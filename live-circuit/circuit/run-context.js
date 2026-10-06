import { el } from './circuit-viewer.js';
import { evidenceModel, componentEvidence, milliseconds, runLink, traceCsv } from './run-evidence.mjs';

const $ = id => document.getElementById(id);
const p = (text, cls = 'note') => el('p', { text, class: cls });
const heading = text => el('h3', { text });
const button = (text, run) => { const b = el('button', { type: 'button', class: 'button secondary small', text }); b.addEventListener('click', run); return b; };
const missing = text => el('div', { class: 'not-captured' }, [el('strong', { text: 'Not captured' }), p(text)]);
const detail = (label, content) => el('details', {}, [el('summary', { text: label }), content]);
const json = value => el('pre', { text: JSON.stringify(value, null, 2) });
function download(name, body, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([body], { type })), a = el('a', { href: url, download: name });
  a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function values(value, depth = 0) {
  if (value == null) return p('No value returned.');
  if (typeof value !== 'object') return p(String(value), 'answer');
  if (depth > 3 || Array.isArray(value)) return json(value);
  return el('dl', { class: 'answer-fields' }, Object.entries(value).flatMap(([key, v]) => [el('dt', { text: key }), el('dd', {}, [values(v, depth + 1)])]));
}

export function createRunContext(hooks) {
  let current = null, model = null, key = '', selectedKey = '', shownRun = null, runsSerial = 0;
  const tabs = [...document.querySelectorAll('[data-context-tab]')];
  function tab(name, focus = false) {
    $('context').scrollTop = 0;
    for (const b of tabs) {
      const selected = b.dataset.contextTab === name;
      b.setAttribute('aria-selected', String(selected)); b.tabIndex = selected ? 0 : -1;
      $(b.getAttribute('aria-controls')).hidden = !selected;
      if (selected && focus) b.focus();
    }
    if (name === 'runs') loadRuns();
  }
  for (const b of tabs) {
    b.addEventListener('click', () => tab(b.dataset.contextTab));
    b.addEventListener('keydown', event => {
      const index = tabs.indexOf(b), next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null;
      if (next !== null) { event.preventDefault(); tab(tabs[next].dataset.contextTab, true); }
    });
  }
  async function loadRuns() {
    const serial = ++runsSerial, root = $('runs-list'); root.replaceChildren(p('Reading your runs…'));
    try {
      const response = await fetch('/api/circuit/v1/session/runs'), body = await response.json();
      if (serial !== runsSerial) return;
      if (!response.ok) {
        root.replaceChildren(p(response.status === 401 ? 'Sign in to see your runs.' : 'Run history is unavailable.', 'warning')); return;
      }
      $('runs-storage').textContent = body.storage === 'durable' ? 'Your retained runs. Capture status is shown for each run; trust evaluation is separate.' : 'Runs admitted in this server session. History is held in memory; a server restart clears it.';
      const rows = [...body.runs].sort((a,b) => b.admittedAt.localeCompare(a.admittedAt)).filter(r => $('runs-all').checked || r.capabilityId === hooks.capability());
      root.replaceChildren(...rows.map(r => el('a', { class: 'run-row', href: runLink(r, location.href), 'data-run-id': r.runId }, [
        el('strong', { text: r.capabilityId ?? 'Capability not recorded' }), el('time', { text: r.admittedAt, datetime: r.admittedAt }), el('small', { text: `${r.runId} · ${r.captureStatus ?? 'in memory'}` })])));
      if (!rows.length) root.append(p('No attributed runs in this selection.'));
    } catch { if (serial === runsSerial) root.replaceChildren(p('Run history could not be read.', 'warning')); }
  }
  $('runs-all').addEventListener('change', loadRuns); $('runs-refresh').addEventListener('click', loadRuns);

  function report() {
    const root = $('run-report'); root.replaceChildren();
    if (!model) { root.append(p(current?.outputError ?? 'Observe this capability or open an earlier run.', current?.outputError ? 'warning' : 'note')); return; }
    const outcome = model.terminal?.kind === 'variant' ? model.terminal.variantId : null;
    root.append(el('div', { class: 'report-summary' }, [el('strong', { class: 'run-outcome', text: outcome ?? model.state }),
      el('strong', { text: milliseconds(model.duration), 'data-run-duration': model.duration ?? '' })]),
      p(`${model.runId} · ${model.state} · exit ${model.exitCode ?? 'not reported'}`),
      p(model.endedAt ? `Ended ${model.endedAt}` : `Started ${model.startedAt}`));
    if (model.partial) root.append(missing('This capture is incomplete. Playback and conclusions are held.'));
    root.append(p(`Evidence persistence: ${current.api?.persistence ?? current.api?.evidencePersistence ?? 'not confirmed'}. Trust: not evaluated.`, 'warning'));
    if (model.held && current.run.ended) root.append(p(`Replay held: ${model.held}`, 'warning'));
    root.append(heading('Asked'), missing('Input is not retained in the run API. The editable input below is a draft, not a record of this run.'), heading('Answered'));
    if (current.output !== undefined) root.append(values(current.output));
    else root.append(missing(current.outputError ?? 'No retained API output is available for this capture.'));
    root.append(heading('Providers called'));
    for (const call of model.providers) root.append(button(`${call.label} · ${milliseconds(call.duration)} · ${call.outcomeVariant ?? call.disposition ?? 'observed'}`, () => hooks.select(call.nodeId)),
      p(`${call.operation} · owning operation. Exchange: ${milliseconds(call.exchangeDuration)}.`));
    if (!model.providers.length) root.append(p('No provider call could be joined to this capture. A declared provider alone does not establish execution.'));
    const replay = button('Replay this run', hooks.replay); replay.disabled = !model.timeline;
    const copy = button('Copy link', async () => {
      try { await navigator.clipboard.writeText(runLink(model, location.href)); copy.textContent = 'Link copied'; }
      catch { copy.textContent = 'Copy unavailable'; }
    }); copy.disabled = !current.api?.runId;
    root.append(el('div', { class: 'evidence-actions' }, [replay, copy, button('Download captured evidence', () => {
      download('run-evidence.json', JSON.stringify({ format: 'sfx-run-evidence-export.v1', basis: 'Browser capture; no ledger disposition',
        run: current.api ?? { runId: current.run.id }, output: current.output, sceneDigest: current.deck.snapshotDigest,
        limitations: ['Input not retained', 'Provider bodies not captured', 'No trust disposition evaluated', ...(model.held ? [model.held] : [])],
        records: [current.run.startRecord, ...current.run.events.map(e => e.record)] }, null, 2));
    })]));
    root.append(p('Run links require access to the original run. History and traces remain subject to server retention.'));
  }
  function timing() {
    const root = $('invocation-timeline'); root.replaceChildren();
    $('run-steps').replaceChildren();
    if (!model?.timing || !Number.isFinite(model.duration) || model.duration <= 0) { root.hidden = true; return; }
    root.hidden = false;
    root.append(heading(`Whole invocation · ${milliseconds(model.duration)}`));
    const bar = el('div', { class: 'invocation-track', 'aria-label': 'Captured invocation intervals' });
    const spans = [...model.timing.phases.map(s => ({ ...s, kind: 'phase' })), ...model.operations.map(s => ({ ...s, kind: model.providers.some(p => p.operationId === s.nodeId) ? 'provider' : 'operation' })), ...model.timing.gaps.map(s => ({ ...s, kind: 'gap', label: 'No timed record' }))];
    for (const span of spans) {
      const node = el('button', { type: 'button', class: `timing-span ${span.kind}`, title: `${span.label} · ${milliseconds(span.to - span.from)}`, 'aria-label': `${span.label} · ${milliseconds(span.to - span.from)}` });
      node.style.left = `${Math.max(0, span.from) / model.duration * 100}%`; node.style.width = `${Math.max(0, Math.min(model.duration, span.to) - Math.max(0, span.from)) / model.duration * 100}%`;
      node.addEventListener('click', () => { if (span.nodeId) hooks.select(span.nodeId); if (model.timeline) hooks.seek(Math.max(0, Math.min(model.timeline.duration, span.from - model.timeline.window.from))); }); bar.append(node);
    }
    bar.append(el('span', { id: 'invocation-playhead', class: 'invocation-playhead' })); root.append(bar);
    const range = el('input', { id: 'replay-seek', type: 'range', min: '0', max: String(model.timeline?.duration ?? 0), step: '1', value: '0', 'aria-label': 'Seek scenario replay' });
    range.disabled = !model.timeline; range.addEventListener('input', () => hooks.seek(Number(range.value))); root.append(range,
      p('Captured operation and provider intervals. Hatched spans have no timed record. The replay clock covers scenario execution; setup and finish remain visible on this invocation bar.'));
    $('run-steps').replaceChildren(heading('Execution steps'), ...model.operations.map(i => {
      const b = button(`${i.label} · ${milliseconds(i.to - i.from)}`, () => { hooks.seek(i.from - model.timeline.window.from); hooks.select(i.nodeId); });
      b.dataset.stepNode = i.nodeId; b.dataset.stepFrom = i.from; b.dataset.stepTo = i.to; return b;
    }));
  }
  function evidence(nodeId) {
    const root = $('component-evidence'); root.replaceChildren();
    const data = componentEvidence(current?.deck, current?.run, model, nodeId);
    if (!data) { root.append(p('Select a circuit component to inspect its captured evidence.')); return; }
    root.append(el('h2', { text: data.node.label }), p(data.node.id), p(data.basis, 'warning'));
    if (data.ambiguous) root.append(missing('Overlapping operations contain some of these receipts. Their owner is not verified.'));
    root.append(heading(data.node.kind === 'provider' ? 'Request and response' : 'In and out'), missing('Values and provider bodies are not captured in this evidence lane.'),
      heading('Time'), ...data.intervals.map(i => p(`${i.label}: ${milliseconds(i.to - i.from)} · ${i.fact.outcomeVariant ?? i.fact.disposition ?? 'observed'}`)), heading('Called'));
    for (const call of data.calls) root.append(button(`${call.label} · ${milliseconds(call.exchangeDuration)} exchange`, () => hooks.select(call.nodeId)));
    if (!data.calls.length) root.append(p('No provider call matched this selection.'));
    root.append(heading('Trace'), p(`${data.receipts.length} receipts in the selected operation intervals. ${data.own.length} receipts directly address this component.`));
    const table = el('table', {}, [el('thead', {}, [el('tr', {}, ['Receipt', 'Cell / edge', 'Duration', 'Outcome', 'Owners'].map(t => el('th', { text: t })))]),
      el('tbody', {}, data.receipts.map(r => el('tr', { 'data-receipt-id': r.record.observationKey }, [r.record.observationKey, r.record.payload.semanticAddress ?? r.record.payload.cellId ?? r.record.payload.edgeId,
        milliseconds(r.to - r.from), r.record.payload.outcomeVariant ?? r.record.payload.disposition, r.candidates.length].map(v => el('td', { text: v ?? 'Not captured' })))))]);
    root.append(detail('Open trace', el('div', { class: 'trace-table' }, [table])), button('Download trace CSV', () => download('trace.csv', traceCsv(data.receipts), 'text/csv;charset=utf-8')),
      detail('Own testimony', json(data.own)));
  }
  return {
    tab,
    update(snapshot) {
      current = snapshot;
      const next = `${snapshot.deck?.snapshotDigest}:${snapshot.deck?.scenarioId}:${snapshot.run?.id}:${snapshot.run?.events.length}:${snapshot.run?.ambiguous}:${snapshot.api?.state}:${snapshot.api?.persistence ?? snapshot.api?.evidencePersistence}:${snapshot.output !== undefined}:${snapshot.outputError ?? ''}`;
      if (next !== key) {
        key = next; model = evidenceModel(snapshot.deck, snapshot.run, snapshot.api); report(); timing(); selectedKey = '';
        if (snapshot.run?.ended && shownRun !== snapshot.run.id) { shownRun = snapshot.run.id; tab('run'); }
      }
      if (selectedKey !== `${key}:${snapshot.selected}`) { selectedKey = `${key}:${snapshot.selected}`; evidence(snapshot.selected); }
      const position = snapshot.playback ? snapshot.playback.clock.position + snapshot.playback.timeline.window.from : null;
      if ($('invocation-playhead')) { $('invocation-playhead').hidden = position === null; $('invocation-playhead').style.left = `${position / model.duration * 100}%`; }
      if ($('replay-seek') && document.activeElement !== $('replay-seek')) $('replay-seek').value = String(snapshot.playback?.clock.position ?? 0);
      for (const b of document.querySelectorAll('[data-step-node]')) b.setAttribute('aria-current', String(position !== null && position >= Number(b.dataset.stepFrom) && position < Number(b.dataset.stepTo)));
    }
  };
}
