// Real-browser click-path proof for the first declared-region mount (the
// Explorer header). Playwright is supplied by the environment:
//   SFX_BROWSER_TEST_MODULE  path to an installed playwright module
//   SFX_BROWSER_EXECUTABLE   optional browser executable
//   SFX_BROWSER_ORIGIN       default http://127.0.0.1:8788
//   SFX_REGION_CAPTURE_DIR   default artifacts/region-header-local
//   SFX_BROWSER_IDENTIFIER / SFX_BROWSER_PASSWORD  optional real principal
// The path is login page -> landing (Explorer) -> the header rendered from the
// declared ui-region-header region. The run also forces a provider failure and
// a tampered candidate to prove the named failure state replaces the region and
// the old chrome never returns, then diffs the served candidate against the
// blueprint deck when the deck is present.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const origin = (process.env.SFX_BROWSER_ORIGIN ?? 'http://127.0.0.1:8788').replace(/\/$/, '');
const outDir = path.resolve(process.env.SFX_REGION_CAPTURE_DIR ?? path.join(repoRoot, 'artifacts', 'region-header-local'));
const deckFile = path.join(repoRoot, 'outputs', 'capability-estate', 'landing-circuit', 'circuit-blueprint.json');
fs.mkdirSync(outDir, { recursive: true });
assert(process.env.SFX_BROWSER_TEST_MODULE, 'SFX_BROWSER_TEST_MODULE_REQUIRED');
const { chromium } = await import(pathToFileURL(process.env.SFX_BROWSER_TEST_MODULE).href);
const browser = await chromium.launch({ executablePath: process.env.SFX_BROWSER_EXECUTABLE, headless: true });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
context.setDefaultTimeout(60000);
context.setDefaultNavigationTimeout(120000);
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', error => pageErrors.push(error.message));
const checks = [];
const check = (name, ok, detail = '') => { checks.push({ name, ok: Boolean(ok), detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` · ${detail}` : ''}`); };
const receipt = { contractId: 'region-header-capture.v1', capturedAt: new Date().toISOString(), origin, outDir,
  identity: process.env.SFX_BROWSER_IDENTIFIER ? 'principal' : 'signed-out', screenshots: [], checks, blueprintDiff: null };

const CANDIDATE_URL = '/api/circuit/v1/region?contractId=ui-region-request.v1&regionId=header';
const readCandidate = () => page.evaluate(async url => {
  const response = await fetch(url, { redirect: 'error' });
  return { status: response.status, body: await response.json() };
}, CANDIDATE_URL);

async function settle() {
  await page.waitForFunction(() => {
    const root = document.querySelector('#region-header');
    if (!root) return false;
    if (root.dataset.regionFailure !== undefined) return true;
    if (root.dataset.regionSource !== 'declared') return false;
    const identity = document.getElementById('identity');
    return identity !== null && identity.childNodes.length > 0;
  }, null, { timeout: 60000 });
}

try {
  // 1. Login page. A real principal is used when supplied; otherwise the click
  // path continues from the login page's own navigation.
  await page.goto(origin + '/circuit/login', { waitUntil: 'load' });
  await page.waitForSelector('#sign-in', { state: 'visible' });
  await page.screenshot({ path: path.join(outDir, '01-login.png'), fullPage: true });
  receipt.screenshots.push('01-login.png');
  check('click-path-login', true, `login page loaded at ${origin}/circuit/login`);

  if (process.env.SFX_BROWSER_IDENTIFIER && process.env.SFX_BROWSER_PASSWORD) {
    await page.locator('#identifier').fill(process.env.SFX_BROWSER_IDENTIFIER);
    await page.locator('#password').fill(process.env.SFX_BROWSER_PASSWORD);
    const accepted = page.waitForResponse(response => response.url() === origin + '/api/circuit/v1/session' && response.request().method() === 'POST');
    await page.locator('#submit').click();
    const response = await accepted;
    check('click-path-sign-in', response.status() === 200, `POST /api/circuit/v1/session status=${response.status()}`);
    await page.locator('#signed-in').waitFor({ state: 'visible' });
    await page.screenshot({ path: path.join(outDir, '02-login-signed-in.png'), fullPage: true });
    receipt.screenshots.push('02-login-signed-in.png');
    await page.locator('#continue').click();
  } else {
    await page.locator('header.site-header a[href="/circuit/explorer"]').first().click();
  }

  // 2. Landing: the Explorer with the declared region header.
  await page.waitForURL(/\/circuit\/explorer/, { timeout: 90000 });
  await settle();
  check('click-path-landing', page.url().includes('/circuit/explorer'), page.url());

  const rendered = await page.evaluate(() => {
    const root = document.getElementById('region-header');
    const region = root?.querySelector('.region-header') ?? null;
    const slots = region ? [...region.querySelectorAll('[data-slot]')].map(node => ({ name: node.dataset.slot, children: node.childNodes.length })) : [];
    const style = root?.querySelector('style[data-region-asset]') ?? null;
    const figure = root?.querySelector('svg[data-region-asset]') ?? null;
    const computed = region ? getComputedStyle(region) : null;
    return {
      source: root?.dataset.regionSource ?? null,
      failure: root?.dataset.regionFailure ?? null,
      regionClass: region?.className ?? null, role: region?.dataset.regionRole ?? null,
      slots, slotsFilled: slots.every(slot => slot.children > 0),
      styleAsset: style?.getAttribute('data-region-asset') ?? null, styleDigest: style?.getAttribute('data-region-digest') ?? null,
      figureAsset: figure?.getAttribute('data-region-asset') ?? null, figureDigest: figure?.getAttribute('data-region-digest') ?? null,
      figureFrame: Boolean(figure?.querySelector('.region-frame')), figureNodes: figure?.querySelectorAll('.region-node').length ?? 0,
      display: computed?.display ?? null, minHeight: computed?.minHeight ?? null, borderBottom: computed?.borderBottomWidth ?? null,
      background: computed?.backgroundColor ?? null,
      brand: Boolean(region?.querySelector('[data-slot="brand"] img')),
      navLinks: [...(region?.querySelectorAll('[data-slot="primary-navigation"] a') ?? [])].map(link => link.getAttribute('href')),
      identity: region?.querySelector('#identity')?.textContent ?? null,
      oldChrome: Boolean(root?.querySelector('.site-header, .wrap')) || root?.querySelectorAll('script').length > 0,
    };
  });
  receipt.rendered = rendered;
  check('region-declared-source', rendered.source === 'declared' && rendered.failure === null, `source=${rendered.source} failure=${rendered.failure ?? '(none)'}`);
  check('region-element', rendered.regionClass === 'region region-header' && rendered.role === 'shell-chrome', `class=${rendered.regionClass} role=${rendered.role}`);
  check('region-slots-filled', rendered.slots.length === 4 && rendered.slotsFilled,
    rendered.slots.map(slot => `${slot.name}:${slot.children}`).join(' '));
  check('region-declared-style-applied', rendered.styleAsset === 'header.css' && /^sha256:[0-9a-f]{64}$/.test(rendered.styleDigest ?? '')
    && rendered.display === 'flex' && rendered.minHeight === '56px' && rendered.borderBottom === '1px' && rendered.background === 'rgba(2, 13, 25, 0.96)',
    `asset=${rendered.styleAsset} display=${rendered.display} minHeight=${rendered.minHeight} border=${rendered.borderBottom} background=${rendered.background}`);
  check('region-declared-figure', rendered.figureAsset === 'header.svg' && rendered.figureFrame && rendered.figureNodes === 2,
    `asset=${rendered.figureAsset} frame=${rendered.figureFrame} nodes=${rendered.figureNodes}`);
  check('region-shell-slots', rendered.brand && rendered.navLinks.includes('/circuit/home') && rendered.navLinks.includes('/circuit/explorer') && rendered.identity !== null,
    `brand=${rendered.brand} nav=${rendered.navLinks.join(',')} identity=${JSON.stringify(rendered.identity)}`);
  check('region-no-old-chrome', !rendered.oldChrome, `oldChrome=${rendered.oldChrome}`);

  // 3. Digest evidence in the browser: recompute the candidate and every asset.
  const candidateReading = await readCandidate();
  check('region-candidate-read', candidateReading.status === 200 && candidateReading.body?.disposition === 'AUTHORED',
    `status=${candidateReading.status} disposition=${candidateReading.body?.disposition}`);
  const digestCheck = await page.evaluate(async candidate => {
    const hex = buffer => [...new Uint8Array(buffer)].map(byte => byte.toString(16).padStart(2, '0')).join('');
    const sha256 = async text => 'sha256:' + hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
    const assets = candidate.assets.map(asset => ({ ...asset }));
    const assetResults = [];
    for (const asset of assets) assetResults.push([asset.assetId, await sha256(asset.content) === asset.digest]);
    const body = { contractId: candidate.contractId, providerId: candidate.providerId, regionProviderId: candidate.regionProviderId,
      regionId: candidate.regionId, role: candidate.role, place: candidate.place, basis: candidate.basis,
      assets: assets.map(asset => ({ assetId: asset.assetId, kind: asset.kind, mediaType: asset.mediaType, role: asset.role,
        path: asset.path, bytes: asset.bytes, digest: asset.digest, content: asset.content })) };
    return { assets: assetResults, candidate: await sha256(JSON.stringify(body)) === candidate.digest };
  }, candidateReading.body.candidate);
  receipt.digests = digestCheck;
  check('region-digests-verified', digestCheck.candidate && digestCheck.assets.every(([, ok]) => ok),
    `candidate=${digestCheck.candidate} assets=${digestCheck.assets.map(([id, ok]) => `${id}:${ok}`).join(' ')}`);

  await page.screenshot({ path: path.join(outDir, '03-landing.png'), fullPage: true });
  await page.locator('#region-header').screenshot({ path: path.join(outDir, '03-header-region.png') });
  receipt.screenshots.push('03-landing.png', '03-header-region.png');

  // 4. The blueprint deck diff: the served candidate against the declared region
  // circuit, operation and binding, when the deck is present in this checkout.
  if (fs.existsSync(deckFile)) {
    const deck = JSON.parse(fs.readFileSync(deckFile, 'utf8'));
    const candidate = candidateReading.body.candidate;
    const scenario = (deck.scenarios ?? []).find(entry => entry.id === 'ui-region-header');
    const operation = (deck.nodes ?? []).find(entry => entry.id === 'operation:ui-region-header.v1:1');
    const binding = (deck.nodes ?? []).find(entry => entry.id === 'binding:load-explorer-region-header');
    const moduleRealization = (binding?.realizations ?? []).find(realization => realization.field === 'module')?.value ?? null;
    const assets = new Map((candidate.assets ?? []).map(asset => [asset.kind, asset]));
    const rows = [
      { expectation: 'scenario ↔ region', deck: scenario?.id ?? null, served: candidate.regionId ? `ui-region-${candidate.regionId}` : null },
      { expectation: 'authority ↔ region', deck: scenario?.authorityId ?? null, served: candidate.regionId ? `ui-region-${candidate.regionId}.v1` : null },
      { expectation: 'request contract', deck: scenario?.inputContractId ?? null, served: 'ui-region-request.v1' },
      { expectation: 'content contract', deck: scenario?.outcomeContractId ?? null, served: candidate.contractId ?? null },
      { expectation: 'operation', deck: operation?.semanticId ?? null, served: candidate.regionId ? `ui-region-${candidate.regionId}.load` : null },
      { expectation: 'operation port', deck: operation?.portId ?? null, served: candidate.regionId ? `load-explorer-region-${candidate.regionId}` : null },
      { expectation: 'platform capability', deck: binding?.platformCapabilityId ?? null, served: candidate.regionId ? `sda-ui-explorer-region-${candidate.regionId}-port.v1` : null },
      { expectation: 'provider', deck: binding?.providerIds?.[0] ?? null, served: candidate.regionProviderId ?? null },
      { expectation: 'module realization', deck: moduleRealization, served: 'providers/ui-explorer-region/ui-explorer-region.mjs' },
      { expectation: 'role', deck: 'shell-chrome', served: candidate.role ?? null },
      { expectation: 'place', deck: '1', served: String(candidate.place ?? '') },
      { expectation: 'assets', deck: 'css,html,svg', served: [...assets.keys()].sort().join(',') },
      { expectation: 'css path', deck: `assets/${candidate.regionId}.css`, served: assets.get('css')?.path ?? null },
      { expectation: 'html path', deck: `assets/${candidate.regionId}.html`, served: assets.get('html')?.path ?? null },
      { expectation: 'svg path', deck: `assets/${candidate.regionId}.svg`, served: assets.get('svg')?.path ?? null },
    ].map(row => ({ ...row, pass: row.deck !== null && row.deck === row.served }));
    receipt.blueprintDiff = { deck: 'outputs/capability-estate/landing-circuit/circuit-blueprint.json', rows,
      failed: rows.filter(row => !row.pass).length };
    check('region-blueprint-diff', receipt.blueprintDiff.failed === 0,
      receipt.blueprintDiff.failed ? receipt.blueprintDiff.rows.filter(row => !row.pass).map(row => row.expectation).join(', ')
        : `${rows.length} deck expectations matched`);
    fs.writeFileSync(path.join(outDir, 'blueprint-diff.json'), JSON.stringify(receipt.blueprintDiff, null, 2) + '\n');
  } else {
    check('region-blueprint-diff', true, 'blueprint deck not present; recorded as a limitation');
  }

  // 5. Forced provider failure: the named state replaces the region; the old
  // chrome must never render.
  await page.route('**/api/circuit/v1/region?**', route => route.fulfill({ status: 503, contentType: 'application/json',
    body: JSON.stringify({ providerId: null, toolId: 'ui.region.load', disposition: 'HELD', candidate: null, shapeConforms: false,
      findings: [{ code: 'UI_REGION_PROVIDER_UNREADABLE', path: '$', message: 'Forced unreadable provider for the failure proof.' }] }) }));
  await page.reload({ waitUntil: 'load' });
  await settle();
  const failure = await page.evaluate(() => {
    const root = document.getElementById('region-header');
    const node = root?.querySelector('[data-region-failure]');
    return { code: node?.getAttribute('data-region-failure') ?? null, text: node?.textContent ?? '',
      oldChrome: Boolean(root?.querySelector('.site-header')), region: Boolean(root?.querySelector('.region-header')) };
  });
  receipt.providerFailure = failure;
  check('region-failure-named', failure.code === 'UI_REGION_PROVIDER_UNREADABLE' && failure.text.includes('Forced unreadable provider'),
    `code=${failure.code} region=${failure.region}`);
  check('region-failure-no-fallback', !failure.oldChrome && !failure.region, `oldChrome=${failure.oldChrome} region=${failure.region}`);
  await page.screenshot({ path: path.join(outDir, '04-region-provider-failure.png'), fullPage: true });
  receipt.screenshots.push('04-region-provider-failure.png');
  await page.unroute('**/api/circuit/v1/region?**');

  // 6. Tampered candidate: the digest check refuses by name in the browser.
  const tampered = structuredClone(candidateReading.body);
  const cssAsset = tampered.candidate.assets.find(asset => asset.kind === 'css');
  cssAsset.content += '\n/* tampered */';
  cssAsset.bytes = Buffer.byteLength(cssAsset.content, 'utf8');
  await page.route('**/api/circuit/v1/region?**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(tampered) }));
  await page.reload({ waitUntil: 'load' });
  await settle();
  const tamperFailure = await page.evaluate(() => document.querySelector('#region-header [data-region-failure]')?.getAttribute('data-region-failure') ?? null);
  receipt.tamperFailure = tamperFailure;
  check('region-tamper-named', tamperFailure === 'UI_REGION_ASSET_DIGEST_MISMATCH', `code=${tamperFailure}`);
  await page.screenshot({ path: path.join(outDir, '05-region-tamper-failure.png'), fullPage: true });
  receipt.screenshots.push('05-region-tamper-failure.png');
  await page.unroute('**/api/circuit/v1/region?**');

  check('console-clean', pageErrors.length === 0, pageErrors.join(' | ') || 'no page errors');
} catch (error) {
  check('capture-completed', false, error?.message ?? String(error));
} finally {
  receipt.completedAt = new Date().toISOString();
  receipt.failed = receipt.checks.filter(entry => !entry.ok).length;
  fs.writeFileSync(path.join(outDir, 'capture.json'), JSON.stringify(receipt, null, 2) + '\n');
  await browser.close();
  if (receipt.failed) process.exitCode = 1;
}
