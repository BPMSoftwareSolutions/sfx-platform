// Real deck/capture fixtures, with explicitly synthetic variant/shape negatives.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadDeck } from './deck-store.mjs';
import { newRun, applyRecord, joinFlow, replayFrames } from './deck-trace.js';
import { boundaryGlyphs } from './circuit-viewer.js';
const [id, capture] = process.argv.slice(2);
const deck = await loadDeck(id);
assert(deck.observationMap?.boundaries?.length);
const events = (await readFile(capture, 'utf8')).split(/\r?\n/).filter(line => line.startsWith('data: ')).map(line => JSON.parse(line.slice(6)));
const runs = []; let run;
for (const record of events) {
  if (record.kind === 'run-start') { run = newRun(record); runs.push(run); }
  else if (run) applyRecord(run, record, record.seq);
}
run = runs.findLast(run => run.graph?.graphId === `graph:${deck.capabilityId}`);
assert(run?.ended);
const boundary = deck.observationMap.boundaries[0];
const root = run.graph.cells.find(cell => cell.semanticAddress === boundary.semanticAddress && cell.altitude === 'scenario');
const graphRecord = run.events.find(event => event.record.payload?.observationType === 'execution-graph-captured.v1').record;
const rootRecord = run.events.findLast(event => event.record.payload?.cellId === root.cellId && event.record.payload.testimonyType === 'cell-execution-testimony.v1').record;
const build = payload => { const r = newRun({ observationKey: 'boundary-verification' }); applyRecord(r, graphRecord, 0);
  applyRecord(r, { ...rootRecord, payload }, 1); return r; };
const actual = joinFlow(deck, run);
assert.equal(actual.activity.get(boundary.inputNodeId).phase, 'input-observed');
const reportedVariant = boundary.variants.find(variant => variant.variantId === rootRecord.payload.outcomeVariant);
assert.equal(actual.activity.get(boundary.outcomeNodeId).phase, reportedVariant ?
  reportedVariant.classification === 'failure' ? 'outcome-failure' : 'completed' : 'variant-unmapped');
for (const variant of boundary.variants) assert.equal(actual.activity.has(variant.nodeId), variant === reportedVariant,
  'Only the exact reported variant may light, including on a real capture.');
for (const field of boundary.fields) assert.equal(actual.activity.get(field.nodeId).phase, 'input-context', 'Withheld fields must not claim presence.');
const slide = deck.slides.find(slide => slide.blueprint?.scenarioId === boundary.scenarioId && slide.blueprint?.role === 'scenario-blueprint');
const glyphs = boundaryGlyphs(deck, slide);
assert.equal(glyphs.filter(glyph => glyph.kind === 'input-field').length, boundary.fields.length);
assert.equal(glyphs.filter(glyph => glyph.kind === 'variant').length, boundary.variants.length);
for (const glyph of glyphs.filter(glyph => glyph.kind !== 'reported-variant')) {
  assert(slide.commands.some(command => command.op === 'shape' && JSON.stringify(command.args.slice(1,5)) ===
    JSON.stringify([glyph.bounds.x,glyph.bounds.y,glyph.bounds.w,glyph.bounds.h])), 'Highlight must use an original deck shape.');
}
for (const variant of boundary.variants) {
  const synthetic = build({ ...rootRecord.payload, outcomeVariant: variant.variantId });
  const matched = joinFlow(deck, synthetic);
  assert.equal(matched.activity.get(variant.nodeId).phase, variant.classification === 'failure' ? 'outcome-failure' : 'completed');
  assert.equal(boundary.variants.filter(v => matched.activity.has(v.nodeId)).length, 1, 'Only the exact branch may light.');
}
const wrongContract = joinFlow(deck, build({ ...rootRecord.payload, outcomeContractId: 'wrong' }));
assert(!wrongContract.activity.has(boundary.outcomeNodeId));
assert(wrongContract.boundaryFindings.some(finding => finding.code === 'OUTCOME_CONTRACT_MISMATCH'));
const field = boundary.fields[0], fieldKey = field.path.split('/').at(-1).replaceAll('~1','/').replaceAll('~0','~');
for (const value of [null, false, 0, '', []]) {
  const explicit = joinFlow(deck, build({ ...rootRecord.payload, inputShape: { contractId: boundary.inputContractId, payload: { [fieldKey]: value } } }));
  assert.equal(explicit.activity.get(field.nodeId).phase, 'input-observed', 'Falsey values are present fields.');
  for (const absent of boundary.fields.slice(1)) assert(!explicit.activity.has(absent.nodeId), 'Absent fields must remain unlit when a payload is published.');
}
const refOnly = joinFlow(deck, build({ ...rootRecord.payload, inputShape: { contractId: boundary.inputContractId, payloadRef: { digest: 'unresolved' } } }));
assert.equal(refOnly.activity.get(field.nodeId).phase, 'input-context');
const childOnly = newRun({ observationKey: 'child-verification' }); applyRecord(childOnly, graphRecord);
const child = run.events.find(event => event.record.payload?.cellAltitude === 'mechanic' && event.record.payload.testimonyType === 'cell-execution-testimony.v1').record;
applyRecord(childOnly, { ...child, payload: { ...child.payload, outcomeVariant: boundary.variants[0].variantId } });
assert(!joinFlow(deck, childOnly).activity.has(boundary.variants[0].nodeId), 'A child variant cannot stand in for the scenario return.');
assert.equal(joinFlow(deck, { ...run, ambiguous: true }).activity.size, 0);
const replay = newRun({ observationKey: 'replay-verification' });
for (const frame of replayFrames(deck, run)) for (const record of frame) applyRecord(replay, record);
assert.deepEqual([...joinFlow(deck, replay).activity.keys()], [...actual.activity.keys()]);
console.log(JSON.stringify({ capability: deck.capabilityId, inputFields: boundary.fields.length, declaredVariants: boundary.variants.length,
  actualReportedVariant: rootRecord.payload.outcomeVariant, actualMatchedVariants: reportedVariant ? 1 : 0, overlayShapes: glyphs.length, checks: 'passed' }));
