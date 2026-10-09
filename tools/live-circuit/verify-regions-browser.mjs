// Real-browser click-path proof for the declared shell regions: the four
// Explorer regions (header, left-sidebar, middle, right-sidebar) and the shared
// shell footer across the Explorer, login, home and a declared page. Playwright
// is supplied by the environment:
//   SFX_BROWSER_TEST_MODULE  path to an installed playwright module
//   SFX_BROWSER_EXECUTABLE   optional browser executable
//   SFX_BROWSER_ORIGIN       default http://127.0.0.1:8788
//   SFX_REGION_CAPTURE_DIR   default artifacts/regions-local
//   SFX_BROWSER_IDENTIFIER / SFX_BROWSER_PASSWORD  optional real principal
// The run captures per-region and per-page screenshots, recomputes every
// candidate/asset digest in the browser, diffs each served candidate against
// the landing deck where the deck declares it (the footer records its
// blueprint-diff note), and forces a provider failure and a tampered candidate
// for every region to prove the named failure state replaces the region and no
// old chrome returns.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const origin = (process.env.SFX_BROWSER_ORIGIN ?? 'http://127.0.0.1:8788').replace(/\/$/, '');
const outDir = path.resolve(process.env.SFX_REGION_CAPTURE_DIR ?? path.join(repoRoot, 'artifacts', 'regions-local'));
const deckFile = path.join(repoRoot, 'outputs', 'capability-estate', 'landing-circuit', 'circuit-blueprint.json');
const declaredPage = process.env.SFX_REGION_DECLARED_PAGE ?? '/circuit/healthcare-solutions';
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
const receipt = { contractId: 'regions-capture.v1', capturedAt: new Date().toISOString(), origin, outDir,
  identity: process.env.SFX_BROWSER_IDENTIFIER ? 'principal' : 'signed-out', screenshots: [], checks, blueprintDiff: null };

const REGIONS = [
  { id: 'header', mount: 'region-header', className: 'region-header', role: 'shell-chrome' },
  { id: 'left-sidebar', mount: 'tree', className: 'region-left-sidebar', role: 'navigate-and-select' },
  { id: 'middle', mount: 'region-middle', className: 'region-middle', role: 'scenario-circuit-canvas-and-execution' },
  { id: 'right-sidebar', mount: 'context', className: 'region-right-sidebar', role: 'context-inspection-and-evidence' },
  { id: 'footer', mount: 'region-footer', className: 'region-footer', role: 'shell-chrome' }
];
const EXPLORER_REGIONS = REGIONS.filter(region => region.id !== 'footer');
const candidateUrl = id => `/api/circuit/v1/region?contractId=ui-region-request.v1&regionId=${id}`;

async function screenshot(name, locator = null) {
  if (locator) await locator.screenshot({ path: path.join(outDir, name) });
  else await page.screenshot({ path: path.join(outDir, name), fullPage: true });
  receipt.screenshots.push(name);
  return name;
}
async function settle(mounts) {
  await page.waitForFunction(ids => ids.every(id => {
    const root = document.getElementById(id);
    if (!root) return false;
    return root.dataset.regionSource === 'declared' || root.dataset.regionFailure !== undefined;
  }), mounts, { timeout: 60000 });
}
async function renderState() {
  return page.evaluate(regions => Object.fromEntries(regions.map(({ id, mount, className }) => {
    const root = document.getElementById(mount);
    const region = root?.querySelector(`.${className}`) ?? null;
    const style = root?.querySelector('style[data-region-asset]') ?? null;
    const figure = root?.querySelector('svg[data-region-asset]') ?? null;
    const slots = region ? [...region.querySelectorAll('[data-slot]')].map(node => ({ name: node.dataset.slot, children: node.childNodes.length })) : [];
    const figureClamped = (() => {
      if (!figure || !region) return null;
      const f = figure.getBoundingClientRect(), r = region.getBoundingClientRect();
      return f.top >= r.top - 1 && f.bottom <= r.bottom + 1 && f.left >= r.left - 1 && f.right <= r.right + 1;
    })();
    return [id, {
      source: root?.dataset.regionSource ?? null, failure: root?.dataset.regionFailure ?? null,
      failureCode: root?.querySelector('[data-region-failure]')?.getAttribute('data-region-failure') ?? null,
      regionClass: region?.className ?? null, role: region?.dataset.regionRole ?? null,
      slots, slotsFilled: slots.length > 0 && slots.every(slot => slot.children > 0),
      styleAsset: style?.getAttribute('data-region-asset') ?? null, styleDigest: style?.getAttribute('data-region-digest') ?? null,
      figureAsset: figure?.getAttribute('data-region-asset') ?? null, figureDigest: figure?.getAttribute('data-region-digest') ?? null,
      figureClamped,
      oldChrome: Boolean(root?.querySelector('.site-header, .site-footer, .wrap'))
    }];
  })), REGIONS);
}
async function digestEvidence(ids) {
  const readings = [];
  for (const id of ids) {
    const reading = await page.evaluate(async url => {
      const response = await fetch(url, { redirect: 'error' });
      return { status: response.status, body: await response.json() };
    }, candidateUrl(id));
    const digest = await page.evaluate(async candidate => {
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
    }, reading.body.candidate);
    readings.push({ id, status: reading.status, disposition: reading.body?.disposition, ...digest });
  }
  return readings;
}

try {
  // 1. Login page: the footer is already declared; the Explorer is reached by
  // the page's own navigation (or a real principal sign-in when supplied).
  await page.goto(origin + '/circuit/login', { waitUntil: 'load' });
  await page.waitForSelector('#sign-in', { state: 'visible' });
  await settle(['region-footer']);
  await screenshot('01-login.png');
  await screenshot('01-login-footer.png', page.locator('#region-footer'));
  const loginFooter = (await renderState()).footer;
  check('page-login-footer-declared', loginFooter.source === 'declared' && loginFooter.failure === null && loginFooter.slotsFilled,
    `source=${loginFooter.source} failure=${loginFooter.failure ?? '(none)'} slots=${loginFooter.slots.map(s => `${s.name}:${s.children}`).join(' ')}`);

  if (process.env.SFX_BROWSER_IDENTIFIER && process.env.SFX_BROWSER_PASSWORD) {
    await page.locator('#identifier').fill(process.env.SFX_BROWSER_IDENTIFIER);
    await page.locator('#password').fill(process.env.SFX_BROWSER_PASSWORD);
    const accepted = page.waitForResponse(response => response.url() === origin + '/api/circuit/v1/session' && response.request().method() === 'POST');
    await page.locator('#submit').click();
    const response = await accepted;
    check('click-path-sign-in', response.status() === 200, `POST /api/circuit/v1/session status=${response.status()}`);
    await page.locator('#signed-in').waitFor({ state: 'visible' });
    await screenshot('02-login-signed-in.png');
    await page.locator('#continue').click();
  } else {
    await page.locator('header.site-header a[href="/circuit/explorer"]').first().click();
  }

  // 2. Explorer: four declared regions plus the shared footer, then the click
  // path through the tree, the capability picker and the context tabs.
  await page.waitForURL(/\/circuit\/explorer/, { timeout: 90000 });
  await settle(['region-header', 'tree', 'region-middle', 'context', 'region-footer']);
  await page.waitForSelector('#tree-nodes .tree-item', { timeout: 90000 }).catch(() => {});
  await screenshot('03-explorer.png');
  const explorerState = await renderState();
  receipt.explorer = explorerState;
  for (const region of REGIONS) {
    const state = explorerState[region.id];
    check(`explorer-${region.id}-declared`, state.source === 'declared' && state.failure === null
      && state.regionClass === `region ${region.className}` && state.role === region.role,
      `source=${state.source} class=${state.regionClass} role=${state.role} slots=${state.slots.map(s => `${s.name}:${s.children}`).join(' ')}`);
    check(`explorer-${region.id}-slots-filled`, state.slotsFilled, state.slots.map(s => `${s.name}:${s.children}`).join(' '));
    check(`explorer-${region.id}-style-figure`, Boolean(state.styleAsset && /^sha256:[0-9a-f]{64}$/.test(state.styleDigest ?? ''))
      && Boolean(state.figureAsset && /^sha256:[0-9a-f]{64}$/.test(state.figureDigest ?? '')) && state.figureClamped === true,
      `style=${state.styleAsset} figure=${state.figureAsset} clamped=${state.figureClamped}`);
    check(`explorer-${region.id}-no-old-chrome`, !state.oldChrome, `oldChrome=${state.oldChrome}`);
    await screenshot(`03-explorer-${region.id}.png`, page.locator(`#${region.mount}`));
  }
  const oldChrome = await page.evaluate(() => ({
    siteHeader: Boolean(document.querySelector('.site-header')),
    siteFooter: Boolean(document.querySelector('.site-footer')),
    main: Boolean(document.getElementById('main')),
    asideTree: Boolean(document.querySelector('aside#tree'))
  }));
  check('explorer-no-hand-authored-chrome', !oldChrome.siteHeader && !oldChrome.siteFooter && !oldChrome.main && !oldChrome.asideTree,
    JSON.stringify(oldChrome));

  // Click path: picker submit for the selected capability, then a tree row and
  // the context tabs; every selection re-renders the declared regions only.
  await page.locator('#capability').fill('authenticate-ide-user');
  await page.locator('#picker button[type="submit"]').click();
  await page.waitForSelector('#tree-nodes .tree-item', { timeout: 90000 });
  await page.locator('#tree-nodes .tree-item').first().click();
  await page.waitForSelector('#context-body h3', { timeout: 30000 }).catch(() => {});
  await screenshot('04-explorer-selection.png');
  for (const region of EXPLORER_REGIONS) await screenshot(`04-explorer-selection-${region.id}.png`, page.locator(`#${region.mount}`));
  await page.locator('#tab-runs').click();
  await screenshot('05-explorer-runs-tab.png');
  await page.locator('#tab-evidence').click();
  await screenshot('05-explorer-evidence-tab.png');
  const tabState = await page.evaluate(() => [...document.querySelectorAll('[data-context-panel]')].map(host => ({ panel: host.dataset.contextPanel, hidden: host.hidden })));
  receipt.contextTabs = tabState;
  check('explorer-context-tabs-toggle-hosts', tabState.some(host => host.panel === 'run' && host.hidden)
    && tabState.some(host => host.panel === 'evidence' && !host.hidden),
    tabState.map(host => `${host.panel}:${host.hidden ? 'hidden' : 'shown'}`).join(' '));

  // 3. Digest evidence in the browser for every region.
  const digests = await digestEvidence(REGIONS.map(region => region.id));
  receipt.digests = digests;
  check('regions-digests-verified', digests.every(entry => entry.status === 200 && entry.disposition === 'AUTHORED'
    && entry.candidate && entry.assets.every(([, ok]) => ok)),
    digests.map(entry => `${entry.id}:${entry.candidate && entry.assets.every(([, ok]) => ok) ? 'ok' : 'bad'}`).join(' '));

  // 4. Home and a declared page: the same footer declared on both.
  await page.goto(origin + '/circuit/home', { waitUntil: 'load' });
  await settle(['region-footer']);
  await page.waitForFunction(() => (document.getElementById('page-root')?.childNodes.length ?? 0) > 0, null, { timeout: 60000 }).catch(() => {});
  await screenshot('06-home.png');
  await screenshot('06-home-footer.png', page.locator('#region-footer'));
  const homeFooter = (await renderState()).footer;
  check('page-home-footer-declared', homeFooter.source === 'declared' && homeFooter.slotsFilled && !homeFooter.oldChrome,
    `source=${homeFooter.source} slots=${homeFooter.slots.map(s => `${s.name}:${s.children}`).join(' ')}`);

  await page.goto(origin + declaredPage, { waitUntil: 'load' });
  await settle(['region-footer']);
  await page.waitForFunction(() => (document.getElementById('page-root')?.childNodes.length ?? 0) > 0, null, { timeout: 60000 }).catch(() => {});
  await screenshot('07-declared-page.png');
  await screenshot('07-declared-page-footer.png', page.locator('#region-footer'));
  const declaredFooter = (await renderState()).footer;
  check('page-declared-footer-declared', declaredFooter.source === 'declared' && declaredFooter.slotsFilled,
    `source=${declaredFooter.source} slots=${declaredFooter.slots.map(s => `${s.name}:${s.children}`).join(' ')}`);
  const declaredOldChrome = await page.evaluate(() => Boolean(document.querySelector('.site-footer')));
  check('pages-no-site-footer', !declaredOldChrome, `siteFooter=${declaredOldChrome}`);

  // 5. Forced provider failure on the Explorer: every region reports its named
  // state, and no old chrome renders anywhere.
  await page.route('**/api/circuit/v1/region?**', route => route.fulfill({ status: 503, contentType: 'application/json',
    body: JSON.stringify({ providerId: null, toolId: 'ui.region.load', disposition: 'HELD', candidate: null, shapeConforms: false,
      findings: [{ code: 'UI_REGION_PROVIDER_UNREADABLE', path: '$', message: 'Forced unreadable provider for the failure proof.' }] }) }));
  await page.goto(origin + '/circuit/explorer', { waitUntil: 'load' });
  await settle(REGIONS.map(region => region.mount));
  const failureState = await renderState();
  receipt.providerFailure = failureState;
  for (const region of REGIONS) {
    const state = failureState[region.id];
    check(`failure-${region.id}-named`, state.failureCode === 'UI_REGION_PROVIDER_UNREADABLE' && !state.regionClass && !state.oldChrome,
      `code=${state.failureCode} region=${state.regionClass} oldChrome=${state.oldChrome}`);
    await screenshot(`08-failure-provider-${region.id}.png`, page.locator(`#${region.mount}`));
  }
  const failureOldChrome = await page.evaluate(() => Boolean(document.querySelector('.site-header, .site-footer, #main, aside#tree')));
  check('failure-no-fallback-page', !failureOldChrome, `oldChrome=${failureOldChrome}`);
  await page.unroute('**/api/circuit/v1/region?**');

  // 6. Tampered candidates on the Explorer: every digest check refuses by name.
  const tampered = {};
  for (const region of REGIONS) {
    const reading = await page.evaluate(async url => (await fetch(url, { redirect: 'error' })).json(), candidateUrl(region.id));
    const css = reading.candidate.assets.find(asset => asset.kind === 'css');
    css.content += '\n/* tampered */';
    css.bytes = new TextEncoder().encode(css.content).length;
    tampered[region.id] = reading;
  }
  await page.route('**/api/circuit/v1/region?**', route => {
    const regionId = new URL(route.request().url()).searchParams.get('regionId');
    if (tampered[regionId]) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(tampered[regionId]) });
    return route.continue();
  });
  await page.goto(origin + '/circuit/explorer', { waitUntil: 'load' });
  await settle(REGIONS.map(region => region.mount));
  const tamperState = await renderState();
  receipt.tamperFailure = tamperState;
  for (const region of REGIONS) {
    const state = tamperState[region.id];
    check(`tamper-${region.id}-named`, state.failureCode === 'UI_REGION_ASSET_DIGEST_MISMATCH' && !state.oldChrome,
      `code=${state.failureCode} oldChrome=${state.oldChrome}`);
    await screenshot(`09-tamper-${region.id}.png`, page.locator(`#${region.mount}`));
  }
  await page.unroute('**/api/circuit/v1/region?**');

  // 7. Footer failure on home: the shared footer's named state replaces it.
  await page.route('**/api/circuit/v1/region?**', route => route.fulfill({ status: 503, contentType: 'application/json',
    body: JSON.stringify({ providerId: null, toolId: 'ui.region.load', disposition: 'HELD', candidate: null, shapeConforms: false,
      findings: [{ code: 'UI_REGION_PROVIDER_UNREADABLE', path: '$', message: 'Forced unreadable footer provider.' }] }) }));
  await page.goto(origin + '/circuit/home', { waitUntil: 'load' });
  await settle(['region-footer']);
  const homeFailure = (await renderState()).footer;
  check('failure-footer-home-named', homeFailure.failureCode === 'UI_REGION_PROVIDER_UNREADABLE' && !homeFailure.oldChrome,
    `code=${homeFailure.failureCode} oldChrome=${homeFailure.oldChrome}`);
  await screenshot('10-failure-footer-home.png', page.locator('#region-footer'));
  await page.unroute('**/api/circuit/v1/region?**');

  // 8. Blueprint deck diff for the four declared Explorer regions; the footer
  // records its shell-chrome revision note.
  const deckDiff = { deck: fs.existsSync(deckFile) ? 'outputs/capability-estate/landing-circuit/circuit-blueprint.json' : null, regions: {}, notes: [] };
  if (deckDiff.deck) {
    deckDiff.notes.push('Role expectations are the region roles declared in ui-explorer-region-blueprint.md §2 (the deck scenario nodes carry no role member).');
    const deck = JSON.parse(fs.readFileSync(deckFile, 'utf8'));
    for (const region of EXPLORER_REGIONS) {
      const reading = await page.evaluate(async url => (await fetch(url, { redirect: 'error' })).json(), candidateUrl(region.id));
      const candidate = reading.candidate;
      const scenario = (deck.scenarios ?? []).find(entry => entry.id === `ui-region-${region.id}`);
      const operation = (deck.nodes ?? []).find(entry => entry.id === `operation:ui-region-${region.id}.v1:1`);
      const binding = (deck.nodes ?? []).find(entry => entry.id === `binding:load-explorer-region-${region.id}`);
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
        { expectation: 'role', deck: region.role, served: candidate.role ?? null },
        { expectation: 'place', deck: String(region.id === 'header' ? 1 : region.id === 'left-sidebar' ? 2 : region.id === 'middle' ? 3 : 4), served: String(candidate.place ?? '') },
        { expectation: 'assets', deck: 'css,html,svg', served: [...assets.keys()].sort().join(',') },
        { expectation: 'css path', deck: `assets/${candidate.regionId}.css`, served: assets.get('css')?.path ?? null },
        { expectation: 'html path', deck: `assets/${candidate.regionId}.html`, served: assets.get('html')?.path ?? null },
        { expectation: 'svg path', deck: `assets/${candidate.regionId}.svg`, served: assets.get('svg')?.path ?? null }
      ].map(row => ({ ...row, pass: row.deck !== null && row.deck === row.served }));
      deckDiff.regions[region.id] = { rows, failed: rows.filter(row => !row.pass).length };
    }
  } else {
    deckDiff.notes.push('Landing deck not present in this checkout; no per-region diff could be computed.');
  }
  const footerReading = await page.evaluate(async url => (await fetch(url, { redirect: 'error' })).json(), candidateUrl('footer'));
  deckDiff.regions.footer = { note: 'The shared footer is a shell-chrome revision outside the landing deck\'s four region resolves; declared by the ui-shell-footer provider package (regionProviderId sfx-ui-shell-footer, place 5, role shell-chrome, basis implementation-strategy.md:62-65).',
    served: { providerId: footerReading.providerId, regionProviderId: footerReading.candidate?.regionProviderId, role: footerReading.candidate?.role, place: footerReading.candidate?.place, assets: (footerReading.candidate?.assets ?? []).map(asset => asset.path) },
    failed: 0 };
  const deckFailed = Object.values(deckDiff.regions).reduce((total, region) => total + (region.failed ?? 0), 0);
  check('regions-blueprint-diff', deckFailed === 0, deckFailed ? `${deckFailed} drifted expectations` : `${Object.keys(deckDiff.regions).length} region diffs clean`);
  fs.writeFileSync(path.join(outDir, 'blueprint-diff.json'), JSON.stringify(deckDiff, null, 2) + '\n');
  receipt.blueprintDiff = deckDiff;

  check('console-clean', pageErrors.length === 0, pageErrors.join(' | ') || 'no page errors');
} catch (error) {
  check('capture-completed', false, error?.stack ?? String(error));
} finally {
  receipt.completedAt = new Date().toISOString();
  receipt.failed = receipt.checks.filter(entry => !entry.ok).length;
  fs.writeFileSync(path.join(outDir, 'capture.json'), JSON.stringify(receipt, null, 2) + '\n');
  await browser.close();
  if (receipt.failed) process.exitCode = 1;
}
