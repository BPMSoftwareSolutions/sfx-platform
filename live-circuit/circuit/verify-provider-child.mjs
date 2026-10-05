// Positive assertions consume real installed-kernel records. Mutated copies
// below exercise refusal only; no generated testimony is sent to the observer.
// node live-circuit/circuit/verify-provider-child.mjs <scene.json> <observations.ndjson>
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {newRun,applyRecord,replayTimeline,capturedTimestamp} from './deck-trace.js';
import {buildTraversal,traversalState} from './traversal.js';
const [sceneFile,captureFile]=process.argv.slice(2);
assert(sceneFile&&captureFile,'Supply a database scene and real host capture');
const deck=JSON.parse(await readFile(sceneFile,'utf8'));
const records=(await readFile(captureFile,'utf8')).trim().split(/\r?\n/).map(JSON.parse);
const runs=[];let run;
for(const [index,source] of records.entries()){
  // The host capture precedes observer assignment. These local keys identify
  // records in the verifier only; payloads and their clocks stay verbatim.
  const record={...source,payload:source.kind==='observation'?source.payload:source,
    observationKey:'capture:'+index,seq:index,receivedAt:source.payload?.observedAt??source.at};
  if(record.kind==='run-start'){run=newRun(record);runs.push(run);}
  else if(run)applyRecord(run,record,Date.parse(record.receivedAt));
}
const lanes=deck.slides.flatMap(s=>s.blueprint?.flow?.lanes??[]).filter(l=>l.calleeKind==='provider');
assert(lanes.length>0);
let returns=0,refusals=0,liveBeforeReturn=0;const timedProviders=[];
for(const run of runs){
  assert.equal(run.graph.graphId,'graph:'+deck.capabilityId);
  const live=traversalState(buildTraversal(deck,run));
  const replay=buildTraversal(deck,run,replayTimeline(deck,run));
  const prefix=newRun(run.startRecord),pending=new Set();
  for(const event of run.events){
    applyRecord(prefix,event.record,event.at);
    for(const token of traversalState(buildTraversal(deck,prefix)).tokens){
      if(!token.call||token.complete)continue;
      assert(![...prefix.cells.values()].some(f=>f.cellId===token.cursor.cell.cellId),
        'Live provider is visible before its owning operation returns');
      pending.add(token.nodeId);
    }
  }
  for(const lane of lanes){
    const binding=deck.observationMap.bindings.find(b=>b.nodeId===lane.nodeId);
    const parent=run.graph.cells.find(c=>c.semanticAddress===binding.semanticAddress&&c.altitude===binding.altitude);
    const child=run.graph.cells.find(c=>c.parentCellId===parent.cellId&&c.altitude==='provider');
    const fact=[...run.cells.values()].find(f=>f.cellId===child.cellId);
    assert(fact,'The capture must exercise provider children');
    const completed=deck.observationMap.flowPolicy.completedDispositions.includes(fact.outcomeVariant);
    assert.equal(live.visited.has(lane.calleeNodeId),completed,'Only an exact completed exchange establishes visited provider history');
    assert.equal(replay.segments.find(s=>s.nodeId===lane.nodeId).call==='provider',completed);
    if(!completed){refusals++;continue;}
    returns++;
    const segment=replay.segments.find(s=>s.nodeId===lane.nodeId);
    const dwell=segment.pieces.find(p=>p.basis==='captured provider execution');
    const from=capturedTimestamp(fact.startedAt)-replay.timeline.start;
    const to=capturedTimestamp(fact.completedAt)-replay.timeline.start;
    assert(dwell,'A matched provider receipt must supply its replay interval');
    assert.equal(dwell.t0,from);assert.equal(dwell.t1,to);
    assert.equal(dwell.d0,dwell.d1,'Recorded provider work holds the dot at the provider');
    for(const fraction of [0.01,0.5,0.99]){
      if(to===from)continue;
      const state=traversalState(replay,{position:from+(to-from)*fraction,run});
      assert(state.current.has(lane.calleeNodeId),'Provider stays current throughout its actual recorded interval');
      assert(state.busy.has(lane.nodeId)&&state.busy.has(lane.portNodeId),'Owning operation and port remain busy');
    }
    timedProviders.push({provider:lane.calleeNodeId,from,to,duration:to-from});
    assert(pending.has(lane.nodeId));liveBeforeReturn++;
    for(const mutate of [
      f=>{f.providerProfileId='wrong-executor';},
      f=>{f.parentCellExecutionId='wrong-instance';},
      f=>{f.semanticAddress='wrong-address';},
      f=>{f.completedAt='2099-01-01T00:00:00Z';}
    ]){
      const negative=structuredClone(run);
      for(const f of negative.cells.values())if(f.cellId===child.cellId)mutate(f);
      assert(!traversalState(buildTraversal(deck,negative)).visited.has(lane.calleeNodeId));
    }
    const wrongParent=structuredClone(run);
    wrongParent.graph.cells.find(c=>c.cellId===child.cellId).parentCellId='wrong-parent';
    assert(!traversalState(buildTraversal(deck,wrongParent)).visited.has(lane.calleeNodeId));
  }
}
assert(returns>0&&refusals>0,'Acceptance requires real completed and refused exchanges');
console.log(JSON.stringify({runs:runs.length,matchedReturns:returns,liveBeforeReturn,refusedExchanges:refusals,negativeChecks:returns*5,liveAndReplay:true,timedProviders}));
