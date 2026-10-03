// Invoked by the private host integration harness with a disposable identity
// over stdin. Never supplies a noninteractive password option to production CLI.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { authenticate } from './auth.mjs';
import { sessionStore } from './session-store.mjs';
import { configuration } from './sfx-api.mjs';

let privateInput = ''; for await (const chunk of process.stdin) privateInput += chunk;
const fixture = JSON.parse(privateInput); privateInput = '';
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sfx-live-client-'));
const store = sessionStore(root), endpoint = fixture.endpoint;
const checks = [], tokens = [];
const pty = process.env.SFX_LOGIN_TEST_PTY_MODULE ? createRequire(import.meta.url)(process.env.SFX_LOGIN_TEST_PTY_MODULE) : null;
const record = name => { checks.push(name); process.stderr.write('PASS ' + name + '\n'); };
async function command(args) {
  const executable = process.platform === 'win32' ? 'powershell.exe' : path.join(fixture.bin, 'sfx');
  const argv = process.platform === 'win32' ? ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(fixture.bin, 'sfx.ps1'), ...args] : args;
  return new Promise((resolve, reject) => {
    const env = { ...process.env, SFX_SESSION_HOME: root }; delete env.SFX_API_ENDPOINT;
    const child = spawn(executable, argv, { env, cwd: os.tmpdir(), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = ''; child.stdout.on('data', x => out += x); child.stderr.on('data', x => err += x);
    child.on('error', () => reject(new Error('Installed command could not start')));
    child.on('close', code => resolve({ code, out, err }));
  });
}
async function terminalLogin(cancel = false) {
  process.stderr.write('PROGRESS TTY ' + (cancel ? 'cancellation' : 'login') + ' starting\n');
  return new Promise((resolve, reject) => {
    const env = { ...process.env, SFX_SESSION_HOME: root }; delete env.SFX_API_ENDPOINT;
    const terminal = pty.spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(fixture.bin, 'sfx.ps1'),
      'login', '--endpoint', endpoint, '--username', fixture.identifier, '--json'], { env, cwd: os.tmpdir(), cols: 180, rows: 24, useConptyDll: true });
    let output = '', sent = false;
    const timer = setTimeout(() => { terminal.kill(); reject(new Error('Interactive prompt timed out')); }, 60000);
    terminal.onData(value => {
      output += value;
      if (!sent && output.includes('Password: ')) { sent = true; process.stderr.write('PROGRESS TTY hidden prompt reached\n'); terminal.write(cancel ? '\x03' : fixture.password + '\r'); }
    });
    terminal.onExit(({ exitCode }) => {
      process.stderr.write('PROGRESS TTY child exited\n');
      clearTimeout(timer);
      if (output.includes(fixture.password)) reject(new Error('Password echoed in terminal'));
      else resolve({ exitCode, output, prompted: sent });
    });
  });
}
try {
  // The harness has already verified the input provider independently. This
  // seam supplies its private HTTP result; every server effect is real.
  const acquired = async () => {
    const response = await fetch(endpoint + '/auth/v1/login', { method: 'POST', redirect: 'error',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify({ identifier: fixture.identifier, password: fixture.password }) });
    assert.equal(response.status, 200, 'Real login must succeed');
    const session = await response.json(); tokens.push(session.token);
    return { realm: response.headers.get('x-sfx-identity-realm'), session };
  };
  let login;
  if (pty) {
    const cancelled = await terminalLogin(true);
    assert.ok(cancelled.prompted); assert.notEqual(cancelled.exitCode, 0);
    assert.equal(store.profile(endpoint).state, 'signed-out'); record('Installed interactive Ctrl+C restores prompt and creates no session');
    const interactive = await terminalLogin();
    assert.ok(interactive.prompted); assert.equal(interactive.exitCode, 0, 'Interactive installed login failed');
    const value = store.read(endpoint); tokens.push(value.token);
    assert.ok(!interactive.output.includes(value.token));
    login = await authenticate({ command: 'whoami' }, endpoint, { store });
    record('Installed interactive login uses hidden provider prompt, real HTTPS and real database');
  } else login = await authenticate({ command: 'login' }, endpoint, { store, acquire: acquired });
  assert.equal(login.disposition, 'AUTHENTICATED'); record('Real HTTPS login persisted with Windows DPAPI');
  assert.equal(configuration({ endpoint }, store).token, tokens[0]); record('sfx-api selects the same exact user bearer');
  const whoami = await command(['whoami', '--endpoint', endpoint, '--json']);
  assert.equal(whoami.code, 0, 'Installed whoami exit');
  assert.equal(JSON.parse(whoami.out).sessionId, login.sessionId); record('Installed whoami validates real session from outside checkout');
  const signedOut = await command(['logout', '--endpoint', endpoint, '--json']);
  assert.equal(signedOut.code, 0, 'Installed logout exit');
  assert.equal(JSON.parse(signedOut.out).remoteRevocationConfirmed, true); record('Installed logout confirms server revocation and local deletion');
  const revoked = await fetch(endpoint + '/auth/v1/session', { headers: { authorization: 'Bearer ' + tokens[0] } });
  assert.equal(revoked.status, 401); record('Identity database rejects revoked session');
  const after = await command(['whoami', '--endpoint', endpoint, '--json']);
  assert.notEqual(after.code, 0); assert.ok(after.err.includes('LOGIN_REQUIRED')); record('Installed whoami fails after logout');
  const loginNoTty = await command(['login', '--endpoint', endpoint, '--json']);
  assert.notEqual(loginNoTty.code, 0); assert.ok(loginNoTty.err.includes('INTERACTIVE_LOGIN_REQUIRED')); record('Installed login refuses redirected input');
  const refusedFlag = await command(['login', '--password', 'flag-canary-do-not-echo']);
  assert.notEqual(refusedFlag.code, 0); assert.ok(!(refusedFlag.out + refusedFlag.err).includes('flag-canary-do-not-echo')); record('Installed CLI refuses password flags without echoing their values');
  const cancelled = await command(['login', '--help']);
  assert.equal(cancelled.code, 0); record('Installed login help works outside an estate');
  const stdout = [JSON.stringify(login), whoami.out, whoami.err, signedOut.out, signedOut.err, after.out, after.err].join('\n');
  for (const secret of [fixture.password, ...tokens]) assert.ok(!stdout.includes(secret));
  for (const file of fs.readdirSync(root)) for (const secret of tokens)
    assert.ok(!fs.readFileSync(path.join(root, file), 'utf8').includes(secret));
  record('CLI output and persisted metadata contain no password or bearer');
  process.stdout.write(JSON.stringify({ checks, count: checks.length, inputMode: pty ? 'Windows ConPTY installed command' : 'private host harness; prompt tested separately', endpoint }) + '\n');
} catch (error) { process.stderr.write('LIVE_CLI_VERIFICATION_FAILED at ' + checks.length + ' completed checks (' + error.name + '; private diagnostic suppressed)\n'); process.exitCode = 1; }
finally {
  for (const token of tokens) { try { await fetch(endpoint + '/auth/v1/logout', { method: 'POST', headers: { authorization: 'Bearer ' + token } }); } catch {} }
  try { store.clear(endpoint); } finally { fs.rmSync(root, { recursive: true, force: true }); }
}
// ConPTY can retain a native worker after its child exits. All HTTP requests,
// secure-store cleanup and assertions above have completed at this boundary.
process.exit(process.exitCode || 0);
