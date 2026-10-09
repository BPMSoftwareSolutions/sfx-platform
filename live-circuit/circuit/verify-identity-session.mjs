// Transport conformance for the browser session (docs/live-circuit-browser-session.md).
// Starts observe-server.mjs against a stub identity host that answers with the
// identity host's contract shapes (POST /auth/v1/login, GET /auth/v1/session,
// POST /auth/v1/logout) and a stub SDA API. Live acceptance uses the real
// identity host, which runs authenticate-ide-user; this script never contacts it.
//   node live-circuit/circuit/verify-identity-session.mjs
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const server = fileURLToPath(new URL('../dispatch-pair/observe-server.mjs', import.meta.url));
const IDENTIFIER = 'pilot-fixture', PASSWORD = 'canary-password-7f3a91', MACHINE = 'machine-token-fixture-0001';
const spare = () => new Promise((resolve, reject) => { const p = net.createServer(); p.once('error', reject); p.listen(0, '127.0.0.1', () => { const { port } = p.address(); p.close(() => resolve(port)); }); });
const body = req => new Promise(resolve => { const c = []; req.on('data', d => c.push(d)); req.on('end', () => resolve(Buffer.concat(c).toString('utf8'))); });
const json = (res, status, value) => { res.writeHead(status, { 'content-type': 'application/json', 'x-sfx-identity-realm': 'sfx-ide-local' }); res.end(JSON.stringify(value)); };

// Stub identity host: contract shapes only.
const sessions = new Map(); const identityLog = [];
const identity = http.createServer(async (req, res) => {
  const bearer = (req.headers.authorization ?? '').startsWith('Bearer ') ? req.headers.authorization.slice(7) : null;
  identityLog.push(`${req.method} ${req.url} bearer=${bearer ? 'present' : 'absent'}`);
  if (req.method === 'POST' && req.url === '/auth/v1/login') {
    const input = JSON.parse(await body(req));
    if (Object.keys(input).length !== 2) return json(res, 400, { disposition: 'LOGIN_INPUT_INVALID' });
    if (input.identifier !== IDENTIFIER || input.password !== PASSWORD) return json(res, 401, { contractId: 'ide-authentication-result.v1', disposition: 'AUTHENTICATION_REJECTED' });
    const token = randomBytes(32).toString('base64'), meta = { sessionId: randomUUID(), principalId: randomUUID(), expiresAt: new Date(Date.now() + 30 * 60000).toISOString() };
    sessions.set(token, { ...meta, revoked: false });
    return json(res, 200, { ...meta, tokenType: 'Bearer', token });
  }
  const s = bearer && sessions.get(bearer);
  if (req.method === 'GET' && req.url === '/auth/v1/session') return s && !s.revoked ? json(res, 200, { sessionId: s.sessionId, principalId: s.principalId, expiresAt: s.expiresAt }) : json(res, 401, {});
  if (req.method === 'POST' && req.url === '/auth/v1/logout') { if (!s) return json(res, 401, {}); s.revoked = true; return json(res, 200, { disposition: 'REVOKED' }); }
  json(res, 404, {});
});
// Stub SDA API: records what Observe forwarded.
const apiLog = [];
const api = http.createServer(async (req, res) => {
  const text = await body(req);
  apiLog.push({ method: req.method, url: req.url, authorization: req.headers.authorization, body: text, cookie: req.headers.cookie ?? null, idempotency: req.headers['idempotency-key'] });
  json(res, 202, { runId: `run-${apiLog.length}`, state: 'admitted' });
});

async function start(env) {
  const port = await spare();
  const child = spawn(process.execPath, [server], { env: { ...process.env, OBSERVER_PORT: String(port), ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = ''; child.stdout.on('data', d => { output += d; }); child.stderr.on('data', d => { output += d; });
  for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
  return { origin: `http://127.0.0.1:${port}`, host: `127.0.0.1:${port}`, child, output: () => output };
}

const [identityPort, apiPort] = await Promise.all([spare(), spare()]);
await new Promise(r => identity.listen(identityPort, '127.0.0.1', r));
await new Promise(r => api.listen(apiPort, '127.0.0.1', r));
const o = await start({ SFX_IDENTITY_ENDPOINT: `http://127.0.0.1:${identityPort}`, SDA_API_ENDPOINT: `http://127.0.0.1:${apiPort}`, SDA_API_TOKEN: MACHINE });
const bare = await start({ SFX_IDENTITY_ENDPOINT: '', SDA_API_ENDPOINT: `http://127.0.0.1:${apiPort}`, SDA_API_TOKEN: MACHINE });
const checks = [];
const check = (name, fn) => checks.push([name, fn]);
const post = (target, path, value, { origin = target.origin, type = 'application/json', cookie, idempotency } = {}) =>
  fetch(target.origin + path, { method: 'POST', redirect: 'manual', body: typeof value === 'string' ? value : JSON.stringify(value),
    headers: { ...(origin ? { origin } : {}), 'content-type': type, ...(cookie ? { cookie } : {}), ...(idempotency ? { 'idempotency-key': idempotency } : {}) } });
const get = (target, path, cookie) => fetch(target.origin + path, { headers: cookie ? { cookie } : {} });
let cookie = null, session = null;

check('sign-in and home pages, scripts, styles and artwork are served', async () => {
  for (const p of ['/circuit/login', '/circuit/login.js', '/circuit/explorer', '/circuit/explorer.js', '/circuit/circuit-runtime.js', '/circuit/home', '/circuit/home.js', '/circuit/site.js',
    '/circuit/site.css', '/circuit/assets/optical-flow.webp', '/circuit/assets/optical-architecture-900.webp', '/circuit/assets/sfx-logo-wordmark.png'])
    assert.equal((await get(o, p)).status, 200, p);
});
check('home configuration is host route data: hero and sign-in circuit only', async () => {
  const h = await (await get(o, '/api/circuit/v1/home')).json();
  assert.equal(h.hero.capabilityId, 'ui-page-landing'); assert.equal(h.signInCircuit.capabilityId, 'authenticate-ide-user');
  assert.equal((h.featured ?? []).length, 0, 'featured is declaration authority, not host data (C1)');
});
check('no cookie: not authenticated, Observe requires session', async () => {
  const s = await (await get(o, '/api/circuit/v1/session')).json();
  assert.deepEqual([s.authenticated, s.observeRequiresSession], [false, true]);
  assert.equal((await (await get(o, '/api/circuit/v1/execution')).json()).observeRequiresSession, true);
});
check('cross-origin and non-JSON sign-in are refused before the identity host', async () => {
  const before = identityLog.length;
  assert.equal((await post(o, '/api/circuit/v1/session', { identifier: IDENTIFIER, password: PASSWORD }, { origin: 'https://evil.example' })).status, 403);
  assert.equal((await post(o, '/api/circuit/v1/session', { identifier: IDENTIFIER, password: PASSWORD }, { origin: null })).status, 403);
  assert.equal((await post(o, '/api/circuit/v1/session', `identifier=${IDENTIFIER}&password=${PASSWORD}`, { type: 'application/x-www-form-urlencoded' })).status, 403);
  assert.equal(identityLog.length, before);
});
check('malformed sign-in input is refused locally', async () => {
  assert.equal((await post(o, '/api/circuit/v1/session', { identifier: IDENTIFIER, password: PASSWORD, principalId: randomUUID() })).status, 400);
  assert.equal((await post(o, '/api/circuit/v1/session', { identifier: IDENTIFIER })).status, 400);
});
check('rejected credentials: 401, no cookie', async () => {
  const r = await post(o, '/api/circuit/v1/session', { identifier: IDENTIFIER, password: 'wrong-password' });
  assert.equal(r.status, 401); assert.equal((await r.json()).disposition, 'AUTHENTICATION_REJECTED'); assert.equal(r.headers.get('set-cookie'), null);
});
check('accepted credentials: HttpOnly Secure SameSite=Strict __Host- cookie; body carries no bearer', async () => {
  const r = await post(o, '/api/circuit/v1/session', { identifier: IDENTIFIER, password: PASSWORD });
  assert.equal(r.status, 200);
  const text = await r.text(); session = JSON.parse(text);
  assert.equal(session.disposition, 'AUTHENTICATED'); assert.equal(session.identifier, IDENTIFIER); assert.equal(session.realm, 'sfx-ide-local');
  const set = r.headers.get('set-cookie');
  for (const flag of ['__Host-sfx-session=', 'Path=/', 'HttpOnly', 'Secure', 'SameSite=Strict', 'Max-Age=']) assert.ok(set.includes(flag), flag);
  const token = set.split(';')[0].slice('__Host-sfx-session='.length);
  assert.ok(sessions.has(token)); assert.ok(!text.includes(token)); assert.ok(!text.includes(PASSWORD));
  cookie = `__Host-sfx-session=${token}`;
});
check('session status reflects the identity host', async () => {
  const s = await (await get(o, '/api/circuit/v1/session', cookie)).json();
  assert.deepEqual([s.authenticated, s.principalId, s.identifier], [true, session.principalId, IDENTIFIER]);
});
check('Observe without a session is refused and never reaches the API', async () => {
  const before = apiLog.length;
  const r = await post(o, '/api/circuit/v1/runs', { object: 'capability', operation: 'observe', subject: 'say-hello-world', input: {} });
  assert.equal(r.status, 401); assert.equal((await r.json()).disposition, 'SIGN_IN_REQUIRED'); assert.equal(apiLog.length, before);
});
check('Observe with a session reaches the API with the machine credential only and is attributed', async () => {
  const r = await post(o, '/api/circuit/v1/runs', { object: 'capability', operation: 'observe', subject: 'say-hello-world', input: {} }, { cookie });
  assert.equal(r.status, 202);
  const admitted = await r.json();
  const forwarded = apiLog.at(-1);
  assert.equal(forwarded.authorization, `Bearer ${MACHINE}`); assert.equal(forwarded.cookie, null);
  const runs = await (await get(o, '/api/circuit/v1/session/runs', cookie)).json();
  assert.equal(runs.principalId, session.principalId); assert.deepEqual(runs.runs.map(x => [x.runId, x.capabilityId]), [[admitted.runId, 'say-hello-world']]);
});
check('a revoked session is refused for Observe and its cookie cleared', async () => {
  const token = cookie.split('=').slice(1).join('=');
  sessions.get(token).revoked = true;
  const r = await post(o, '/api/circuit/v1/runs', { object: 'capability', operation: 'observe', subject: 'say-hello-world', input: {} }, { cookie });
  assert.equal(r.status, 401); assert.equal((await r.json()).disposition, 'SESSION_ENDED'); assert.ok(r.headers.get('set-cookie').includes('Max-Age=0'));
  sessions.get(token).revoked = false;
});
check('run reads require the owning principal; other and nonexistent runs have identical refusals', async () => {
  const list = await (await get(o, '/api/circuit/v1/session/runs', cookie)).json(), runId = list.runs[0].runId;
  const other = await post(o, '/api/circuit/v1/session', { identifier: IDENTIFIER, password: PASSWORD });
  const otherCookie = other.headers.get('set-cookie').split(';')[0];
  assert.deepEqual((await (await get(o, '/api/circuit/v1/session/runs', otherCookie)).json()).runs, []);
  for (const suffix of ['', '/events', '/events/stream', '/graph', '/output']) {
    const before = apiLog.length;
    assert.equal((await get(o, `/api/circuit/v1/runs/${runId}${suffix}`)).status, 401);
    const denied = await get(o, `/api/circuit/v1/runs/${runId}${suffix}`, otherCookie);
    const absent = await get(o, `/api/circuit/v1/runs/missing${suffix}`, otherCookie);
    assert.equal(denied.status, 404); assert.equal(absent.status, 404); assert.equal(await denied.text(), await absent.text());
    assert.equal(apiLog.length, before, 'Refused reads must never contact execution storage');
    assert.equal((await get(o, `/api/circuit/v1/runs/${runId}${suffix}`, cookie)).status, 202);
  }
});
check('admission retry keys are stable for one principal and distinct across principals', async () => {
  const other = await post(o, '/api/circuit/v1/session', { identifier: IDENTIFIER, password: PASSWORD });
  const otherCookie = other.headers.get('set-cookie').split(';')[0];
  const keys = [];
  for (const owner of [cookie, cookie, otherCookie]) {
    assert.equal((await post(o, '/api/circuit/v1/runs', { object: 'capability', operation: 'observe', subject: 'say-hello-world', input: {} }, { cookie: owner, idempotency: 'same-browser-retry' })).status, 202);
    keys.push(apiLog.at(-1).idempotency);
  }
  assert.equal(keys[0], keys[1]); assert.notEqual(keys[0], keys[2]); assert.notEqual(keys[0], 'same-browser-retry');
});
check('sign-out revokes on the identity host and clears the cookie', async () => {
  const cross = await post(o, '/api/circuit/v1/session/logout', {}, { origin: 'https://evil.example', cookie });
  assert.equal(cross.status, 403);
  const r = await post(o, '/api/circuit/v1/session/logout', {}, { cookie });
  assert.equal((await r.json()).disposition, 'REVOKED'); assert.ok(r.headers.get('set-cookie').includes('Max-Age=0'));
  assert.equal(sessions.get(cookie.split('=').slice(1).join('=')).revoked, true);
  assert.equal((await post(o, '/api/circuit/v1/runs', { object: 'capability', operation: 'observe', subject: 'say-hello-world', input: {} }, { cookie })).status, 401);
});
check('identity not configured: Observe fails closed', async () => {
  const before = apiLog.length;
  const r = await post(bare, '/api/circuit/v1/runs', { object: 'capability', operation: 'observe', subject: 'say-hello-world', input: {} }, { origin: bare.origin, cookie: `__Host-sfx-session=${randomBytes(32).toString('base64')}` });
  assert.equal(r.status, 503); assert.equal((await r.json()).disposition, 'IDENTITY_NOT_CONFIGURED'); assert.equal(apiLog.length, before);
});
check('canaries: no password or bearer in observer output, API traffic or identity log', async () => {
  const tokens = [...sessions.keys()];
  const surfaces = [o.output(), bare.output(), JSON.stringify(apiLog), identityLog.join('\n')];
  for (const s of surfaces) { assert.ok(!s.includes(PASSWORD)); for (const t of tokens) assert.ok(!s.includes(t)); }
});

let failed = 0;
for (const [name, fn] of checks) {
  try { await fn(); console.log(`ok   ${name}`); }
  catch (error) { failed++; console.log(`FAIL ${name}: ${error.message}`); }
}
o.child.kill(); bare.child.kill(); identity.close(); api.close();
console.log(JSON.stringify({ checks: checks.length, failed }));
process.exit(failed ? 1 : 0);
