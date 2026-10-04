import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { authenticate, authEndpoint, parseAuth, privateLogin } from './auth.mjs';
import { nativeStore, sessionStore } from './session-store.mjs';
import { configuration } from './sfx-api.mjs';

// Explicit client boundary fixtures. These do not stand in for kernel/database
// evidence; the separate live test invokes the real private host.
const endpoint = 'https://localhost:8793';
function issued() { return { realm: 'client-unit-test', session: { sessionId: randomUUID(), principalId: randomUUID(),
  expiresAt: new Date(Date.now() + 60000).toISOString(), token: randomBytes(32).toString('base64'), tokenType: 'Bearer' } }; }
function fixture(t, secureOverride) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sfx-client-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const data = new Map();
  const secure = secureOverride || { check() {}, write: (k, v) => data.set(k, v), read: k => data.get(k), delete: k => data.delete(k) };
  return { root, data, store: sessionStore(root, secure) };
}
function response(data, status = 200, realm = 'client-unit-test') {
  return new Response(JSON.stringify(data), { status, headers: { 'x-sfx-identity-realm': realm, 'content-type': 'application/json' } });
}
test('password arguments are refused without echoing supplied values; only HTTPS accepted', () => {
  for (const args of [['login','--password','secret-canary'], ['login','--input','secret-canary'], ['enroll','--password','secret-canary'], ['enroll','--input','secret-canary'], ['logout','--username','someone']])
    assert.throws(() => parseAuth(args), error => !error.message.includes('secret-canary'));
  for (const value of ['http://localhost:8793', 'https://user:secret@example.test', 'https://example.test/?secret'])
    assert.throws(() => authEndpoint(value), /HTTPS_ENDPOINT_REQUIRED/);
  assert.equal(authEndpoint('https://example.test/'), 'https://example.test');
  assert.equal(parseAuth(['enroll','--username','pilot','--json']).command, 'enroll');
});
test('noninteractive login has no secret input fallback', async () => {
  if (!process.stdin.isTTY || !process.stderr.isTTY) await assert.rejects(privateLogin(endpoint), /INTERACTIVE_LOGIN_REQUIRED/);
  if (!process.stdin.isTTY || !process.stderr.isTTY) await assert.rejects(privateLogin(endpoint, 'pilot', 'operator-fixture'), /INTERACTIVE_LOGIN_REQUIRED/);
});
test('login saves metadata-only profile, scopes secret to endpoint/realm/principal/session', async t => {
  const { root, store, data } = fixture(t); const value = issued();
  const result = await authenticate({ command: 'login' }, endpoint, { store, acquire: async () => value });
  assert.equal(result.disposition, 'AUTHENTICATED'); assert.equal(data.size, 1);
  for (const name of fs.readdirSync(root)) assert.ok(!fs.readFileSync(path.join(root, name), 'utf8').includes(value.session.token));
  assert.ok(!JSON.stringify(result).includes(value.session.token));
  assert.equal(store.read(endpoint).token, value.session.token);
  assert.throws(() => store.read('https://another.example'), /LOGIN_REQUIRED/);
  const metadataFile = fs.readdirSync(root).find(name => name !== 'selected.json');
  const file = path.join(root, metadataFile), profile = JSON.parse(fs.readFileSync(file));
  fs.writeFileSync(file, JSON.stringify({ ...profile, realm: 'forged' }));
  assert.throws(() => store.read(endpoint), /SESSION_SCOPE_INVALID/);
});
test('whoami validates remotely and projects only safe session metadata', async t => {
  const { store } = fixture(t); const value = issued();
  await authenticate({ command: 'login' }, endpoint, { store, acquire: async () => value });
  let calls = 0;
  const result = await authenticate({ command: 'whoami' }, endpoint, { store, request: async (url, options) => {
    calls++; assert.equal(url, endpoint + '/auth/v1/session'); assert.equal(options.redirect, 'error');
    assert.equal(options.headers.authorization, 'Bearer ' + value.session.token);
    return response({ ...value.session, unexpectedSecret: 'do-not-output' });
  } });
  assert.equal(calls, 1); assert.ok(!JSON.stringify(result).includes('token')); assert.ok(!JSON.stringify(result).includes('do-not-output'));
  await assert.rejects(authenticate({ command: 'whoami' }, endpoint, { store, request: async () => response(value.session, 200, 'another-realm') }), /SESSION_SCOPE_INVALID/);
  await assert.rejects(authenticate({ command: 'whoami' }, endpoint, { store, request: async () => response({}, 401) }), /SESSION_REJECTED/);
});
test('storage failure revokes issued session and reports incomplete login', async t => {
  const value = issued(); let revoked = 0;
  const { store } = fixture(t, { check() {}, write() { throw new Error('secret-canary'); }, delete() {} });
  await assert.rejects(authenticate({ command: 'login' }, endpoint, { store, acquire: async () => value, request: async (url, options) => {
    assert.equal(url, endpoint + '/auth/v1/logout'); assert.equal(options.headers.authorization, 'Bearer ' + value.session.token); revoked++; return response({});
  } }), /SECURE_SESSION_STORE_UNAVAILABLE/);
  assert.equal(revoked, 1); assert.equal(store.profile(endpoint).state, 'signed-out');
});
test('replacement login revokes previous session before replacing protected credential', async t => {
  const { store, data } = fixture(t); const first = issued(), second = issued();
  await authenticate({ command: 'login' }, endpoint, { store, acquire: async () => first });
  const requests = [];
  await authenticate({ command: 'login' }, endpoint, { store, acquire: async () => second, request: async (url, options) => {
    requests.push(options.headers.authorization); return response({ disposition: 'REVOKED' });
  } });
  assert.deepEqual(requests, ['Bearer ' + first.session.token]); assert.equal(data.size, 1);
  assert.equal(store.read(endpoint).token, second.session.token);
});
test('offline logout erases locally, retains user selection, reports unconfirmed remote revocation', async t => {
  const { store, data } = fixture(t); const value = issued();
  await authenticate({ command: 'login' }, endpoint, { store, acquire: async () => value });
  const result = await authenticate({ command: 'logout' }, endpoint, { store, request: async () => { throw new Error('offline'); } });
  assert.equal(result.remoteRevocationConfirmed, false); assert.equal(data.size, 0);
  assert.equal(store.selected().authentication, 'user'); assert.throws(() => store.read(endpoint), /LOGIN_REQUIRED/);
});
test('cancellation submits no HTTP request and never selects machine authentication', async t => {
  const { store } = fixture(t); let requests = 0;
  await assert.rejects(authenticate({ command: 'login' }, endpoint, { store, acquire: async () => { throw new Error('LOGIN_CANCELLED'); },
    request: async () => { requests++; } }), /LOGIN_CANCELLED/);
  assert.equal(requests, 0); assert.equal(store.selected().authentication, 'user');
});
test('expired or missing user session cannot fall back to an environment machine token', t => {
  const { store } = fixture(t); store.select(endpoint);
  const before = process.env.SFX_API_TOKEN; process.env.SFX_API_TOKEN = 'unit-machine-token';
  try {
    assert.throws(() => configuration({ endpoint }, store), /LOGIN_REQUIRED/);
    const value = issued(); value.session.expiresAt = new Date(0).toISOString(); store.save(endpoint, value.realm, value.session);
    assert.throws(() => configuration({ endpoint }, store), /SESSION_EXPIRED/);
    assert.throws(() => configuration({ endpoint: 'https://other.example' }, store), /LOGIN_REQUIRED/);
    assert.equal(configuration({ endpoint, auth: 'machine' }, store).token, 'unit-machine-token');
  } finally { if (before === undefined) delete process.env.SFX_API_TOKEN; else process.env.SFX_API_TOKEN = before; }
});
test('macOS adapter sends secret only over stdin and checks write by reading back', () => {
  const key = 'a'.repeat(64), secret = JSON.stringify({ token: 'keychain-secret-canary' }); const calls = [];
  const store = nativeStore('/unused', 'darwin', (command, args, options) => {
    calls.push({ command, args, options });
    return args[0] === 'find-generic-password' ? Buffer.from(secret).toString('base64') : '';
  });
  store.write(key, secret);
  assert.equal(calls.length, 2); assert.equal(calls[0].args[0], '-i');
  assert.ok(!JSON.stringify(calls.map(call => call.args)).includes('canary'));
  assert.ok(calls[0].options.input.includes(Buffer.from(secret).toString('base64')));
  assert.throws(() => nativeStore('/unused', 'linux').check(), /UNSUPPORTED/);
});
test('concurrent mutations cannot replace or revoke each other\'s saved session', async t => {
  const { store } = fixture(t); const release = store.lock(endpoint); let calls = 0;
  try {
    await assert.rejects(authenticate({ command: 'login' }, endpoint, { store, acquire: async () => { calls++; return issued(); } }), /LOGIN_OPERATION_IN_PROGRESS/);
    assert.equal(calls, 0);
  } finally { release(); }
  await assert.rejects(authenticate({ command: 'login' }, endpoint, { store, acquire: async () => { throw new Error('LOGIN_CANCELLED'); } }), /LOGIN_CANCELLED/);
  store.lock(endpoint)(); // A handled cancellation released its lock.
});
test('Windows DPAPI roundtrip contains no plaintext and deletes the protected credential', { skip: process.platform !== 'win32' }, t => {
  const { root } = fixture(t), store = nativeStore(root), key = 'b'.repeat(64), secret = randomBytes(32).toString('base64');
  store.write(key, secret); assert.equal(store.read(key), secret);
  assert.ok(!fs.readFileSync(path.join(root, key + '.dpapi.xml'), 'utf8').includes(secret));
  store.delete(key); assert.equal(fs.existsSync(path.join(root, key + '.dpapi.xml')), false);
});
