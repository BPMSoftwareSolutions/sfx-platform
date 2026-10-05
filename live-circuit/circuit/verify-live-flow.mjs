// Live-prefix acceptance. Positive cases consume only an actual observer capture
// up to the record under test. Nothing is posted to the observer; no replay
// timeline or completed-operation interval supplies a live location.
// node demo/circuit/verify-live-flow.mjs <scene.json> <capture.sse>
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { newRun, applyRecord } from './deck-trace.js';
import { executionCursor } from './execution-cursor.js';
import { buildTraversal, traversalState, locate, LiveMotion } from './traversal.js';

const [sceneFile, captureFile, browserFile] = process.argv.slice(2);
assert(sceneFile && captureFile, 'Supply a database scene and real SSE capture');
const deck = JSON.parse(await readFile(sceneFile, 'utf8'));
const records = (await readFile(captureFile, 'utf8')).split(/\r?\n/).filter(s => s.startsWith('data: ')).map(s => JSON.parse(s.slice(6)));
const runs = []; let source;
for (const record of records) {
  if (record.kind === 'run-start') { source = { start: record, records: [] }; runs.push(source); }
  else if (source) source.records.push(record);
}
source = runs.findLast(r => r.records.some(r => r.payload?.graphId === `graph:${deck.capabilityId}`));
assert(source, 'Capture must contain the selected graph');
const run = newRun(source.start), motion = new LiveMotion();
const pendingEvidence = [], returned = new Set();
const admissionPrefixes = [];
let unrelatedWhilePending = 0, terminalKey, checked = 0, oldCursor;
for (const record of source.records) {
  applyRecord(run, record, Date.parse(record.receivedAt));
  const model = buildTraversal(deck, run), view = traversalState(model), cursor = executionCursor(deck, run);
  const shownLive = motion.update(model, traversalState(model), Date.parse(record.receivedAt));
  const fact = record.payload;
  if (oldCursor && fact?.testimonyType && !run.graph.cells.some(c => c.cellId === (fact.cellId ?? fact.destinationCellId))) {
    assert.equal(cursor?.key, oldCursor.key, 'Unmatched nested receipts must not clear/move the root cursor');
    if (view.tokens.some(t => t.call && !t.complete)) unrelatedWhilePending++;
  }
  for (const token of view.tokens) {
    assert.equal(token.current, locate(deck.slides.find(s => s.id === token.sceneId), token.point), 'Live highlight contains the dot');
    if (token.call && !token.complete) {
      assert(!view.terminal, 'Outstanding call cannot select an outcome');
      assert(view.current.has(token.lane.calleeNodeId), 'Selected provider/callee has the live dot before return');
      assert(shownLive.current.has(token.lane.calleeNodeId), 'Presentation must show an outstanding callee immediately, including calls shorter than its decorative transition');
      assert(view.busy.has(token.nodeId) && view.busy.has(token.lane.portNodeId), 'Step and call box remain busy until own return');
      const matchingOwn = [...run.cells.values()].find(r => r.cellId === token.cursor.cell.cellId && r.semanticAddress === token.cursor.cell.semanticAddress);
      assert(!matchingOwn, 'This positive capture must establish live provider visibility before any own completion');
      if (!pendingEvidence.some(e => e.nodeId === token.nodeId)) pendingEvidence.push({ nodeId: token.nodeId,
        callee: token.lane.calleeNodeId, admissionKey: token.key, firstVisibleBeforeReturnAt: record.receivedAt });
    }
  }
  for (const entry of pendingEvidence) {
    if (view.phases.get(entry.callee)?.phase === 'observed') returned.add(entry.nodeId);
  }
  if (view.terminal) {
    terminalKey ??= record.observationKey;
    assert.equal(view.busy.size, 0, 'No busy callers remain after the own scenario return');
    const shown = motion.update(model, view, Date.parse(record.receivedAt));
    assert.equal(motion.moving, false, 'No live catch-up playback after return');
    assert(shown.current.has(view.terminal.nodeId));
  }
  oldCursor = cursor; checked++;
}
assert(pendingEvidence.length >= 2, 'This acceptance capture must exercise at least two live provider calls');
assert.equal(returned.size, pendingEvidence.length, 'Every admitted provider call has verified return history');
assert(unrelatedWhilePending > 0, 'Capture must exercise the original nested-receipt regression');
assert(terminalKey, 'Own scenario return must reach an exact outcome or an explicit defect');

// Inspect each provider admission prefix directly, then mutate copies only for
// rejection tests. Synthetic data never goes to the server or demo.
for (const entry of pendingEvidence) {
  const prefix = newRun(source.start);
  for (const r of source.records) { applyRecord(prefix, r); if (r.observationKey === entry.admissionKey) break; }
  const model = buildTraversal(deck, prefix), m = new LiveMotion();
  admissionPrefixes.push(prefix);
  let v = m.update(model, traversalState(model), 0);
  v = m.update(model, traversalState(model), 500);
  assert(v.current.has(entry.callee), 'Provider is current within a bounded live presentation transition');
  assert(!prefix.ended && !model.timeline, 'Live provider position needs neither run-end nor replay');
  const held = m.update(model, traversalState(model), 60000);
  assert(held.current.has(entry.callee), 'Elapsed time alone cannot invent a return');
  const foreign = structuredClone(deck);
  for (const slide of foreign.slides) for (const lane of slide.blueprint.flow?.lanes ?? [])
    if (lane.nodeId === entry.nodeId) lane.executorAuthorityId = 'wrong-authority';
  const rejected = traversalState(buildTraversal(foreign, prefix));
  assert(!rejected.current.has(entry.callee), 'Mismatched captured authority must not activate a provider');
  const refused = structuredClone(prefix);
  refused.events.at(-1).record.payload.admissionDisposition = 'refused';
  const refusal = traversalState(buildTraversal(deck, refused));
  assert(!refusal.current.has(entry.callee), 'Refused admission must not activate a provider');
  const wrongAddress = structuredClone(prefix);
  wrongAddress.events.at(-1).record.payload.semanticAddress = 'wrong-address';
  assert(!traversalState(buildTraversal(deck, wrongAddress)).current.has(entry.callee), 'Wrong address must not activate a provider');
  const wrongGraph = structuredClone(prefix); wrongGraph.graph.graphId = 'graph:other';
  assert.equal(traversalState(buildTraversal(deck, wrongGraph)).tokens.length, 0);
  wrongGraph.ended = true;
  assert.equal(traversalState(buildTraversal(deck, wrongGraph)).terminal, null, 'Wrong graph cannot manufacture a missing-outcome defect');
  const ambiguous = structuredClone(prefix); ambiguous.ambiguous = true;
  assert.equal(traversalState(buildTraversal(deck, ambiguous)).tokens.length, 0);
  ambiguous.ended = true;
  assert.equal(traversalState(buildTraversal(deck, ambiguous)).terminal, null, 'Ambiguous capture remains held at run-end');
}

// Adversarial review regressions: parallel cells mapped to the same declared
// operation, late descendant receipts, and wrong called-scenario identity.
const prefix = admissionPrefixes[0], original = buildTraversal(deck, prefix);
const a = original.liveCursors.at(-1);
const b = structuredClone(a); b.key += ':parallel'; b.cell.cellId += ':parallel';
const complete = buildTraversal(deck, run).liveCursors.find(c => c.stage === 'completion' && c.cell.cellId === a.cell.cellId);
const parallel = { ...original, liveCursors: [a, b, complete] };
const parallelView = traversalState(parallel);
assert.equal(parallelView.tokens.length, 1);
assert.equal(parallelView.tokens[0].cursor.cell.cellId, b.cell.cellId, 'First return cannot erase a different pending instance');
assert.equal(parallelView.tokens[0].complete, false);
const motionParallel = new LiveMotion();
motionParallel.update({ ...original, liveCursors: [a, b] }, traversalState({ ...original, liveCursors: [a, b] }), 0);
const parallelMotionView = motionParallel.update(parallel, traversalState(parallel), 500);
assert.equal(parallelMotionView.tokens[0].cursor.cell.cellId, b.cell.cellId);
assert.deepEqual(parallelMotionView.tokens[0].point, parallelView.tokens[0].point, 'Sibling return cannot move another call dot');
assert.equal(motionParallel.moving, false);
// Different operation/provider positions make accidental route reuse observable.
const other = buildTraversal(deck, admissionPrefixes[1]).liveCursors.at(-1);
const otherReturn = buildTraversal(deck, run).liveCursors.find(c => c.stage === 'completion' && c.cell.cellId === other.cell.cellId);
const overlap = { ...original, liveCursors: [a, other] }, remains = { ...original, liveCursors: [a, other, otherReturn] };
const survivorMotion = new LiveMotion();
survivorMotion.update(overlap, traversalState(overlap), 0);
const survivor = survivorMotion.update(remains, traversalState(remains), 500);
assert(survivor.current.has(pendingEvidence[0].callee), 'Returning provider B cannot pull pending provider A to its return path');
const repeat = { ...original, liveCursors: [a, { ...a, key: a.key + ':repeat' }, complete] };
const repeatedView = traversalState(repeat);
assert(repeatedView.findings.some(f => f.code === 'LIVE_INVOCATION_IDENTITY_AMBIGUOUS'));
assert(!repeatedView.tokens.some(t => t.call), 'Indistinguishable overlapping admissions cannot fabricate a single call');

const late = structuredClone(prefix);
const oldOwn = original.liveCursors.find(c => c.stage === 'completion' && c.cell.cellId !== a.cell.cellId &&
  prefix.graph.cells.some(child => child.parentCellId === c.cell.cellId));
const child = prefix.graph.cells.find(c => c.parentCellId === oldOwn.cell.cellId);
assert(child, 'Capture includes a descendant of a returned operation');
const descendant = source.records.find(r => r.payload?.cellId === child.cellId && r.payload.testimonyType === 'cell-execution-testimony.v1');
assert(descendant);
applyRecord(late, { ...descendant, observationKey: descendant.observationKey + ':late' });
assert.equal(executionCursor(deck, late).key, a.key, 'Late descendant cannot reopen a returned operation');

const childDeck = structuredClone(deck), childRun = structuredClone(prefix);
const childLanes = childDeck.slides.flatMap(s => s.blueprint.flow?.lanes ?? []).filter(l => l.nodeId === a.nodeId);
for (const lane of childLanes) { lane.calleeKind = 'scenario'; lane.calledScenarioId = 'declared-child'; }
childRun.graph.cells.push({ cellId: 'child:wrong', parentCellId: a.cell.cellId, altitude: 'scenario', authorityId: 'scenario:wrong-child', semanticAddress: 'wrong/scenario/wrong-child' });
assert(!traversalState(buildTraversal(childDeck, childRun)).tokens.some(t => t.call), 'Unrelated child cannot light declared callee');
Object.assign(childRun.graph.cells.at(-1), { cellId: 'cell:scenario:declared-child', authorityId: 'declared-child.v1' });
assert(traversalState(buildTraversal(childDeck, childRun)).tokens.some(t => t.call), 'Exact called-scenario identity admits its declared path');
let browserVerification;
if (browserFile) {
  const samples = JSON.parse(await readFile(browserFile, 'utf8'));
  assert(samples.length > 0);
  for (const sample of samples) assert.equal(sample.mode, 'LIVE RECEIPTS · real-time', 'Browser never entered replay');
  const providers = pendingEvidence.map(entry => {
    const sample = samples.find(s => s.providers.some(p => p.id === entry.callee));
    assert(sample, 'Browser must visibly show each provider during the fresh invocation');
    const admission = source.records.find(r => r.observationKey === entry.admissionKey);
    const completion = source.records.find(r => r.payload?.testimonyType === 'cell-execution-testimony.v1' &&
      r.payload.cellId === admission.payload.destinationCellId);
    assert(Date.parse(sample.at) >= Date.parse(admission.receivedAt), 'Provider display cannot precede admission');
    assert(Date.parse(sample.at) < Date.parse(completion.receivedAt), 'Provider must be visible before its own return is received');
    assert(sample.busy.includes(entry.nodeId) && sample.busy.includes(`call:${entry.nodeId}`));
    assert(sample.dots.some(d => d.current === entry.callee && d.receipt === entry.admissionKey));
    return { provider: entry.callee, browserAt: sample.at, admissionAt: admission.receivedAt, returnAt: completion.receivedAt };
  });
  const endpoint = samples.findLast(s => s.terminal);
  assert(endpoint && endpoint.busy.length === 0);
  const realTerminal = traversalState(buildTraversal(deck, run)).terminal;
  assert(endpoint.dots.some(d => d.current === realTerminal.nodeId), 'Browser ends on the actual scenario return');
  browserVerification = { samples: samples.length, mode: 'live throughout', providers, terminal: realTerminal.nodeId };
}
console.log(JSON.stringify({ capture: captureFile, runId: run.id, checkedPrefixes: checked,
  liveProviderCalls: pendingEvidence, verifiedReturns: returned.size, unrelatedWhilePending,
  ownScenarioReturnKey: terminalKey, noReplayTimeline: true, browserVerification,
  reviewRegressions: ['parallel instance return', 'ambiguous repeated admission', 'late descendant', 'exact called-scenario identity'],
  negativeChecks: 'altered copies only; authority, refused admission, address, graph, overlap' }, null, 2));
