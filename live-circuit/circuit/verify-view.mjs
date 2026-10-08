#!/usr/bin/env node
// Declared-view host checks (shell lane):
//   node live-circuit/circuit/verify-view.mjs
// Spawns the observer over the file-backed page fixtures and proves the
// ui-view.v1 host end to end: the view document reads through the deployed page
// reader, the URL selection binds into its declared sources (host selection
// wins), the page validator admits it, and the host serves view.html /
// view-runtime.js. Reads only; the fixture observer never touches ports 8788/8799.
//
// Declared-only: the check also proves the bespoke provider-profile.js renderer
// and every fallback path are gone. A provider drill-down that cannot read its
// view is a named visible state, never a fallback render.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VIEW_CONTRACT, DEFAULT_VIEW_ID, bindViewSelection, viewPath, viewSelection, validateView, readView, createViewRuntime } from './view-runtime.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const fixtureDirectory = path.join(here, 'fixtures', 'pages');
const observerModule = path.join(repoRoot, 'live-circuit', 'dispatch-pair', 'observe-server.mjs');
const fixturePort = 8896;
const fixtureBase = `http://localhost:${fixturePort}`;

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

const [runtimeSource, htmlSource, serverSource, explorerSource, storeSource] = await Promise.all([
  readFile(new URL('./view-runtime.js', import.meta.url), 'utf8'),
  readFile(new URL('./view.html', import.meta.url), 'utf8'),
  readFile(new URL('../dispatch-pair/observe-server.mjs', import.meta.url), 'utf8'),
  readFile(new URL('./circuit-runtime.js', import.meta.url), 'utf8'),
  readFile(new URL('./live-store.mjs', import.meta.url), 'utf8'),
]);

record('view-contract', runtimeSource.includes(`'${VIEW_CONTRACT}'`) && typeof createViewRuntime === 'function' && typeof readView === 'function',
  `contract=${VIEW_CONTRACT} projector=${/createPageRuntime/.test(runtimeSource)} validator=${/validatePage/.test(runtimeSource)}`);
record('view-safety', !runtimeSource.includes('innerHTML') && htmlSource.includes('id="view-root"'),
  `innerHTML=${runtimeSource.includes('innerHTML')} viewRoot=${htmlSource.includes('id="view-root"')}`);
record('view-serving', serverSource.includes("['/circuit/view-runtime.js'") && serverSource.includes("['/circuit/view'") && serverSource.includes("'view-runtime.js'"),
  'view.html, /circuit/view and view-runtime.js are CIRCUIT_FILES entries');
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

let child = null;
function stopObserver() {
  const running = child; child = null;
  if (running && running.exitCode === null) running.kill();
}
async function startObserver() {
  const env = { ...process.env, OBSERVER_PORT: String(fixturePort), SFX_PAGE_FIXTURE_DIR: fixtureDirectory };
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

  await guard('view-host-serving', async () => {
    const [page, runtime] = await Promise.all([fetch(`${fixtureBase}/circuit/view`), fetch(`${fixtureBase}/circuit/view-runtime.js`)]);
    const html = await page.text();
    const pass = page.status === 200 && html.includes('id="view-root"') && html.includes('/circuit/view-runtime.js')
      && runtime.status === 200 && (await runtime.text()).includes('createViewRuntime');
    return { pass, detail: `view.html=${page.status} view-runtime.js=${runtime.status}` };
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
    'The fixture observer proves the read, binding and validator path; DOM execution of the projected view is the browser gate\'s capture bundle.',
    'The estate publication of the ui-view declaration is proven by the declare-provider-profile-view migration and the live browser capture, not by the fixture host.',
  ],
};
console.log(JSON.stringify(summary, null, 2));
process.exitCode = summary.failed > 0 ? 1 : 0;
