// Regression against a real installed-kernel scene and SSE capture. Altered
// copies below test refusals only and are never sent to an observer.
// node live-circuit/circuit/verify-scenario-return.mjs <scene.json> <capture.sse>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {newRun,applyRecord,replayTimeline} from './deck-trace.js';
import {buildTraversal,traversalState} from './traversal.js';
const [sceneFile,captureFile]=process.argv.slice(2);
assert(sceneFile&&captureFile,'Supply the database scene and real capture');
const deck=JSON.parse(fs.readFileSync(sceneFile,'utf8'));
const records=fs.readFileSync(captureFile,'utf8').split(/\r?\n/).filter(l=>l.startsWith('data: ')).map(l=>JSON.parse(l.slice(6)));
const runs=[];let run;
for(const record of records) {
 if(record.kind==='run-start'){run=newRun(record);runs.push(run);}
 else if(run)applyRecord(run,record,Date.parse(record.receivedAt));
}
run=runs.findLast(r=>r.graph?.graphId===`graph:${deck.capabilityId}`&&r.ended);
assert(run,'A complete real run is required');
const lanes=[...new Map(deck.slides.flatMap(s=>s.blueprint?.flow?.lanes??[]).filter(l=>l.calleeKind==='scenario').map(l=>[l.nodeId,l])).values()];
assert(lanes.length,'Called scenarios are required');
const shown=traversalState(buildTraversal(deck,run));
const replay=buildTraversal(deck,run,replayTimeline(deck,run));
let negatives=0,active=0;
for(const lane of lanes) {
 for(const id of [lane.portNodeId,lane.calleeNodeId]) {
  assert(shown.visited.has(id),`${id} has real return evidence`);
  assert.equal(shown.phases.get(id)?.phase,'observed',`${id} lights from that evidence`);
 }
 assert(replay.segments.some(s=>s.nodeId===lane.nodeId&&s.call==='scenario'),'Replay recognizes the same call');
 const child=run.graph.cells.find(c=>c.cellId===`cell:scenario:${lane.calledScenarioId}`);
 assert.equal(child.parentCellId,null,'Exercise the root-level composed scenario shape');
 const edge=run.graph.edges.find(e=>e.kind==='return'&&e.from.cellId===child.cellId);
 const prefix=newRun(run.startRecord);
 let wasActive=false;
 for(const event of run.events) {
  applyRecord(prefix,event.record,event.at);
  const state=traversalState(buildTraversal(deck,prefix));
  if(state.current.has(lane.calleeNodeId)&&!state.visited.has(lane.calleeNodeId))wasActive=true;
  if(event.record.payload?.cellId===child.cellId)break;
 }
 assert(wasActive,'Actual child activity illuminates its selected caller before return');active++;
 const cases=[
  ['missing return edge',copy=>{copy.graph.edges=copy.graph.edges.filter(e=>e.edgeId!==edge.edgeId);}],
  ['wrong return port',copy=>{copy.graph.edges.find(e=>e.edgeId===edge.edgeId).to.portId='wrong-port';}],
  ['ambiguous return',copy=>{copy.graph.edges.push({...edge,edgeId:'negative:second-return'});}],
  ['dangling parent',copy=>{copy.graph.cells.find(c=>c.cellId===child.cellId).parentCellId='missing-parent';}],
  ['missing child return',copy=>{for(const [key,f]of copy.cells)if(f.cellId===child.cellId)copy.cells.delete(key);}],
  ['wrong child address',copy=>{for(const f of copy.cells.values())if(f.cellId===child.cellId)f.semanticAddress='wrong-address';}],
  ['wrong return instance',copy=>{for(const f of copy.edges.values())if(f.edgeId===edge.edgeId)f.sourceCellExecutionId='wrong-instance';}],
  ['refused return',copy=>{for(const f of copy.edges.values())if(f.edgeId===edge.edgeId)f.admissionDisposition='refused';}],
 ];
 for(const [label,mutate]of cases) {
  const copy=structuredClone(run);mutate(copy);
  const state=traversalState(buildTraversal(deck,copy));
  assert(!state.visited.has(lane.calleeNodeId),`${label} must not appear visited`);
  assert(state.findings.some(f=>f.nodeId===lane.nodeId&&f.code.startsWith('CALLED_SCENARIO_')),`${label} must have a named diagnostic`);
  negatives++;
 }
}
console.log(JSON.stringify({calledScenarios:lanes.length,litCallBoxes:lanes.length,activeBeforeReturn:active,negativeChecks:negatives,run:run.id}));
