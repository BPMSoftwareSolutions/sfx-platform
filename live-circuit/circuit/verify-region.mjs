#!/usr/bin/env node
// Declared-region host checks (shell lane: the four Explorer regions and the
// shared shell footer):
//   node live-circuit/circuit/verify-region.mjs
// Source checks always run. When the sfx-providers checkout is present (an
// explicit SFX_UI_PROVIDER_DIR or a sibling checkout), a fixture observer loads
// the real ui-explorer-region and ui-shell-footer providers through
// ui.region.load and the candidates, contracts, digests and refusals are
// proven end to end. The region runtime module's Node-safe validator/digest
// functions run against those candidates. Reads only; the fixture observer
// never touches ports 8788/8799.
//
// No fallback: the Explorer's hand-authored region chrome and every page's
// .site-footer are gone; a region that cannot be read or projected renders its
// named failure state.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { REGION_OPERATION, REGION_REQUEST_CONTRACT, REGION_CONTENT_CONTRACT, HEADER_REGION_ID, FOOTER_REGION_ID,
  validateRegionContent, verifyRegionDigests, readingFailure } from './region-runtime.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const observerModule = path.join(repoRoot, 'live-circuit', 'dispatch-pair', 'observe-server.mjs');
const deckFile = path.join(repoRoot, 'outputs', 'capability-estate', 'landing-circuit', 'circuit-blueprint.json');
const fixturePort = 8895;
const fixtureBase = `http://localhost:${fixturePort}`;
const explorerRegions = ['header', 'left-sidebar', 'middle', 'right-sidebar'];
const configuredProvider = process.env.SFX_UI_PROVIDER_DIR ? path.resolve(process.env.SFX_UI_PROVIDER_DIR) : null;
const siblingProviders = path.resolve(repoRoot, '..', 'sfx-providers', 'providers');
const providerDirectory = configuredProvider ?? (existsSync(siblingProviders) ? siblingProviders : null);

const checks = [];
const limitations = [];
function record(name, pass, detail) {
  const entry = { name, pass: Boolean(pass), detail: detail ?? '' };
  checks.push(entry);
  console.log(`${entry.pass ? 'PASS' : 'FAIL'} ${name}${entry.detail ? ` · ${entry.detail}` : ''}`);
  return entry.pass;
}
async function guard(name, work) {
  try { const result = await work(); return record(name, result?.pass, result?.detail); }
  catch (error) { return record(name, false, `unavailable · ${error?.message ?? error}`); }
}

const [runtimeSource, hostSource, serverSource, explorerSource, htmlSource, shellSource, footerSource,
  homeHtml, loginHtml, pageHtml, homeJs, loginJs, pageJs] = await Promise.all([
  readFile(new URL('./region-runtime.js', import.meta.url), 'utf8'),
  readFile(new URL('./region-host.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../dispatch-pair/observe-server.mjs', import.meta.url), 'utf8'),
  readFile(new URL('./explorer.js', import.meta.url), 'utf8'),
  readFile(new URL('./explorer.html', import.meta.url), 'utf8'),
  readFile(new URL('./explorer-shell.js', import.meta.url), 'utf8'),
  readFile(new URL('./footer.js', import.meta.url), 'utf8'),
  readFile(new URL('./home.html', import.meta.url), 'utf8'),
  readFile(new URL('./login.html', import.meta.url), 'utf8'),
  readFile(new URL('./page.html', import.meta.url), 'utf8'),
  readFile(new URL('./home.js', import.meta.url), 'utf8'),
  readFile(new URL('./login.js', import.meta.url), 'utf8'),
  readFile(new URL('./page.js', import.meta.url), 'utf8'),
]);

record('region-contract', runtimeSource.includes(`'${REGION_OPERATION}'`) && runtimeSource.includes(`'${REGION_REQUEST_CONTRACT}'`)
  && runtimeSource.includes(`'${REGION_CONTENT_CONTRACT}'`) && typeof validateRegionContent === 'function'
  && typeof verifyRegionDigests === 'function' && typeof readingFailure === 'function'
  && runtimeSource.includes('FOOTER_REGION_ID'),
  `operation=${REGION_OPERATION} request=${REGION_REQUEST_CONTRACT} content=${REGION_CONTENT_CONTRACT} footer=${runtimeSource.includes('FOOTER_REGION_ID')}`);
record('region-safety', !runtimeSource.includes('innerHTML') && !runtimeSource.includes('document.write')
  && !/\beval\s*\(/.test(runtimeSource) && !runtimeSource.includes('new Function')
  && runtimeSource.includes("from './page-runtime.js'") && runtimeSource.includes('safeUrl'),
  `innerHTML=${runtimeSource.includes('innerHTML')} sharedSafeUrl=${runtimeSource.includes('safeUrl')}`);
record('region-host', hostSource.includes(`'${REGION_OPERATION}'`) && hostSource.includes('READ_ONLY')
  && hostSource.includes('SFX_UI_PROVIDER_DIR') && hostSource.includes('UI_REGION_PROVIDER_UNREADABLE')
  && hostSource.includes('REGION_PROVIDERS') && hostSource.includes('ui-shell-footer'),
  'the host maps each region to its declared provider package and refuses an unreadable provider by name');
record('region-served', serverSource.includes('serveRegionApi(') && serverSource.includes("['/circuit/region-runtime.js'")
  && serverSource.includes("['/circuit/explorer-shell.js'") && serverSource.includes("['/circuit/footer.js'"),
  `routeServed=${serverSource.includes('serveRegionApi(')} runtime=${serverSource.includes("['/circuit/region-runtime.js'")} shell=${serverSource.includes("['/circuit/explorer-shell.js'")} footer=${serverSource.includes("['/circuit/footer.js'")}`);
record('region-mounted', htmlSource.includes('id="region-header"') && htmlSource.includes('data-region="header"')
  && htmlSource.includes('id="tree"') && htmlSource.includes('data-region="left-sidebar"')
  && htmlSource.includes('id="region-middle"') && htmlSource.includes('data-region="middle"')
  && htmlSource.includes('id="context"') && htmlSource.includes('data-region="right-sidebar"')
  && htmlSource.includes('id="region-footer"') && htmlSource.includes('data-region="footer"')
  && !htmlSource.includes('class="site-header"') && !htmlSource.includes('site-nav'),
  'the Explorer body carries only region mounts; no hand-authored header/region chrome');
record('region-shell-slots', explorerSource.includes('createRegionRuntime(') && shellSource.includes('headerSlots(')
  && shellSource.includes('leftSidebarSlots(') && shellSource.includes('middleSlots(') && shellSource.includes('rightSidebarSlots(')
  && shellSource.includes("'identity-session-mount'")
  && explorerSource.includes("identity($('identity'))") && !explorerSource.includes('renderFallbackHeader'),
  'the shell composes every declared slot and mounts the regions once');
record('region-no-fallback', runtimeSource.includes('renderRegionFailure') && runtimeSource.includes('data-region-failure')
  && runtimeSource.includes('UI_REGION_PROVIDER_UNREADABLE') && !runtimeSource.includes('site-header')
  && !explorerSource.includes("$('identity').replaceChildren"),
  'a failed region renders its named state and never the old chrome');
record('footer-mounted', homeHtml.includes('id="region-footer"') && loginHtml.includes('id="region-footer"')
  && pageHtml.includes('id="region-footer"') && !homeHtml.includes('class="site-footer"')
  && !loginHtml.includes('class="site-footer"') && !pageHtml.includes('class="site-footer"')
  && [homeJs, loginJs, pageJs].every(source => source.includes("from './footer.js'"))
  && [homeJs, loginJs, pageJs].every(source => source.includes('mountFooter(')),
  'home, sign-in and declared pages mount the shared footer from its declared provider and carry no .site-footer');
record('footer-slots', footerSource.includes('FOOTER_REGION_ID') && footerSource.includes('footerSlots(')
  && ['footer-brand', 'footer-credit', 'footer-navigation', 'release-label'].every(name => footerSource.includes(`'${name}'`))
  && footerSource.includes('createRegionRuntime('),
  'the footer mount fills the four declared slots with shell behavior only');

let child = null;
function stopObserver() {
  const running = child; child = null;
  if (running && running.exitCode === null) running.kill();
}
async function startObserver(providerPath) {
  const env = { ...process.env, OBSERVER_PORT: String(fixturePort), SFX_UI_PROVIDER_DIR: providerPath };
  child = spawn(process.execPath, [observerModule], { env, cwd: repoRoot, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.resume(); child.stderr.resume(); child.on('error', () => {});
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`observe-server exited early with code ${child.exitCode}`);
    try { const response = await fetch(`${fixtureBase}/health`, { signal: AbortSignal.timeout(2000) }); if (response.ok) return; } catch { /* not ready */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('observe-server did not report /health within 20s');
}
const regionPath = regionId => `${fixtureBase}/api/circuit/v1/region?${new URLSearchParams({ contractId: REGION_REQUEST_CONTRACT, regionId })}`;

try {
  await startObserver(path.join(repoRoot, 'live-circuit', 'circuit', 'no-such-provider-package'));

  await guard('region-unreadable-named', async () => {
    const response = await fetch(regionPath('header'));
    const body = await response.json();
    return { pass: response.status === 503 && body?.disposition === 'HELD' && body?.findings?.[0]?.code === 'UI_REGION_PROVIDER_UNREADABLE',
      detail: `status=${response.status} disposition=${body?.disposition} code=${body?.findings?.[0]?.code}` };
  });

  await guard('region-method-405', async () => {
    const response = await fetch(regionPath('header'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    await response.body?.cancel();
    return { pass: response.status === 405, detail: `POST status=${response.status}` };
  });

  await guard('region-reading-failure-mapping', async () => {
    const held = readingFailure({ ok: false, status: 404, body: { disposition: 'HELD', candidate: null, findings: [{ code: 'UI_REGION_UNKNOWN', path: '$.regionId', message: 'unknown' }] } });
    const unreadable = readingFailure({ ok: false, status: 0, body: null, error: 'route down' });
    const authored = readingFailure({ ok: true, status: 200, body: { disposition: 'AUTHORED', candidate: { contractId: REGION_CONTENT_CONTRACT } , findings: [] } });
    return { pass: held?.code === 'UI_REGION_UNKNOWN' && unreadable?.code === 'UI_REGION_PROVIDER_UNREADABLE' && authored === null,
      detail: `held=${held?.code} unreadable=${unreadable?.code} authored=${authored === null ? 'accepted' : 'refused'}` };
  });
} catch (error) {
  record('region-fixture-observer', false, `could not start · ${error?.message ?? error}`);
} finally {
  stopObserver();
}

if (providerDirectory) {
  const candidates = new Map();
  try {
    await startObserver(providerDirectory);

    for (const regionId of [...explorerRegions, FOOTER_REGION_ID]) {
      await guard(`region-read-authored:${regionId}`, async () => {
        const response = await fetch(regionPath(regionId));
        const body = await response.json();
        const candidate = body?.candidate ?? null;
        candidates.set(regionId, candidate);
        const expectedProvider = regionId === FOOTER_REGION_ID ? 'sfx-ui-shell-footer' : `sfx-ui-explorer-region-${regionId}`;
        return { pass: response.status === 200 && body?.disposition === 'AUTHORED' && body?.shapeConforms === true
          && candidate?.regionId === regionId && candidate?.regionProviderId === expectedProvider
          && (candidate?.assets?.length ?? 0) === 3,
          detail: `status=${response.status} disposition=${body?.disposition} region=${candidate?.regionId} provider=${candidate?.regionProviderId} place=${candidate?.place} assets=${candidate?.assets?.length ?? 0}` };
      });
    }

    await guard('region-candidate-vocabulary', async () => {
      const results = [];
      for (const regionId of [...explorerRegions, FOOTER_REGION_ID]) {
        const candidate = candidates.get(regionId);
        if (!candidate) { results.push(`${regionId}:missing`); continue; }
        const shape = validateRegionContent(candidate, regionId);
        const digests = await verifyRegionDigests(candidate);
        results.push(`${regionId}:${shape.ok && digests.ok ? 'valid' : shape.refusals.map(r => r.code).concat(digests.refusals.map(r => r.code)).join(',')}`);
      }
      return { pass: results.every(result => result.endsWith('valid')), detail: results.join(' ') };
    });

    await guard('region-tamper-refused', async () => {
      const refusals = [];
      for (const regionId of [...explorerRegions, FOOTER_REGION_ID]) {
        const candidate = candidates.get(regionId);
        if (!candidate) continue;
        const tampered = structuredClone(candidate);
        tampered.assets[0].content += '\n/*tampered*/';
        const digests = await verifyRegionDigests(tampered);
        if (!digests.ok) refusals.push(digests.refusals[0].code);
      }
      return { pass: refusals.length === candidates.size && refusals.every(code => code === 'UI_REGION_ASSET_DIGEST_MISMATCH'),
        detail: refusals.join(',') };
    });

    await guard('region-refusals', async () => {
      const [unknown, invalid] = await Promise.all([
        fetch(regionPath('banner')),
        fetch(`${fixtureBase}/api/circuit/v1/region?contractId=${REGION_REQUEST_CONTRACT}`),
      ]);
      const unknownBody = await unknown.json(), invalidBody = await invalid.json();
      return { pass: unknown.status === 404 && unknownBody?.findings?.[0]?.code === 'UI_REGION_UNKNOWN'
        && invalid.status === 400 && invalidBody?.findings?.[0]?.code === 'UI_REGION_REQUEST_INVALID',
        detail: `unknown=${unknown.status}/${unknownBody?.findings?.[0]?.code} missing=${invalid.status}/${invalidBody?.findings?.[0]?.code}` };
    });

    if (existsSync(deckFile)) {
      await guard('region-blueprint-deck', async () => {
        const deck = JSON.parse(await readFile(deckFile, 'utf8'));
        const rows = [];
        for (const regionId of explorerRegions) {
          const candidate = candidates.get(regionId);
          const scenario = (deck.scenarios ?? []).find(entry => entry.id === `ui-region-${regionId}`);
          const operation = (deck.nodes ?? []).find(entry => entry.id === `operation:ui-region-${regionId}.v1:1`);
          const binding = (deck.nodes ?? []).find(entry => entry.id === `binding:load-explorer-region-${regionId}`);
          const assets = new Map((candidate?.assets ?? []).map(asset => [asset.kind, asset]));
          const pass = scenario?.authorityId === `ui-region-${regionId}.v1` && scenario?.inputContractId === REGION_REQUEST_CONTRACT
            && scenario?.outcomeContractId === REGION_CONTENT_CONTRACT
            && binding?.providerIds?.includes(candidate?.regionProviderId)
            && ['css', 'html', 'svg'].every(kind => assets.get(kind)?.path === `assets/${regionId}.${kind}`);
          rows.push(`${regionId}:${pass ? 'match' : 'diff'}`);
        }
        return { pass: rows.every(row => row.endsWith('match')), detail: rows.join(' ') };
      });
      limitations.push('The shared footer is a shell-chrome revision outside the landing deck\'s four region resolves; the browser capture records its blueprint-diff note.');
    } else {
      limitations.push('The blueprint deck (outputs/capability-estate/landing-circuit/circuit-blueprint.json) is not present in this checkout; the browser capture bundle records the deck diff.');
    }
  } catch (error) {
    record('region-fixture-observer', false, `could not start over the provider packages · ${error?.message ?? error}`);
  } finally {
    stopObserver();
  }
} else {
  record('region-provider-package', true, 'recorded unavailable · set SFX_UI_PROVIDER_DIR or keep a sibling sfx-providers checkout to run the provider checks');
  limitations.push('The provider invocation checks need the sfx-providers packages (SFX_UI_PROVIDER_DIR or a sibling checkout); the local browser capture bundle is the real-browser proof.');
}

const summary = {
  tool: 'verify-region.mjs',
  operation: REGION_OPERATION,
  contract: REGION_CONTENT_CONTRACT,
  providerDirectory: providerDirectory ?? null,
  passed: checks.filter(check => check.pass).length,
  failed: checks.filter(check => !check.pass).length,
  checks,
  limitations,
};
console.log(JSON.stringify(summary, null, 2));
assert.equal(summary.failed, 0, 'region checks failed');
process.exitCode = summary.failed > 0 ? 1 : 0;
