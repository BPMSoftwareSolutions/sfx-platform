// Real-host acceptance with a caller-owned identity fixture (disposable or CI).
// Credentials arrive over stdin and are never persisted or printed. The browser
// uses the normal product UI and revokes the session in cleanup.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

let input = ''; for await (const chunk of process.stdin) input += chunk;
const fixture = JSON.parse(input); input = '';
const origin = process.env.SFX_BROWSER_ORIGIN || fixture.endpoint;
const evidence = process.env.SFX_BROWSER_EVIDENCE;
if (!evidence) throw new Error('SFX_BROWSER_EVIDENCE_REQUIRED');
const request = JSON.parse(fs.readFileSync(process.env.SFX_BROWSER_OBSERVE_REQUEST, 'utf8'));
assert(request.object === 'capability' && request.operation === 'observe' && request.subject && request.input);
const { chromium } = await import(pathToFileURL(process.env.SFX_BROWSER_TEST_MODULE).href);
fs.mkdirSync(evidence, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.SFX_BROWSER_EXECUTABLE, headless: true });
const context = await browser.newContext({ viewport: { width: 1600, height: 1200 } });
context.setDefaultTimeout(30000);
context.setDefaultNavigationTimeout(90000);
const page = await context.newPage();
const checks = [], errors = [], consoleMessages = [], secrets = [fixture.password];
let logProcess, logText = '', logTruncated = false;
let logStatus, logExit;
if (fixture.logs) {
  secrets.push(fixture.logs.authorization);
  // Private stdin keeps SCM credentials out of argv. A bounded streaming curl
  // process can be stopped reliably even when the server leaves its body open.
  assert(/^https:\/\/[a-z0-9.-]+\.azurewebsites\.net\/api\/logstream$/.test(fixture.logs.url));
  assert(/^Basic [A-Za-z0-9+/=]+$/.test(fixture.logs.authorization));
  logProcess = spawn('curl', ['--config','-'], {windowsHide:true,stdio:['pipe','pipe','pipe']});
  logProcess.stdin.end(`url = "${fixture.logs.url}"\nheader = "Authorization: ${fixture.logs.authorization}"\nno-buffer\ninclude\nsilent\nshow-error\nfail\nconnect-timeout = 20\nmax-time = 300\n`);
  const retain = bytes => {if(logText.length+bytes.length<=4*1024*1024)logText+=bytes;else logTruncated=true;};
  logProcess.stdout.on('data',retain); logProcess.stderr.on('data',retain);
  logProcess.on('error',()=>{logTruncated=true;}); logProcess.on('close',code=>{logExit=code;});
} else if (process.env.SFX_AZURE_CLI_PYTHON) {
  for (const key of ['SFX_LOG_RESOURCE_GROUP', 'SFX_LOG_APP', 'SFX_LOG_SLOT']) assert(process.env[key], key);
  logProcess = spawn(process.env.SFX_AZURE_CLI_PYTHON || 'az', [...(process.env.SFX_AZURE_CLI_PYTHON ? ['-IBm', 'azure.cli'] : []), 'webapp', 'log', 'tail',
    '-g', process.env.SFX_LOG_RESOURCE_GROUP, '-n', process.env.SFX_LOG_APP, '--slot', process.env.SFX_LOG_SLOT],
    { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const retain = bytes => { if (logText.length + bytes.length <= 4 * 1024 * 1024) logText += bytes; else logTruncated = true; };
  logProcess.stdout.on('data', retain); logProcess.stderr.on('data', retain);
  logProcess.on('error', () => { logTruncated = true; });
}
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => consoleMessages.push(message.text()));
const stage = name => fs.writeFileSync(path.join(evidence, 'progress.json'), JSON.stringify({ at: new Date().toISOString(), stage: name, checks }));
const record = name => { checks.push(name); stage(name); process.stderr.write('PASS ' + name + '\n'); };
const streamController = new AbortController(); let captured = '', streamFailure;
const stream = await fetch(origin + '/events', { signal: streamController.signal });
assert.equal(stream.status, 200);
const collect = (async () => {
  const decoder = new TextDecoder();
  try { for await (const bytes of stream.body) captured += decoder.decode(bytes, { stream: true }); }
  catch (error) { if (!streamController.signal.aborted) streamFailure = error; }
})();
const post = async (route, body, cookie) => {
  const response = await fetch(origin + route, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(145000),
    headers: { origin, 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) });
  return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie') };
};
let cookie, runId, scene, samples = [], output;
try {
  const anonymous = await post('/api/circuit/v1/runs', request);
  assert.equal(anonymous.status, 401); assert.equal(anonymous.body.disposition, 'SIGN_IN_REQUIRED');
  record('Anonymous Observe refused before admission');

  await page.goto(origin + '/circuit/login');
  await page.locator('#sign-in').waitFor({ state: 'visible' });
  await page.locator('#identifier').fill(fixture.identifier);
  await page.locator('#password').fill(fixture.password + '-wrong');
  let loginResponse = page.waitForResponse(r => r.url() === origin + '/api/circuit/v1/session' && r.request().method() === 'POST');
  await page.locator('#submit').click();
  const rejected = await loginResponse;
  assert.equal(rejected.status(), 401); assert.equal((await rejected.json()).disposition, 'AUTHENTICATION_REJECTED');
  assert(!(await context.cookies()).some(c => c.name === '__Host-sfx-session'));
  record('Real wrong password refused without a cookie');

  await page.locator('#password').fill(fixture.password);
  loginResponse = page.waitForResponse(r => r.url() === origin + '/api/circuit/v1/session' && r.request().method() === 'POST');
  await page.locator('#submit').click();
  const accepted = await loginResponse, login = await accepted.json();
  assert.equal(accepted.status(), 200); assert.equal(login.disposition, 'AUTHENTICATED');
  assert(!Object.hasOwn(login, 'token'));
  await page.locator('#signed-in').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#who').textContent(), fixture.identifier);
  const session = (await context.cookies()).find(c => c.name === '__Host-sfx-session');
  assert(session && session.httpOnly && session.secure && session.sameSite === 'Strict' && session.path === '/');
  assert(!session.domain.startsWith('.'));
  secrets.push(session.value); cookie = `${session.name}=${session.value}`;
  assert(!(await page.evaluate(() => document.cookie)).includes(session.value));
  record('Real browser sign-in; __Host-, HttpOnly, Secure, Strict cookie; no script bearer');

  const query = new URLSearchParams({ capabilityId: request.subject, namespaceId: request.namespace || 'sidefx:capabilities', scenarioId: request.subject });
  const sceneResponse = await fetch(origin + '/api/circuit/v1/scenario?' + query);
  assert.equal(sceneResponse.status, 200); scene = await sceneResponse.json();
  fs.writeFileSync(path.join(evidence, 'scene.json'), JSON.stringify(scene));
  await page.goto(origin + '/circuit/explorer?' + new URLSearchParams({ capability: request.subject, namespace: query.get('namespaceId'), scenario: request.subject, page: 'scenario-1' }));
  await page.locator('.component-hit').first().waitFor({ timeout: 90000 });
  await page.waitForFunction(() => document.querySelector('#identity').textContent.includes('Signed in as'));
  assert((await page.locator('#identity').textContent()).includes(fixture.identifier));
  await page.locator('#follow').check();
  await page.locator('#payload').fill(JSON.stringify(request.input, null, 2));
  await page.evaluate(() => {
    window.acceptanceFrames = [];
    const sample = () => {
      window.acceptanceFrames.push({ at: Date.now(), mode: document.querySelector('#mode').textContent,
        page: document.querySelector('#slide').value, status: document.querySelector('#observe-status').textContent,
        current: [...document.querySelectorAll('.component-hit[data-current=true]')].map(n => ({ id: n.dataset.nodeId, kind: n.dataset.kind, phase: n.dataset.phase })),
        busy: [...document.querySelectorAll('.component-hit[data-busy=true]')].map(n => n.dataset.nodeId) });
      window.acceptanceFrame = requestAnimationFrame(sample);
    }; window.acceptanceFrame = requestAnimationFrame(sample);
  });
  const admittedResponse = page.waitForResponse(r => r.url() === origin + '/api/circuit/v1/runs' && r.request().method() === 'POST', { timeout: 90000 });
  await page.locator('#observe').click();
  const admitted = await admittedResponse;
  assert.equal(admitted.status(), 202); runId = (await admitted.json()).runId;
  assert(runId);
  await page.waitForFunction(() => /API run .* · (completed|failed|cancelled|timed-out)/.test(document.querySelector('#observe-status').textContent), null, { timeout: 360000 });
  samples = await page.evaluate(() => { cancelAnimationFrame(window.acceptanceFrame); return window.acceptanceFrames; });
  const run = await (await fetch(origin + '/api/circuit/v1/runs/' + runId)).json();
  output = await (await fetch(origin + '/api/circuit/v1/runs/' + runId + '/output')).json();
  fs.writeFileSync(path.join(evidence, 'run.json'), JSON.stringify({ run, output }, null, 2));
  fs.writeFileSync(path.join(evidence, 'frames.json'), JSON.stringify(samples));
  await page.screenshot({ path: path.join(evidence, 'observe.png'), fullPage: true });
  assert.equal(run.state, 'completed', 'Real Observe must complete successfully');
  if (process.env.SFX_EXPECTED_OUTCOME) assert.equal(output.disposition, process.env.SFX_EXPECTED_OUTCOME);
  assert(!JSON.stringify(output).includes('CELL_EXECUTION_FAILED'), 'Technical failure is not successful Observe');
  const current = samples.flatMap(s => s.current);
  assert(current.some(n => n.kind === 'provider'), 'A real provider must receive the dot while live');
  // A sub-frame operation need not be sampled under the dot. Its owning step
  // must stay visibly busy throughout a provider call, as the viewer contract
  // specifies; receipt-prefix verification covers the shorter transitions.
  assert(samples.some(s => s.busy.some(id => id.startsWith('operation:'))), 'Owning execution step must remain visibly active');
  assert(samples.some(s => s.busy.some(id => id.startsWith('call:'))), 'Owning port call must remain visibly active');
  assert(current.some(n => n.kind === 'variant'), 'An exact declared outcome must receive the dot');
  assert(samples.every(s => !s.mode.includes('REPLAY')), 'Live acceptance cannot use replay');
  stage('Checking browser run attribution');
  const attributed = await page.evaluate(async () => {
    const response = await fetch('/api/circuit/v1/session/runs', { signal: AbortSignal.timeout(145000) });
    return response.json();
  });
  assert(attributed.principalId === login.principalId && attributed.runs.some(r => r.runId === runId));
  record('Signed-in browser Observe completes with live operation/provider/outcome visits and principal attribution');

  stage('Checking browser sign-out');
  let logoutStatus;
  const onLogout = response => { if (response.url() === origin + '/api/circuit/v1/session/logout') logoutStatus = response.status(); };
  page.on('response', onLogout);
  // The page also has a long-lived SSE response; do not wait for network idle.
  await page.locator('#identity button').click({ timeout: 15000, noWaitAfter: true });
  stage('Sign-out click completed; awaiting signed-out UI');
  await page.waitForFunction(() => document.querySelector('#identity a')?.textContent === 'Sign in', null, { timeout: 145000 });
  page.off('response', onLogout);
  assert.equal(logoutStatus, 200, 'Sign-out transport must confirm success');
  stage('Signed-out UI confirmed; checking cookie removal');
  assert(!(await context.cookies()).some(c => c.name === '__Host-sfx-session'));
  stage('Checking revoked cookie rejection');
  const revoked = await post('/api/circuit/v1/runs', request, cookie);
  assert.equal(revoked.status, 401); assert.equal(revoked.body.disposition, 'SESSION_ENDED');
  record('Sign-out revokes the real session; replayed cookie cannot Observe');

  if (process.env.SFX_BROWSER_VERIFY_CLI === '1') {
    stage('Checking installed CLI');
    const cli = spawn(process.execPath, [fileURLToPath(new URL('../sfx-api/live-auth-test.mjs', import.meta.url))], {
      windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], env: process.env });
    let stdout = '', stderr = ''; cli.stdout.on('data', d => stdout += d); cli.stderr.on('data', d => stderr += d);
    cli.stdin.end(JSON.stringify(fixture));
    const code = await new Promise((resolve, reject) => { cli.on('error', reject); cli.on('close', resolve); });
    assert.equal(code, 0, 'Installed CLI authentication regression');
    for (const secret of secrets) assert(!(stdout + stderr).includes(secret), 'Private value in CLI output');
    fs.writeFileSync(path.join(evidence, 'cli.json'), stdout);
    record('Installed CLI login/whoami/logout regression passed');
  }
  assert.equal(errors.length, 0, 'Browser JavaScript errors');
  for (const secret of secrets) assert(!(captured + consoleMessages.join('\n') + JSON.stringify(output)).includes(secret), 'Private value in observable material');
  record('No password or bearer in browser console, run output or observer testimony');
  if (logProcess) {
    assert(!logTruncated && logText.length > 100, 'Azure log sample must be available and complete within its bound');
    if (fixture.logs) { logStatus = Number(logText.match(/HTTP\/[\d.]+ (\d+)/)?.[1]); assert.equal(logStatus,200); assert(logExit===undefined || logExit===0); }
    assert(logText.includes('STAGING_GATEWAY_READY'), 'Sample must contain real host output, not an Azure CLI diagnostic');
    for (const secret of secrets) assert(!logText.includes(secret), 'Private acceptance value in server logs');
    assert(!/Bearer\s+[A-Za-z0-9+/_=-]{24,}/.test(logText), 'Bearer-like credential in server logs');
    record('Azure log sample contains no acceptance password/session bearer or bearer-like credential');
  }
  const receipt = { checkedAt: new Date().toISOString(), origin, runId, sceneDigest: scene.snapshotDigest,
    checks, errors, sampleCount: samples.length, visited: [...new Set(samples.flatMap(s => s.current.map(n => n.id)))],
    serverLogCheck: { performed: Boolean(logProcess), httpStatus:logStatus, actualHostOutput:logText.includes('STAGING_GATEWAY_READY'), sampledCharacters: logText.length, truncated: logTruncated, rawLogsRetained: false },
    basis: 'Real identity session and fresh capability execution through product browser UI; no response mocks or replay overrides' };
  fs.writeFileSync(path.join(evidence, 'browser-receipt.json'), JSON.stringify(receipt, null, 2));
  process.stdout.write(JSON.stringify(receipt));
} catch (error) {
  fs.writeFileSync(path.join(evidence, 'failed.json'), JSON.stringify({ checks, runId, error: error.name, message: secrets.reduce((m,s) => m.replaceAll(s, '[private]'), error.message) }, null, 2));
  process.stderr.write(`BROWSER_ACCEPTANCE_FAILED after ${checks.length} checks (${error.name}); private diagnostic retained\n`);
  process.exitCode = 1;
} finally {
  if (cookie) try { await post('/api/circuit/v1/session/logout', {}, cookie); } catch {}
  logProcess?.kill();
  streamController.abort(); await collect;
  if (streamFailure) process.exitCode = 1;
  if (secrets.every(secret => !captured.includes(secret))) fs.writeFileSync(path.join(evidence, 'capture.sse'), captured);
  await browser.close();
}
