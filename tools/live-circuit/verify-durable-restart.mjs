// Re-authenticate the same owner and reopen the existing run; never submit Observe.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { durableSnapshot } from './durable-snapshot.mjs';
let input = ''; for await (const chunk of process.stdin) input += chunk;
const fixture = JSON.parse(input); input = '';
const directory = process.env.SFX_BROWSER_EVIDENCE, origin = fixture.endpoint;
const before = JSON.parse(fs.readFileSync(path.join(directory, 'browser/durable-before.json')));
const restart = JSON.parse(fs.readFileSync(path.join(directory, 'restart.json')));
const request = JSON.parse(fs.readFileSync(path.join(directory, 'observe-request.json')));
assert(restart.bootId && restart.previousBoot && restart.bootId !== restart.previousBoot);
const { chromium } = await import(pathToFileURL(process.env.SFX_BROWSER_TEST_MODULE).href);
const browser = await chromium.launch({ executablePath: process.env.SFX_BROWSER_EXECUTABLE, headless: true });
const context = await browser.newContext({ viewport: { width: 1600, height: 1200 } });
const page = await context.newPage(); let admissions = 0, cookie;
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', r => { if (r.method() === 'POST' && new URL(r.url()).pathname === '/api/circuit/v1/runs') admissions++; });
try {
  await page.goto(origin + '/circuit/login');
  await page.locator('#identifier').fill(fixture.identifier);
  await page.locator('#password').fill(fixture.password);
  const login = page.waitForResponse(r => r.url() === origin + '/api/circuit/v1/session' && r.request().method() === 'POST', { timeout: 145000 });
  await page.locator('#submit').click(); assert.equal((await login).status(), 200);
  await page.locator('#signed-in').waitFor({ state: 'visible', timeout: 145000 });
  const session = (await context.cookies()).find(c => c.name === '__Host-sfx-session'); assert(session);
  cookie = session.name + '=' + session.value;
  const runsResponse = await fetch(origin + '/api/circuit/v1/session/runs', { headers: { cookie }, signal: AbortSignal.timeout(90000) });
  assert.equal(runsResponse.status, 200);
  assert((await runsResponse.json()).runs.some(r => r.runId === before.runId), 'Run remains listed for the same owner');
  const after = await durableSnapshot(origin, before.runId, cookie);
  assert.deepEqual(after, before, 'Every captured event, graph and output must survive the restart');
  await page.goto(origin + '/circuit/explorer?' + new URLSearchParams({ capability: request.subject, namespace: request.namespace,
    scenario: request.subject, page: 'scenario-1', run: before.runId }));
  await page.waitForFunction(() => /API run .* · completed/.test(document.querySelector('#observe-status')?.textContent ?? ''), null, { timeout: 145000 });
  assert.equal(await page.locator('#view-linear').getAttribute('aria-pressed'), 'true', 'Linear circuit remains the default');
  assert.equal(await page.locator('#observe-resume').isVisible(), false);
  assert.equal(admissions, 0, 'Reopening retained evidence must not re-execute');
  assert.deepEqual(errors, []);
  await page.screenshot({ path: path.join(directory, 'durable-after-restart.png'), fullPage: true });
  fs.writeFileSync(path.join(directory, 'durable-restart.json'), JSON.stringify({ checkedAt: new Date().toISOString(),
    ...after, previousBoot: restart.previousBoot, bootId: restart.bootId, admissions, browserErrors: errors,
    checks: ['same owner lists run', 'complete SQL capture', 'all event identities and bytes match', 'graph and output match', 'browser reopens original run', 'no new execution'] }, null, 2));
  console.log('Same owner reopened the same SQL run after restart; events, graph and output identical; no new execution.');
} finally {
  if (cookie) await fetch(origin + '/api/circuit/v1/session/logout', { method: 'POST', headers: { origin, cookie, 'content-type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(90000) }).catch(() => {});
  await browser.close();
}
