// Acceptance for the one traversal model (docs/scenario-circuit-design-review.md).
// Positive execution claims use a retained real capture. Altered copies are
// labelled: they test refusal/defect behaviour and routing logic only, and are
// never uploaded to the observer or shown as demo testimony.
//   node live-circuit/circuit/verify-traversal.mjs <scene.json> <capture.sse> [<child-scene.json>]
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { newRun, applyRecord, replayTimeline, capturedTimestamp } from './deck-trace.js';
import { buildTraversal, traversalState, locate, pointAtDistance } from './traversal.js';
import { PlaybackClock } from './playback-clock.js';
const [sceneFile, captureFile, childSceneFile] = process.argv.slice(2);
assert(sceneFile && captureFile, 'Supply a scene JSON and a real SSE capture');
const deck = JSON.parse(await readFile(sceneFile, 'utf8'));
const runs = []; let run;
for (const record of (await readFile(captureFile, 'utf8')).split(/\r?\n/).filter(l => l.startsWith('data: ')).map(l => JSON.parse(l.slice(6)))) {
  if (record.kind === 'run-start') { run = newRun(record); runs.push(run); } else if (run) applyRecord(run, record);
}
run = runs.findLast(r => r.graph?.graphId === `graph:${deck.capabilityId}`);
assert(run?.ended, 'A complete real capture of the scene capability is required');
const scene = id => deck.slides.find(s => s.id === id);
const glyph = (sceneId, nodeId) => [...(scene(sceneId).blueprint.glyphs ?? []), ...(scene(sceneId).blueprint.boundaryGlyphs ?? [])].find(g => g.nodeId === nodeId);
const within = (p, b) => p[0] >= b.x - .01 && p[0] <= b.x + b.w + .01 && p[1] >= b.y - .01 && p[1] <= b.y + b.h + .01;
let timeline;
try { timeline = replayTimeline(deck, run); } catch (error) {
  // Replay is held; the live state must still be honest about what was received.
  const live = traversalState(buildTraversal(deck, run), { run });
  const operationsCurrent = [...live.current].filter(id => deck.nodes.find(n => n.id === id)?.kind === 'operation');
  assert.equal(operationsCurrent.length, 0, 'No step is claimed without its own receipt');
  if (live.terminal) assert(within(live.tokens[0].point, glyph(live.tokens[0].sceneId, live.terminal.nodeId).bounds), 'The dot is at the received terminal');
  console.log(JSON.stringify({ capture: captureFile, runId: run.id, replay: 'held', reason: error.message,
    live: { current: [...live.current], busy: [...live.busy], terminal: live.terminal && { kind: live.terminal.kind, code: live.terminal.code ?? null, reported: live.terminal.reported ?? null, nodeId: live.terminal.nodeId } } }, null, 2));
  process.exit(0);
}
const model = buildTraversal(deck, run, timeline);
const prefixAt = at => { const r = newRun(run.startRecord); r.graph = run.graph; for (const f of timeline.frames.filter(f => f.at <= at)) for (const x of f.records) applyRecord(r, x); return r; };
const report = { capture: captureFile, runId: run.id, findings: model.findings.map(f => f.code) };

// 1. One payload; the route starts inside it, outside every field; it lights at entry.
const first = model.segments[0], flow = scene(first.sceneId).blueprint.flow;
const payload = glyph(first.sceneId, flow.payloadNodeId);
assert(payload?.kind === 'input-payload', 'The scene declares one payload component');
assert(within(first.points[0], payload.bounds), 'The route starts inside the payload component');
for (const field of scene(first.sceneId).blueprint.boundaryGlyphs.filter(g => g.kind === 'input-field')) {
  assert(within([field.bounds.x, field.bounds.y], payload.bounds) && within([field.bounds.x + field.bounds.w, field.bounds.y + field.bounds.h], payload.bounds), 'Fields are members of the payload');
  assert(!within(first.points[0], field.bounds), 'The start point is not on a field');
}
const entry = traversalState(model, { position: 0, run: prefixAt(0) });
assert(entry.current.has(flow.payloadNodeId), 'The payload is the current location at scenario entry');
report.payload = { start: first.points[0], currentAtEntry: true };

// 2. Current follows the dot; busy is the call stack; timing is captured only.
function sampleTraversal(model) {
let samples = 0, providerCurrent = 0, calleeCurrent = 0, portBusyWhileBeyond = 0;
const earliestReturn = model.terminal?.at != null ? model.terminal.at - timeline.start : Infinity;
for (const s of model.segments) {
  for (let j = 0; j <= 200; j++) {
    const at = s.from + (s.to - s.from) * j / 200;
    if (at >= s.to && s.to > s.from) continue;
    const view = traversalState(model, { position: at, run: prefixAt(at) });
    const token = view.tokens.find(t => t.key === s.key); assert(token, 'The dot never disappears inside a captured segment');
    const under = locate(scene(token.sceneId), token.point);
    assert.deepEqual([...view.current], under ? [under] : [], 'Current is exactly the component under the dot');
    for (const id of view.current) assert(within(token.point, glyph(token.sceneId, id).bounds), 'A current component contains the dot');
    if (s.kind === 'operation') {
      assert(view.busy.has(s.nodeId) || view.current.has(s.nodeId), 'The owning step stays busy throughout its own interval');
      for (const other of model.segments.filter(o => o.kind === 'operation' && o !== s && !(o.from <= at && at < o.to)))
        assert(!view.busy.has(other.nodeId), "No other sequential step is busy");
      if (s.call && view.current.has(s.calleeNodeId)) {
        (s.call === 'scenario' ? calleeCurrent++ : providerCurrent++);
        assert(view.busy.has(s.portNodeId), 'The call box waits while its callee holds the dot');
        portBusyWhileBeyond++;
      }
      if (s.call && !view.current.has(s.calleeNodeId)) {
        const callee = glyph(s.sceneId, s.calleeNodeId);
        assert(!within(token.point, callee.bounds), 'A callee is never current before the dot reaches it');
      }
    }
    if (at < earliestReturn) {
      for (const id of view.current) assert(!['variant', 'outcome-defect'].includes(glyph(token.sceneId, id).kind), 'No outcome endpoint is reached before the return');
      assert.equal(view.terminal, null, 'No terminal before the own return');
    }
    samples++;
  }
}
return { samples, providerTrips: model.segments.filter(s => s.call === 'provider').length, childTrips: model.segments.filter(s => s.call === 'scenario').length, providerCurrentSamples: providerCurrent, calleeCurrentSamples: calleeCurrent, portBusyWhileBeyond };
}
const sampled = sampleTraversal(model);
const operations = model.segments.filter(s => s.kind === 'operation');
assert.equal(operations.length, timeline.intervals.length);
for (const s of operations) {
  const interval = timeline.intervals.find(i => i.nodeId === s.nodeId && i.from === s.from);
  assert(interval && interval.to === s.to, 'Operation segments equal their captured intervals');
}
for (let i = 1; i < model.segments.length; i++) {
  const [a, b] = [model.segments[i - 1], model.segments[i]];
  assert.equal(b.from, a.to, 'Segments are contiguous in captured time: no added delay');
  if (!b.pageChange && a.sceneId === b.sceneId) assert.deepEqual(b.points[0], a.points.at(-1), 'No teleport between contiguous segments');
}
report.traversal = { operations: operations.length, ...sampled };
// Provider-trip logic when this capture has no matched executor: align the scene's
// executor rule to the reported executor (scene altered; testimony untouched).
if (!sampled.providerTrips) {
  const aligned = structuredClone(deck);
  for (const s of aligned.slides) for (const lane of s.blueprint.flow?.lanes ?? []) if (lane.requestPoints && lane.calleeKind !== 'scenario') {
    const interval = timeline.intervals.find(i => i.nodeId === lane.nodeId), cell = run.graph.cells.find(c => c.cellId === interval?.fact.cellId);
    if (interval) Object.assign(lane, { executorProfileId: interval.fact.providerProfileId, executorAuthorityId: cell?.authorityId });
  }
  const trips = sampleTraversal(buildTraversal(aligned, run, timeline));
  assert(trips.providerTrips > 0 && trips.providerCurrentSamples > 0 && trips.portBusyWhileBeyond === trips.providerCurrentSamples);
  report.providerTripLogic = { basis: 'scene executor rule aligned to the reported executor; logic only, not execution testimony', ...trips };
}

// 3. The own return selects the terminal: an exact declared variant or the defect endpoint.
const end = traversalState(model, { position: timeline.duration, run });
assert(end.terminal, 'The own return selects a terminal');
const target = end.tokens[0];
assert.equal(target.nodeId, end.terminal.nodeId);
assert(within(target.point, glyph(target.sceneId, end.terminal.nodeId).bounds), 'The dot ends inside the selected endpoint');
if (end.terminal.kind === 'variant') assert(model.boundary.variants.some(v => v.variantId === end.terminal.variantId));
else assert(!model.boundary.variants.some(v => v.nodeId === end.terminal.nodeId), 'A defect is never a declared variant');
report.terminal = { kind: end.terminal.kind, nodeId: end.terminal.nodeId, variantId: end.terminal.variantId ?? null,
  code: end.terminal.code ?? null, reported: end.terminal.reported ?? null };

// 4. Clock: 1x and 0.1x use the same captured window; pause holds; step and speed rebase.
class Scheduler { time = 0; serial = 0; tasks = new Map(); now = () => this.time;
  set = (fn, delay) => { const id = ++this.serial; this.tasks.set(id, { at: this.time + delay, fn }); return id; };
  clear = id => this.tasks.delete(id);
  run(until = Infinity) { for (;;) { const next = [...this.tasks].sort((a, b) => a[1].at - b[1].at)[0];
    if (!next || next[1].at > until) break; this.time = next[1].at; this.tasks.delete(next[0]); next[1].fn(); } } }
report.clock = [];
for (const rate of [1, .1]) {
  const scheduler = new Scheduler(), clock = new PlaybackClock(timeline, () => {}, () => {}, { ...scheduler, now: scheduler.now, set: scheduler.set, clear: scheduler.clear, frameMilliseconds: 16 });
  clock.rate = rate; clock.resume(); scheduler.run();
  assert(clock.done); assert(Math.abs(clock.wallElapsed - timeline.duration / rate) < .01, 'No presentation delay is added');
  report.clock.push({ rate, capturedMs: timeline.duration, wallMs: clock.wallElapsed });
}
{
  const scheduler = new Scheduler(), clock = new PlaybackClock(timeline, () => {}, () => {}, { now: scheduler.now, set: scheduler.set, clear: scheduler.clear, frameMilliseconds: 16 });
  clock.resume(); scheduler.run(timeline.duration * .4); clock.pause();
  const held = clock.position, before = traversalState(model, { position: held, run: prefixAt(held) });
  scheduler.time += 5000; scheduler.run(scheduler.time);
  const after = traversalState(model, { position: clock.position, run: prefixAt(clock.position) });
  assert.equal(clock.position, held); assert.deepEqual(after.tokens[0].point, before.tokens[0].point, 'Pause holds the dot');
  assert.deepEqual([...after.current], [...before.current]); assert.deepEqual([...after.busy], [...before.busy]);
  clock.next(); assert(clock.position >= held, 'Step advances to the next captured frame');
  clock.speed(2); clock.resume(); scheduler.run(); assert(clock.done);
  report.pauseStepSpeed = true;
}

// 5. Declared routes for every outcome class. Altered copies check routing only.
const routing = [];
for (const variant of model.boundary.variants) {
  const copy = structuredClone(run);
  for (const e of copy.events) { const p = e.record.payload; if (p?.testimonyType === 'cell-execution-testimony.v1' && p.cellAltitude === 'scenario') p.outcomeVariant = variant.variantId; }
  copy.cells = new Map([...copy.cells].map(([k, v]) => [k, v.cellAltitude === 'scenario' ? { ...v, outcomeVariant: variant.variantId } : v]));
  const altered = buildTraversal(deck, copy, replayTimeline(deck, copy));
  const done = traversalState(altered, { position: timeline.duration, run: copy });
  assert.equal(done.terminal.kind, 'variant'); assert.equal(done.terminal.nodeId, variant.nodeId);
  assert(within(done.tokens[0].point, glyph(done.tokens[0].sceneId, variant.nodeId).bounds));
  routing.push({ variant: variant.variantId, classification: variant.classification, routed: true });
}
report.declaredVariantRouting = { basis: 'altered copies; routing logic only, not execution testimony', routing };

// 6. Defects: unknown, mismatched and missing outcome testimony (altered copies).
const defects = {};
{
  const copy = structuredClone(run);
  for (const e of copy.events) { const p = e.record.payload; if (p?.cellAltitude === 'scenario') p.outcomeVariant = 'NOT-A-DECLARED-VARIANT'; }
  copy.cells = new Map([...copy.cells].map(([k, v]) => [k, v.cellAltitude === 'scenario' ? { ...v, outcomeVariant: 'NOT-A-DECLARED-VARIANT' } : v]));
  const t = traversalState(buildTraversal(deck, copy, replayTimeline(deck, copy)), { position: timeline.duration, run: copy }).terminal;
  assert.equal(t.kind, 'defect'); assert.equal(t.code, 'OUTCOME_VARIANT_NOT_DECLARED'); defects.unknownVariant = t.nodeId;
}
{
  const copy = structuredClone(run);
  for (const e of copy.events) { const p = e.record.payload; if (p?.cellAltitude === 'scenario') p.outcomeContractId = 'mismatched-contract.v1'; }
  copy.cells = new Map([...copy.cells].map(([k, v]) => [k, v.cellAltitude === 'scenario' ? { ...v, outcomeContractId: 'mismatched-contract.v1' } : v]));
  const t = traversalState(buildTraversal(deck, copy), { run: copy }).terminal;
  assert.equal(t.kind, 'defect'); assert.equal(t.code, 'OUTCOME_CONTRACT_MISMATCH'); defects.mismatchedContract = t.nodeId;
}
{
  const copy = structuredClone(run);
  copy.events = copy.events.filter(e => e.record.payload?.cellAltitude !== 'scenario');
  copy.cells = new Map([...copy.cells].filter(([, v]) => v.cellAltitude !== 'scenario'));
  assert.throws(() => replayTimeline(deck, copy), 'Replay stays held without the own return');
  const t = traversalState(buildTraversal(deck, copy), { run: copy }).terminal;
  assert.equal(t.kind, 'defect'); assert.equal(t.code, 'OUTCOME_RETURN_NOT_OBSERVED'); defects.missingReturn = t.nodeId;
}
report.defects = { basis: 'altered copies; defect behaviour only', ...defects };

// 7. Held traversal: an unmatched executor or missing admitted edge is a finding, not a trip.
{
  const wrong = structuredClone(deck); for (const s of wrong.slides) for (const lane of s.blueprint.flow?.lanes ?? []) lane.executorProfileId = 'unmatched-negative-test';
  const held = buildTraversal(wrong, run, timeline);
  assert.equal(held.segments.filter(s => s.call === 'provider').length, 0);
  const missing = structuredClone(run); missing.events = missing.events.filter(e => e.record.payload?.testimonyType !== 'edge-execution-testimony.v1'); missing.edges.clear();
  assert(buildTraversal(deck, missing, timeline).findings.some(f => f.code === 'SEQUENCE_TRAVERSAL_NOT_OBSERVED'));
  report.heldTraversal = true;
}

// 8. Child scenario calls: declared entry/return geometry (and execution, when captured).
if (childSceneFile) {
  const child = JSON.parse(await readFile(childSceneFile, 'utf8'));
  const lanes = child.slides.flatMap(s => (s.blueprint?.flow?.lanes ?? []).map(l => ({ l, s }))).filter(x => x.l.calleeKind === 'scenario');
  assert(lanes.length > 0, 'The child scene declares called-scenario lanes');
  for (const { l, s } of lanes) {
    const device = [...s.blueprint.glyphs].find(g => g.nodeId === l.calleeNodeId), box = s.blueprint.glyphs.find(g => g.nodeId === l.portNodeId);
    assert.equal(device?.kind, 'called-scenario'); assert.equal(box?.kind, 'scenario-call');
    assert(within(l.requestPoints.at(-1), device.bounds), 'Entry ends inside the called scenario');
    assert.deepEqual(l.responsePoints.at(-1), l.throughPoints[1], 'Return rejoins the owning step');
    const path = [...l.requestPoints, ...l.responsePoints.slice(1)];
    const total = path.slice(1).reduce((n, p, i) => n + Math.hypot(p[0] - path[i][0], p[1] - path[i][1]), 0);
    const seen = new Set(); for (let d = 0; d <= total; d += 1) seen.add(locate(s, pointAtDistance(path, d)));
    assert(seen.has(l.portNodeId) && seen.has(l.calleeNodeId) && seen.has(l.nodeId), 'The route crosses step, call box and child');
    assert(s.blueprint.navigation.some(n => n.target.kind === 'scenario' && n.target.id === l.calledScenarioId), 'The child is a drill-down target');
  }
  report.childGeometry = { scene: child.capabilityId, calledScenarioLanes: lanes.length, captured: report.traversal.childTrips };
}
console.log(JSON.stringify(report, null, 2));
