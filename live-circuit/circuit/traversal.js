// One traversal model for the scenario circuit. The database supplies geometry,
// glyph identities and call relationships; receipts supply evidence and
// captured intervals. Every visible state is decided here, once:
//   token    where the dot is (captured clock; schematic position inside a span)
//   current  the component geometrically under the dot
//   busy     callers with outstanding work (the scenario, the owning step, and
//            a call box while its callee has not returned)
//   visited  components the traversal has passed through
//   terminal the scenario's own return: an exact declared variant, or the
//            defect endpoint for unmatched, mismatched or missing testimony
// The renderer draws this state and never reinterprets receipts.
import { capturedTimestamp, joinFlow } from './deck-trace.js';
import { executionCursors } from './execution-cursor.js';

const FLOW_CONTRACT = 'captured-operation-path.v1';
const LOCATIONS = new Set(['input-payload', 'operation', 'provider-port', 'scenario-call', 'provider', 'called-scenario',
  'variant', 'outcome-defect', 'reported-variant']);
const same = (a, b) => a && b && a.every((v, i) => Math.abs(v - b[i]) < .001);
const append = (...paths) => paths.flat().filter((p, i, all) => !i || !same(p, all[i - 1]));
const segmentLengths = points => points.slice(1).map((p, i) => Math.hypot(p[0] - points[i][0], p[1] - points[i][1]));
const pathLength = points => segmentLengths(points).reduce((n, x) => n + x, 0);
const centre = bounds => [bounds.x + bounds.w / 2, bounds.y + bounds.h / 2];

export function pointAtDistance(points, distance) {
  const lengths = segmentLengths(points);
  let left = Math.max(0, distance);
  for (let i = 0; i < lengths.length; i++) {
    if (left <= lengths[i] && lengths[i] > 0) return points[i].map((v, j) => v + (points[i + 1][j] - v) * left / lengths[i]);
    left -= lengths[i];
  }
  return points.at(-1);
}
export const pointOnPath = (points, progress) => pointAtDistance(points, Math.max(0, Math.min(1, progress)) * pathLength(points));

const glyphsOf = scene => [...(scene?.blueprint?.glyphs ?? []), ...(scene?.blueprint?.boundaryGlyphs ?? [])];
const inside = (point, b) => point[0] >= b.x - .01 && point[0] <= b.x + b.w + .01 && point[1] >= b.y - .01 && point[1] <= b.y + b.h + .01;

// The innermost declared location under a point; wires and panels are not locations.
export function locate(scene, point) {
  let best = null;
  for (const glyph of glyphsOf(scene)) if (LOCATIONS.has(glyph.kind) && point && inside(point, glyph.bounds) &&
      (!best || glyph.bounds.w * glyph.bounds.h < best.bounds.w * best.bounds.h)) best = glyph;
  return best?.nodeId ?? null;
}

// Where along a path each location is entered and left, sampled per unit length.
function stopsAlong(scene, points) {
  const total = pathLength(points), stops = [];
  for (let d = 0; d <= total + .5; d += 1) {
    const id = locate(scene, pointAtDistance(points, Math.min(d, total)));
    const last = stops.at(-1);
    if (id && last?.nodeId === id && d - last.to <= 1.001) last.to = Math.min(d, total);
    else if (id) stops.push({ nodeId: id, from: Math.min(d, total), to: Math.min(d, total) });
  }
  return stops;
}

// Only the own scenario return selects a terminal. A declared variant needs an
// exact contract and variant match; anything else reaches the defect endpoint.
export function outcomeTerminal(deck, boundary, evidence, run) {
  if (!boundary || !run?.graph || run.ambiguous || run.graph.graphId !== `graph:${deck.capabilityId}` ||
      deck.observationMap?.snapshotDigest !== deck.snapshotDigest) return null;
  const suffix = deck.observationMap?.flowPolicy?.boundaryPolicy?.reportedVariantSuffix ?? '/reported-variant';
  const defectNodeId = boundary.outcomeNodeId + suffix;
  const returned = (evidence.nodes.get(boundary.eventNodeId) ?? []).filter(fact => fact.cellAltitude === 'scenario').at(-1);
  const finding = evidence.boundaryFindings.find(f => f.scenarioId === boundary.scenarioId &&
    (f.code === 'OUTCOME_VARIANT_NOT_DECLARED' || f.code === 'OUTCOME_CONTRACT_MISMATCH'));
  if (!returned) return run?.ended ? { kind: 'defect', nodeId: defectNodeId, code: 'OUTCOME_RETURN_NOT_OBSERVED',
    reported: null, detail: 'The run ended without the scenario’s own return receipt.' } : null;
  const variant = (boundary.variants ?? []).find(v => evidence.activity.get(v.nodeId)?.basis === 'exact scenario outcome variant');
  const at = capturedTimestamp(returned.completedAt);
  if (variant && !finding) return { kind: 'variant', nodeId: variant.nodeId, variantId: variant.variantId,
    classification: variant.classification, fact: returned, at };
  const code = finding?.code ?? 'OUTCOME_VARIANT_NOT_DECLARED';
  return { kind: 'defect', nodeId: defectNodeId, code, fact: returned, at,
    reported: code === 'OUTCOME_CONTRACT_MISMATCH' ? returned.outcomeContractId ?? null : returned.outcomeVariant ?? null,
    declared: code === 'OUTCOME_CONTRACT_MISMATCH' ? boundary.outcomeContractId : (boundary.variants ?? []).map(v => v.variantId),
    detail: code === 'OUTCOME_CONTRACT_MISMATCH' ? 'Returned outcome contract does not match the declared contract.'
      : 'Returned variant has no exact declared match. It is testimony, not a domain outcome.' };
}

// A linear scene repeats the pages' lanes on one surface: a deck view traverses
// either the pages or the linear scene, never both.
const flowScenes = deck => deck.slides.filter(s => s.blueprint?.flow?.contractId === FLOW_CONTRACT &&
  (s.blueprint.role === 'scenario-linear') === Boolean(deck.linear));
const selectedBoundary = deck => (deck.observationMap?.boundaries ?? []).find(b => b.scenarioId === deck.scenarioId) ??
  deck.observationMap?.boundaries?.[0] ?? null;

// Before the return the dot may only travel the route every outcome shares; the
// branch to one endpoint is selected by the return receipt, at the return.
function sharedPrefix(routes) {
  const prefix = [];
  for (let i = 0; routes.length && routes.every(r => r.length > i && same(r[i], routes[0][i])); i++) prefix.push(routes[0][i]);
  return prefix;
}
function outcomeTarget(scenes, terminal) {
  for (const scene of scenes) {
    const targets = scene.blueprint.flow.outcomeTargets ?? [];
    const target = targets.find(t => t.nodeId === terminal?.nodeId);
    if (!target) continue;
    const shared = sharedPrefix(targets.map(t => t.points));
    return { ...target, scene, shared: shared.length ? shared : target.points.slice(0, 1),
      branch: target.points.slice(Math.max(0, shared.length - 1)) };
  }
  // Older scenes and exports: the target glyph's centre, reached from the output boundary.
  for (const scene of scenes) {
    const glyph = glyphsOf(scene).find(g => g.nodeId === terminal?.nodeId);
    if (glyph) return { nodeId: glyph.nodeId, point: centre(glyph.bounds), scene, shared: scene.blueprint.flow.outputPoints,
      branch: [scene.blueprint.flow.outputPoints.at(-1), centre(glyph.bounds)] };
  }
  return null;
}

// Callee evidence. A provider trip needs the selected executor in the call's own
// receipt; a child scenario needs its captured scenario cell under the call.
function selectedChild(lane, cell, run, deck) {
  const addresses = (deck.observationMap?.boundaries ?? []).filter(b => b.scenarioId === lane.calledScenarioId).map(b => b.semanticAddress);
  const declared = deck.nodes.find(n => n.id === lane.calleeNodeId);
  const bindings = (deck.observationMap?.bindings ?? []).filter(b => b.nodeId === lane.calleeNodeId && b.altitude === 'scenario');
  addresses.push(...bindings.map(b => b.semanticAddress));
  // The captured scenario cell identity names the scenario even when authorityId
  // names its version. Never accept an arbitrary child under the owning call.
  return run.graph.cells.find(c => c.altitude === 'scenario' && c.parentCellId === cell?.cellId &&
    (addresses.includes(c.semanticAddress) || (lane.calledScenarioId &&
      (c.authorityId === lane.calledScenarioId || c.cellId === `cell:scenario:${lane.calledScenarioId}`)) ||
      (declared?.semanticAddress && c.semanticAddress === declared.semanticAddress)));
}
function calleeEvidence(lane, interval, run, deck) {
  const cell = run.graph.cells.find(c => c.cellId === interval.fact.cellId);
  if (lane.calleeKind === 'scenario') {
    const child = selectedChild(lane, cell, run, deck);
    if (!child) return { ok: false, finding: { code: 'CALLED_SCENARIO_NOT_CAPTURED', nodeId: lane.nodeId, calledScenarioId: lane.calledScenarioId } };
    const receipt = [...run.cells.values()].filter(f => f.cellId === child.cellId && f.cellAltitude === 'scenario').at(-1);
    return { ok: true, child, receipt };
  }
  const providerId = lane.providerId ?? (lane.calleeKind === 'provider' ? lane.calleeNodeId : null);
  if (!providerId) return { ok: false };
  let ok = lane.executorProfileId && lane.executorProfileId === interval.fact.providerProfileId &&
    lane.executorAuthorityId && lane.executorAuthorityId === cell?.authorityId;
  let providerReceipt;
  // Native effect executors report their identity in the captured provider
  // child, while the owning mechanic reports the operation's return. Join that
  // exact child instance; another call to the same executor is not evidence.
  if (!ok && lane.executorProfileId && lane.executorAuthorityId === cell?.authorityId &&
      cell.authorityId.startsWith('operation:')) {
    const children = run.graph.cells.filter(child => child.altitude === 'provider' &&
      child.parentCellId === cell.cellId && child.semanticAddress === cell.semanticAddress + '/provider' &&
      child.authorityId === 'provider:' + cell.authorityId.slice('operation:'.length));
    const from = capturedTimestamp(interval.fact.startedAt), to = capturedTimestamp(interval.fact.completedAt);
    if (children.length === 1 && Number.isFinite(from) && Number.isFinite(to)) {
      const child = children[0];
      const receipt = [...run.cells.values()].find(fact => fact.cellId === child.cellId && fact.cellAltitude === child.altitude &&
        fact.semanticAddress === child.semanticAddress && fact.parentCellExecutionId === interval.fact.cellExecutionId &&
        fact.providerProfileId === lane.executorProfileId && capturedTimestamp(fact.startedAt) >= from &&
        capturedTimestamp(fact.completedAt) <= to);
      if (receipt) {
        ok = deck.observationMap.flowPolicy.completedDispositions.includes(receipt.outcomeVariant);
        if (!ok) return { ok: false, finding: { code: 'PROVIDER_EXCHANGE_NOT_COMPLETED', nodeId: lane.nodeId,
          reported: receipt.outcomeVariant } };
        providerReceipt = receipt;
      }
    }
  }
  return ok ? { ok: true, receipt: providerReceipt } : { ok: false, finding: { code: 'PROVIDER_EXECUTOR_NOT_MATCHED', nodeId: lane.nodeId,
    declared: lane.executorProfileId ?? null, reported: interval.fact.providerProfileId ?? null } };
}

// A timing piece maps captured time to distance along the segment's path.
function pieces(from, to, total, outbound, dwell, basis) {
  if (!dwell) return [{ t0: from, t1: to, d0: 0, d1: total, basis }];
  return [{ t0: from, t1: dwell.from, d0: 0, d1: outbound, basis: 'captured call start; schematic entry' },
    { t0: dwell.from, t1: dwell.to, d0: outbound, d1: outbound, basis: dwell.basis },
    { t0: dwell.to, t1: to, d0: outbound, d1: total, basis: 'captured child return; schematic return' }];
}
function distanceAt(segment, position) {
  for (const p of segment.pieces) if (position < p.t1 || p === segment.pieces.at(-1))
    return p.t1 > p.t0 ? p.d0 + (p.d1 - p.d0) * Math.max(0, Math.min(1, (position - p.t0) / (p.t1 - p.t0))) : p.d1;
  return segment.length;
}

export function buildTraversal(deck, run, timeline = null) {
  const evidence = joinFlow(deck, run), boundary = selectedBoundary(deck), scenes = flowScenes(deck);
  const terminal = outcomeTerminal(deck, boundary, evidence, run);
  const model = { deck, run, boundary, scenes, evidence, terminal, timeline, segments: [], findings: [],
    payloadNodeId: scenes[0]?.blueprint.flow.payloadNodeId ?? null, disclosure: scenes[0]?.blueprint.flow.disclosure };
  if (!timeline) model.liveCursors = executionCursors(deck, run);
  if (!timeline || !scenes.length) return model;
  const lanes = new Map();
  // Extra payload/variant pages repeat the execution row. Follow the first
  // declared occurrence; manual inspection can select any repeated view.
  for (const scene of scenes) for (const lane of scene.blueprint.flow.lanes) if (!lanes.has(lane.nodeId)) lanes.set(lane.nodeId, { ...lane, scene });
  let previous;
  for (const interval of [...timeline.intervals].sort((a, b) => a.from - b.from || a.to - b.to)) {
    const lane = lanes.get(interval.nodeId);
    if (!lane) { model.findings.push({ code: 'OPERATION_PATH_NOT_DECLARED', nodeId: interval.nodeId }); previous = null; continue; }
    const call = lane.requestPoints ? calleeEvidence(lane, interval, run, deck) : { ok: false };
    if (call.finding) model.findings.push(call.finding);
    const [entry, middle, exit] = lane.throughPoints;
    const prefix = !previous && interval.from === 0 ? lane.scene.blueprint.flow.inputPoints : [entry];
    const outboundPath = append(prefix, [entry, middle], call.ok ? lane.requestPoints : []);
    const points = append(outboundPath, call.ok ? lane.responsePoints : [], [middle, exit]);
    const length = pathLength(points), outbound = pathLength(outboundPath);
    const childFrom = capturedTimestamp(call.receipt?.startedAt) - timeline.start, childTo = capturedTimestamp(call.receipt?.completedAt) - timeline.start;
    const dwell = call.receipt && Number.isFinite(childFrom) && Number.isFinite(childTo) &&
      interval.from <= childFrom && childFrom <= childTo && childTo <= interval.to ? { from: childFrom, to: childTo,
        basis: lane.calleeKind === 'provider' ? 'captured provider execution' : 'captured child scenario execution' } : null;
    if (call.ok && lane.calleeKind === 'scenario' && !dwell) model.findings.push({ code: 'CALLED_SCENARIO_INTERVAL_NOT_CAPTURED', nodeId: lane.nodeId });
    const segment = { kind: 'operation', nodeId: lane.nodeId, key: interval.record.observationKey, from: interval.from, to: interval.to,
      points, length, outbound, sceneId: lane.scene.id, lane, interval, call: call.ok ? lane.calleeKind : null,
      portNodeId: call.ok ? lane.portNodeId : null, calleeNodeId: call.ok ? lane.calleeNodeId : null,
      pieces: pieces(interval.from, interval.to, length, outbound, dwell, 'captured own-operation start/end; schematic path progress'),
      stops: stopsAlong(lane.scene, points) };
    if (previous && previous.to <= interval.from) {
      const edge = deck.edges.find(e => e.kind === 'sequence' && e.from === previous.nodeId && e.to === interval.nodeId);
      const admitted = edge && evidence.routes.get(edge.id);
      if (admitted) {
        const handoff = [previous.points.at(-1), points[0]];
        model.segments.push({ kind: 'handoff', key: admitted.key, nodeId: previous.nodeId, from: previous.to, to: interval.from,
          points: handoff, length: pathLength(handoff), sceneId: previous.sceneId, nextSceneId: segment.sceneId,
          pageChange: previous.sceneId !== segment.sceneId, fact: admitted.fact, stops: [],
          pieces: pieces(previous.to, interval.from, pathLength(handoff), 0, null, 'captured inter-operation interval and admitted sequence receipt') });
      } else if (!same(previous.points.at(-1), points[0])) model.findings.push({ code: 'SEQUENCE_TRAVERSAL_NOT_OBSERVED', from: previous.nodeId, to: interval.nodeId });
    }
    model.segments.push(segment); previous = segment;
  }
  const last = model.segments.filter(s => s.kind === 'operation').sort((a, b) => a.to - b.to).at(-1);
  const target = outcomeTarget(scenes, terminal);
  if (last && terminal?.fact && target) {
    const to = terminal.at - timeline.start;
    const points = append([last.points.at(-1)], target.scene.id === last.sceneId ? target.shared : []);
    model.segments.push({ kind: 'outcome', key: `return:${terminal.fact.cellExecutionId}`, nodeId: terminal.nodeId, from: last.to, to,
      points, length: pathLength(points), sceneId: last.sceneId, targetSceneId: target.scene.id, targetPoint: target.point,
      branch: target.branch, terminal, stops: stopsAlong(last.lane.scene, points),
      // No positive duration is invented for an instantaneous return.
      pieces: pieces(last.to, to, pathLength(points), 0, null, 'captured scenario return; the terminal activates only at the return') });
  } else if (last && terminal?.fact && !target) model.findings.push({ code: 'OUTCOME_ROUTE_NOT_DECLARED', nodeId: terminal.nodeId });
  return model;
}

function sceneOf(model, id) { return model.deck.slides.find(s => s.id === id); }

// Evidence phases as displayed. The payload shares its input boundary's
// participation; the defect endpoint shows its terminal once returned.
function phasesFor(model, evidence, terminal) {
  const phases = new Map(evidence.activity);
  const input = model.boundary && evidence.activity.get(model.boundary.inputNodeId);
  if (model.payloadNodeId && input) phases.set(model.payloadNodeId, { ...input, basis: 'payload of the participating scenario input' });
  if (terminal?.kind === 'defect') phases.set(terminal.nodeId, { phase: 'outcome-defect', fact: terminal.fact ?? null,
    key: terminal.fact ? `return:${terminal.fact.cellExecutionId}` : 'return:missing', own: false, basis: terminal.detail });
  return phases;
}

function replayState(model, state, position) {
  const segments = model.segments;
  let selected = segments.filter(s => s.kind === 'operation' && s.from <= position && position < s.to);
  if (!selected.length) selected = segments.filter(s => s.from <= position && position < s.to);
  if (!selected.length) { const done = segments.filter(s => s.to <= position).sort((a, b) => a.to - b.to).at(-1); if (done) selected = [done]; }
  const returned = segments.find(s => s.kind === 'outcome' && s.to <= position);
  if (!returned && model.boundary && segments.length) state.busy.add(model.boundary.eventNodeId);
  for (const s of segments) if (s.to <= position) for (const stop of s.stops) state.visited.add(stop.nodeId);
  for (const s of selected) {
    const distance = distanceAt(s, position), complete = position >= s.to;
    const arrived = s.kind === 'outcome' && complete;
    const point = arrived ? s.targetPoint : s.pageChange ? s.points[0] : pointAtDistance(s.points, distance);
    const sceneId = arrived ? s.targetSceneId : s.sceneId;
    const current = locate(sceneOf(model, sceneId), point);
    if (current) state.current.add(current);
    for (const stop of s.stops) if (stop.from <= distance) state.visited.add(stop.nodeId);
    const returning = s.call && distance > s.outbound;
    if (s.kind === 'operation' && !complete) {
      state.busy.add(s.nodeId);
      // The call box waits while the dot is beyond it: out to the callee and back.
      const port = s.stops.find(stop => stop.nodeId === s.portNodeId);
      const mirror = returning ? 2 * s.outbound - distance : distance;
      if (port && mirror > port.to && current !== s.portNodeId) state.busy.add(s.portNodeId);
    }
    state.busy.delete(current);
    const piece = s.pieces.find(p => position < p.t1) ?? s.pieces.at(-1);
    state.tokens.push({ key: s.key, kind: s.kind, nodeId: s.nodeId, sceneId, point, distance, current,
      progress: s.length ? distance / s.length : 1, complete,
      direction: returning ? 'return' : 'forward', basis: piece.basis,
      stage: s.kind === 'operation' ? s.call ? `${returning ? 'return from' : 'call to'} ${s.call === 'scenario' ? 'called scenario' : 'provider'}` : 'execution'
        : s.kind === 'outcome' ? complete ? model.terminal?.kind === 'variant' ? 'declared outcome' : 'outcome defect' : 'returning' : 'handoff' });
  }
  if (returned) {
    state.terminal = model.terminal;
    state.terminalRoute = { sceneId: returned.targetSceneId, points: returned.branch, nodeId: returned.nodeId };
    state.visited.add(returned.nodeId);
  }
}

function liveLocation(model, cursor) {
  for (const scene of model.scenes) {
    const lane = scene.blueprint.flow.lanes.find(l => l.nodeId === cursor.operationId);
    if (!lane) continue;
    const complete = cursor.stage === 'completion';
    // Admission identifies the dispatched operation, not a measured network
    // phase. Display its selected call only when the captured authority agrees.
    // Completion additionally verifies the executor actually reported back.
    const matchedAuthority = lane.executorAuthorityId && lane.executorAuthorityId === cursor.cell.authorityId;
    const returnedCall = complete && lane.requestPoints ? calleeEvidence(lane, { fact: cursor.fact }, model.run, model.deck) : null;
    const call = lane.requestPoints && (complete ? returnedCall.ok :
      matchedAuthority && (lane.calleeKind === 'provider' ? Boolean(lane.executorProfileId) :
        Boolean(selectedChild(lane, cursor.cell, model.run, model.deck))));
    const [entry, middle, exit] = lane.throughPoints;
    const arrivalPath = complete ? [exit] : append([entry, middle], call ? lane.requestPoints : []);
    const point = arrivalPath.at(-1);
    return { key: cursor.key, kind: 'operation', nodeId: lane.nodeId, sceneId: scene.id, point,
      current: locate(scene, point), complete, cursor, lane, call, arrivalPath,
      finding: lane.requestPoints && !call ? returnedCall?.finding ?? { code: lane.calleeKind === 'scenario' ?
        'CALLED_SCENARIO_NOT_MATCHED' : 'PROVIDER_AUTHORITY_NOT_MATCHED', nodeId: lane.nodeId } : null,
      departurePath: complete ? [exit] : append(call ? lane.responsePoints : [middle], [middle, exit]),
      stage: complete ? 'operation returned' : call ? `admitted ${lane.calleeKind} call · awaiting return` : 'operation active · awaiting return',
      basis: complete ? 'own operation return receipt' : call ? 'received operation admission/activity and matching captured authority; selected callee, no measured transport phase'
        : 'received operation admission or contained activity' };
  }
  if (cursor.eventId === model.boundary?.eventNodeId && cursor.stage !== 'outcome' && cursor.edge?.kind !== 'return') {
    const scene = model.scenes[0], point = scene?.blueprint.flow.inputPoints[0];
    if (point) return { key: cursor.key, kind: 'input', nodeId: model.payloadNodeId, sceneId: scene.id, point,
      current: locate(scene, point), arrivalPath: [point], departurePath: scene.blueprint.flow.inputPoints,
      cursor, stage: 'scenario input observed', basis: 'received scenario admission or contained activity' };
  }
  return null;
}

// Admission opens a live call; its own return closes it. No completed interval
// or replay clock participates. Unmapped nested receipts leave that call intact.
function liveState(model, state, run) {
  const { deck } = model, evidence = state.evidence;
  for (const [id, activity] of evidence.activity) if (activity.own || activity.phase === 'observed') state.visited.add(id);
  for (const [id, activity] of evidence.activity) if (activity.phase === 'admitted' || activity.phase === 'active') state.busy.add(id);
  const terminal = outcomeTerminal(deck, model.boundary, evidence, run);
  const pending = new Map(), ambiguous = new Set();
  state.history = [];
  for (const cursor of model.liveCursors ?? []) {
    const token = liveLocation(model, cursor);
    if (!token) continue;
    if (token.finding) state.findings.push(token.finding);
    state.history.push(token);
    const invocation = cursor.cell.cellId;
    if (ambiguous.has(invocation)) continue;
    if (token.complete) pending.delete(invocation);
    else if (token.kind === 'operation') {
      if (cursor.stage === 'admission' && pending.has(invocation)) {
        state.findings.push({ code: 'LIVE_INVOCATION_IDENTITY_AMBIGUOUS', nodeId: token.nodeId });
        ambiguous.add(invocation); pending.delete(invocation); continue;
      }
      pending.set(invocation, token);
    }
    if (token.complete && token.call) {
      for (const id of [token.lane.portNodeId, token.lane.calleeNodeId]) {
        state.visited.add(id);
        state.phases.set(id, { phase: 'observed', key: token.key, fact: cursor.fact,
          basis: 'own operation return matched to selected executor and captured authority' });
      }
    }
  }
  state.history = state.history.filter(t => !ambiguous.has(t.cursor?.cell.cellId));
  const liveRoutes = new Map();
  for (const token of state.history) {
    if (!token.lane) continue;
    const [entry, middle, exit] = token.lane.throughPoints;
    const points = token.complete ? append([entry, middle], token.call ? token.lane.requestPoints : [],
      token.call ? token.lane.responsePoints : [], [middle, exit]) : token.arrivalPath;
    liveRoutes.set(token.nodeId, { id: `live:${token.nodeId}`, sceneId: token.sceneId, points,
      evidence: { key: token.key, fact: token.cursor.fact }, basis: token.basis });
  }
  state.liveRoutes = [...liveRoutes.values()];
  if (evidence.activity.has(model.boundary?.inputNodeId)) {
    state.visited.add(model.payloadNodeId);
    const scene = model.scenes[0];
    if (scene) state.liveRoutes.push({ id: `live:${model.payloadNodeId}`, sceneId: scene.id,
      points: scene.blueprint.flow.inputPoints, evidence: evidence.activity.get(model.boundary.inputNodeId) });
  }
  if (!terminal && model.boundary && evidence.activity.has(model.boundary.eventNodeId) && !run?.ended) state.busy.add(model.boundary.eventNodeId);
  if (terminal) {
    state.busy.clear();
    state.terminal = terminal;
    const target = outcomeTarget(model.scenes, terminal);
    if (target) state.terminalRoute = { sceneId: target.scene.id, points: target.branch, nodeId: terminal.nodeId };
    if (target) state.tokens.push({ key: terminal.fact ? `return:${terminal.fact.cellExecutionId}` : 'return:missing', kind: 'outcome',
      nodeId: terminal.nodeId, sceneId: target.scene.id, point: target.point, current: terminal.nodeId, complete: true,
      arrivalPath: target.points ?? target.branch, departurePath: [target.point],
      stage: terminal.kind === 'variant' ? 'declared outcome' : 'outcome defect', basis: 'latest received scenario return' });
    if (state.tokens.length) state.history.push(state.tokens[0]);
    state.current.add(terminal.nodeId);
    return;
  }
  state.tokens = pending.size ? [...pending.values()] : state.history.filter(t => !ambiguous.has(t.cursor?.cell.cellId)).slice(-1);
  for (const token of state.tokens) {
    if (token.current) state.current.add(token.current);
    if (!token.complete && token.kind === 'operation') {
      state.busy.add(token.nodeId);
      if (token.call) for (const id of [token.lane.portNodeId, token.lane.calleeNodeId]) {
        state.phases.set(id, { phase: 'admitted', key: token.key, fact: token.cursor.fact, basis: token.basis });
        state.busy.add(id);
      }
    }
  }
  // Exported decks carry no flow geometry: the latest receipt's component is current.
  if (!state.tokens.length && !model.scenes.length) {
    const cursor = model.liveCursors?.at(-1);
    if (cursor?.nodeId) state.current.add(cursor.nodeId);
  }
}

// `position` is milliseconds into the captured scenario window (replay), or
// null for live receipts. `run` is the evidence available at that position.
export function traversalState(model, { position = null, run = model.run } = {}) {
  const evidence = run === model.run ? model.evidence : joinFlow(model.deck, run);
  const state = { tokens: [], current: new Set(), busy: new Set(), visited: new Set(), evidence, terminal: null,
    findings: [...model.findings], disclosure: model.disclosure, sceneId: null, live: position === null };
  state.phases = phasesFor(model, evidence, position === null ? outcomeTerminal(model.deck, model.boundary, evidence, run) : null);
  if (position === null) liveState(model, state, run); else replayState(model, state, position);
  for (const id of state.current) state.busy.delete(id);
  if (position !== null) state.phases = phasesFor(model, evidence, state.terminal);
  state.sceneId = state.tokens[0]?.sceneId ?? null;
  state.status = state.tokens.length > 1 ? `${state.tokens.length} ${state.live ? 'outstanding live' : 'overlapping captured'} operations` : state.tokens[0]?.stage ?? 'awaiting evidence';
  return state;
}

// Presentation interpolation between *received* live locations, never an
// execution clock. A single short transition is retargeted by new receipts;
// durations are not taken from completed operations or queued per operation.
// No motion continues after the scenario returns. Replay does not use this.
export class LiveMotion {
  constructor(milliseconds = 120) { this.milliseconds = milliseconds; this.reset(); }
  reset() { this.identity = null; this.count = 0; this.last = null; this.points = []; this.started = 0; this.moving = false; }
  sample(now) {
    const progress = Math.min(1, Math.max(0, (now - this.started) / this.milliseconds));
    const distance = pathLength(this.points) * progress;
    this.moving = progress < 1 && this.points.length > 1;
    const point = pointAtDistance(this.points, distance);
    // Retargeting keeps only the untraveled part of the displayed route.
    let consumed = 0;
    const lengths = segmentLengths(this.points);
    const next = lengths.findIndex(length => { consumed += length; return consumed > distance; });
    return { point, remaining: next < 0 ? [point] : append([point], this.points.slice(next + 1)) };
  }
  update(model, view, now, reducedMotion = false) {
    const identity = `${model.deck.id}:${model.deck.snapshotDigest}:${model.run?.id ?? ''}`;
    if (identity !== this.identity || view.history?.length < this.count) { this.reset(); this.identity = identity; }
    const history = view.history ?? [], fresh = history.slice(this.count);
    this.count = history.length;
    if (reducedMotion || view.terminal || model.run?.ended || view.tokens.length !== 1) {
      this.moving = false; this.points = []; this.last = history.at(-1) ?? null;
      return view;
    }
    // A parallel sibling can return while another call remains outstanding.
    // Its return route does not belong to the remaining call's dot.
    if (history.at(-1)?.key !== view.tokens[0].key) {
      this.moving = false; this.last = view.tokens[0]; this.points = [this.last.point];
      return view;
    }
    // An admitted call is already outstanding at its selected callee. Delaying
    // that location by a decorative transition can hide a call that returns
    // faster than the transition. Show the received location immediately;
    // its own return still controls departure, never an animation timeout.
    if (view.tokens[0].call && !view.tokens[0].complete) {
      this.moving = false; this.last = view.tokens[0]; this.points = [this.last.point];
      return view;
    }
    if (fresh.length) {
      let path = this.points.length ? this.sample(now).remaining : [], previous = this.last;
      for (const token of fresh) {
        const scene = sceneOf(model, token.sceneId), flow = scene.blueprint.flow;
        let connection = null;
        if (!previous && token.nodeId === flow.lanes[0]?.nodeId && view.visited.has(flow.payloadNodeId)) {
          connection = append(flow.inputPoints, token.complete ? token.lane.throughPoints : token.arrivalPath);
        } else if (previous?.sceneId === token.sceneId) {
          if (previous.nodeId === token.nodeId) {
            if (token.complete && (!previous.call || token.call)) connection = previous.departurePath;
          } else if (previous.kind === 'input' && token.nodeId === flow.lanes[0]?.nodeId) {
            connection = append(previous.departurePath, token.arrivalPath);
          } else if (previous.complete && token.cursor?.stage === 'admission' &&
              token.cursor.edge?.from.cellId === previous.cursor?.cell.cellId &&
              token.cursor.fact.sourceCellExecutionId === previous.cursor?.fact.cellExecutionId &&
              model.deck.edges.some(e => e.kind === token.cursor.edge.kind && e.from === previous.nodeId && e.to === token.nodeId)) {
            connection = append(previous.departurePath, token.arrivalPath);
          }
        }
        // No admitted connection or a page change: change location, not topology.
        path = connection ? append(path, connection) : [token.point];
        previous = token;
      }
      this.last = previous; this.points = path; this.started = now;
    }
    if (!this.points.length) return view;
    const token = view.tokens[0], { point } = this.sample(now), scene = sceneOf(model, token.sceneId);
    const current = locate(scene, point);
    if (token.current && !token.complete) view.busy.add(token.current);
    view.current = new Set(current ? [current] : []);
    if (current) view.busy.delete(current);
    view.tokens = [{ ...token, point, current, stage: this.moving ? 'live receipt transition' : token.stage,
      basis: this.moving ? 'schematic transition between received locations; no execution duration inferred' : token.basis }];
    view.status = view.tokens[0].stage;
    return view;
  }
}
