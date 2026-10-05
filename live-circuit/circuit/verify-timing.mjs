// Deterministic scheduler checks use a real capture. No generated testimony is
// sent to the observer. Damaged copies are explicit negative tests only.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadDeck } from './deck-store.mjs';
import { newRun, applyRecord, replayTimeline, capturedTimestamp } from './deck-trace.js';
import { buildTraversal, traversalState } from './traversal.js';
import { PlaybackClock } from './playback-clock.js';
const [id, capture] = process.argv.slice(2);
assert(id && capture, 'Supply an exported deck ID and real SSE capture');
const deck = id.endsWith('.json') ? JSON.parse(await readFile(id,'utf8')) : await loadDeck(id);
const records = (await readFile(capture,'utf8')).split(/\r?\n/).filter(l=>l.startsWith('data: ')).map(l=>JSON.parse(l.slice(6)));
const runs = []; let run;
for (const record of records) {
  if (record.kind === 'run-start') { run = newRun(record); runs.push(run); }
  else if (run) applyRecord(run,record,record.seq);
}
run = runs.findLast(r=>r.graph?.graphId === `graph:${deck.capabilityId}`);
const timeline = replayTimeline(deck,run);
const graphRecord=run.events.find(e=>e.record.payload?.observationType==='execution-graph-captured.v1').record;
const repeated=newRun(run.startRecord);applyRecord(repeated,graphRecord);applyRecord(repeated,structuredClone(graphRecord));
assert(repeated.ambiguous,'Different captured graph emissions cannot be merged as one run');
const wrongProcess=newRun(run.startRecord);applyRecord(wrongProcess,{kind:'run-end',payload:{processId:-1}});
assert(wrongProcess.ambiguous,'Run start/end process identities must agree');
const closed=structuredClone(run), closedCount=closed.events.length;
applyRecord(closed,{kind:'observation',payload:{observationType:'command-timing.v1'}});
assert.equal(closed.events.length,closedCount,'Post-run launcher bookkeeping must not extend an invocation');
const scenarioRecords=timeline.frames.flatMap(f=>f.records);
assert.deepEqual([...scenarioRecords,...timeline.outsideRecords].sort((a,b)=>a.seq-b.seq),run.events.map(e=>e.record),
  'Excluded host records remain available as evidence');
assert(scenarioRecords.every(r=>r.payload?.testimonyType),'Host phases never become scenario playback frames');
assert.equal(timeline.frames[0].at,0,'Scenario starts immediately with no host startup delay');
assert.equal(timeline.frames.at(-1).at,timeline.duration,'Playback ends at the scenario return');
assert.equal(timeline.intervals[0].from,0);
for (const frame of timeline.frames) {
  assert.equal(frame.at,capturedTimestamp(frame.timestamp)-timeline.start);
  for (const record of frame.records) if (record.payload?.testimonyType)
    assert.equal(frame.at,capturedTimestamp(record.payload.completedAt ?? record.payload.observedAt)-timeline.start,
      'Every cell/edge receipt is scheduled at its own captured execution timestamp');
}
class Scheduler {
  time=0; serial=0; tasks=new Map();
  now=()=>this.time;
  set=(fn,delay)=>{ const id=++this.serial;this.tasks.set(id,{at:this.time+delay,fn});return id; };
  clear=id=>this.tasks.delete(id);
  advance(to) {
    let count=0;
    while (true) {
      const next=[...this.tasks].sort((a,b)=>a[1].at-b[1].at)[0];
      if (!next || next[1].at>to) break;
      assert(++count<100000,'Scheduler must make progress');
      this.time=next[1].at;this.tasks.delete(next[0]);next[1].fn();
    }
    this.time=to;
  }
}
const close=(a,b)=>assert(Math.abs(a-b)<0.002,`${a} != ${b}`);
const measurements=[];
for (const rate of Object.values(deck.observationMap.flowPolicy.replayRates)) {
  const scheduler=new Scheduler(), seen=[];
  const clock=new PlaybackClock(timeline,frame=>seen.push([frame,scheduler.time]),()=>{},scheduler);
  clock.rate=rate;clock.resume();scheduler.advance(timeline.duration/rate+1);
  assert(clock.done);assert.equal(seen.length,timeline.frames.length);
  for (const [frame,at] of seen) close(at,frame.at/rate);
  close(clock.wallElapsed,timeline.duration/rate);
  measurements.push({rate,expectedWallMs:timeline.duration/rate,measuredWallMs:clock.wallElapsed});
}
const scheduler=new Scheduler(), seen=[];
const clock=new PlaybackClock(timeline,f=>seen.push(f),()=>{},scheduler);
clock.resume();scheduler.advance(timeline.duration*.2);clock.pause();
const held=clock.position, count=seen.length;
scheduler.advance(scheduler.time+5000);
assert.equal(clock.position,held);assert.equal(seen.length,count);assert.equal(scheduler.tasks.size,0);
clock.resume();scheduler.advance(scheduler.time+timeline.duration-held+1);assert(clock.done);close(clock.wallElapsed,timeline.duration);
const stepScheduler=new Scheduler(), steps=[];
const stepped=new PlaybackClock(timeline,f=>steps.push(f),()=>{},stepScheduler);
stepped.next();assert.equal(steps.length,1);assert(stepped.paused);assert.equal(stepScheduler.tasks.size,0);
stepped.resume();stepScheduler.advance(stepScheduler.time+100);stepped.speed(2);
const rebased=stepped.position;const wall=stepped.wallElapsed;
stepScheduler.advance(stepScheduler.time+(timeline.duration-rebased)/2+1);
assert(stepped.done);close(stepped.wallElapsed,wall+(timeline.duration-rebased)/2);
const lateScheduler=new Scheduler(), late=[];
const lateClock=new PlaybackClock(timeline,f=>late.push(f),()=>{},lateScheduler);
lateClock.resume();lateScheduler.time=timeline.duration+500;lateClock.tick();
assert(lateClock.done);assert.equal(late.length,timeline.frames.length);assert.equal(lateScheduler.tasks.size,0);

const partial=newRun(run.startRecord);partial.graph=run.graph;
const model=buildTraversal(deck,run,timeline);
const outcomeAt=new Map();
let busyChecks=0;
for (const frame of timeline.frames) {
  for (const record of frame.records) applyRecord(partial,record,frame.at);
  const view=traversalState(model,{position:frame.at,run:partial});
  const active=timeline.intervals.filter(i=>i.from<=frame.at && frame.at<i.to);
  // The owning step is busy, or current while the dot is on it; never both, never another step.
  const busyOperations=[...view.busy,...view.current].filter(id=>deck.nodes.find(n=>n.id===id)?.kind==='operation');
  if (active.length===1) { assert.deepEqual(busyOperations,[active[0].nodeId],'Exactly the owning operation owns work (busy or current) within its captured interval');busyChecks++; }
  for (const boundary of deck.observationMap.boundaries) for (const variant of boundary.variants) {
    if (!view.phases.has(variant.nodeId)) continue;
    const own=[...partial.cells.values()].find(f=>f.cellAltitude==='scenario' && f.semanticAddress===boundary.semanticAddress && f.outcomeVariant===variant.variantId);
    assert(own,'An outcome cannot light from an operation or future return');
    if (!outcomeAt.has(variant.nodeId)) outcomeAt.set(variant.nodeId,frame.at);
  }
  if (view.terminal) assert(frame.at>=capturedTimestamp(view.terminal.fact.completedAt)-timeline.start,'The terminal activates only at the own return');
}
assert(busyChecks>0);
const intervals=[...timeline.intervals].sort((a,b)=>a.from-b.from);
let overlaps=0;
for (let i=1;i<intervals.length;i++) if(intervals[i].from<intervals[i-1].to) overlaps++;
// Verify each declared sequence edge against the actual mapped operation spans.
let sequenceChecks=0;
for (const edge of deck.edges.filter(e=>e.kind==='sequence')) {
  const a=intervals.filter(i=>i.nodeId===edge.from), b=intervals.filter(i=>i.nodeId===edge.to);
  if(a.length===1 && b.length===1) { assert(a[0].to<=b[0].from,'Sequential operations must not overlap');sequenceChecks++; }
}
assert(sequenceChecks>0);
for (const damaged of [{...run,ended:false},{...run,ambiguous:true},{...run,startedAt:null},{...run,graph:{...run.graph,graphId:'wrong'}}])
  assert.throws(()=>replayTimeline(deck,damaged));
assert.throws(()=>replayTimeline({...deck,snapshotDigest:'stale'},run));
assert.throws(()=>replayTimeline({...deck,observationMap:null},run));
for (const patch of [{completedAt:null,observedAt:null},{completedAt:run.startedAt}]) {
  const damaged=structuredClone(run);const event=damaged.events.find(e=>e.record.payload?.testimonyType==='cell-execution-testimony.v1');
  Object.assign(event.record.payload,patch);assert.throws(()=>replayTimeline(deck,damaged));
}
console.log(JSON.stringify({capture,runId:run.id,recordedDurationMs:timeline.duration,window:timeline.window,
  scenarioRecords:scenarioRecords.length,outsideRecords:timeline.outsideRecords.length,recordsRetained:run.events.length,
  timestampedFrames:timeline.frames.length,operationIntervals:intervals.map(i=>({nodeId:i.nodeId,startMs:i.from,endMs:i.to})),
  sequentialOverlapCount:overlaps,sequenceChecks,clockChecks:measurements,pauseResume:true,step:true,speedChange:true,
  stalledBrowserCatchup:true,exactOutcomeFrames:[...outcomeAt],busyOwnershipFrames:busyChecks,negativeChecks:10},null,2));
