// Development only: explicit built API and estate, per-launch machine token.
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';

const [apiArgument, estateArgument, identityArgument, observerArgument = '8788', apiPortArgument = '8799', extra] = process.argv.slice(2);
if (!apiArgument || !estateArgument || !identityArgument || extra !== undefined)
  throw new Error('Expected built-api-src-directory estate-directory identity-origin [observer-port=8788] [api-port=8799]');
const api = path.resolve(apiArgument), estate = path.resolve(estateArgument);
const origin = new URL(identityArgument);
if (origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash ||
    !(origin.protocol === 'https:' || origin.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname)))
  throw new Error('HTTPS_OR_LOOPBACK_IDENTITY_ORIGIN_REQUIRED');
const observerPort = Number(observerArgument), apiPort = Number(apiPortArgument);
if (![observerPort, apiPort].every(p => Number.isInteger(p) && p > 0 && p <= 65535) || observerPort === apiPort)
  throw new Error('DISTINCT_VALID_PORTS_REQUIRED');
for (const name of ['config.js', 'server.js', 'supervisor.js'])
  if (!fs.statSync(path.join(api, name)).isFile()) throw new Error('BUILT_SDA_API_REQUIRED');
const config = JSON.parse(fs.readFileSync(path.join(estate, 'sfx.config.json'), 'utf8'));
if (!config.deliveries?.['database-memory']?.args?.includes('--stdin-envelope')) throw new Error('INSTALLED_KERNEL_DELIVERY_REQUIRED');
for (const port of [observerPort, apiPort]) await new Promise((resolve, reject) => {
  const probe = net.createServer(); probe.once('error', reject);
  probe.listen(port, '127.0.0.1', () => probe.close(resolve));
});
const platform = fileURLToPath(new URL('../../', import.meta.url));
const token = randomBytes(32).toString('base64url');
const inherited = { ...process.env };
for (const name of Object.keys(inherited))
  if (/^(SDA_API_TOKEN|SFX_API_TOKEN|SFX_VAULT_UNLOCK|IDENTITY_HEADER|MSI_SECRET|SFX_IDENTITY_CONNECTION_STRING|SFX_IDENTITY_SERVICE_KEY|PROCEDURE_EXTRACT_CONNECTION_STRING)$/i.test(name)) delete inherited[name];
const children = []; let stopping = false;
function stop(code = 0) {
  if (stopping) return; stopping = true;
  for (const child of children) if (child.exitCode === null && child.pid) {
    if (process.platform === 'win32') spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    else child.kill('SIGTERM');
  }
  process.exitCode = code;
}
function start(name, entry, args, additions) {
  const child = spawn(process.execPath, [entry, ...args], {
    cwd: platform, env: { ...inherited, SDA_ESTATE_DIR: estate, SDA_API_TOKEN: token, ...additions },
    windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']
  });
  children.push(child);
  for (const stream of [child.stdout, child.stderr])
    createInterface({ input: stream }).on('line', line => console.log(`[${name}] ${line.replaceAll(token, '[token]')}`));
  child.on('error', error => { console.error(`${name}: ${error.code ?? 'START_FAILED'}`); stop(1); });
  child.on('exit', code => { if (!stopping) { console.error(`${name}: exited ${code}`); stop(code || 1); } });
}
async function ready(url, status, headers = {}) {
  for (let attempt = 0; attempt < 60 && !stopping; attempt++) {
    try { const response = await fetch(url, { headers, signal: AbortSignal.timeout(1000) }); await response.body?.cancel(); if (response.status === status) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('LOCAL_STACK_START_TIMEOUT');
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stop());
try {
  start('observer', path.join(platform, 'live-circuit/dispatch-pair/observe-server.mjs'), [], {
    OBSERVER_PORT: String(observerPort), SDA_API_ENDPOINT: `http://127.0.0.1:${apiPort}`, SFX_IDENTITY_ENDPOINT: origin.origin
  });
  await ready(`http://127.0.0.1:${observerPort}/health`, 200);
  start('api', fileURLToPath(new URL('./api-host.mjs', import.meta.url)), [api], {
    SDA_API_HOST: '127.0.0.1', SDA_API_PORT: String(apiPort),
    SFX_OBSERVER_ENDPOINT: `http://127.0.0.1:${observerPort}/events`,
    SDA_RUN_EVENT_RETENTION: '20000', SDA_OUTPUT_BYTE_CAP: '16777216'
  });
  await ready(`http://127.0.0.1:${apiPort}/v1/runs/ready`, 404, { authorization: `Bearer ${token}` });
  console.log(`LOCAL_CIRCUIT_READY http://localhost:${observerPort}/circuit (API ${apiPort}; Ctrl+C stops owned processes)`);
} catch (error) { console.error(error.code ?? error.message); stop(1); }
