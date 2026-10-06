// Presentation checks against unchanged retained execution receipts. These do
// not claim a live invocation or a durable ledger installation.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { newRun, applyRecord, capturedTimestamp } from './deck-trace.js';
import { evidenceModel, componentEvidence, traceCsv, runLink } from './run-evidence.mjs';
import { PlaybackClock } from './playback-clock.js';

const root = new URL('../../', import.meta.url);
const deck = JSON.parse(await readFile(new URL('docs/replay-timing-fidelity/scene.json', root), 'utf8'));
const records = (await readFile(new URL('docs/replay-timing-fidelity/capture.sse', root), 'utf8')).split(/\r?\n/).filter(l => l.startsWith('data: ')).map(l => JSON.parse(l.slice(6)));
const runs = []; let current;
for (const record of records) {
  if (record.kind === 'run-start') { current = newRun(record); runs.push(current); }
  else if (current) applyRecord(current, record);
}
const run = runs.findLast(r => r.ended && r.graph?.graphId === `graph:${deck.capabilityId}`);
assert(run);
const model = evidenceModel(deck, run);
assert.equal(model.held, null); assert.equal(model.operations.length, 11); assert.equal(model.providers.length, 3);
assert.equal(model.duration, capturedTimestamp(model.endedAt) - capturedTimestamp(run.startedAt));
assert.equal(model.terminal.variantId, 'ADMITTED');
for (const op of model.operations) {
  const evidence = componentEvidence(deck, run, model, op.nodeId);
  const expected = run.events.filter(({ record }) => {
    const p = record.payload ?? {}, from = capturedTimestamp(p.startedAt ?? p.observedAt ?? p.completedAt) - capturedTimestamp(run.startedAt);
    const to = capturedTimestamp(p.completedAt ?? p.observedAt) - capturedTimestamp(run.startedAt);
    return p.testimonyType && from >= op.from && to <= op.to;
  }).map(e => e.record.observationKey);
  assert.deepEqual(evidence.receipts.map(r => r.record.observationKey), expected);
  assert(evidence.basis.includes('NOT_VERIFIED'));
}
const broken = structuredClone(run); broken.ambiguous = true;
const held = evidenceModel(deck, broken); assert(held.held); assert.equal(held.providers.length, 0); assert.equal(held.partial, true);
const overlapped = { ...model, operations: [...model.operations, { ...model.operations[0], nodeId: 'overlapping-operation' }] };
assert(componentEvidence(deck, run, overlapped, model.operations[0].nodeId).ambiguous);
const malicious = [{ record: { observationKey: '=FORMULA()', payload: { testimonyType: '@x', cellId: '\n+bad' } }, from: 0, to: 1, candidates: [] }];
assert(traceCsv(malicious).includes('"\'=FORMULA()"')); assert(traceCsv(malicious).includes('"\'@x"'));
const link = new URL(runLink({ runId: 'id', capabilityId: 'a&b', namespaceId: 'n:x' }, 'https://example.test/circuit/explorer?detail=stale'));
assert.equal(link.searchParams.get('capability'), 'a&b'); assert.equal(link.searchParams.has('detail'), false);
let prefix = [], changes = 0;
const clock = new PlaybackClock(model.timeline, f => prefix.push(...f.records), () => changes++);
for (const at of [model.timeline.duration, 0, model.timeline.duration / 2, model.timeline.duration]) {
  clock.seek(at, () => { prefix = []; });
  assert.deepEqual(prefix, model.timeline.frames.filter(f => f.at <= at).flatMap(f => f.records));
  assert(clock.paused); assert.equal(clock.timer, null);
}
assert.equal(changes, 4);
console.log(JSON.stringify({ basis: 'retained capture', operations: model.operations.length, providers: model.providers.length,
  durationMs: model.duration, checks: 'report, containment, ambiguity, missing evidence, links, CSV and backwards/forwards seek', status: 'PASS' }));
