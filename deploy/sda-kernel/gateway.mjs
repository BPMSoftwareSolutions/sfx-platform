import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { createHash, timingSafeEqual } from 'node:crypto';

const release = JSON.parse(fs.readFileSync('/opt/sfx/release.json', 'utf8'));
const unlock = process.env.SFX_VAULT_UNLOCK;
const token = process.env.SDA_API_TOKEN;
const retrievalConnection = process.env.PROCEDURE_EXTRACT_CONNECTION_STRING;
const identityConnection = process.env.SFX_IDENTITY_CONNECTION_STRING;
const identityServiceKey = process.env.SFX_IDENTITY_SERVICE_KEY;
delete process.env.PROCEDURE_EXTRACT_CONNECTION_STRING;
delete process.env.SFX_IDENTITY_CONNECTION_STRING;
delete process.env.SFX_IDENTITY_SERVICE_KEY;
if (!unlock || unlock.startsWith('@Microsoft.KeyVault(') || !token) throw new Error('VAULT_OR_API_AUTH_NOT_CONFIGURED');
delete process.env.SFX_VAULT_UNLOCK;
const data = path.join(process.env.HOME, '.local/share');
fs.mkdirSync(data, { recursive: true, mode: 0o700 });
if (!fs.existsSync(path.join(data, 'sfx/vault/vault.json'))) {
  // This bundle contains ciphertext and key references only. The unlock secret
  // is supplied independently by the staging identity's Key Vault reference.
  const restored = spawnSync('tar', ['-xzf', '/opt/sfx/vault-bootstrap.tar.gz', '-C', data]);
  if (restored.status !== 0) throw new Error('VAULT_BOOTSTRAP_FAILED');
}
const bus = spawnSync('dbus-daemon', ['--session', '--fork', '--print-address=1'], { encoding: 'utf8' });
if (bus.status !== 0) throw new Error('SECRET_SERVICE_BUS_FAILED');
process.env.DBUS_SESSION_BUS_ADDRESS = bus.stdout.trim();
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  setTimeout(() => process.exit(code), 1000).unref();
}
function launch(command, args, cwd, additions = {}, omit = []) {
  const environment = { ...process.env, ...additions };
  for (const name of omit) delete environment[name];
  const child = spawn(command, args, { cwd, env: environment, stdio: 'inherit' });
  children.push(child);
  child.on('error', () => stop(1));
  child.on('exit', code => { if (!stopping) stop(code || 1); });
  return child;
}
// Unix sockets belong on the container's local filesystem. App Service's
// persistent /home mount holds ciphertext, but cannot host the control socket.
const control = fs.mkdtempSync(path.join(os.tmpdir(), 'sfx-keyring-'));
process.env.XDG_RUNTIME_DIR = control;
const keyring = spawn('gnome-keyring-daemon', ['--foreground', '--unlock', '--components=secrets', '--control-directory=' + control],
  { env: process.env, stdio: ['pipe', 'inherit', 'inherit'] });
children.push(keyring);
keyring.on('error', () => stop(1));
keyring.on('exit', () => { if (!stopping) stop(1); });
keyring.stdin.end(unlock);
const keyReference = createHash('sha256').update(path.join(data, 'sfx/vault').toLowerCase()).digest('hex').slice(0, 32);
let vaultReady = false;
for (let attempt = 0; attempt < 10 && !vaultReady; attempt++) {
  await new Promise(resolve => setTimeout(resolve, 200));
  const probe = spawnSync('secret-tool', ['lookup', 'service', 'sfx-credential-vault', 'key', keyReference],
    { encoding: 'utf8', timeout: 3000 });
  vaultReady = probe.status === 0 && probe.stdout.trim().length > 0;
}
if (!vaultReady) { stop(1); throw new Error('VAULT_MASTER_KEY_UNAVAILABLE'); }
if (!retrievalConnection || retrievalConnection.startsWith('@Microsoft.KeyVault(')) throw new Error('RETRIEVAL_CONNECTION_NOT_CONFIGURED');
const retrievalPolicy = JSON.parse(fs.readFileSync('/opt/sfx/host/retrieval-policy.json', 'utf8'));
launch('/opt/sfx/procedure-extract/procedure-extract', ['--serve', '--url', 'http://127.0.0.1:8791'], '/opt/sfx/procedure-extract', {
  'sidefx-connection-string': retrievalConnection,
  PROCEDURE_EXTRACT_ALLOWED_PROCEDURES: retrievalPolicy.allowedProcedures.join(',')
}, ['SDA_API_TOKEN', 'IDENTITY_HEADER', 'MSI_SECRET']);
launch(process.execPath, ['demo/dispatch-pair/observe-server.mjs'], '/opt/sfx/estate',
  { SDA_API_ENDPOINT: 'http://127.0.0.1:8799', PROCEDURE_EXTRACT_ENDPOINT: 'http://127.0.0.1:8791' }, ['IDENTITY_HEADER', 'MSI_SECRET']);
async function waitFor(url, headers = {}, expected = 200) {
  for (let i = 0; i < 60; i++) {
    try { const response = await fetch(url, { headers, signal: AbortSignal.timeout(1000) }); if (response.status === expected) return; } catch {}
    if (stopping) throw new Error('SERVICE_START_FAILED');
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('SERVICE_START_TIMEOUT');
}
await waitFor('http://127.0.0.1:8787/health');
await waitFor('http://127.0.0.1:8791/health');
if (!identityConnection || identityConnection.startsWith('@Microsoft.KeyVault(') || !/^[a-fA-F0-9]{64}$/.test(identityServiceKey || ''))
  throw new Error('IDENTITY_SERVICE_NOT_CONFIGURED');
const identityPolicy = JSON.parse(fs.readFileSync('/opt/sfx/host/identity-policy.json', 'utf8'));
launch('/opt/sfx/identity/sfx-identity-host', [], '/opt/sfx/identity', {
  ASPNETCORE_URLS: 'http://127.0.0.1:8793', SDA_ESTATE_DIR: '/opt/sfx/estate',
  SFX_IDENTITY_CAPABILITY: identityPolicy.capability,
  SFX_IDENTITY_INPUT_CONTRACT: identityPolicy.inputContract,
  SFX_IDENTITY_OUTCOME_CONTRACT: identityPolicy.outcomeContract,
  SFX_ENROLLMENT_CAPABILITY: identityPolicy.enrollment.capability,
  SFX_ENROLLMENT_INPUT_CONTRACT: identityPolicy.enrollment.inputContract,
  SFX_ENROLLMENT_OUTCOME_CONTRACT: identityPolicy.enrollment.outcomeContract,
  SFX_IDENTITY_ENROLLMENT_TOKEN: token,
  SFX_IDENTITY_REALM: identityPolicy.realm,
  SFX_IDENTITY_PROVIDER_ORIGIN: identityPolicy.providerOrigin,
  SFX_OBSERVER_ENDPOINT: 'http://127.0.0.1:8787/events', SFX_IDENTITY_LOCAL_GATEWAY: '1',
  SFX_IDENTITY_CONNECTION_STRING: identityConnection, SFX_IDENTITY_SERVICE_KEY: identityServiceKey
}, ['SDA_API_TOKEN', 'IDENTITY_HEADER', 'MSI_SECRET']);
await waitFor('http://127.0.0.1:8793/health');
launch(process.execPath, ['/opt/sfx/host/api.mjs'], '/opt/sfx', {
  SDA_ESTATE_DIR: '/opt/sfx/estate', SDA_API_HOST: '127.0.0.1', SDA_API_PORT: '8799',
  SDA_API_AUTHORITY: '/opt/sfx/api/interfaces/sda-api/sda-api-v1.authority.json', SDA_RUN_EVENT_RETENTION: '20000',
  SDA_OUTPUT_BYTE_CAP: '16777216'
});
await waitFor('http://127.0.0.1:8799/v1/runs/ready', { authorization: `Bearer ${token}` }, 404);
launch(process.execPath, ['server.js'], '/app', { PORT: '3001', HOSTNAME: '127.0.0.1', SDA_API_ENDPOINT: 'http://127.0.0.1:8799' });
await waitFor('http://127.0.0.1:3001/readyz');

http.createServer((request, response) => {
  const url = new URL(request.url, 'http://localhost');
  if (url.pathname === '/readyz' || url.pathname === '/healthz') {
    response.writeHead(stopping ? 503 : 200, { 'content-type': 'application/json', 'x-sidefx-release': release.id, 'cache-control': 'no-store' });
    response.end(JSON.stringify({ ready: !stopping, release: release.id, kernelDigest: release.kernelDigest })); return;
  }
  const api = url.pathname.startsWith('/v1/');
  const identity = url.pathname.startsWith('/auth/');
  if (identity && !identityPolicy.routes.some(route => route.method === request.method && route.path === url.pathname)) {
    response.writeHead(404, { 'cache-control': 'no-store' }); response.end(); return;
  }
  const retrieval = url.pathname.startsWith('/procedure-extract/');
  if (retrieval) {
    const supplied = createHash('sha256').update(request.headers.authorization || '').digest();
    const expected = createHash('sha256').update(`Bearer ${token}`).digest();
    if (!timingSafeEqual(supplied, expected)) {
      response.writeHead(401, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'UNAUTHORIZED' })); return;
    }
    if (request.method !== 'POST' || !['/procedure-extract/json', '/procedure-extract/excel'].includes(url.pathname)) {
      response.writeHead(404); response.end(); return;
    }
  }
  const circuit = url.pathname === '/circuit' || url.pathname.startsWith('/circuit/') || url.pathname.startsWith('/api/circuit/') || url.pathname === '/events';
  // Website and circuit reads are public. The SDA API validates the caller's
  // own Bearer header; the gateway must never substitute its server credential.
  const observe = url.pathname === '/api/circuit/v1/runs' && request.method === 'POST';
  if (circuit && request.method !== 'GET' && !observe) { response.writeHead(405); response.end(); return; }
  const upstream = http.request({ hostname: '127.0.0.1', port: identity ? 8793 : retrieval ? 8791 : api ? 8799 : circuit ? 8787 : 3001,
    path: retrieval ? url.pathname.slice('/procedure-extract'.length) : request.url, method: request.method, headers: { ...request.headers, host: 'localhost', 'x-forwarded-host': request.headers.host } }, incoming => {
    response.writeHead(incoming.statusCode, { ...incoming.headers, 'x-robots-tag': 'noindex, nofollow', ...(identity || api || circuit || retrieval ? { 'cache-control': 'no-store' } : {}) });
    incoming.pipe(response);
  });
  upstream.on('error', () => { if (!response.headersSent) response.writeHead(502); response.end(); });
  response.on('close', () => upstream.destroy());
  request.pipe(upstream);
}).listen(Number(process.env.PORT || 3000), '0.0.0.0', () => console.log('STAGING_GATEWAY_READY', release.id));
process.on('SIGTERM', () => stop());
process.on('SIGINT', () => stop());
