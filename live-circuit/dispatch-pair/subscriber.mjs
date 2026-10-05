#!/usr/bin/env node
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { spawn } from 'node:child_process';

const OBSERVATION_PREFIX = 'SFX_OBSERVATION ';
const FALLBACK_ARTIFACT = '281af915b0dd2b4fc6fd417d6432c653dd2ff94639b9581dfdfd85fa716340fd';
const localAppData = process.env.LOCALAPPDATA ?? path.join(os.homedir(), 'AppData', 'Local');
const kernelBase = path.join(localAppData, 'sfx', 'kernel');
const explicitRoot = path.join(kernelBase, FALLBACK_ARTIFACT);

const capabilityId = process.argv[2];
const input = process.argv[3] ?? '{}';
const port = Number.parseInt(process.env.SUBSCRIBER_PORT ?? '8787', 10);

if (!capabilityId) {
  console.error('usage: node subscriber.mjs <capabilityId> [inputJson]');
  process.exit(2);
}

function findKernelRoot() {
  let best = null;
  try {
    for (const entry of fs.readdirSync(kernelBase, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const dir = path.join(kernelBase, entry.name);
      const manifestPath = path.join(dir, 'kernel-install-manifest.json');
      let manifest;
      try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      } catch {
        continue;
      }
      if (manifest.kernelLanguage !== 'csharp') continue;
      const published = Date.parse(manifest.publishedAt ?? '') || fs.statSync(manifestPath).mtimeMs;
      if (!best || published > best.published) best = { dir, manifest, published };
    }
  } catch (error) {
    console.error(`[subscriber] kernel discovery failed: ${error.message}`);
  }
  if (best) return { ...best, source: 'discovered' };
  return { dir: explicitRoot, manifest: null, published: 0, source: 'explicit' };
}

const kernel = findKernelRoot();
const entryPoint = kernel.manifest?.entryPoint ?? 'KernelEntry.exe';
const entryArgs = kernel.manifest?.entryArgs ?? ['--stdin-envelope', '--config', 'kernel-host.json'];
const configIndex = entryArgs.indexOf('--config');
const configArgs = configIndex >= 0 && entryArgs[configIndex + 1] !== undefined
  ? ['--config', entryArgs[configIndex + 1]]
  : ['--config', 'kernel-host.json'];
const entryPath = path.join(kernel.dir, entryPoint);
const childArgs = ['capability', 'observe', capabilityId, '--input', input, '--json', ...configArgs];

const clients = new Set();
const history = [];
const startedAt = performance.now();
const elapsedNow = () => Math.round(performance.now() - startedAt);

function emit(type, payload) {
  const record = { type, at: new Date().toISOString(), elapsedMs: elapsedNow(), ...payload };
  history.push(record);
  const frame = `event: ${type}\ndata: ${JSON.stringify(record)}\n\n`;
  for (const client of clients) {
    try {
      client.write(frame);
    } catch {
      clients.delete(client);
    }
  }
  return record;
}

function glyphFor(event) {
  if (event.testimonyType === 'cell-execution-testimony.v1') return '\u25c6';
  if (event.testimonyType === 'edge-execution-testimony.v1') return '\u2192';
  if (event.observationType === 'delivery-phase') {
    if (event.status === 'completed') return '\u2713';
    if (event.status === 'started') return '\u25b6';
    if (event.status === 'failed') return '\u2717';
    return '\u2022';
  }
  if (event.observationType === 'command-timing.v1') return '\u23f1';
  return '\u2022';
}

function classFor(event) {
  if (event.testimonyType === 'cell-execution-testimony.v1') return 'cell';
  if (event.testimonyType === 'edge-execution-testimony.v1') return 'edge';
  if (event.observationType === 'delivery-phase') return 'phase';
  return 'ev';
}

function summarizeObservation(event) {
  const type = event.observationType ?? event.testimonyType ?? 'observation';
  const fields = [];
  if (event.semanticRole) fields.push(`role=${event.semanticRole}`);
  if (event.phase) fields.push(`phase=${event.phase}`);
  const status = event.status ?? event.disposition ?? event.admissionDisposition;
  if (status) fields.push(`status=${status}`);
  if (event.subject) fields.push(`subject=${event.subject}`);
  if (event.cellId) fields.push(`cellId=${event.cellId}`);
  if (event.edgeId) fields.push(`edgeId=${event.edgeId}`);
  if (typeof event.durationMilliseconds === 'number') fields.push(`duration=${event.durationMilliseconds}ms`);
  return {
    glyph: glyphFor(event),
    cls: classFor(event),
    text: fields.length > 0 ? `${type} ${fields.join(' ')}` : type,
  };
}

const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SFX observation timeline</title>
<style>
  body { font-family: ui-monospace, Consolas, "Courier New", monospace; background: #0b0e14; color: #d7dae0; margin: 0; padding: 16px; }
  h1 { font-size: 15px; font-weight: 600; margin: 0 0 4px; }
  #status { color: #8f98a8; font-size: 12px; margin-bottom: 12px; }
  ol { list-style: none; padding: 0; margin: 0; }
  li { padding: 2px 0; white-space: pre-wrap; word-break: break-all; border-bottom: 1px solid #161a22; font-size: 13px; }
  .t { color: #8f98a8; } .ev { color: #6ee7b7; } .phase { color: #93c5fd; }
  .cell { color: #fbbf24; } .edge { color: #f472b6; } .final { color: #a78bfa; } .exit { color: #f87171; }
  pre { background: #11151d; padding: 10px; overflow: auto; max-height: 45vh; font-size: 12px; }
</style>
</head>
<body>
<h1>SFX observation timeline</h1>
<div id="status">connecting\u2026</div>
<ol id="timeline"></ol>
<pre id="final" hidden></pre>
<script>
  var status = document.getElementById('status');
  var timeline = document.getElementById('timeline');
  var finalBox = document.getElementById('final');
  function add(cls, text) {
    var li = document.createElement('li');
    li.className = cls;
    li.textContent = text;
    timeline.appendChild(li);
    window.scrollTo(0, document.body.scrollHeight);
  }
  function dataOf(message) {
    try { return JSON.parse(message.data); } catch (error) { return null; }
  }
  var events = new EventSource('/events');
  events.onopen = function () { status.textContent = 'connected'; };
  events.onerror = function () { status.textContent = 'reconnecting\u2026'; };
  events.addEventListener('spawn', function (message) {
    var data = dataOf(message);
    if (data) add('ev', '[+' + data.elapsedMs + 'ms] \\u21e2 spawn ' + data.command + ' ' + data.arguments.join(' '));
  });
  events.addEventListener('observation', function (message) {
    var data = dataOf(message);
    if (data) add(data.cls, '[+' + String(data.elapsedMs).padStart(6) + 'ms] ' + data.glyph + ' ' + data.text);
  });
  events.addEventListener('final', function (message) {
    var data = dataOf(message);
    if (!data) return;
    finalBox.hidden = false;
    finalBox.textContent = 'FINAL ' + JSON.stringify(data.final, null, 2);
    add('final', '[+' + data.elapsedMs + 'ms] \\u25a3 final stdout JSON (' + data.stdoutBytes + ' bytes)');
  });
  events.addEventListener('exit', function (message) {
    var data = dataOf(message);
    if (data) add('exit', '[+' + data.elapsedMs + 'ms] \\u25a0 exit code ' + data.code);
    events.close();
    status.textContent = 'complete';
  });
</script>
</body>
</html>
`;

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${port}`);
  if (req.method === 'GET' && url.pathname === '/events') {
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'access-control-allow-origin': '*',
    });
    res.write('retry: 3000\n\n');
    for (const record of history) {
      res.write(`event: ${record.type}\ndata: ${JSON.stringify(record)}\n\n`);
    }
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(PAGE);
    return;
  }
  res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ error: 'not_found' }));
});

server.on('error', (error) => {
  console.error(`[subscriber] server error: ${error.message}`);
  process.exit(1);
});

const keepAlive = setInterval(() => {
  for (const client of clients) {
    try {
      client.write(': keep-alive\n\n');
    } catch {
      clients.delete(client);
    }
  }
}, 15000);

let child = null;

function startChild() {
  console.log(`[subscriber] kernel root (${kernel.source}) ${kernel.dir}`);
  console.log(`[subscriber] capability=${capabilityId} input=${input}`);
  console.log(`[subscriber] exec ${entryPath} ${childArgs.join(' ')}`);

  child = spawn(entryPath, childArgs, {
    cwd: kernel.dir,
    env: { ...process.env, SIDEFX_OBSERVE: '1' },
    windowsHide: true,
  });

  emit('spawn', {
    command: entryPath,
    arguments: childArgs,
    cwd: kernel.dir,
    pid: child.pid ?? null,
    capabilityId,
    input,
  });

  let stdoutText = '';
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    stdoutText += chunk;
  });

  const lines = readline.createInterface({
    input: child.stderr,
    crlfDelay: Number.POSITIVE_INFINITY,
  });
  lines.on('line', (line) => {
    if (!line.startsWith(OBSERVATION_PREFIX)) return;
    const payload = line.slice(OBSERVATION_PREFIX.length);
    let event;
    try {
      event = JSON.parse(payload);
    } catch (error) {
      console.error(`[subscriber] malformed observation line (${payload.length} chars): ${payload.slice(0, 200)}`);
      emit('malformed', { chars: payload.length, excerpt: payload.slice(0, 200) });
      return;
    }
    const summary = summarizeObservation(event);
    const entry = emit('observation', {
      glyph: summary.glyph,
      text: summary.text,
      cls: summary.cls,
      event,
    });
    console.log(`[+${String(entry.elapsedMs).padStart(6)}ms] ${summary.glyph} ${summary.text}`);
  });

  child.on('error', (error) => {
    console.error(`[subscriber] spawn failed: ${error.message}`);
    emit('spawn-error', { message: error.message });
  });

  child.on('close', (code, signal) => {
    lines.close();
    const elapsedMs = elapsedNow();
    let final = null;
    if (stdoutText.trim().length > 0) {
      try {
        final = JSON.parse(stdoutText);
      } catch (error) {
        console.error(`[subscriber] stdout was not valid JSON: ${error.message}`);
        final = { unparsed: stdoutText };
      }
    }
    emit('final', { final, stdoutBytes: stdoutText.length });
    emit('exit', { code, signal, elapsedMs });
    console.log(`[subscriber] child exit code=${code} signal=${signal ?? 'none'} after ${elapsedMs}ms`);
    if (final !== null) {
      const summary = final && typeof final === 'object'
        ? `keys=${Object.keys(final).join(',')} capabilityId=${final.capabilityId ?? '?'} scenarioId=${final.scenarioId ?? '?'}`
        : `value=${JSON.stringify(final)}`;
      console.log(`[subscriber] final ${summary}`);
      console.log(`FINAL_JSON ${JSON.stringify(final)}`);
    }
  });
}

function shutdown() {
  console.log('[subscriber] shutting down');
  clearInterval(keepAlive);
  if (child !== null && child.exitCode === null) child.kill();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 500).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

server.listen(port, '127.0.0.1', () => {
  console.log(`SUBSCRIBER_READY http://localhost:${port}`);
  startChild();
});
