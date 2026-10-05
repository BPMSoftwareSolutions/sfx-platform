// Checks actual exported deck bytes and recorded execution joins. No package install.
// node demo/circuit/verify-deck.mjs <deck-directory-id> <capture.sse> [observer-url]
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { loadDeck } from './deck-store.mjs';
import { newRun, applyRecord, joinTestimony } from './deck-trace.js';
const [id, capture, base = 'http://localhost:8787'] = process.argv.slice(2);
assert(id && capture, 'Supply a deck directory ID and captured SSE file.');
const deck = await loadDeck(id);
assert.equal(deck.observationMap?.contractId, 'deck-observation-map.v1', deck.mapError);
const records = (await readFile(capture, 'utf8')).split(/\r?\n/).filter((line) => line.startsWith('data: ')).map((line) => JSON.parse(line.slice(6)));
const runs = []; let run;
for (const record of records) {
  if (record.kind === 'run-start') { run = newRun(record); runs.push(run); }
  else if (run) applyRecord(run, record);
}
run = runs.findLast((item) => item.graph?.graphId === `graph:${deck.capabilityId}`);
assert(run?.ended, 'The capture must contain a complete matching run.');
const joined = joinTestimony(deck, run);
assert(joined.nodes.size > 0, 'Real testimony must address deck components.');
assert.equal(joined.unmatched.length, 0, 'All recorded cell testimony must match the compiled graph.');
for (const facts of joined.nodes.values()) for (const fact of facts) assert([...run.cells.values()].includes(fact));
const first = [...joined.nodes.values()][0][0];
const tampered = { ...first, semanticAddress: 'not-a-declared-address' };
const damaged = { ...run, cells: new Map([[first.cellExecutionId, tampered]]) };
assert.equal(joinTestimony(deck, damaged).nodes.size, 0);
assert.equal(joinTestimony(deck, damaged).unmatched.length, 1);
assert.equal(joinTestimony(deck, { ...run, ambiguous: true }).nodes.size, 0);
assert.equal(joinTestimony({ ...deck, snapshotDigest: 'wrong-generation' }, run).nodes.size, 0);
assert.equal(joinTestimony({ ...deck, capabilityId: 'another-capability' }, run).nodes.size, 0);
assert.equal(joinTestimony({ ...deck, observationMap: null }, run).nodes.size, 0);
const scenario = deck.slides.find((slide) => slide.blueprint?.role === 'scenario-blueprint');
assert(scenario, 'Deck must contain its scenario circuit slide.');
const response = await fetch(new URL(scenario.imageUrl, base));
assert(response.ok);
assert.equal(createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex'), scenario.svgDigest,
  'The served SVG must be byte-identical to the exported deck slide.');
console.log(JSON.stringify({ capabilityId: deck.capabilityId, slides: deck.slides.length, mappedNodes: deck.observationMap.mappedNodes,
  observedComponents: joined.nodes.size, cells: run.cells.size, edges: run.edges.size, unmatched: joined.unmatched.length,
  svgByteIdentical: true, negativeIdentityChecks: 5 }));
