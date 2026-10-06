// Builds the reviewable timing log for docs/replay-timing-fidelity.md from the retained
// staging capture, with the same deck-trace/traversal modules the browser runs.
//   node docs/replay-timing-fidelity/build-timing-log.mjs
// Inputs (beside this file): capture.sse, scene.json, samples-1.json.
// Outputs: receipts.csv (every receipt of the run), dot.csv (what the browser showed),
// timing-log.md (the readable digest).
import fs from 'node:fs';
import { newRun, applyRecord, replayTimeline, capturedTimestamp } from '../../live-circuit/circuit/deck-trace.js';
import { buildTraversal } from '../../live-circuit/circuit/traversal.js';

const here = new URL('.', import.meta.url);
const read = name => fs.readFileSync(new URL(name, here), 'utf8');
const lines = read('capture.sse').split(/\r?\n/).filter(l => l.startsWith('data: ')).map(l => JSON.parse(l.slice(6)));
const deck = JSON.parse(read('scene.json'));
const samples = JSON.parse(read('samples-1.json'));
const paged = { ...deck, slides: deck.slides.filter(s => s.blueprint?.role !== 'scenario-linear') };

// The capture holds three observer runs; the reviewed one is the last.
const first = lines.findLastIndex(r => r.kind === 'run-start');
const records = lines.slice(first);
const run = newRun(records[0]);
for (const record of records.slice(1)) applyRecord(run, record, Date.parse(record.receivedAt));
const timeline = replayTimeline(paged, run), model = buildTraversal(paged, run, timeline);
const t0 = timeline.start, at = s => capturedTimestamp(s) - t0;
const r1 = n => Number.isFinite(n) ? Math.round(n * 10) / 10 : '';

// Declared operation ids of scenario execute-projected-model-provider-attempt by ordinal,
// read from model.execution_operation (scenario_version_pk 316) on 2026-10-06. Cell
// ...execute-projected-model-provider-attempt.operation.N is ordinal N-1. Labels only.
const attemptSteps = ['project-provider-protocol-port', 'prepare-request-body-port', 'project-request-body-port',
  'prepare-credential-binding-port', 'bind-credential-port', 'prepare-http-exchange-port', 'observe-http-port',
  'prepare-provider-normalization-port', 'normalize-provider-protocol-port', 'finalize-provider-attempt-port'];

const ops = [...timeline.intervals].sort((a, b) => a.from - b.from).map(i => {
  const seg = model.segments.find(s => s.kind === 'operation' && s.interval.fact === i.fact);
  return { ordinal: seg?.lane.ordinal, label: i.label, from: i.from, to: i.to, fact: i.fact, seg,
    provider: seg?.calleeNodeId ?? null, lag: Date.parse(i.record.receivedAt) - capturedTimestamp(i.fact.completedAt) };
});
const topExec = new Map(ops.map(o => [o.fact.cellExecutionId, o]));
const owner = (from, to) => ops.find(o => from >= o.from && to <= o.to + 0.001);
const stepName = id => {
  const m = id.match(/execute-projected-model-provider-attempt\.operation\.(\d+)$/);
  return m ? attemptSteps[Number(m[1]) - 1] : '';
};
const classify = p => {
  if (p.testimonyType === 'edge-execution-testimony.v1') return topExec.has(p.sourceCellExecutionId) ? 'handoff edge' : 'nested edge';
  // A scenario return carries the execution id of the operation that returned it; test altitude first.
  if (p.cellAltitude === 'scenario') return p.cellId === `cell:scenario:${deck.rootScenarioId}` ? 'scenario return' : 'nested scenario';
  if (topExec.has(p.cellExecutionId)) return 'operation';
  if ((p.cellId ?? '').includes(':expression')) return 'expression';
  return 'nested step';
};

// receipts.csv: every record of the run, ordered by captured start.
const rows = records.map(r => {
  const p = r.payload ?? {};
  const start = p.startedAt ? at(p.startedAt) : p.observedAt || p.at ? at(p.observedAt ?? p.at) : NaN;
  const end = p.completedAt ? at(p.completedAt) : start;
  const level = p.testimonyType ? classify(p) : p.observationType ?? (r.kind === 'observation' ? 'evidence record' : r.kind);
  // Observer receive time, on the observer's clock (not the kernel's). The only time an untimed record has.
  const received = Date.parse(r.receivedAt) - t0;
  const own = level === 'operation' ? topExec.get(p.cellExecutionId) : Number.isFinite(start) ? owner(start, end) : owner(received, received);
  return { seq: r.seq, level, start, end, received, duration: p.durationMilliseconds ?? (p.completedAt ? end - start : ''),
    startedAt: p.startedAt ?? p.observedAt ?? p.at ?? '', completedAt: p.completedAt ?? '', receivedAt: r.receivedAt,
    lag: p.completedAt ? Date.parse(r.receivedAt) - capturedTimestamp(p.completedAt) : '',
    operation: own ? `${own.ordinal} ${own.label}` : '', step: stepName(p.cellId ?? ''),
    id: p.cellId ?? p.edgeId ?? (p.phase ? `${p.phase} ${p.status}` : r.text ?? ''), altitude: p.cellAltitude ?? '',
    disposition: p.disposition ?? p.admissionDisposition ?? p.status ?? '', variant: p.outcomeVariant ?? '', profile: p.providerProfileId ?? '' };
}).sort((a, b) => (Number.isFinite(a.start) ? a.start : a.received) - (Number.isFinite(b.start) ? b.start : b.received) || a.seq - b.seq);
const csv = (cols, data) => [cols.join(','), ...data.map(d => cols.map(c => {
  const v = typeof d[c] === 'number' ? r1(d[c]) : String(d[c] ?? '');
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}).join(','))].join('\n') + '\n';
const receiptCols = ['seq', 'start', 'end', 'duration', 'received', 'lag', 'level', 'operation', 'step', 'id', 'altitude', 'disposition', 'variant', 'profile', 'startedAt', 'completedAt', 'receivedAt'];
fs.writeFileSync(new URL('receipts.csv', here), csv(receiptCols, rows));

// dot.csv: the browser's sampled replay at 1x, merged where the current component is unchanged.
const dot = [];
for (const s of samples) {
  const current = s.current.join(' ');
  const last = dot.at(-1);
  if (last && last.current === current) { last.to = s.position; last.frames++; continue; }
  if (last) last.to = s.position;
  const own = owner(s.position, s.position);
  dot.push({ from: s.position, to: s.position, browserAt: s.at, current, frames: 1, operation: own ? `${own.ordinal} ${own.label}` : '' });
}
fs.writeFileSync(new URL('dot.csv', here), csv(['from', 'to', 'frames', 'operation', 'current', 'browserAt'], dot.map(d => ({ ...d, span: d.to - d.from }))));

// timing-log.md
const ms = n => Number.isFinite(n) ? Math.round(n).toLocaleString('en-US') : '';
const out = [];
const phases = records.filter(r => r.payload?.observationType === 'delivery-phase');
out.push('# Timing log: request-capability-from-objective-v3, staging run 849', '',
  'Generated by `build-timing-log.mjs` from the files beside it. Every time is in milliseconds',
  'from the first operation\'s captured start (replay position 0). Negative times are before it.',
  'Each number comes from a receipt\'s own `startedAt` / `completedAt`, except for the replay columns.', '',
  `Observer run \`${run.id}\`. Scenario window ${ms(timeline.duration)} ms; invocation ${ms(timeline.window.invocationDuration)} ms.`,
  `Replay leaves out ${ms(timeline.window.from)} ms before the window and ${ms(timeline.window.invocationDuration - timeline.window.to)} ms after it.`, '',
  '## Invocation and delivery phases', '',
  'The invocation runs from `run-start` to `run-end` (the API runner\'s `at`). The phases are the kernel\'s `delivery-phase` observations.',
  'Nothing is captured between `run-start` and the first phase.', '',
  '| at | phase | status | duration |', '| ---: | --- | --- | ---: |',
  `| ${ms(at(records[0].payload.at))} | run-start | API run started | |`,
  ...phases.map(r => `| ${ms(at(r.payload.observedAt ?? r.payload.at))} | ${r.payload.phase} | ${r.payload.status} | ${r.payload.durationMilliseconds != null ? ms(r.payload.durationMilliseconds) : ''} |`),
  ...records.filter(r => r.kind === 'run-end').map(r => `| ${ms(at(r.payload.at))} | run-end | exit ${r.payload.exitCode} | |`), '',
  '## Operations', '',
  '"Replay at callee" is when the replayed dot reaches the provider. It comes from wire length, not from evidence;',
  'the dot leaves again at once. "Frames at callee" counts the browser\'s sampled frames at 1× in which the provider was the current component.', '',
  '| # | operation | start | end | duration | callee | replay at callee | frames at callee | receipt lag |',
  '| ---: | --- | ---: | ---: | ---: | --- | ---: | --- | ---: |');
for (const o of ops) {
  const arrive = o.seg?.call ? o.from + (o.seg.outbound / o.seg.length) * (o.to - o.from) : NaN;
  const within = samples.filter(s => s.position >= o.from && s.position < o.to);
  const atCallee = o.provider ? within.filter(s => s.current.includes(o.provider)).length : null;
  out.push(`| ${o.ordinal} | ${o.label} | ${ms(o.from)} | ${ms(o.to)} | ${ms(o.to - o.from)} | ${o.provider ?? ''} | ${ms(arrive)} | ${atCallee == null ? '' : `${atCallee} of ${within.length}`} | ${ms(o.lag)} |`);
}
for (const o of ops.filter(o => o.provider)) {
  const nested = rows.filter(r => r.operation === `${o.ordinal} ${o.label}` && r.level !== 'operation' && Number.isFinite(r.start));
  const untimed = rows.filter(r => r.operation === `${o.ordinal} ${o.label}` && r.level === 'evidence record');
  const shown = [...nested.filter(r => r.level === 'nested step' || r.level === 'nested scenario'),
    ...untimed.map(r => ({ ...r, start: r.received, end: r.received, duration: NaN, untimed: true }))];
  // Time inside the operation that no nested receipt covers.
  const spans = nested.filter(r => r.end > r.start).map(r => [r.start, r.end]).sort((a, b) => a[0] - b[0]);
  const gaps = []; let cursor = o.from;
  for (const [a, b] of spans) { if (a - cursor >= 20) gaps.push([cursor, a]); cursor = Math.max(cursor, b); }
  if (o.to - cursor >= 20) gaps.push([cursor, o.to]);
  out.push('', `## Inside operation ${o.ordinal}: ${o.label} → ${o.provider}`, '',
    `${ms(o.to - o.from)} ms. Nested receipts: ${nested.filter(r => r.level === 'nested step').length} steps, ${nested.filter(r => r.level === 'nested scenario').length} scenario returns, ` +
    `${nested.filter(r => r.level === 'expression').length} expression cells, ${nested.filter(r => r.level.endsWith('edge')).length} edges. ` +
    'They are attributed to this operation by time containment only: no receipt names it as its parent.',
    'The table lists steps and scenario returns. Expression cells and edges are in `receipts.csv`.', '',
    '| start | end | duration | +op | receipt | declared step |', '| ---: | ---: | ---: | ---: | --- | --- |',
    ...[...shown.map(r => ({ ...r, kind: 'r' })), ...gaps.map(([a, b]) => ({ start: a, end: b, kind: 'gap' }))].sort((a, b) => a.start - b.start).map(r => r.kind === 'gap'
      ? `| ${ms(r.start)} | ${ms(r.end)} | ${ms(r.end - r.start)} | +${ms(r.start - o.from)} | **no timed receipt** | |`
      : r.untimed ? `| ${ms(r.start)} ᵒ | | | +${ms(r.start - o.from)} | evidence record: \`${r.id}\` ${r.disposition} | |`
      : `| ${ms(r.start)} | ${ms(r.end)} | ${ms(r.duration)} | +${ms(r.start - o.from)} | ${r.level}: \`${r.id.replace(/^cell:(mechanic|scenario):/, '')}\` | ${r.step} |`),
    '', 'ᵒ Observer receive time; the record carries no execution timestamp. These are the evidence records each model call leaves (provider-exchange-shape.v1 and model-response-shape.v1, as a local re-run on the API shows); the observer bridge drops their kind.');
  const track = dot.filter(d => d.to > o.from && d.from < o.to);
  out.push('', 'What the replayed dot showed (browser samples at 1×):', '', '| from | to | +op | current component |', '| ---: | ---: | ---: | --- |',
    ...track.map(d => `| ${ms(Math.max(d.from, o.from))} | ${ms(Math.min(d.to, o.to))} | +${ms(Math.max(d.from, o.from) - o.from)} | ${d.current || '(none)'} |`));
}
out.push('', '## Files', '',
  '- `capture.sse`: the retained observer capture, byte for byte. It holds three runs; the log reads the last.',
  '- `scene.json`: the circuit scene the browser replayed.',
  '- `samples-1.json`: the browser\'s per-frame replay samples at 1×: browser time, replay position, current components.',
  '- `receipts.csv`: every record of the run, one row each, in captured start order, with its owning operation and delivery lag.',
  '- `dot.csv`: the browser samples merged into spans with an unchanged current component.', '');
fs.writeFileSync(new URL('timing-log.md', here), out.join('\n'));
console.log(`receipts ${rows.length} · dot spans ${dot.length} · operations ${ops.length}`);
