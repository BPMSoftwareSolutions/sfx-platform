// Identity joins only. The database supplies the component/address mapping.
// Testimony remains verbatim; an observed component is not a success verdict.
export function newRun(record) {
  return { id: record.runId ?? record.observationKey, startedAt: record.payload?.at ?? record.receivedAt, startRecord: record, graph: null,
    cells: new Map(), edges: new Map(), other: [], events: [], ended: false, ambiguous: false };
}
// Shared observers can carry concurrent invocations. Only a producer-supplied
// envelope ID separates them; graph/cell identities and arrival order cannot.
// Older, unattributed producers retain the fail-closed overlap behaviour.
export function observeRecord(runs, record, at = Date.now()) {
  const runId = record.runId;
  if (record.kind === 'run-start') {
    const existing = runId && runs.find(run => run.startRecord.runId === runId);
    if (existing) { existing.ambiguous = true; return existing; }
    const overlapping = runId ? [] : runs.filter(run => !run.startRecord.runId && !run.ended);
    for (const run of overlapping) run.ambiguous = true;
    const run = newRun(record); run.ambiguous = overlapping.length > 0;
    runs.push(run);
    return run;
  }
  const run = runId ? runs.find(run => run.startRecord.runId === runId)
    : runs.findLast(run => !run.startRecord.runId);
  if (run) applyRecord(run, record, at);
  return run;
}
export function applyRecord(run, record, at = Date.now()) {
  // Launcher bookkeeping may arrive after run-end. It belongs outside the
  // invocation envelope and must not extend its recorded execution clock.
  if (run.ended) return;
  run.events.push({ record, at });
  const payload = record.payload ?? {};
  if (record.kind === 'run-end') {
    const processId = payload.processId ?? payload.pid, startedProcess = run.startRecord?.payload?.processId ?? run.startRecord?.payload?.pid;
    if (processId != null && startedProcess != null && processId !== startedProcess) run.ambiguous = true;
    run.ended = true; run.exitCode = payload.exitCode; return;
  }
  if (payload.observationType === 'execution-graph-captured.v1') {
    if (run.graph && run.graph !== payload) run.ambiguous = true;
    else run.graph = payload;
  } else if (payload.testimonyType === 'cell-execution-testimony.v1') {
    // Keep every observer receipt: some emitters reuse a cellExecutionId for
    // the enclosing scenario return. That must not erase the operation receipt.
    run.cells.set(record.observationKey, payload);
  } else if (payload.testimonyType === 'edge-execution-testimony.v1') {
    run.edges.set(record.observationKey, payload);
  } else if (String(payload.observationType ?? '').includes('failure')) run.other.push(payload);
}
export function joinTestimony(deck, run) {
  const nodes = new Map(), unmatched = [], unaddressed = [];
  if (!run?.graph || !deck.observationMap || run.ambiguous ||
      run.graph.graphId !== `graph:${deck.capabilityId}` || deck.observationMap.snapshotDigest !== deck.snapshotDigest)
    return { nodes, unmatched, unaddressed };
  const planned = new Map(run.graph.cells.map((cell) => [cell.cellId, cell]));
  const addresses = new Map();
  for (const binding of deck.observationMap.bindings) {
    const key = JSON.stringify([binding.semanticAddress, binding.altitude]);
    addresses.set(key, [...(addresses.get(key) ?? []), binding.nodeId]);
  }
  for (const testimony of run.cells.values()) {
    const cell = planned.get(testimony.cellId);
    if (!cell || cell.semanticAddress !== testimony.semanticAddress || cell.altitude !== testimony.cellAltitude) {
      unmatched.push(testimony); continue;
    }
    const targets = addresses.get(JSON.stringify([cell.semanticAddress, cell.altitude]));
    if (!targets) { unaddressed.push(testimony); continue; }
    for (const id of targets) nodes.set(id, [...(nodes.get(id) ?? []), testimony]);
  }
  return { nodes, unmatched, unaddressed };
}

// A generic renderer of the database's flow policy. Graph edges/parents and deck
// identities supply topology; no operation names, inferred ordering or timers
// establish execution. Timers only keep evidence flashes visible to a human.
export function joinFlow(deck, run) {
  const result = { ...joinTestimony(deck, run), activity: new Map(), routes: new Map(), rejectedEdges: [], boundaryFindings: [] };
  const policy = deck.observationMap?.flowPolicy;
  if (!policy || !run?.graph || run.ambiguous || run.graph.graphId !== `graph:${deck.capabilityId}` ||
      deck.observationMap.snapshotDigest !== deck.snapshotDigest) return result;
  const cells = new Map(run.graph.cells.map(cell => [cell.cellId, cell]));
  const edges = new Map(run.graph.edges.map(edge => [edge.edgeId, edge]));
  const addresses = new Map();
  for (const binding of deck.observationMap.bindings) {
    const key = JSON.stringify([binding.semanticAddress, binding.altitude]);
    addresses.set(key, [...(addresses.get(key) ?? []), binding.nodeId]);
  }
  const targets = cell => cell ? addresses.get(JSON.stringify([cell.semanticAddress, cell.altitude])) ?? [] : [];
  const set = (id, phase, event, fact, own = false, basis = own ? 'own cell receipt' : 'admission or contained activity') => {
    const previous = result.activity.get(id);
    result.activity.set(id, { ...previous, phase, at: event.at, key: event.record.observationKey,
      firstAt: previous?.firstAt ?? event.at, fact, own, basis,
      completedAt: own && (phase === 'completed' || phase === 'failed') ? event.at : previous?.completedAt });
  };
  const ancestors = (cell, event, fact) => {
    const seen = new Set();
    while (policy.ancestorActivity && cell?.parentCellId && !seen.has(cell.parentCellId)) {
      seen.add(cell.parentCellId); cell = cells.get(cell.parentCellId);
      for (const id of targets(cell)) set(id, 'active', event, fact);
    }
  };
  const receipts = new Map();
  for (const event of run.events) {
    const fact = event.record.payload ?? {};
    if (fact.testimonyType === 'cell-execution-testimony.v1') {
      const cell = cells.get(fact.cellId);
      if (!cell || cell.semanticAddress !== fact.semanticAddress || cell.altitude !== fact.cellAltitude) continue;
      const sourceCells = receipts.get(fact.cellExecutionId) ?? new Set();
      sourceCells.add(fact.cellId); receipts.set(fact.cellExecutionId, sourceCells);
      const phase = policy.failureDispositions.includes(fact.disposition) ? 'failed' :
        policy.completedDispositions.includes(fact.disposition) ? 'completed' : 'observed';
      for (const id of targets(cell)) set(id, phase, event, fact, true);
      ancestors(cell, event, fact);
      // A provider declaration alone supplies no activity. Its exact identity
      // must occur in a component's own receipt, at receipt time.
      if (fact.providerProfileId) for (const node of deck.nodes) {
        if (node.id === policy.providerIdentityPrefix + fact.providerProfileId)
          set(node.id, phase === 'failed' ? 'failed' : 'observed', event, fact, false, 'exact provider identity in cell receipt');
      }
    } else if (fact.testimonyType === 'edge-execution-testimony.v1') {
      const edge = edges.get(fact.edgeId), destination = cells.get(fact.destinationCellId);
      const source = receipts.get(fact.sourceCellExecutionId);
      if (!edge || !destination || !cells.has(edge.from.cellId) || edge.to.cellId !== fact.destinationCellId || destination.semanticAddress !== fact.semanticAddress ||
          (source && !source.has(edge.from.cellId))) { result.rejectedEdges.push(fact); continue; }
      const admitted = policy.admittedDispositions.includes(fact.admissionDisposition);
      if (!admitted) continue; // A refused route cannot light its destination.
      const from = targets(cells.get(edge.from.cellId)), to = targets(destination);
      for (const id of to) set(id, 'admitted', event, fact);
      for (const id of from) if (!result.activity.get(id)?.own) set(id, 'traversed', event, fact);
      ancestors(destination, event, fact);
      for (const route of deck.edges) if (policy.edgeKinds.includes(route.kind) && route.kind === edge.kind &&
          from.includes(route.from) && to.includes(route.to)) {
        result.routes.set(route.id, { at: event.at, key: event.record.observationKey, fact });
      }
    }
  }
  if (run.ended) for (const value of result.activity.values()) {
    if (value.phase === 'active' || value.phase === 'admitted') value.phase = 'observed';
  }
  if (policy.boundaryPolicy) for (const boundary of deck.observationMap.boundaries ?? []) {
    const scenario = [...cells.values()].find(cell => cell.altitude === 'scenario' && cell.semanticAddress === boundary.semanticAddress);
    const activity = result.activity.get(boundary.eventNodeId);
    if (!scenario || !activity) continue;
    const ownEvents = run.events.filter(event => event.record.payload?.testimonyType === 'cell-execution-testimony.v1' &&
      event.record.payload.cellId === scenario.cellId && event.record.payload.cellAltitude === scenario.altitude &&
      event.record.payload.semanticAddress === scenario.semanticAddress);
    // Input participation is observable before a completion receipt. Individual
    // field presence is claimed only if a matching input shape was published.
    if (scenario.ports?.input?.contractId === boundary.inputContractId) {
      const shapeEvent = ownEvents.findLast(event => event.record.payload.inputShape?.contractId === boundary.inputContractId);
      const shape = shapeEvent?.record.payload.inputShape;
      result.activity.set(boundary.inputNodeId, { ...activity, phase: 'input-observed', own: false,
        at: activity.firstAt, basis: 'scenario input participation; payload values may be withheld' });
      const hasPayload = shape && Object.hasOwn(shape, 'payload') && !shape.payloadRef;
      for (const field of boundary.fields ?? []) {
        const present = hasPayload && hasPointer(shape, field.path);
        if (hasPayload && !present) continue;
        result.activity.set(field.nodeId, { ...activity, phase: present ? 'input-observed' : 'input-context', own: false,
          at: shapeEvent?.at ?? activity.firstAt, key: shapeEvent?.record.observationKey ?? activity.key,
          fact: shapeEvent?.record.payload ?? activity.fact,
          basis: present ? 'field present in published input shape' : 'input boundary active; field presence not published' });
      }
      if (!hasPayload) result.boundaryFindings.push({ scenarioId: boundary.scenarioId, code: 'INPUT_FIELD_PRESENCE_NOT_PUBLISHED' });
    }
    const returned = ownEvents.at(-1), fact = returned?.record.payload;
    if (!fact) continue;
    if (fact.outcomeContractId !== boundary.outcomeContractId || scenario.ports?.outcome?.contractId !== boundary.outcomeContractId) {
      result.boundaryFindings.push({ scenarioId: boundary.scenarioId, code: 'OUTCOME_CONTRACT_MISMATCH', reported: fact.outcomeContractId }); continue;
    }
    const variant = (boundary.variants ?? []).find(variant => variant.variantId === fact.outcomeVariant &&
      scenario.ports.outcome.variants?.includes(variant.variantId));
    const phase = variant ? variant.classification === policy.boundaryPolicy.failureClassification ? 'outcome-failure' : 'completed' : 'variant-unmapped';
    set(boundary.outcomeNodeId, phase, returned, fact, false, 'own scenario return receipt');
    if (variant) set(variant.nodeId, phase, returned, fact, false, 'exact scenario outcome variant');
    else {
      set(boundary.outcomeNodeId + policy.boundaryPolicy.reportedVariantSuffix, phase, returned, fact, false, 'reported variant has no exact declared match');
      result.boundaryFindings.push({ scenarioId: boundary.scenarioId, code: 'OUTCOME_VARIANT_NOT_DECLARED',
        reported: fact.outcomeVariant ?? null, declared: (boundary.variants ?? []).map(variant => variant.variantId) });
    }
  }
  return result;
}

function hasPointer(value, pointer) {
  if (!pointer.startsWith('$/')) return false;
  for (const part of pointer.slice(2).split('/').map(part => part.replaceAll('~1', '/').replaceAll('~0', '~'))) {
    if (value === null || typeof value !== 'object' || !Object.hasOwn(value, part)) return false;
    value = value[part];
  }
  return true;
}

// Group receipts at visible changes. Grouping never supplies replay timing.
export function replayFrames(deck, run) {
  const copy = newRun({ observationKey: run.id, receivedAt: run.startedAt });
  const frames = []; let previous = '', group = [];
  for (const event of run.events) {
    applyRecord(copy, event.record, 0); group.push(event.record);
    const flow = joinFlow(deck, copy);
    const signature = JSON.stringify([...flow.activity].map(([id, s]) => [id, s.phase, s.own])) +
      JSON.stringify([...flow.routes.keys()]);
    if (signature !== previous || event.record.kind === 'run-end') {
      frames.push(group); group = []; previous = signature;
    }
  }
  if (group.length) frames.push(group);
  return frames;
}

export function capturedTimestamp(value) {
  if (typeof value !== 'string') return NaN;
  const match = value.match(/^(.*?)(?:\.(\d+))?(Z|[+-]\d\d:\d\d)$/);
  if (!match) return NaN;
  return Date.parse(match[1] + match[3]) + Number('0.' + (match[2] ?? '0')) * 1000;
}

// Wall-clock phases and process-local cost spans are distinct evidence lanes.
// No subtraction of unrelated clocks and no inferred scenario component.
export function invocationTiming(deck, run, intervals = [], now = Date.now()) {
  const policy = deck.observationMap?.flowPolicy?.invocationTiming;
  if (!policy || !run || run.ambiguous) return null;
  const start = capturedTimestamp(run.startedAt);
  const end = run.events.findLast(e=>e.record.kind==='run-end')?.record.payload?.at;
  const duration = Math.max(0,(end ? capturedTimestamp(end) : now)-start);
  if (!Number.isFinite(start) || !Number.isFinite(duration)) return null;
  const open = new Map(), phases = [], spans = new Map(), findings = [];
  for (const {record} of run.events) {
    const fact = record.payload ?? {};
    if (fact.observationType === policy.wallPhaseType) {
      const at = capturedTimestamp(fact[policy.wallTimestamp])-start;
      if (!Number.isFinite(at) || at<0 || at>duration) { findings.push('INVALID_PHASE_TIMESTAMP'); continue; }
      if (fact.status === policy.startStatus) {
        if (open.has(fact.phase)) findings.push('AMBIGUOUS_PHASE_INTERVAL');
        open.set(fact.phase,{id:record.observationKey,label:fact.phase,from:at,startRecord:record});
      } else if (policy.endStatuses.includes(fact.status)) {
        const begun = open.get(fact.phase);
        if (!begun || begun.from>at) { findings.push('UNPAIRED_PHASE_END'); continue; }
        phases.push({...begun,to:at,endRecord:record,basis:'captured UTC phase boundaries'});open.delete(fact.phase);
      }
    } else if (fact.observationType === policy.processSpanType && policy.endStatuses.includes(fact.status)) {
      spans.set(JSON.stringify([fact.clockDomain,fact.processId,fact.spanId]),{...fact,record});
    }
  }
  for (const begun of open.values()) {
    if (run.ended) findings.push('UNFINISHED_PHASE');
    else phases.push({...begun,to:duration,open:true,basis:'received phase start; completion not yet observed'});
  }
  const covered = [...phases,...intervals].sort((a,b)=>a.from-b.from), gaps=[];
  let through=0;
  for(const span of covered) {
    if(span.from>through)gaps.push({from:through,to:span.from});
    through=Math.max(through,span.to);
  }
  if(through<duration)gaps.push({from:through,to:duration});
  return {start,duration,phases,gaps,processSpans:[...spans.values()],findings,
    beforeFirstOperation:intervals.length?Math.min(...intervals.map(i=>i.from)):null,
    unlocatedMilliseconds:gaps.reduce((n,g)=>n+g.to-g.from,0), intervals};
}

export function replayTimeline(deck, run) {
  if (!run?.ended || run.ambiguous) throw new Error('A complete, unambiguous capture is required');
  const policy = deck.observationMap?.flowPolicy;
  if (!run.graph || run.graph.graphId !== `graph:${deck.capabilityId}` || deck.snapshotDigest !== deck.observationMap?.snapshotDigest)
    throw new Error('Captured graph and declared mapping must match');
  if (policy?.replayClock !== 'captured-execution-timestamps' || policy?.replayIntervals !== 'own-operation-timestamps' || policy?.replayRates?.normal !== 1)
    throw new Error('Captured execution clock policy is not declared; refresh declaration checks');
  if (policy.replayWindow?.start !== 'first-mapped-operation-start' || policy.replayWindow?.end !== 'last-mapped-scenario-return')
    throw new Error('Scenario replay window is not declared; refresh declaration checks');
  const start = capturedTimestamp(run.startedAt);
  if (!Number.isFinite(start)) throw new Error('Captured run start timestamp is missing');
  let previous = 0;
  const groups = []; let pending = [];
  for (const event of run.events) {
    pending.push(event.record);
    const fact = event.record.payload ?? {};
    if (fact.testimonyType || event.record.kind === 'run-end' || !groups.length) {
      groups.push(pending); pending = [];
    }
  }
  if (pending.length) throw new Error('Capture has records after its run end');
  const frames = groups.map(records => {
    const record = records.at(-1), fact = record.payload ?? {};
    const semantic = fact.testimonyType === 'cell-execution-testimony.v1' || fact.testimonyType === 'edge-execution-testimony.v1';
    const timestamp = fact.completedAt ?? fact.observedAt ?? fact.at ?? (!semantic ? record.receivedAt : undefined);
    const at = capturedTimestamp(timestamp) - start;
    if (!Number.isFinite(at)) throw new Error('Captured execution timestamp is missing; replay is held');
    if (at < previous) throw new Error('Captured execution timestamps are out of order; replay is held');
    previous = at;
    return { records, at, timestamp, basis: fact.completedAt ? 'execution completion' : fact.observedAt || fact.at ? 'captured event' : 'observer receipt' };
  });
  const endRecord = run.events.findLast(event => event.record.kind === 'run-end')?.record;
  const duration = capturedTimestamp(endRecord?.payload?.at) - start;
  if (!Number.isFinite(duration) || frames.at(-1)?.at !== duration) throw new Error('Captured run end timestamp is missing or inconsistent');
  // Start/end boundaries come from actual own-operation receipts. These are
  // historical intervals, not new start testimonies or inferred provider calls.
  const intervals = [];
  for (const [id, facts] of joinTestimony(deck, run).nodes) {
    const node = deck.nodes.find(node => node.id === id);
    if (node?.kind !== 'operation') continue;
    for (const fact of facts) {
      const from = capturedTimestamp(fact.startedAt) - start, to = capturedTimestamp(fact.completedAt) - start;
      if (!Number.isFinite(from) || !Number.isFinite(to) || from < 0 || to < from || to > duration)
        throw new Error('Captured operation interval is missing or inconsistent; replay is held');
      const record = run.events.find(event => event.record.payload === fact).record;
      intervals.push({ nodeId: id, label: node.label, from, to, fact, record });
      frames.push({ records: [], at: from, basis: 'recorded operation start', timestamp: fact.startedAt });
      frames.push({ records: [], at: to, basis: 'recorded operation end', timestamp: fact.completedAt });
    }
  }
  frames.sort((a,b) => a.at - b.at);
  const invocation = invocationTiming(deck,run,intervals);
  const joined = joinTestimony(deck,run);
  const returns = (deck.observationMap.boundaries ?? []).flatMap(boundary =>
    (joined.nodes.get(boundary.eventNodeId) ?? []).filter(fact => fact.cellAltitude === 'scenario'));
  if (!intervals.length) throw new Error('The capture publishes no own-operation receipts for the mapped operations; replay needs their captured start/end and is held');
  if (!returns.length) throw new Error('The capture has no own scenario return receipt; replay needs it and is held');
  const from = Math.min(...intervals.map(i=>i.from));
  const to = Math.max(...returns.map(fact=>capturedTimestamp(fact.completedAt)-start));
  if (!Number.isFinite(to) || to<Math.max(...intervals.map(i=>i.to)) || to>duration)
    throw new Error('Captured scenario window is inconsistent');
  const scoped = frames.filter(frame=>frame.at>=from && frame.at<=to &&
    (!frame.records.length || frame.records.at(-1).payload?.testimonyType)).map(frame=>({...frame,at:frame.at-from,
      records:frame.records.filter(record=>record.payload?.testimonyType)}));
  const kept = new Set(scoped.flatMap(frame=>frame.records));
  return { start:start+from, duration:to-from, frames:scoped,
    intervals:intervals.map(i=>({...i,from:i.from-from,to:i.to-from})), invocation,
    outsideRecords:run.events.map(e=>e.record).filter(record=>!kept.has(record)),
    window:{from,to,invocationDuration:duration,scope:'scenario-execution'}, timing:'captured-timestamps' };
}
