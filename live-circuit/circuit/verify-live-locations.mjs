// Check presentation against every prefix of a real capture, including calls
// shorter than the decorative transition. No events are generated or posted.
// node live-circuit/circuit/verify-live-locations.mjs <scene.json> <capture.sse>
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { newRun, applyRecord } from './deck-trace.js';
import { buildTraversal, traversalState, LiveMotion } from './traversal.js';

const [sceneFile, captureFile] = process.argv.slice(2);
assert(sceneFile && captureFile, 'Supply a database scene and real capture');
const deck = JSON.parse(await readFile(sceneFile, 'utf8'));
const records = (await readFile(captureFile, 'utf8')).split(/\r?\n/)
  .filter(line => line.startsWith('data: ')).map(line => JSON.parse(line.slice(6)));
const motion = new LiveMotion(), calls = new Map(), results = [];
let run, prefixes = 0;
for (const record of records) {
  if (record.kind === 'run-start') run = newRun(record);
  else if (run) applyRecord(run, record, Date.parse(record.receivedAt));
  if (run?.graph?.graphId !== `graph:${deck.capabilityId}`) continue;
  const model = buildTraversal(deck, run), expected = traversalState(model);
  const shown = motion.update(model, traversalState(model), Date.parse(record.receivedAt));
  assert(!model.timeline, 'Live location must not require replay');
  for (const token of expected.tokens.filter(t => t.call && !t.complete)) {
    assert(shown.current.has(token.lane.calleeNodeId), 'Outstanding callee is visible on receipt, without a presentation delay');
    assert(shown.busy.has(token.nodeId) && shown.busy.has(token.lane.portNodeId), 'Call owners stay busy');
    const key = `${run.id}:${token.nodeId}`;
    if (!calls.has(key)) calls.set(key, { runId: run.id, nodeId: token.nodeId,
      provider: token.lane.calleeNodeId, admissionAt: record.receivedAt });
  }
  for (const call of calls.values()) {
    if (call.runId !== run.id || call.returnAt) continue;
    if (!model.liveCursors.some(c => c.stage === 'completion' && c.nodeId === call.nodeId)) continue;
    call.returnAt = record.receivedAt;
    call.providerReturnMatched = expected.phases.get(call.provider)?.phase === 'observed';
    call.receivedIntervalMs = Date.parse(call.returnAt) - Date.parse(call.admissionAt);
  }
  if (expected.terminal) {
    assert(shown.current.has(expected.terminal.nodeId), 'Own return immediately reaches its outcome');
    assert(!motion.moving && !shown.busy.size, 'No catch-up playback or outstanding callers after return');
    if (!results.some(r => r.runId === run.id)) results.push({ runId: run.id, outcome: expected.terminal.nodeId });
  }
  prefixes++;
}
assert(calls.size, 'Capture must contain an admitted call');
assert(results.length, 'Capture must contain its own scenario return');
assert([...calls.values()].every(c => c.returnAt), 'Every admitted operation has its own return');
console.log(JSON.stringify({ capture: captureFile, checkedPrefixes: prefixes,
  calls: [...calls.values()], results, noReplayTimeline: true }, null, 2));
