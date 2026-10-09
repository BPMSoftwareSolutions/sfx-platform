// Declared-home presentation captures against a deployed origin, with its own
// signed-in session. Post-acceptance qualification: it never gates a release
// and never starts an execution. Credentials arrive over stdin and are never
// persisted or printed; the session is revoked in cleanup.
//   echo <fixture-json> | node tools/live-circuit/verify-presentation.mjs
// Set SFX_BROWSER_ORIGIN, SFX_BROWSER_CAPTURES and SFX_BROWSER_TEST_MODULE.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { captureDeclaredHome } from './browser-captures.mjs';

let input = ''; for await (const chunk of process.stdin) input += chunk;
const fixture = JSON.parse(input); input = '';
const origin = process.env.SFX_BROWSER_ORIGIN || fixture.endpoint;
const outDir = path.resolve(process.env.SFX_BROWSER_CAPTURES ?? 'artifacts/staging/browser-captures');
const { chromium } = await import(pathToFileURL(process.env.SFX_BROWSER_TEST_MODULE).href);
const browser = await chromium.launch({ executablePath: process.env.SFX_BROWSER_EXECUTABLE, headless: true });
let stage = 'signing in', cookie;
try {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1200 } });
  context.setDefaultTimeout(30000); context.setDefaultNavigationTimeout(90000);
  const page = await context.newPage();
  await page.goto(origin + '/circuit/login');
  await page.locator('#identifier').fill(fixture.identifier);
  await page.locator('#password').fill(fixture.password);
  const login = page.waitForResponse(r => r.url() === origin + '/api/circuit/v1/session' && r.request().method() === 'POST');
  await page.locator('#submit').click();
  if ((await login).status() !== 200) throw new Error('PRESENTATION_SIGN_IN_REJECTED');
  await page.locator('#signed-in').waitFor({ state: 'visible' });
  const session = (await context.cookies()).find(c => c.name === '__Host-sfx-session');
  if (session) cookie = `${session.name}=${session.value}`;
  await page.close();
  stage = 'capturing the declared home signed out and signed in';
  const receipt = await captureDeclaredHome({ browser, origin, outDir, signedInContext: context, requireSignedIn: true });
  fs.writeFileSync(path.join(outDir, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  process.stdout.write(JSON.stringify({ capturedAt: receipt.capturedAt, viewports: receipt.viewports.length,
    files: receipt.captures.filter(capture => capture.file).length, failedChecks: receipt.checks.filter(check => !check.ok).length }));
} catch (error) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'failed.json'), JSON.stringify({ at: new Date().toISOString(), stage,
    classification: error.code === 'ERR_ASSERTION' ? 'product' : 'unclassified', error: error.name,
    message: String(error.message).replaceAll(fixture.password, '[private]'), checks: error.receipt?.checks ?? [] }, null, 2) + '\n');
  process.stderr.write(`PRESENTATION_CAPTURES_FAILED at "${stage}" (${error.name})\n`);
  process.exitCode = 1;
} finally {
  if (cookie) await fetch(origin + '/api/circuit/v1/session/logout', { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30000),
    headers: { origin, cookie, 'content-type': 'application/json' }, body: '{}' }).catch(() => {});
  await browser.close();
}
