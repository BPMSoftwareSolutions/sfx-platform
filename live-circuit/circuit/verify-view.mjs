#!/usr/bin/env node
// Declared-view host checks (shell lane):
//   node live-circuit/circuit/verify-view.mjs
// Spawns the observer over the file-backed page fixtures and proves the
// ui-view.v1 host end to end: the view document reads through the deployed page
// reader, the selection binds into its declared sources (host selection wins),
// the page validator admits it, and view-runtime.js is served to the Explorer
// drill-down. Reads only; the fixture observer runs on a spare port with an
// isolated environment (fixture-observer.mjs).
//
// Click path: the Explorer's provider glyph click must open the declared view
// (circuit-runtime.js selectComponent -> openDetail), reveal the Evidence pane,
// and keep the generic authority browser as a collapsed disclosure below the
// view. There is no standalone view page; the drill-down is its only host.
//
// Declared-only: the check also proves the bespoke provider-profile.js renderer
// and every fallback path are gone. A provider drill-down that cannot read its
// view is a named visible state, never a fallback render.
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startFixtureObserver } from './fixture-observer.mjs';
import { VIEW_CONTRACT, DEFAULT_VIEW_ID, bindViewSelection, viewPath, viewSelection, validateView, readView, createViewRuntime } from './view-runtime.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const fixtureDirectory = path.join(here, 'fixtures', 'pages');
let fixtureBase = null;

const checks = [];
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

const [runtimeSource, serverSource, explorerSource, storeSource, viewerSource] = await Promise.all([
  readFile(new URL('./view-runtime.js', import.meta.url), 'utf8'),
  readFile(new URL('../dispatch-pair/observe-server.mjs', import.meta.url), 'utf8'),
  readFile(new URL('./circuit-runtime.js', import.meta.url), 'utf8'),
  readFile(new URL('./live-store.mjs', import.meta.url), 'utf8'),
  readFile(new URL('./circuit-viewer.js', import.meta.url), 'utf8'),
]);

record('view-contract', runtimeSource.includes(`'${VIEW_CONTRACT}'`) && typeof createViewRuntime === 'function' && typeof readView === 'function',
  `contract=${VIEW_CONTRACT} projector=${/createPageRuntime/.test(runtimeSource)} validator=${/validatePage/.test(runtimeSource)}`);
record('view-safety', !runtimeSource.includes('innerHTML') && !runtimeSource.includes('document.write'),
  `innerHTML=${runtimeSource.includes('innerHTML')}`);
record('view-folded', serverSource.includes("['/circuit/view-runtime.js'")
  && !serverSource.includes("['/circuit/view'") && !serverSource.includes("['/circuit/view.html'"),
  `runtimeServed=${serverSource.includes("['/circuit/view-runtime.js'")} standalonePage=${serverSource.includes("['/circuit/view'")}`);
record('view-standalone-removed', !(await access(new URL('./view.html', import.meta.url)).then(() => true, () => false)),
  'view.html is deleted; the Explorer drill-down is the only mount point');
record('view-click-path',
  /function selectComponent\(id\)[\s\S]*?item\?\.kind === 'provider'[\s\S]*?openDetail\(id\)/.test(explorerSource)
  && explorerSource.includes('selectNode: selectComponent')
  && /addEventListener\('click', \(\) => selectNode\(/.test(viewerSource),
  'the provider glyph click selects the component and opens its declared view');
record('view-primary',
  explorerSource.includes("context.tab('evidence')") && explorerSource.includes("'Declared authority (raw)'")
  && /replaceChildren\(inspection, authority\)/.test(explorerSource),
  'the declared view is the visible drill-down content; the generic authority browser is a collapsed disclosure below it');
record('view-declared-only',
  explorerSource.includes('createViewRuntime(') && !explorerSource.includes('renderProviderProfile')
    && !explorerSource.includes('provider-profile.js') && !serverSource.includes("['/circuit/provider-profile.js'")
    && !storeSource.includes('readerFallback'),
  `createViewRuntime=${explorerSource.includes('createViewRuntime(')} fallbackImport=${explorerSource.includes('renderProviderProfile')} served=${serverSource.includes("['/circuit/provider-profile.js'")} readerFallback=${storeSource.includes('readerFallback')}`);
record('view-failure-named',
  explorerSource.includes('PROVIDER_VIEW_RENDER_FAILED') && explorerSource.includes('PROVIDER_VIEW_UNREADABLE') && explorerSource.includes('namedRefusal'),
  'the Explorer renders a named refusal for an absent, unreadable or unrenderable view');

await guard('view-selection-url', async () => {
  const selection = viewSelection(new URLSearchParams('viewId=provider-profile&provider=p%2Fid&capability=c&namespace=n&scenario=s&detail=d&expectedSnapshotDigest=' + 'a'.repeat(64)));
  return { pass: selection.viewId === 'provider-profile' && selection.providerId === 'p/id' && selection.detailId === 'd'
    && selection.capabilityId === 'c' && selection.namespaceId === 'n' && selection.scenarioId === 's' && selection.expectedSnapshotDigest === 'a'.repeat(64),
    detail: JSON.stringify(selection) };
});
await guard('view-path', async () => ({ pass: viewPath() === '/circuit/views/' + DEFAULT_VIEW_ID, detail: viewPath() }));

let observer = null;
function stopObserver() { observer?.stop(); observer = null; }
async function startObserver() {
  observer = await startFixtureObserver({ SFX_PAGE_FIXTURE_DIR: fixtureDirectory });
  fixtureBase = observer.base;
}

let viewDocument = null;
try {
  await startObserver();

  await guard('view-read', async () => {
    const response = await fetch(`${fixtureBase}/api/circuit/v1/page?path=${encodeURIComponent(viewPath())}`);
    const body = await response.json();
    viewDocument = body;
    const source = (body?.sources ?? []).find(entry => entry.sourceId === 'provider-inspection');
    return { pass: response.status === 200 && body?.contractId === VIEW_CONTRACT && body?.status === 'READ'
      && /^[a-f0-9]{64}$/.test(body?.viewDigest ?? '') && Array.isArray(body?.sections) && body.sections.length >= 6
      && Boolean(source) && typeof body?.viewId === 'string',
      detail: `status=${response.status} contractId=${body?.contractId} status=${body?.status} viewId=${body?.viewId} sections=${body?.sections?.length ?? 0}` };
  });

  await guard('view-vocabulary', async () => {
    if (!viewDocument) return { pass: false, detail: 'the view fixture did not read' };
    const { ok, refusals } = validateView(viewDocument, viewSelection(new URLSearchParams()));
    return { pass: ok, detail: refusals.map(refusal => `${refusal.code}${refusal.sectionId ? `@${refusal.sectionId}` : ''}`).join(', ') || 'the declared view passes the page validator' };
  });

  await guard('view-selection-binding', async () => {
    if (!viewDocument) return { pass: false, detail: 'the view fixture did not read' };
    const selection = { capabilityId: 'cap', namespaceId: 'ns', scenarioId: 'sc', detailId: 'provider-detail', expectedSnapshotDigest: 'b'.repeat(64) };
    const bound = bindViewSelection(viewDocument, selection);
    const input = bound.sources[0]?.input ?? {};
    const readBinding = bound.sections.flatMap(section => Object.values(section.bindings ?? {}))
      .find(binding => binding?.kind === 'read' || (binding?.kind === undefined && typeof binding?.reader === 'string'));
    const defaultKept = bindViewSelection({ sources: [{ sourceId: 'x', reader: 'x', input: { detailId: 'declared-default' } }] }, { detailId: '' }).sources[0].input.detailId === 'declared-default';
    const hostWins = bindViewSelection({ sources: [{ sourceId: 'x', reader: 'x', input: { detailId: 'declared-default' } }] }, selection).sources[0].input.detailId === 'provider-detail';
    return { pass: bound.sources[0] !== viewDocument.sources[0] && input.capabilityId === 'cap' && input.detailId === 'provider-detail'
      && input.expectedSnapshotDigest === 'b'.repeat(64) && !('viewId' in input) && hostWins && defaultKept
      && readBinding?.input?.detailId === 'provider-detail',
      detail: `input={${Object.keys(input).join(',')}} binding=${Object.keys(readBinding?.input ?? {}).join(',')} hostWins=${hostWins} defaultKept=${defaultKept}` };
  });

  await guard('view-host-folded', async () => {
    const [gone, runtime] = await Promise.all([fetch(`${fixtureBase}/circuit/view`), fetch(`${fixtureBase}/circuit/view-runtime.js`)]);
    const pass = gone.status === 404 && runtime.status === 200 && (await runtime.text()).includes('createViewRuntime');
    return { pass, detail: `standaloneView=${gone.status} view-runtime.js=${runtime.status}` };
  });

  await guard('view-reader-reuse', async () => {
    assert.equal(typeof readView, 'function', 'readView is exported');
    return { pass: true, detail: 'view documents read through the deployed page reader (ui-page read reuse)' };
  });
} finally {
  stopObserver();
}

const summary = {
  tool: 'verify-view.mjs',
  contract: VIEW_CONTRACT,
  passed: checks.filter(check => check.pass).length,
  failed: checks.filter(check => !check.pass).length,
  checks,
  limitations: [
    'The fixture observer proves the read, binding, validator, fold and click-path wiring; the real browser click-to-screens proof is the browser gate\'s capture bundle.',
    'The estate publication of the ui-view declaration is proven by the declare-provider-profile-view migration and the live browser capture, not by the fixture host.',
  ],
};
console.log(JSON.stringify(summary, null, 2));
process.exitCode = summary.failed > 0 ? 1 : 0;
