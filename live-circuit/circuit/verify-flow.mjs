// Run against real exported decks and real recorded testimony. No installed packages.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadDeck } from './deck-store.mjs';
import { newRun, applyRecord, joinFlow, replayFrames } from './deck-trace.js';
import { slideRoutes } from './circuit-viewer.js';
const [id, capture] = process.argv.slice(2);
assert(id && capture, 'Supply a deck ID and a complete SSE capture.');
const deck = await loadDeck(id);
assert.equal(deck.observationMap?.flowPolicy?.contractId, 'deck-live-flow-policy.v1');
const records = (await readFile(capture, 'utf8')).split(/\r?\n/).filter(line => line.startsWith('data: ')).map(line => JSON.parse(line.slice(6)));
const runs = []; let current;
for (const record of records) {
  if (record.kind === 'run-start') { current = newRun(record); runs.push(current); }
  else if (current) applyRecord(current, record, record.seq);
}
const run = runs.findLast(item => item.graph?.graphId === `graph:${deck.capabilityId}`);
assert(run?.ended);
const flow = joinFlow(deck, run);
assert(flow.routes.size > 0, 'Real admitted edges must join declared deck wires.');
assert.equal(flow.rejectedEdges.length, 0);
assert.equal(flow.unmatched.length, 0);
assert.equal(run.cells.size, run.events.filter(event => event.record.payload?.testimonyType === 'cell-execution-testimony.v1').length,
  'Reused execution IDs must not erase distinct observer receipts.');
const graphRecord = run.events.find(event => event.record.payload?.observationType === 'execution-graph-captured.v1').record;
const fresh = () => { const r = newRun({ observationKey: 'verification', receivedAt: '' }); applyRecord(r, graphRecord, 0); return r; };
const routeId = [...flow.routes.keys()][0], receipt = flow.routes.get(routeId).fact;
const edgeRecord = run.events.find(event => event.record.payload === receipt).record;
const deckEdge = deck.edges.find(edge => edge.id === routeId);
let partial = fresh(); applyRecord(partial, edgeRecord, 1);
assert.equal(joinFlow(deck, partial).activity.get(deckEdge.to).phase, 'admitted', 'Admission must light the destination before completion.');
partial = fresh();
applyRecord(partial, { ...edgeRecord, payload: { ...receipt, admissionDisposition: 'refused' } }, 1);
assert.equal(joinFlow(deck, partial).routes.size, 0, 'Refused edges must never animate as traversed.');
assert.equal(joinFlow(deck, partial).activity.size, 0, 'A refused edge must not light the destination.');
partial = fresh();
applyRecord(partial, { ...edgeRecord, payload: { ...receipt, destinationCellId: 'unmatched-cell' } }, 1);
assert.equal(joinFlow(deck, partial).routes.size, 0);
assert.equal(joinFlow(deck, partial).rejectedEdges.length, 1);
partial = fresh();
for (const event of run.events.filter(event => event.record.payload?.testimonyType === 'cell-execution-testimony.v1')) applyRecord(partial, event.record, event.at);
assert.equal(joinFlow(deck, partial).routes.size, 0, 'Completed endpoints alone cannot establish edge traversal.');
const ownId = [...flow.nodes.keys()].find(nodeId => deck.nodes.find(node => node.id === nodeId)?.kind === 'operation');
const own = flow.nodes.get(ownId)[0];
const ownRecord = run.events.find(event => event.record.payload === own).record;
partial = fresh(); applyRecord(partial, { ...ownRecord, payload: { ...own, disposition: 'failed' } }, 1);
assert.equal(joinFlow(deck, partial).activity.get(ownId).phase, 'failed');
const container = run.graph.cells.find(cell => cell.cellId === own.cellId).parentCellId;
const parent = run.graph.cells.find(cell => cell.cellId === container);
for (const binding of deck.observationMap.bindings.filter(binding => binding.semanticAddress === parent.semanticAddress)) {
  const state = joinFlow(deck, partial).activity.get(binding.nodeId);
  assert.equal(state.phase, 'active'); assert.equal(state.own, false, 'Child evidence must not assert parent completion.');
}
for (const bad of [{ ...run, ambiguous: true }, { ...run, graph: { ...run.graph, graphId: 'wrong' } }]) {
  assert.equal(joinFlow(deck, bad).activity.size, 0); assert.equal(joinFlow(deck, bad).routes.size, 0);
}
assert.equal(joinFlow({ ...deck, snapshotDigest: 'stale' }, run).activity.size, 0);
assert.equal(joinFlow({ ...deck, observationMap: null }, run).activity.size, 0);
const frames = replayFrames(deck, run);
assert.deepEqual(frames.flat(), run.events.map(event => event.record), 'Replay must retain every record in observed order.');
assert(frames.length > 2 && frames.length < run.events.length, 'Pacing groups unlocated detail while retaining visible transitions.');
const copy = fresh(); copy.events = []; copy.graph = null;
for (const frame of frames) for (const record of frame) applyRecord(copy, record);
assert.deepEqual([...joinFlow(deck, copy).routes.keys()], [...flow.routes.keys()]);
assert.deepEqual([...joinFlow(deck, copy).activity].map(([id, state]) => [id, state.phase]), [...flow.activity].map(([id, state]) => [id, state.phase]));
const scenario = deck.slides.find(slide => slide.blueprint?.role === 'scenario-blueprint');
const scenarioRoutes = slideRoutes(deck, scenario, flow);
assert(scenarioRoutes.length > 0);
for (const route of scenarioRoutes) assert(scenario.commands.some(command => command.op === 'route' && JSON.stringify(command.args[0]) === JSON.stringify(route.points)), 'Animated geometry must be an original deck route.');
const eventPorts = scenario.blueprint.providerPorts.filter(port => port.eventId);
for (const port of eventPorts) {
  const id = `${port.eventId}:${port.operationId}:${port.providerId}`;
  assert(scenarioRoutes.some(route => route.id === id), 'Each observed operation must light its own event connection.');
  const wrong = structuredClone(scenario);
  wrong.blueprint.providerPorts = [{ ...port, eventId: 'unrelated-event' }];
  assert(!slideRoutes(deck, wrong, flow).some(route => route.basis === 'Observed operation of the declared event'), 'A wrong event owner cannot light a call.');
  const unobserved = { ...flow, activity: new Map(flow.activity) }; unobserved.activity.delete(port.operationId);
  assert(!slideRoutes(deck, scenario, unobserved).some(route => route.id === id), 'Event completion alone cannot light an unobserved operation.');
}
console.log(JSON.stringify({ capability: deck.capabilityId, activeComponents: flow.activity.size, matchedWires: flow.routes.size,
  scenarioWires: scenarioRoutes.length, replaySteps: frames.length, recordsRetained: frames.flat().length, negativeChecks: 9 }));
