#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { listDecks, loadDeck, readSlide } from '../circuit/deck-store.mjs';
import { serveCircuitApi } from '../circuit/live-store.mjs';
import { serveRunApi } from '../circuit/run-api.mjs';
import { serveSessionApi } from '../circuit/identity-session.mjs';

const port = Number.parseInt(process.env.OBSERVER_PORT ?? '8787', 10);

// The circuit consumes database scenes or historical exports and declared observation identities.
const CIRCUIT_DIR = new URL('../circuit/', import.meta.url);
const CIRCUIT_FILES = new Map([
  ['/circuit', ['index.html', 'text/html; charset=utf-8']],
  ['/circuit/', ['index.html', 'text/html; charset=utf-8']],
  ['/circuit/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/circuit/observe-panel.js', ['observe-panel.js', 'text/javascript; charset=utf-8']],
  ['/circuit/circuit-viewer.js', ['circuit-viewer.js', 'text/javascript; charset=utf-8']],
  ['/circuit/navigation.js', ['navigation.js', 'text/javascript; charset=utf-8']],
  ['/circuit/deck-trace.js', ['deck-trace.js', 'text/javascript; charset=utf-8']],
  ['/circuit/execution-cursor.js', ['execution-cursor.js', 'text/javascript; charset=utf-8']],
  ['/circuit/traversal.js', ['traversal.js', 'text/javascript; charset=utf-8']],
  ['/circuit/playback-clock.js', ['playback-clock.js', 'text/javascript; charset=utf-8']],
  ['/circuit/login', ['login.html', 'text/html; charset=utf-8']],
  ['/circuit/login.js', ['login.js', 'text/javascript; charset=utf-8']],
  ['/circuit/session-status.js', ['session-status.js', 'text/javascript; charset=utf-8']],
]);
const ringLimit = 2000;
const maxBodyBytes = 16 * 1024 * 1024;

const ring = [];
const clients = new Set();
const runs = [];
let sequence = 0;
const observerInstance = randomBytes(12).toString('hex');

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function asText(value) {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return null;
}

function clip(value, limit = 96) {
  const text = asText(value);
  if (text === null) return null;
  return text.length > limit ? `${text.slice(0, limit - 1)}\u2026` : text;
}

function normalizeEvent(input) {
  if (!isRecord(input)) return null;
  const kind = asText(input.kind);
  if (kind === 'observation') {
    return { kind, payload: isRecord(input.payload) ? input.payload : {} };
  }
  if (kind === 'run-start' || kind === 'run-end') {
    return { kind, payload: input };
  }
  if (isRecord(input.payload)) {
    return { kind: 'observation', payload: input.payload };
  }
  return { kind: kind ?? 'observation', payload: input };
}

function glyphFor(payload) {
  if (payload.testimonyType === 'cell-execution-testimony.v1') return '\u25c6';
  if (payload.testimonyType === 'edge-execution-testimony.v1') return '\u2192';
  if (payload.observationType === 'delivery-phase') {
    if (payload.status === 'completed') return '\u2713';
    if (payload.status === 'started') return '\u25b6';
    if (payload.status === 'failed') return '\u2717';
    return '\u2022';
  }
  if (payload.observationType === 'command-timing.v1') return '\u23f1';
  return '\u2022';
}

function classFor(payload) {
  if (payload.testimonyType === 'cell-execution-testimony.v1') return 'cell';
  if (payload.testimonyType === 'edge-execution-testimony.v1') return 'edge';
  if (payload.observationType === 'delivery-phase') return 'phase';
  if (payload.observationType === 'command-timing.v1') return 'timing';
  return 'other';
}

// Bounded shape values print compactly: contract plus payload size, or the
// ref digest prefix when the emitter declared the payload over its bound.
function shapeSummary(value) {
  if (!isRecord(value)) return null;
  const contract = clip(value.contractId, 44) ?? '?';
  if (isRecord(value.payloadRef)) {
    const digest = asText(value.payloadRef.digest) ?? '?';
    const bytes = asText(value.payloadRef.byteLength) ?? '?';
    return `${contract} ref(${digest.slice(0, 16)}\u2026 ${bytes}B)`;
  }
  if (value.payload !== undefined) {
    let bytes = 0;
    try {
      bytes = Buffer.byteLength(JSON.stringify(value.payload) ?? '');
    } catch {
      bytes = 0;
    }
    return `${contract} payload(${bytes}B)`;
  }
  return contract;
}

function exchangeShapeSummary(payload) {
  const parts = [];
  if (isRecord(payload.requestShape)) {
    const method = clip(payload.requestShape.method, 12) ?? '?';
    const host = clip(payload.requestShape.host, 44) ?? '?';
    const path = clip(payload.requestShape.path, 44) ?? '';
    const query = Array.isArray(payload.requestShape.query) ? payload.requestShape.query.length : 0;
    const headers = isRecord(payload.requestShape.headers) ? Object.keys(payload.requestShape.headers).length : 0;
    parts.push(`req=${method} ${host}${path} q=${query} h=${headers}`);
  }
  if (isRecord(payload.responseShape)) {
    const status = asText(payload.responseShape.status) ?? '?';
    const bytes = asText(payload.responseShape.byteLength) ?? '?';
    const headers = isRecord(payload.responseShape.headers) ? Object.keys(payload.responseShape.headers).length : 0;
    const body = isRecord(payload.responseShape.bodyRef)
      ? `ref(${clip(payload.responseShape.bodyRef.digest, 18)}\u2026)`
      : payload.responseShape.body !== undefined
        ? `body(${asText(payload.responseShape.body)?.length ?? 0}b64)`
        : 'no-body';
    parts.push(`rsp=${status} ${bytes}B h=${headers} ${body}`);
  }
  if (isRecord(payload.modelResponse)) {
    const model = shapeSummary(payload.modelResponse);
    if (model) parts.push(`model=${model}`);
  }
  return parts;
}

function summarize(kind, payload) {
  if (kind === 'run-start') {
    const pid = asText(payload.nativeProcessId) ?? asText(payload.pid) ?? asText(payload.processId) ?? '?';
    return { glyph: '\u25b6', cls: 'run', text: `pid=${pid}` };
  }
  if (kind === 'run-end') {
    const exitCode = asText(payload.exitCode) ?? '?';
    return { glyph: '\u25a0', cls: 'run', text: `exit=${exitCode}` };
  }
  if (kind !== 'observation') {
    return { glyph: '\u2022', cls: 'other', text: kind };
  }
  const type = asText(payload.testimonyType) ?? asText(payload.observationType) ?? 'observation';
  const parts = [];
  const branch = clip(payload.branchId, 32);
  const cell = clip(payload.cellId ?? payload.cellExecutionId);
  const edge = clip(payload.edgeId ?? payload.sourceCellExecutionId);
  const address = clip(payload.semanticAddress);
  const phase = clip(payload.phase, 40);
  const status = clip(payload.status, 32);
  const disposition = clip(payload.admissionDisposition ?? payload.disposition ?? payload.outcomeVariant, 48);
  if (branch) parts.push(`branch=${branch}`);
  if (cell) parts.push(`cell=${cell}`);
  if (edge) parts.push(`edge=${edge}`);
  if (address) parts.push(`address=${address}`);
  if (phase) parts.push(`phase=${phase}`);
  if (status) parts.push(`status=${status}`);
  if (disposition) parts.push(`disp=${disposition}`);
  const inputShape = shapeSummary(payload.inputShape);
  if (inputShape) parts.push(`in=${inputShape}`);
  const outcomeShape = shapeSummary(payload.outcomeShape);
  if (outcomeShape) parts.push(`out=${outcomeShape}`);
  parts.push(...exchangeShapeSummary(payload));
  if (typeof payload.durationMilliseconds === 'number') parts.push(`dur=${payload.durationMilliseconds}ms`);
  return { glyph: glyphFor(payload), cls: classFor(payload), text: [type, ...parts].join(' ') };
}

function clockOf(date) {
  return date.toISOString().slice(11, 23);
}

function admit(event) {
  const summary = summarize(event.kind, event.payload);
  sequence += 1;
  const receivedAt = new Date();
  const record = {
    seq: sequence,
    observationKey: `sfx-observer:${observerInstance}:${sequence}`,
    receivedAt: receivedAt.toISOString(),
    kind: event.kind,
    glyph: summary.glyph,
    cls: summary.cls,
    text: summary.text,
    payload: event.payload,
  };
  ring.push(record);
  if (ring.length > ringLimit) ring.splice(0, ring.length - ringLimit);
  while (runs.length > 0 && runs[0].endSeq !== null && ring.length > 0 && runs[0].endSeq < ring[0].seq) runs.shift();
  if (record.kind === 'run-start') {
    runs.push({ index: runs.length + 1, startSeq: record.seq, endSeq: null });
  } else if (record.kind === 'run-end' && runs.length > 0 && runs[runs.length - 1].endSeq === null) {
    runs[runs.length - 1].endSeq = record.seq;
  } else if (record.payload?.observationType === 'execution-graph-captured.v1' && runs.length > 0 && runs[runs.length - 1].endSeq === null) {
    // A run is identified by the graph it captured; interleaved reader runs do not replace it.
    runs[runs.length - 1].graphId ??= asText(record.payload.graphId);
  }
  console.log(`[${clockOf(receivedAt)}] ${record.observationKey} ${record.glyph} ${record.kind} ${record.text}`);
  const frame = `data: ${JSON.stringify(record)}\n\n`;
  for (const client of clients) {
    if (client.matcher !== null && !client.matcher(record)) continue;
    try {
      client.res.write(frame);
    } catch {
      clients.delete(client);
    }
  }
  return record;
}

function sendJson(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(text),
  });
  res.end(text);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBodyBytes) {
        reject(new Error('body_too_large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function receive(req, res) {
  let text;
  try {
    text = await readBody(req);
  } catch {
    sendJson(res, 413, { error: 'body_too_large' });
    return;
  }
  let parsed;
  try {
    const cleaned = text.replace(/^\uFEFF/, '').trim();
    parsed = JSON.parse(cleaned.length > 0 ? cleaned : 'null');
  } catch {
    sendJson(res, 400, { error: 'invalid_json' });
    return;
  }
  const items = Array.isArray(parsed) ? parsed : [parsed];
  let accepted = 0;
  for (const item of items) {
    const event = normalizeEvent(item);
    if (event === null) continue;
    admit(event);
    accepted += 1;
  }
  sendJson(res, 202, { accepted, sequence });
}

// Per-run scoping: a run spans its run-start through its run-end (an open run
// stays open). `run=current` (or `last`) selects the most recent run, an
// ordinal selects the nth run, and `run=next` waits for the next run-start.
// `run=current`/ordinal replay that run's ring records; a new SSE client with
// no parameters is live-only and never receives an earlier run's events.
// `graphId` narrows `run=current` to the most recent run that captured that graph.
function parseRunSelector(raw) {
  if (raw === null) return null;
  const value = raw.trim().toLowerCase();
  if (value === 'current' || value === 'last') return { kind: 'current' };
  if (value === 'next') return { kind: 'next' };
  const ordinal = Number.parseInt(value, 10);
  return Number.isInteger(ordinal) && ordinal > 0 && String(ordinal) === value
    ? { kind: 'ordinal', value: ordinal }
    : undefined;
}

function createRunMatcher(selector, graphId = null) {
  let selected = null;
  const resolve = () => selector.kind === 'current'
    ? (graphId === null ? runs.at(-1) : runs.findLast(run => run.graphId === graphId)) ?? null
    : runs[selector.value - 1] ?? null;
  if (selector.kind !== 'next') selected = resolve();
  return (record) => {
    if (selected === null) {
      if (record.kind !== 'run-start') return false;
      selected = selector.kind === 'next' ? runs[runs.length - 1] ?? null : resolve();
      if (selected === null) return false;
    }
    if (record.seq < selected.startSeq) return false;
    if (selected.endSeq !== null && record.seq > selected.endSeq) return false;
    return true;
  };
}

function openStream(req, res, url) {
  const sinceRaw = url.searchParams.get('since');
  const selector = parseRunSelector(url.searchParams.get('run'));
  if (selector === undefined) {
    sendJson(res, 400, { error: 'invalid_run' });
    return;
  }
  let since = null;
  if (sinceRaw !== null) {
    since = Number.parseInt(sinceRaw, 10);
    if (!Number.isInteger(since) || since < 0) {
      sendJson(res, 400, { error: 'invalid_since' });
      return;
    }
  }
  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'x-observer-instance': observerInstance,
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    'access-control-allow-origin': '*',
  });
  res.write('retry: 3000\n\n');
  const matcher = selector === null ? null : createRunMatcher(selector, url.searchParams.get('graphId'));
  // Replay is explicit: `since` names the last sequence the client already
  // has, and a run selector replays that run. A bare `/events` is live-only.
  // `run=next` has nothing historical to replay by definition.
  if (selector?.kind !== 'next' && (since !== null || selector !== null)) {
    for (const record of ring) {
      if (since !== null && record.seq <= since) continue;
      if (matcher !== null && !matcher(record)) continue;
      res.write(`data: ${JSON.stringify(record)}\n\n`);
    }
  }
  const client = { res, matcher };
  clients.add(client);
  req.on('close', () => clients.delete(client));
}

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SFX live observation timeline</title>
<style>
  body { font-family: ui-monospace, Consolas, "Courier New", monospace; background: #0b0e14; color: #d7dae0; margin: 0; padding: 16px; }
  h1 { font-size: 15px; font-weight: 600; margin: 0 0 4px; }
  #status { color: #8f98a8; font-size: 12px; margin-bottom: 12px; }
  ol { list-style: none; padding: 0; margin: 0; }
  li { padding: 2px 0; white-space: pre-wrap; word-break: break-all; border-bottom: 1px solid #161a22; font-size: 13px; }
  .phase { color: #93c5fd; } .cell { color: #fbbf24; } .edge { color: #f472b6; }
  .timing { color: #8f98a8; } .run { color: #6ee7b7; } .other { color: #d7dae0; }
</style>
</head>
<body>
<h1>SFX live observation timeline</h1>
<div id="status">Connecting to live events; past events are not loaded.</div>
<ol id="timeline"></ol>
<script>
  var statusLine = document.getElementById('status');
  var timeline = document.getElementById('timeline');
  var total = 0;
  function stamp(iso) {
    var at = new Date(iso);
    return at.toLocaleTimeString('en-GB', { hour12: false }) + '.' + String(at.getMilliseconds()).padStart(3, '0');
  }
  function add(record) {
    var li = document.createElement('li');
    li.className = record.cls || 'other';
    li.textContent = '[' + stamp(record.receivedAt) + '] ' + record.observationKey + ' ' + record.glyph + ' ' + record.kind + ' ' + record.text;
    li.title = JSON.stringify(record.payload);
    timeline.appendChild(li);
    total += 1;
    statusLine.textContent = 'Connected - ' + total + ' live events';
    while (timeline.childNodes.length > 2000) timeline.removeChild(timeline.firstChild);
    window.scrollTo(0, document.body.scrollHeight);
  }
  var source = new EventSource('/events');
  source.onopen = function () { statusLine.textContent = total ? 'Connected - ' + total + ' live events' : 'Connected; waiting for live events.'; };
  source.onerror = function () { statusLine.textContent = 'Event stream disconnected; reconnecting...'; };
  source.onmessage = function (message) {
    try { add(JSON.parse(message.data)); } catch (error) {}
  };
</script>
</body>
</html>
`;

const handleRequest = async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://localhost:${port}`);
    if (await serveSessionApi(req, res, url)) return;
    if (await serveRunApi(req, res, url)) return;
    if (await serveCircuitApi(req, res, url)) return;
    if (req.method === 'GET' && url.pathname === '/circuit/decks') {
      sendJson(res, 200, { decks: await listDecks() });
      return;
    }
    if (req.method === 'GET' && url.pathname === '/circuit/deck') {
      sendJson(res, 200, await loadDeck(url.searchParams.get('id'), url.searchParams.get('refresh') === '1'));
      return;
    }
    if (req.method === 'GET' && url.pathname === '/circuit/deck-slide') {
      const body = await readSlide(url.searchParams.get('id'), Number(url.searchParams.get('slide')));
      res.writeHead(200, { 'content-type': 'image/svg+xml', 'cache-control': 'no-store', 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'" });
      res.end(body);
      return;
    }
    if (req.method === 'GET' && url.pathname === '/health') {
      sendJson(res, 200, { status: 'ok' });
      return;
    }
    if (req.method === 'GET' && url.pathname === '/events') {
      openStream(req, res, url);
      return;
    }
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(page);
      return;
    }
    if (req.method === 'POST' && (url.pathname === '/events' || url.pathname === '/events/batch')) {
      await receive(req, res);
      return;
    }
    if (req.method === 'GET' && CIRCUIT_FILES.has(url.pathname)) {
      const [file, type] = CIRCUIT_FILES.get(url.pathname);
      const body = await readFile(new URL(file, CIRCUIT_DIR));
      res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' });
      res.end(body);
      return;
    }
    sendJson(res, 404, { error: 'not_found' });
  } catch {
    try {
      sendJson(res, 500, { error: 'internal_error' });
    } catch {
      /* the response is already gone */
    }
  }
};

// localhost resolves to ::1 before 127.0.0.1 on Windows, and .NET carriers do
// not fall back before their timeout, so both loopback families are served.
const server4 = http.createServer(handleRequest);
const server6 = http.createServer(handleRequest);
let ready = false;
const reportReady = () => {
  if (ready) return;
  ready = true;
  console.log(`OBSERVER_READY http://localhost:${port}`);
};
const fatal = (error) => {
  console.error(`OBSERVER_ERROR ${error.message}`);
  process.exit(1);
};
server4.on('error', fatal);
server6.on('error', (error) => {
  if (error.code === 'EADDRINUSE') fatal(error);
  else console.error(`OBSERVER_WARN ipv6 loopback unavailable: ${error.code ?? error.message}`);
});
server6.listen(port, '::1', reportReady);
server4.listen(port, '127.0.0.1', reportReady);

const keepAlive = setInterval(() => {
  for (const client of clients) {
    try {
      client.res.write(': keep-alive\n\n');
    } catch {
      clients.delete(client);
    }
  }
}, 15000);
keepAlive.unref();

const shutdown = () => {
  console.log('OBSERVER_STOP');
  clearInterval(keepAlive);
  for (const client of clients) client.res.end();
  for (const listener of [server4, server6]) {
    try {
      listener.close();
    } catch {
      /* listener already closed */
    }
  }
  setTimeout(() => process.exit(0), 500).unref();
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
