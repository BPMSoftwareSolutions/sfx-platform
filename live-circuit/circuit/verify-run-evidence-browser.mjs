// Offline browser acceptance. Scene and testimony are retained real evidence;
// session/list/API envelopes are explicit transport fixtures, not live proof.
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { newRun, applyRecord } from './deck-trace.js';
import { evidenceModel, componentEvidence } from './run-evidence.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(dir, '../..');
const deck = JSON.parse(await fs.readFile(process.env.SFX_BROWSER_EVIDENCE_SCENE ?? path.join(root, 'docs/replay-timing-fidelity/scene.json'), 'utf8'));
const capture = await fs.readFile(path.join(root, 'docs/replay-timing-fidelity/capture.sse'), 'utf8');
const groups = []; let group;
for (const record of capture.split(/\r?\n/).filter(l => l.startsWith('data: ')).map(l => JSON.parse(l.slice(6)))) {
  if (record.kind === 'run-start') { group = { run: newRun(record), records: [record] }; groups.push(group); }
  else if (group && !group.run.ended) { applyRecord(group.run, record); group.records.push(record); }
}
const selected = groups.findLast(g => g.run.ended && g.run.graph?.graphId === 'graph:' + deck.capabilityId);
const model = evidenceModel(deck, selected.run);
const runId = 'fixture-retained-run';
const listed = [{ runId, capabilityId: deck.capabilityId, namespaceId: deck.namespaceId, admittedAt: selected.run.startedAt },
  { runId: 'fixture-other-run', capabilityId: 'other-fixture-capability', namespaceId: 'fixture', admittedAt: selected.run.startedAt }];
const events = selected.records.map((record, index) => ({ runId, cursor: index + 1, eventId: `urn:sda-api:run-event:${runId}:${index + 1}`, at: record.receivedAt,
  kind: record.kind === 'run-start' ? 'run.started' : record.kind === 'run-end' ? 'run.exited' : record.payload?.observationType === 'execution-graph-captured.v1' ? 'graph.captured' : 'observation', payload: record.payload }));
// Preserve execution boundaries rather than the observer receive clock.
events[0].at = selected.run.startedAt; events.at(-1).at = model.endedAt;
const apiRun = { runId, state: 'completed', capability: { subject: deck.capabilityId }, startedAt: selected.run.startedAt, endedAt: model.endedAt, exitCode: selected.run.exitCode, partial: false };
const output = { contractId: 'fixture-output.v1', payload: { summary: 'Transport fixture output' } };
let streamFailure = 0, admissions = 0, authenticated = true;
const sse = selected.records.map(r => 'data: ' + JSON.stringify(r) + '\n\n').join('');
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const json = (body, status = 200) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
  if (url.pathname === '/events') { res.writeHead(200, { 'content-type': 'text/event-stream' }); return res.end(url.searchParams.get('run') === 'current' ? sse : ': fixture observer\n\n'); }
  if (url.pathname === '/api/circuit/v1/scenario') return json(deck);
  if (url.pathname === '/api/circuit/v1/capability-details') return json({ error: 'Offline fixture: navigation not included' }, 503);
  if (url.pathname === '/api/circuit/v1/session') return json({ authenticated, observeRequiresSession: true, principalId: 'fixture-principal', identifier: 'Offline acceptance' });
  if (url.pathname === '/api/circuit/v1/session/runs') return json({ principalId: 'fixture-principal', runs: listed });
  if (url.pathname === '/api/circuit/v1/capabilities') return json({ capabilities: [{ capabilityId: deck.capabilityId, namespaceId: deck.namespaceId }] });
  if (url.pathname === '/api/circuit/v1/home') return json({ environment: 'OFFLINE ACCEPTANCE' });
  if (url.pathname === '/api/circuit/v1/execution') return json({ configured: true });
  if (url.pathname === '/api/circuit/v1/runs' && req.method === 'POST') {
    if (!authenticated) return json({ disposition: 'SIGN_IN_REQUIRED', error: 'Sign in to observe.' }, 401);
    admissions++; return json({ runId }, 202);
  }
  if (url.pathname.endsWith(`/runs/${runId}/events/stream`)) {
    if (streamFailure) return json({ error: 'Explicit stream failure fixture' }, streamFailure);
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    return res.end(events.map(e => `event: ${e.kind}\ndata: ${JSON.stringify(e)}\n\n`).join('') + `event: end\ndata: ${JSON.stringify({ runId })}\n\n`);
  }
  if (url.pathname.endsWith(`/runs/${runId}/graph`)) return json(selected.run.graph);
  if (url.pathname.endsWith(`/runs/${runId}/output`)) return json(output);
  if (url.pathname.endsWith(`/runs/${runId}`)) return json(apiRun);
  if (url.pathname === '/health') return json({ ok: true });
  if (url.pathname === '/release.json') return json({ release: 'offline-fixture' });
  const name = url.pathname.slice('/circuit/'.length), file = name === 'explorer' ? 'explorer.html' : name;
  if (!url.pathname.startsWith('/circuit/') || !/^[\w.-]+$/.test(file)) return json({ error: 'Fixture route unavailable' }, 404);
  try { const body = await fs.readFile(path.join(dir, file)); res.writeHead(200, { 'content-type': file.endsWith('.html') ? 'text/html' : file.endsWith('.css') ? 'text/css' : 'text/javascript' }); res.end(body); }
  catch { json({ error: 'Fixture file unavailable' }, 404); }
});
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const origin = `http://127.0.0.1:${server.address().port}`;
const { chromium } = await import(pathToFileURL(process.env.SFX_BROWSER_TEST_MODULE).href);
const browser = await chromium.launch({ executablePath: process.env.SFX_BROWSER_EXECUTABLE, headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1680, height: 1100 } }), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(origin + '/circuit/explorer?' + new URLSearchParams({ capability: deck.capabilityId, namespace: deck.namespaceId, run: runId }));
  await page.waitForFunction(() => document.querySelector('#run-report')?.textContent.includes('Transport fixture output'));
  if (deck.slides.some(s => s.blueprint?.role === 'scenario-linear')) {
    assert.equal(await page.locator('#view-linear').getAttribute('aria-pressed'), 'true', 'Linear is the default');
    assert.equal(await page.locator('#slide').inputValue(), 'scenario-linear');
    await page.locator('#view-paged').click();
    assert.equal(new URL(page.url()).searchParams.get('view'), 'paged', 'Explicit Paged selection survives links');
    await page.goBack();
    await page.waitForFunction(() => document.querySelector('#view-linear').getAttribute('aria-pressed') === 'true');
    assert.equal(await page.locator('#slide').inputValue(), 'scenario-linear');
  }
  assert.equal(await page.locator('.run-outcome').textContent(), 'ADMITTED');
  assert(Math.abs(Number(await page.locator('[data-run-duration]').getAttribute('data-run-duration')) - model.duration) < 0.01);
  assert.equal(await page.locator('[data-step-node]').count(), model.operations.length);
  await page.locator('#tab-runs').click();
  await page.waitForSelector(`[data-run-id="${runId}"]`);
  assert.equal(await page.locator('.run-row').count(), 1);
  await page.locator('#runs-all').check();
  await page.waitForFunction(() => document.querySelectorAll('.run-row').length === 2);
  assert.deepEqual((await page.locator('.run-row').evaluateAll(nodes => nodes.map(n => n.dataset.runId))).sort(), listed.map(r => r.runId).sort());
  await page.locator('#tab-run').click();
  await page.locator('#replay').click(); await page.locator('#pause').click();
  const op = model.operations.find(o => model.providers.some(p => p.operationId === o.nodeId));
  await page.locator('[data-step-node]').filter({ hasText: op.label }).click();
  assert.equal(await page.locator('#tab-evidence').getAttribute('aria-selected'), 'true');
  const expected = componentEvidence(deck, selected.run, model, op.nodeId);
  assert.deepEqual(await page.locator('[data-receipt-id]').evaluateAll(nodes => nodes.map(n => n.dataset.receiptId.replace(/^sda-api:urn:sda-api:run-event:fixture-retained-run:/, ''))),
    expected.receipts.map(r => String(events.find(e => e.payload === r.record.payload)?.cursor)));
  assert((await page.locator('#component-evidence').textContent()).includes('NOT_VERIFIED'));
  for (const at of [model.timeline.duration, 0, model.timeline.duration / 2]) {
    await page.locator('#replay-seek').fill(String(Math.round(at))); await page.locator('#replay-seek').dispatchEvent('input');
    await page.waitForFunction(position => Math.abs(Number(document.querySelector('#viewer').dataset.replayPosition) - position) < 1, Math.min(model.timeline.duration, Math.round(at)));
  }
  if (process.argv[2]) { await fs.mkdir(process.argv[2], { recursive: true }); await page.screenshot({ path: path.join(process.argv[2], 'evidence.png'), fullPage: true }); await page.locator('#tab-run').click(); await page.screenshot({ path: path.join(process.argv[2], 'run-report.png'), fullPage: true }); }
  await page.setViewportSize({ width: 390, height: 844 }); await page.locator('#toggle-context').click(); await page.locator('#tab-runs').click();
  assert(await page.locator('#runs-list').isVisible());
  await page.setViewportSize({ width: 1680, height: 1100 });
  // An expired/missing session needs sign-in, not a repeated stream request.
  streamFailure = 503;
  await page.goto(origin + '/circuit/explorer?' + new URLSearchParams({ capability: deck.capabilityId, namespace: deck.namespaceId, run: runId }));
  await page.waitForFunction(() => !document.querySelector('#observe-resume').hidden);
  assert((await page.locator('#identity').textContent()).includes('Signed in as'));
  streamFailure = 401; authenticated = false;
  await page.locator('#observe-resume').click();
  await page.waitForFunction(() => document.querySelector('#observe-status').textContent.includes('Your session is missing or has ended'));
  await page.waitForFunction(() => document.querySelector('#identity a')?.textContent === 'Sign in');
  assert(await page.locator('#observe-resume').isHidden());
  assert(await page.locator('#observe').isDisabled());
  assert(await page.locator('#payload').isEnabled());
  const loginLink = new URL(await page.locator('#observe-sign-in').getAttribute('href'), origin);
  const returnTo = new URL(loginLink.searchParams.get('return'), origin);
  assert.equal(loginLink.pathname, '/circuit/login'); assert.equal(returnTo.searchParams.get('run'), runId);
  assert.equal(returnTo.searchParams.get('capability'), deck.capabilityId);
  assert.equal(admissions, 0, '401 must not resubmit');
  // Simulate the normal login return URL after the session has been renewed.
  streamFailure = 0; authenticated = true; await page.goto(returnTo.href);
  await page.waitForFunction(() => document.querySelector('#run-report').textContent.includes('Transport fixture output'));
  assert(await page.locator('#observe-sign-in').isHidden()); assert.equal(admissions, 0);
  authenticated = false;
  await page.goto(origin + '/circuit/explorer?' + new URLSearchParams({ capability: deck.capabilityId, namespace: deck.namespaceId }));
  await page.waitForFunction(() => !document.querySelector('#observe').disabled);
  await page.locator('#payload').fill('{}'); await page.locator('#observe').click();
  await page.waitForFunction(() => document.querySelector('#observe-status').textContent.includes('This request was not admitted'));
  assert(await page.locator('#observe').isDisabled()); assert(await page.locator('#payload').isEnabled());
  const admissionLogin = new URL(await page.locator('#observe-sign-in').getAttribute('href'), origin);
  assert.equal(new URL(admissionLogin.searchParams.get('return'), origin).searchParams.has('run'), false);
  assert.equal(admissions, 0); authenticated = true;
  // A restart/eviction 404 is terminal for this observation; no implicit rerun.
  streamFailure = 404;
  await page.goto(origin + '/circuit/explorer?' + new URLSearchParams({ capability: deck.capabilityId, namespace: deck.namespaceId, run: runId }));
  await page.waitForFunction(() => document.querySelector('#observe-status').textContent.includes('Resume cannot recover it'));
  assert(await page.locator('#observe-resume').isHidden());
  assert(await page.locator('#observe').isEnabled());
  assert(await page.locator('#payload').isEnabled());
  assert.equal(admissions, 0, '404 must never resubmit a capability');
  // Transient connection failures retain Resume and prevent duplicate Observe.
  streamFailure = 503;
  await page.reload();
  await page.waitForFunction(() => !document.querySelector('#observe-resume').hidden);
  assert(await page.locator('#observe').isDisabled());
  streamFailure = 0;
  await page.locator('#observe-resume').click();
  await page.waitForFunction(() => document.querySelector('#observe-status').textContent.includes(' · completed'));
  assert(await page.locator('#observe-resume').isHidden());
  assert.equal(admissions, 0, 'Resume must read the same run, not create one');
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log(JSON.stringify({ basis: 'Offline browser, retained scene and receipts, fixture API/session', gates: ['report', 'history set equality', 'evidence containment', 'seek', 'mobile context', '401 offers sign-in and returns to the same run', '404 releases controls without resubmission', '503 resumes original run'], errors, status: 'PASS' }));
} finally { await browser.close(); server.closeAllConnections(); await new Promise(r => server.close(r)); }
