#!/usr/bin/env node
// HTTP transport only. The SDA API owns admission, execution and domain output.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { randomUUID } from 'node:crypto';

const help = `Usage:
  sfx-api capability observe <identity> --input <text|JSON|@file.json> --json [--trace]
  sfx-api run <runId> --json [--trace]

Options:
  --input-type text|json   Explicit input encoding; otherwise JSON is detected
  --namespace <name>      Optional namespace accepted by the SDA API
  --endpoint <URL>        Override SFX_API_ENDPOINT or the installed profile
  --timeout <seconds>     Client wait limit (default 630); does not cancel the server
  --idempotency-key <key> Reuse a retained API admission instead of starting another
  --trace                 Save received API events to a per-run NDJSON file
  --json                  Print the unchanged scenario JSON (default output)
  --help                  Show this help

SFX_API_TOKEN (or SDA_API_TOKEN) overrides the Windows encrypted profile token.
SFX_API_CONFIG selects a profile; SFX_API_TRACE_DIRECTORY selects the trace folder.
The installed command has no checkout, database or local kernel dependency.
`;

export function parseCommand(argv) {
  const { values, positionals } = parseArgs({ args: argv, allowPositionals: true, options: {
    input: { type: 'string' }, 'input-type': { type: 'string' }, namespace: { type: 'string' },
    endpoint: { type: 'string' }, timeout: { type: 'string', default: '630' },
    'idempotency-key': { type: 'string' }, json: { type: 'boolean' }, trace: { type: 'boolean' },
    help: { type: 'boolean', short: 'h' }
  } });
  if (values.help) return { help: true };
  const resume = positionals[0] === 'run' && positionals.length === 2;
  if (!resume && !(positionals.length === 3 && positionals[0] === 'capability' && positionals[1] === 'observe'))
    throw new Error('Use: sfx-api capability observe <identity> --input <text> --json [--trace]');
  if (resume && ['input', 'input-type', 'namespace', 'idempotency-key'].some(key => values[key] !== undefined))
    throw new Error('The run command reads an existing run; submission options are not accepted.');
  const timeout = Number(values.timeout) * 1000;
  if (!Number.isFinite(timeout) || timeout <= 0 || timeout > 86400000) throw new Error('--timeout must be between 0 and 86400 seconds.');
  const inputType = values['input-type'];
  if (inputType && !['text', 'json'].includes(inputType)) throw new Error('--input-type must be text or json.');
  let input = {};
  if (values.input !== undefined) {
    const file = values.input.startsWith('@') && inputType !== 'text';
    const raw = file ? fs.readFileSync(values.input.slice(1), 'utf8').replace(/^\uFEFF/, '') : values.input;
    if (inputType === 'text') input = raw;
    else { try { input = JSON.parse(raw); } catch { if (file || inputType === 'json') throw new Error('Input is not valid JSON.'); input = raw; } }
  }
  return { ...values, timeout, resume, runId: resume ? positionals[1] : undefined,
    submission: resume ? undefined : { object: 'capability', operation: 'observe', subject: positionals[2],
      ...(values.namespace ? { namespace: values.namespace } : {}), input } };
}

export function normalizeEndpoint(value) {
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash) throw new Error('Endpoint must not contain credentials, a query or a fragment.');
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))
    throw new Error('Use HTTPS, or HTTP on loopback for a local API.');
  return url.href.replace(/\/+$/, '');
}

function configuration(options) {
  const root = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), '.local/share'), 'sfx', 'api-client');
  const configPath = process.env.SFX_API_CONFIG || path.join(root, 'config.json');
  const profile = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, 'utf8').replace(/^\uFEFF/, '')) : {};
  const endpointValue = options.endpoint || process.env.SFX_API_ENDPOINT || profile.endpoint;
  if (!endpointValue) throw new Error('Set SFX_API_ENDPOINT or install an API profile.');
  const endpoint = normalizeEndpoint(endpointValue);
  let token = process.env.SFX_API_TOKEN || process.env.SDA_API_TOKEN;
  if (!token && process.platform === 'win32' && profile.credentialFile && profile.endpoint && normalizeEndpoint(profile.endpoint) === endpoint) {
    token = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File',
      fileURLToPath(new URL('./credential.ps1', import.meta.url)), '-Path', path.resolve(path.dirname(configPath), profile.credentialFile)],
      { encoding: 'utf8', windowsHide: true, env: { ...process.env, PSModulePath: undefined }, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  }
  if (!token) throw new Error('No API token for this endpoint. Set SFX_API_TOKEN or install its encrypted profile.');
  return { endpoint, token, traceDirectory: process.env.SFX_API_TRACE_DIRECTORY || path.join(root, 'traces') };
}

export async function execute(options, config, io = { out: value => process.stdout.write(value), err: value => process.stderr.write(value) }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('Client wait timed out; the remote run was not cancelled.')), options.timeout);
  const interrupt = () => controller.abort(new Error('Client interrupted; the remote run was not cancelled.'));
  process.once('SIGINT', interrupt);
  let runId = options.runId, trace, tracePath;
  const request = async (route, init = {}) => {
    const response = await fetch(config.endpoint + route, { ...init, redirect: 'error', signal: controller.signal,
      headers: { authorization: `Bearer ${config.token}`, ...(init.body ? { 'content-type': 'application/json' } : {}), ...init.headers } });
    const body = await response.text();
    let data; try { data = JSON.parse(body); } catch { throw new Error(`API returned non-JSON (${response.status}).`); }
    if (!response.ok) throw new Error(`${data.error?.code || 'HTTP_' + response.status}: ${data.error?.message || 'API request failed.'}`);
    return data;
  };
  try {
    if (!runId) {
      // Never retry this POST automatically: an uncertain response may already own a run.
      const key = options['idempotency-key'] || randomUUID();
      let admitted;
      try { admitted = await request('/v1/runs', { method: 'POST', headers: { 'idempotency-key': key }, body: JSON.stringify(options.submission) }); }
      catch (error) { throw new Error(`${error.message} Admission key: ${key}. Reuse it if retrying against this running API host.`); }
      if (typeof admitted.runId !== 'string' || !admitted.runId) throw new Error('API admission did not return a runId.');
      runId = admitted.runId;
    }
    const runPath = '/v1/runs/' + encodeURIComponent(runId);
    if (options.trace) {
      fs.mkdirSync(config.traceDirectory, { recursive: true });
      tracePath = path.join(config.traceDirectory, `${encodeURIComponent(runId)}-${Date.now()}.ndjson`);
      trace = fs.openSync(tracePath, 'wx', 0o600);
      io.err(`[sfx-api] Run ${runId}; trace: ${tracePath}\n`);
    }
    let cursor = 0, terminal = false;
    // Read the API's event cursor; receipt timestamps stay exactly as captured.
    // Only reads repeat. No synthetic events, local invocation or domain interpretation.
    while (!terminal) {
      if (options.trace) {
        let page;
        do {
          page = await request(`${runPath}/events?after=${cursor}&limit=500`);
          if (!Array.isArray(page.events) || !Number.isSafeInteger(page.nextCursor)) throw new Error('Invalid API event page.');
          if (page.gap) {
            fs.writeSync(trace, JSON.stringify({ kind: 'sfx-api.trace-gap', runId, gap: page.gap }) + '\n');
            io.err(`[sfx-api] Trace gap: requested ${page.gap.requestedAfter}, oldest ${page.gap.oldestCursor}.\n`);
          }
          for (const event of page.events) fs.writeSync(trace, JSON.stringify(event) + '\n');
          if (page.hasMore && page.nextCursor <= cursor) throw new Error('API event cursor did not advance.');
          cursor = page.nextCursor;
          terminal = page.terminal === true;
        } while (page.hasMore);
      } else {
        const state = await request(runPath);
        terminal = ['completed', 'failed'].includes(state.state);
      }
      if (!terminal) await new Promise(resolve => setTimeout(resolve, 250));
    }
    const state = await request(runPath);
    if (state.output?.available) {
      const output = await request(runPath + '/output');
      io.out(JSON.stringify(output) + '\n');
    } else throw new Error(state.failure?.message || 'Remote run ended without an available scenario output.');
    if (state.state === 'failed' || state.exitCode !== 0) {
      io.err(`[sfx-api] Remote run ${runId} failed${state.failure?.code ? ': ' + state.failure.code : ''}.\n`);
      return { runId, tracePath, exitCode: Number.isInteger(state.exitCode) && state.exitCode > 0 && state.exitCode < 256 ? state.exitCode : 1 };
    }
    return { runId, tracePath, exitCode: 0 };
  } catch (error) {
    const message = String(error.message).split(config.token).join('[redacted]');
    throw new Error(message + (runId ? ` Resume with: sfx-api run ${runId} --json${options.trace ? ' --trace' : ''}` : ''));
  } finally {
    clearTimeout(timer);
    process.removeListener('SIGINT', interrupt);
    if (trace !== undefined) fs.closeSync(trace);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    // PowerShell 5.1 loses JSON quotes in native argv; the shim carries argv intact.
    const argv = process.env.SFX_API_ARGV_B64 ? JSON.parse(Buffer.from(process.env.SFX_API_ARGV_B64, 'base64').toString('utf8')) : process.argv.slice(2);
    delete process.env.SFX_API_ARGV_B64;
    const options = parseCommand(argv);
    if (options.help) process.stdout.write(help);
    else process.exitCode = (await execute(options, configuration(options))).exitCode;
  } catch (error) { process.stderr.write(`[sfx-api] ${error.message}\n`); process.exitCode = 1; }
}
