// Presentation of retained receipts. Declaration, execution and observation
// remain separate; this module never evaluates a trust disposition.
import { capturedTimestamp, replayTimeline, invocationTiming, joinTestimony } from './deck-trace.js';
import { buildTraversal } from './traversal.js';

export const milliseconds = value => !Number.isFinite(value) ? 'Not captured' : value < 1000 ? `${value.toFixed(1)} ms` : `${(value / 1000).toFixed(2)} s`;
export function runLink(run, base) {
  const url = new URL('/circuit/explorer', base);
  for (const [key, value] of [['run', run.runId], ['capability', run.capabilityId], ['namespace', run.namespaceId]])
    if (value) url.searchParams.set(key, value);
  return url.href;
}

export function evidenceModel(deck, run, api = null) {
  if (!deck || !run) return null;
  let timeline = null, held = null;
  try { timeline = replayTimeline(deck, run); } catch (error) { held = error.message; }
  const traversal = buildTraversal(deck, run, timeline);
  const start = capturedTimestamp(run.startedAt);
  const end = run.events.findLast(e => e.record.kind === 'run-end')?.record.payload?.at;
  const duration = end ? capturedTimestamp(end) - start : null;
  const operations = (timeline?.intervals ?? []).map(i => ({ ...i, from: i.from + timeline.window.from, to: i.to + timeline.window.from }));
  const providers = traversal.segments.filter(s => s.kind === 'operation' && s.call === 'provider').map(s => {
    const dwell = s.pieces.find(p => p.d0 === p.d1 && p.t1 > p.t0);
    return { nodeId: s.calleeNodeId, operationId: s.nodeId, label: deck.nodes.find(n => n.id === s.calleeNodeId)?.label ?? s.calleeNodeId,
      operation: s.interval.label, from: s.from + timeline.window.from, to: s.to + timeline.window.from,
      duration: s.to - s.from, exchangeDuration: dwell ? dwell.t1 - dwell.t0 : null,
      disposition: s.interval.fact.disposition, outcomeVariant: s.interval.fact.outcomeVariant,
      basis: dwell?.basis ?? 'Owning operation interval; exchange timing not captured' };
  });
  return { runId: api?.runId ?? run.id, capabilityId: deck.capabilityId, namespaceId: deck.namespaceId,
    state: api?.state ?? (run.ended ? 'ended' : 'running'), exitCode: api?.exitCode ?? run.exitCode,
    startedAt: api?.startedAt ?? run.startedAt, endedAt: api?.endedAt ?? end, duration,
    terminal: traversal.terminal, timeline, operations, providers,
    timing: timeline?.invocation ?? invocationTiming(deck, run), held,
    partial: Boolean(run.ambiguous || api?.partial), receipts: run.events.length,
    findings: traversal.findings, graphDigest: run.graph?.graphDigest ?? null };
}

// Time containment is a search aid, not proof of ownership. Parallel enclosing
// operations are exposed as candidates, and the original receipts stay intact.
export function componentEvidence(deck, run, model, nodeId) {
  if (!deck || !run || !model || !nodeId) return null;
  const node = deck.nodes.find(n => n.id === nodeId) ?? { id: nodeId, label: nodeId };
  const calls = model.providers.filter(p => p.nodeId === nodeId || p.operationId === nodeId);
  const operationIds = node.kind === 'provider' ? calls.map(p => p.operationId) : [nodeId];
  const intervals = model.operations.filter(i => operationIds.includes(i.nodeId));
  const start = capturedTimestamp(run.startedAt);
  const receipts = [];
  for (const { record } of run.events) {
    const fact = record.payload ?? {};
    if (!fact.testimonyType) continue;
    const from = capturedTimestamp(fact.startedAt ?? fact.observedAt ?? fact.completedAt) - start;
    const to = capturedTimestamp(fact.completedAt ?? fact.observedAt) - start;
    if (!Number.isFinite(from) || !Number.isFinite(to)) continue;
    if (!intervals.some(i => from >= i.from && to <= i.to)) continue;
    receipts.push({ record, from, to, candidates: model.operations.filter(i => from >= i.from && to <= i.to).map(i => i.nodeId) });
  }
  return { node, calls, intervals, receipts, own: joinTestimony(deck, run).nodes.get(nodeId) ?? [],
    ambiguous: receipts.some(r => r.candidates.length > 1), basis: 'Time containment; ownership NOT_VERIFIED' };
}

export function traceCsv(receipts) {
  // CSV formula cells are inert even when provider-controlled strings begin
  // with =, +, -, @ or whitespace followed by a formula.
  const cell = v => { const s = String(v ?? ''); return '"' + (/^\s*[=+\-@]/.test(s) ? "'" : '') + s.replaceAll('"', '""') + '"'; };
  return [['receipt', 'type', 'cell', 'from_ms', 'to_ms', 'disposition', 'candidate_operations'], ...receipts.map(r => [
    r.record.observationKey, r.record.payload.testimonyType, r.record.payload.semanticAddress ?? r.record.payload.cellId,
    r.from, r.to, r.record.payload.disposition, r.candidates.join(';')])].map(row => row.map(cell).join(',')).join('\r\n');
}
