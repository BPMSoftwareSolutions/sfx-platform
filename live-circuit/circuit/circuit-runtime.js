// Circuit runtime: the live and replay overlay, run controls, component
// drill-down and Observe for the selected database scene. The Explorer mounts it
// and owns capability, scenario and section selection. The element ids used here
// (#viewer, #slide, #mode, #follow, #speed, #replay, #payload, #observe, …) are the
// page contract the staging browser acceptance drives.
import { el, renderCircuitViewer, boundaryGlyphs } from './circuit-viewer.js';
import { newRun, applyRecord, replayTimeline } from './deck-trace.js';
import { PlaybackClock } from './playback-clock.js';
import { targetLink, relatedLinks, renderDetail, authorityTree } from './navigation.js';
import { buildTraversal, traversalState, LiveMotion } from './traversal.js';
import { createObservePanel } from './observe-panel.js';

const $ = id => document.getElementById(id);
const json = async (url, signal) => { const response = await fetch(url, { signal }); const body = await response.json(); if (!response.ok) throw new Error(body.error ?? `Read failed (${response.status})`); return body; };
const paragraph = (text, className = '') => el('p', { text, class: className });
const details = (title, value) => el('details', {}, [el('summary', { text: title }), el('pre', { text: JSON.stringify(value, null, 2) })]);
const glyphsOf = slide => [...(slide.blueprint?.glyphs ?? []), ...(slide.blueprint?.boundaryGlyphs ?? [])];

// shell: selection() → { capabilityId, namespaceId }; loadRoot() → shows the root
// scenario's live circuit; scenario(id) → switches the selected scenario;
// location(push) → writes the URL; component(id) → a circuit component was selected.
export function createCircuitRuntime(shell) {
  const state = { deck: null, slideId: null, page: null, selectedNode: null, detailId: null, detailPointer: '', detailSlides: [], detailSlideId: null,
    runs: [], current: null, openRuns: 0, lastSeq: 0, instance: null, connection: 'connecting', playback: null,
    apiOwned: false, apiRun: null, apiGap: false, replayError: null };
  let detailRequest, detailSerial = 0, replaySerial = 0, frame = 0, source;
  let liveTraversal = { key: null, model: null };
  const liveMotion = new LiveMotion();
  const capability = () => shell.selection().capabilityId;
  const scenarioSlide = () => state.deck?.slides.find(slide => slide.blueprint?.role === 'scenario-blueprint');
  const hasComponent = id => Boolean(state.deck?.slides.some(slide => glyphsOf(slide).some(g => g.nodeId === id)));
  const slideOf = id => state.deck?.slides.find(slide => glyphsOf(slide).some(g => g.nodeId === id))?.id;

  function showEmpty(message) { $('empty').hidden = false; $('empty').textContent = message; $('viewer').hidden = true; }
  function closeDetail() {
    ++detailSerial; detailRequest?.abort(); state.detailId = null;
    state.detailPointer = ''; state.detailSlides = []; state.detailSlideId = null; $('detail-pages').hidden = true;
    $('declaration-detail').hidden = true; $('viewer').hidden = !state.deck?.slides.length;
  }
  async function openDetail(id, push = true, pointer = '', page = null) {
    $('follow').checked = false;
    if (!state.deck?.navigation?.items.some(item => item.id === id)) {
      $('declaration-detail').hidden = false; $('declaration-detail').replaceChildren(paragraph('Detail held: target is not part of the selected scenario.', 'warning')); return;
    }
    detailRequest?.abort(); detailRequest = new AbortController(); const serial = ++detailSerial, deck = state.deck;
    state.detailId = id; state.detailPointer = pointer; state.detailSlideId = page; state.detailSlides = []; shell.location(push);
    $('detail-pages').hidden = true; $('declaration-detail').hidden = false;
    $('declaration-detail').replaceChildren(paragraph('Reading selected component authority…'));
    const query = new URLSearchParams({ capabilityId: deck.capabilityId, namespaceId: deck.namespaceId, scenarioId: deck.scenarioId,
      detailId: id, detailPointer: pointer, expectedSnapshotDigest: deck.snapshotDigest });
    try {
      const response = await json(`/api/circuit/v1/scenario?${query}`, detailRequest.signal);
      if (serial !== detailSerial || deck !== state.deck) return;
      state.detailSlides = response.detailSlides ?? [];
      state.detailSlideId = state.detailSlides.some(s => s.id === page) ? page : state.detailSlides[0]?.id;
      $('detail-page').replaceChildren(...state.detailSlides.map(s => new Option(s.title, s.id)));
      $('detail-page').value = state.detailSlideId ?? ''; $('detail-page').closest('label').hidden = !state.detailSlides.length; $('detail-pages').hidden = false;
      shell.location(false); render();
      renderDetail($('declaration-detail'), deck, response.detail, selectTarget);
      if (response.detail.kind === 'provider' && response.detail.status === 'DECLARED') {
        const inspection = el('section', { 'aria-label': 'Provider database inspection' }, [paragraph('Loading provider data…', 'muted')]);
        $('declaration-detail').append(inspection);
        try {
          const data = await json(`/api/circuit/v1/provider-inspection?${query}`, detailRequest.signal);
          if (serial !== detailSerial || deck !== state.deck) return;
          inspection.replaceChildren(el('h3', { text: 'Provider database inspection' }),
            paragraph(`${data.resultSets.length} result sets · Database read ${data.readAt}`, 'muted'),
            ...data.resultSets.map(set => authorityTree(set.rows, `${set.name} · ${set.rows.length} rows`)));
        } catch (error) {
          if (serial === detailSerial && error.name !== 'AbortError') inspection.replaceChildren(paragraph(`Provider data unavailable: ${error.message}.`, 'warning'));
        }
      }
    } catch (error) {
      if (serial === detailSerial && error.name !== 'AbortError') $('declaration-detail').replaceChildren(
        paragraph(`Detail held: ${error.message}. Refresh the selected scenario if its authority changed.`, 'warning'));
    }
  }
  function selectTarget(target, push = true) {
    if (target.kind === 'detail') return openDetail(target.id, push, target.pointer ?? '');
    if (target.kind === 'slide') return selectSlide(target.id, push);
    if (target.kind === 'scenario' && state.deck?.scenarios.some(s => s.id === target.id)) { closeDetail(); state.page = null; return shell.scenario(target.id); }
  }
  function selectSlide(id, push = true) {
    if (!state.deck?.slides.some(slide => slide.id === id)) return;
    if (push) $('follow').checked = false;
    closeDetail(); state.slideId = id; state.page = id; state.selectedNode = null; shell.location(push); render();
  }
  // Tree to canvas: show and select a component without leaving the live view.
  function focus(id) {
    const slide = slideOf(id);
    if (!slide) return false;
    if (!state.detailId && state.slideId !== slide) { $('follow').checked = false; state.slideId = slide; state.page = slide; }
    state.selectedNode = id; shell.location(false); render(); return true;
  }
  function install(deck, requested = {}) {
    closeDetail(); stopReplay();
    state.deck = deck; state.selectedNode = null; state.page = null; state.slideId = scenarioSlide()?.id ?? deck.slides[0]?.id;
    observePanel.select(deck);
    const rates = deck.observationMap?.flowPolicy?.replayRates ?? {};
    $('speed').replaceChildren(...Object.entries(rates).map(([name, rate]) => new Option(`${name[0].toUpperCase() + name.slice(1)} · ${rate}×`, String(rate), name === 'normal', name === 'normal')));
    $('slide').replaceChildren(...deck.slides.map((slide, index) => new Option(`${String(index + 1).padStart(2, '0')} · ${slide.title}`, slide.id)));
    $('slide').value = state.slideId ?? ''; $('empty').hidden = true; $('viewer').hidden = false;
    render();
    if (!deck.slides.length) showEmpty(`Circuit held: ${deck.findings?.map(f => f.code).join(', ') ?? deck.status}. Select another declared scenario or inspect the evidence below.`);
    if (requested.page && deck.slides.some(s => s.id === requested.page)) selectSlide(requested.page, false);
    if (requested.detail) return openDetail(requested.detail, false, requested.pointer ?? '', requested.detailPage ?? null);
  }
  function clear(message) {
    stopReplay(); closeDetail(); state.deck = null; state.selectedNode = null; state.page = null;
    $('slide').replaceChildren(); render(); showEmpty(message);
  }
  const latestRun = () => state.apiOwned ? state.apiRun : state.runs.filter(item => item.graph?.graphId === `graph:${capability()}`).at(-1);
  function stopReplay() { state.playback?.clock.cancel(); state.playback = null; }
  function startReplay(run) {
    if (!run || !state.deck) return;
    stopReplay();
    try {
      const timeline = replayTimeline(state.deck, run);
      const playback = { id: ++replaySerial, run: newRun(run.startRecord), timeline, model: buildTraversal(state.deck, run, timeline) };
      playback.run.graph = run.graph;
      playback.clock = new PlaybackClock(timeline, frame => { for (const record of frame.records) applyRecord(playback.run, record); },
        schedule, { frameMilliseconds: state.deck.observationMap?.flowPolicy?.continuousPath?.frameMilliseconds ?? 100 });
      state.playback = playback; state.replayError = null;
      playback.clock.rate = Number($('speed').value);
      // Prepare the first scene and its evidence panels before starting the
      // captured clock. Initial DOM work is not scenario execution time.
      render();
      playback.clock.resume();
    } catch (error) { stopReplay(); state.replayError = error.message; render(); }
  }
  // Live receipts rebuild the traversal model only when new evidence arrives.
  function traversalView(deck, playback, run) {
    if (playback) { liveMotion.reset(); return traversalState(playback.model, { position: playback.clock.position, run: playback.run }); }
    const key = [deck.id, deck.snapshotDigest, run?.id ?? '', run?.events.length ?? 0, run?.ended ?? false].join('|');
    if (liveTraversal.key !== key || liveTraversal.model.deck !== deck) liveTraversal = { key, model: buildTraversal(deck, run) };
    const view = liveMotion.update(liveTraversal.model, traversalState(liveTraversal.model, { run }), performance.now(),
      matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (liveMotion.moving) schedule();
    return view;
  }
  const labelOf = (deck, id) => deck.nodes.find(node => node.id === id)?.label ??
    deck.slides.flatMap(slide => glyphsOf(slide)).find(glyph => glyph.nodeId === id)?.label ?? id;
  function terminalText(terminal) {
    if (!terminal) return null;
    if (terminal.kind === 'variant') return `Returned declared outcome ${terminal.variantId} (${terminal.classification}).`;
    if (terminal.code === 'OUTCOME_RETURN_NOT_OBSERVED') return 'Outcome defect: the run ended without the scenario’s own return receipt. No declared outcome is lit.';
    if (terminal.code === 'OUTCOME_CONTRACT_MISMATCH') return `Outcome defect: returned contract “${terminal.reported ?? '(missing)'}” does not match declared “${terminal.declared}”. No declared outcome is lit.`;
    return `Outcome defect: returned variant “${terminal.reported ?? '(missing)'}” has no exact declared match (declared: ${(terminal.declared ?? []).join(', ')}). It is testimony, not a domain outcome; declared alternatives remain unlit.`;
  }
  function render() {
    const expanded = new Set([...document.querySelectorAll('#verification details[open],#inspector details[open],#inventory details[open]')]
      .map(node => node.querySelector('summary').textContent.replace(/\(\d+\)/g, '')));
    const deck = state.deck, playback = state.playback, run = playback?.run ?? latestRun(), clock = playback?.clock;
    $('observer-status').textContent = `Observer ${state.connection} · ${state.apiOwned ? Number(Boolean(state.apiRun)) : state.runs.length} run(s) seen`;
    const view = deck ? traversalView(deck, playback, run) : null;
    if (view?.sceneId && $('follow').checked && !state.detailId && state.slideId !== view.sceneId) {
      state.slideId = view.sceneId; state.page = view.sceneId; shell.location(false);
    }
    $('slide').value = state.slideId ?? '';
    $('flow-basis').textContent = playback && view?.tokens.length ? `${view.disclosure ?? ''} ${view.tokens[0].basis ?? ''}`.trim() : deck?.observationMap?.flowPolicy?.continuousPath
      ? 'Live admission immediately shows the selected callee; its own return closes the call. Other path motion is schematic, not measured transport timing.' : '';
    $('mode').textContent = playback ? `SCENARIO REPLAY · ${clock.rate}× · ${clock.done ? 'finished · ' : clock.paused ? 'paused · ' : ''}${(clock.position / 1000).toFixed(3)} / ${(playback.timeline.duration / 1000).toFixed(3)} s` : 'LIVE RECEIPTS · real-time';
    $('mode').className = playback ? 'mode replay' : 'mode live';
    $('pause').disabled = !clock || clock.done;
    $('pause').textContent = clock?.paused ? 'Resume replay' : 'Pause replay';
    $('step').disabled = !clock || clock.done;
    $('live').disabled = !playback;
    $('replay').disabled = !deck?.observationMap?.flowPolicy || Boolean(!playback && run && !run.ended);
    $('run').textContent = run
      ? `${playback ? clock.done ? 'Scenario replay complete' : 'Captured scenario prefix' : run.ended ? `Run ended · exit ${run.exitCode ?? '?'}` : 'Run in progress'} · ${run.id} · ${run.cells.size} cell / ${run.edges.size} edge observations${run.ambiguous ? ' · ambiguous capture: overlay held' : ''}`
      : `Waiting for testimony for ${capability() || 'a selected capability'}. The circuit shows declarations until execution evidence arrives.`;
    $('verification').replaceChildren(el('h3', { text: 'Verification evidence' }));
    $('inventory').replaceChildren(el('h3', { text: 'Execution testimony' }));
    $('inspector').replaceChildren(); $('inspector').hidden = true;
    if (!deck) { $('cursor').textContent = 'Waiting for the selected circuit and execution evidence'; return; }
    const current = [...view.current], busy = [...view.busy];
    $('cursor').textContent = view.tokens.length || current.length
      ? `${playback ? 'Replay position' : 'Latest receipt'} · ${current.length ? current.map(id => labelOf(deck, id)).join(', ') : 'on a route'} · ${view.status}${busy.length ? ` · busy: ${busy.map(id => labelOf(deck, id)).join(', ')}` : ''}`
      : 'Waiting for execution evidence';
    Object.assign($('viewer').dataset, { currentLocation: current.join(' '), busy: busy.join(' '), terminal: view.terminal?.kind ?? '',
      replayPosition: String(clock?.position ?? ''), replayDuration: String(playback?.timeline.duration ?? ''),
      replayWall: String(clock?.wallElapsed ?? ''), replayRate: String(clock?.rate ?? ''), replayPaused: String(clock?.paused ?? false) });
    const slide = state.detailSlides.find(item => item.id === state.detailSlideId) ?? deck.slides.find(item => item.id === state.slideId);
    if (slide) renderCircuitViewer($('viewer'), deck, slide, view, {
      selectedNode: state.selectedNode, selectNode: id => { state.selectedNode = id; render(); shell.component(id); }, selectSlide, selectTarget,
      overlay: $('overlay').checked, run, mode: playback ? `Replay ${clock.rate}×` : 'Live', paused: clock?.paused, scenarioComplete: clock?.done, playbackId: playback?.id,
    });
    const map = deck.observationMap, evidence = view.evidence;
    for (const finding of view.findings) $('verification').append(paragraph(`Flow evidence gap: ${finding.code} · ${finding.nodeId ?? finding.from ?? ''}`, 'warning'));
    if (view.terminal) $('verification').append(paragraph(terminalText(view.terminal), view.terminal.kind === 'variant' ? 'observation' : 'warning'));
    if (state.replayError) $('verification').append(paragraph(`Replay held: ${state.replayError}`, 'error'));
    if (playback) {
      const { timeline } = playback;
      $('verification').append(paragraph(`Scenario clock: ${timeline.duration.toFixed(3)} ms captured · ${(timeline.duration / clock.rate).toFixed(3)} ms at ${clock.rate}× · ${clock.wallElapsed.toFixed(3)} ms active playback wall time${clock.stepped ? ' · manually stepped' : ''}`),
        paragraph(`Excluded from playback: ${timeline.window.from.toFixed(3)} ms before the first mapped operation and ${(timeline.window.invocationDuration - timeline.window.to).toFixed(3)} ms after the scenario return.`),
        details('Invocation timing outside scenario playback', timeline.invocation),
        details('Capture records outside scenario playback', timeline.outsideRecords));
    }
    $('verification').append(
      paragraph(`Snapshot ${deck.snapshotDigest}`),
      paragraph(map ? `${map.declarationStatus} · ${map.mappedNodes}/${map.declaredNodes} nodes have direct testimony addresses` : 'Observation mapping unavailable; overlays held.', map ? '' : 'error'),
      paragraph(map?.executionGenerationStatus ?? 'NOT CHECKED', 'warning'),
      paragraph(map?.verificationScope ?? deck.mapError ?? 'No declared mapping returned.'),
      paragraph(deck.verificationScope ?? ''),
      details('Selected operation bindings', deck.operationBindings ?? []), details('Circuit loading findings', deck.findings ?? []),
      details('Observation mapping findings', deck.mappingFindings ?? []), details('Navigation findings', deck.navigation?.findings ?? []),
      details('Slide provenance', { slide: slide?.id, svgDigest: slide?.svgDigest, evidenceRefs: slide?.evidenceRefs, interpretation: slide?.interpretation }));
    const selected = [...deck.nodes, ...(slide ? boundaryGlyphs(deck, slide).map(glyph => ({ ...glyph, id: glyph.nodeId })) : []),
      ...(slide?.blueprint?.glyphs ?? []).map(glyph => ({ ...glyph, id: glyph.nodeId }))].find(node => node.id === state.selectedNode);
    if (selected) {
      const facts = evidence.nodes.get(selected.id) ?? [], activity = view.phases.get(selected.id);
      const where = [view.current.has(selected.id) && 'current location', view.busy.has(selected.id) && 'busy (owns outstanding work)',
        view.visited.has(selected.id) && 'visited'].filter(Boolean).join(' · ');
      $('inspector').hidden = false;
      $('inspector').append(el('h3', { text: 'Circuit component' }), paragraph(selected.label), paragraph(selected.id, 'muted'),
        paragraph(activity ? `${activity.phase.toUpperCase()} · ${activity.basis}${activity.fact?.outcomeVariant ? ` · ${activity.fact.outcomeVariant}` : ''}` : 'Unobserved. A declaration or provider binding does not establish execution.', 'observation'),
        ...(where ? [paragraph(`Traversal: ${where}`)] : []),
        details('Latest activity evidence', activity?.fact ?? null), details('Declared component', selected), details('Own cell testimony', facts));
      if (deck.navigation?.items.some(item => item.id === selected.id)) $('inspector').append(targetLink('Open component authority', { kind: 'detail', id: selected.id }, selectTarget));
      if (deck.navigation) $('inspector').append(relatedLinks(deck.navigation, selected.id, selectTarget));
    }
    if (run) $('inventory').append(
      paragraph(`${evidence.nodes.size} mapped components observed · ${evidence.unaddressed.length} observations outside direct deck addresses · ${evidence.unmatched.length} observations unmatched to the compiled graph`),
      details(`All cell testimony (${run.cells.size})`, [...run.cells.values()]),
      details(`All edge testimony (${run.edges.size})`, [...run.edges.values()]),
      details(`Unmatched testimony (${evidence.unmatched.length})`, evidence.unmatched),
      details(`Rejected edge testimony (${evidence.rejectedEdges.length})`, evidence.rejectedEdges),
      details(`Other failure observations (${run.other.length})`, run.other),
      ...evidence.boundaryFindings.filter(finding => finding.code === 'INPUT_FIELD_PRESENCE_NOT_PUBLISHED').map(() =>
        paragraph('Amber input highlights show the input boundary participated. Dashed payload fields mean field presence and values were not published.', 'warning')),
      details(`Boundary evidence findings (${evidence.boundaryFindings.length})`, evidence.boundaryFindings));
    else $('inventory').append(paragraph('No invocation selected. Replay the latest observer run or start an observed invocation.'));
    for (const node of document.querySelectorAll('#verification details,#inspector details,#inventory details'))
      node.open = expanded.has(node.querySelector('summary').textContent.replace(/\(\d+\)/g, ''));
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(() => { frame = 0; render(); }); }
  function connect(replay = false) {
    source?.close();
    if (state.apiOwned) return;
    if (replay) { state.runs = []; state.current = null; state.openRuns = 0; state.lastSeq = 0; }
    // Replay the latest run of this circuit's graph; interleaved reader runs are skipped.
    source = new EventSource(replay ? `/events?run=current&graphId=${encodeURIComponent(`graph:${capability()}`)}` : state.lastSeq ? `/events?since=${state.lastSeq}` : '/events');
    source.onopen = () => { state.connection = 'connected'; schedule(); };
    source.onmessage = message => {
      if (state.apiOwned) return;
      try {
        const record = JSON.parse(message.data);
        const instance = record.observationKey?.split(':').slice(0, -1).join(':');
        if (state.instance && state.instance !== instance) { state.runs = []; state.current = null; state.openRuns = 0; state.lastSeq = 0; stopReplay(); }
        state.instance = instance;
        if (record.seq <= state.lastSeq) return;
        state.lastSeq = record.seq;
        if (record.kind === 'run-start') {
          const overlap = state.openRuns > 0;
          state.openRuns++;
          if (overlap) for (const run of state.runs.filter(run => !run.ended)) run.ambiguous = true;
          state.current = newRun(record); state.current.ambiguous = Boolean(overlap);
          state.runs.push(state.current); if (state.runs.length > 20) state.runs.shift();
        } else if (state.current) {
          applyRecord(state.current, record);
          if (record.kind === 'run-end') state.openRuns = Math.max(0, state.openRuns - 1);
        } else state.connection = 'connected · incomplete retained run; waiting for run-start';
        schedule();
        if (replay && record.kind === 'run-end') { startReplay(latestRun()); connect(); }
      } catch (error) { state.connection = `invalid observation: ${error.message}`; schedule(); }
    };
    source.onerror = () => { if (state.apiOwned) return; state.connection = 'reconnecting'; schedule(); source.close(); setTimeout(() => connect(), 1500); };
  }
  const observePanel = createObservePanel({
    selection: shell.selection,
    prepare: async () => {
      stopReplay(); closeDetail(); $('follow').checked = true; $('overlay').checked = true;
      await shell.loadRoot();
      if (!state.deck) throw new Error('The live scenario could not be loaded.');
    },
    admitted: id => { source?.close(); stopReplay(); state.apiOwned = true; state.apiRun = null; state.apiGap = false; state.connection = `API run ${id}`; schedule(); },
    record: record => {
      if (record.kind === 'run-start') { state.apiRun = newRun(record); state.apiRun.ambiguous = Boolean(state.apiGap); }
      else if (state.apiRun) applyRecord(state.apiRun, record);
      else state.apiGap = true;
      schedule();
    },
    gap: () => { state.apiGap = true; if (state.apiRun) state.apiRun.ambiguous = true; schedule(); },
    release: () => {
      if (!state.apiOwned) return;
      stopReplay(); state.apiOwned = false; state.apiRun = null; state.runs = []; state.current = null; state.openRuns = 0; state.lastSeq = 0; state.instance = null; connect(); schedule();
    }
  });
  $('slide').addEventListener('change', () => selectSlide($('slide').value));
  $('detail-page').addEventListener('change', () => { state.detailSlideId = $('detail-page').value; shell.location(true); render(); });
  $('close-detail').addEventListener('click', () => { closeDetail(); shell.location(true); render(); });
  $('overlay').addEventListener('change', render);
  $('follow').addEventListener('change', () => { if ($('follow').checked) { closeDetail(); shell.location(true); } render(); });
  $('replay').addEventListener('click', () => { const run = latestRun(); if (run?.ended) startReplay(run); else if (!run) connect(true); });
  $('pause').addEventListener('click', () => { const clock = state.playback?.clock; if (!clock) return; if (clock.paused) clock.resume(); else clock.pause(); });
  $('step').addEventListener('click', () => state.playback?.clock.next());
  $('speed').addEventListener('change', () => state.playback?.clock.speed(Number($('speed').value)));
  $('live').addEventListener('click', () => { stopReplay(); render(); });
  connect();
  return {
    state, install, clear, render, selectSlide, openDetail, closeDetail, focus, hasComponent, slideOf,
    reset: () => observePanel.reset(),
    selection: () => ({ page: state.page, detail: state.detailId, pointer: state.detailPointer, detailPage: state.detailSlideId })
  };
}
