'use strict';
(() => {
  const data = window.CAPABILITY_PAGE;
  const $ = id => document.getElementById(id);
  const make = (tag, text, cls) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (cls) node.className = cls; return node; };
  const rootUrl = path => data.root + path.split('/').map(encodeURIComponent).join('/');
  const specs = {...data.grammar.nodeTypes, ...data.grammar.junctionTypes};
  let current = 0, material = true, phase = -1, selected = null, scale = 1, fitMode = true, flow = null;
  const product = () => data.circuits[current];
  const projection = () => product().projection;

  function stop() {
    flow?.pause();
  }

  function clearFlow() {
    flow?.destroy(); flow = null;
    $('play').textContent = '▶ Play flow'; $('play').setAttribute('aria-label', 'Play silver-ball flow');
    $('flow-position').value = 0; $('flow-time').textContent = '0:00';
  }

  function updateFlow(state) {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    $('play').textContent = state.running ? 'Ⅱ Pause' : state.finished ? '↺ Replay flow' : reduced ? 'Step flow →' : state.time > 0 ? '▶ Resume flow' : '▶ Play flow';
    $('play').setAttribute('aria-label', state.running ? 'Pause silver-ball flow' : reduced ? 'Step silver-ball flow' : state.finished ? 'Replay silver-ball flow' : state.time > 0 ? 'Resume silver-ball flow' : 'Play silver-ball flow');
    $('flow-position').max = Math.ceil(state.duration * 100) / 100; $('flow-position').value = state.time;
    const clock = t => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
    $('flow-time').textContent = clock(state.time) + ' / ' + clock(state.duration);
    const nodes = [...projection().nodes, ...projection().junctions];
    const name = id => nodes.find(n => n.id === id)?.label || id;
    const moving = state.moving.map(id => projection().edges.find(e => e.id === id));
    let caption = 'Ready at the input. Play the silver ball through the authored circuit.';
    if (state.joins.length) caption = state.joins.map(join => `${name(join.id)}: ${join.arrived} / ${join.required} arrivals${join.arrived < join.required ? '. Waiting for the remaining result.' : '. Merge, then continue.'}`).join(' ');
    else if (state.time > 0 && state.active.length) caption = state.active.map(name).join(' + ') + ' · illustrative processing';
    else if (moving.length) caption = moving.map(edge => name(edge.source) + ' → ' + name(edge.target)).join('  ·  ');
    else if (state.time > 0) caption = 'The illustrated path has reached its outcome. Evidence status is unchanged.';
    if (state.finished) caption = 'End-to-end flow complete. ' + (nodes.some(n => n.basis === 'GAP') ? 'Required testimony is still GAP; the intended outcome is not an observed result.' : 'This animation does not establish live execution.');
    const independent = nodes.filter(n => n.type === 'input').length;
    if (independent > 1) caption = `${independent} independent scenario paths. ` + caption;
    if ($('phase-caption').textContent !== caption) $('phase-caption').textContent = caption;
  }

  function createFlow(snapshot) {
    flow = new window.SideFXCircuitFlow.Player($('stage').firstElementChild, projection(), updateFlow);
    flow.setRate(snapshot?.rate || Number($('flow-speed').value));
    if (snapshot) { flow.seek(snapshot.time); if (snapshot.running) flow.play(); }
  }

  function sources(ids) {
    const links = make('div', undefined, 'sources');
    for (const id of ids) {
      const source = projection().sources.find(s => s.id === id);
      const link = make('a', source.label + ' ↗'); link.href = rootUrl(source.path); link.title = (source.pointer || '/') + ' · SHA-256 ' + source.sha256; links.append(link);
    }
    return links;
  }

  function inspect(id) {
    stop(); selected = id;
    const node = [...projection().nodes, ...projection().junctions].find(n => n.id === id);
    $('inspect-title').textContent = node.label;
    const mode = data.grammar.evidenceModes[node.basis], body = $('inspect-body');
    body.replaceChildren(make('span', mode.label, 'badge'), make('p', node.detail), make('p', specs[node.type].meaning));
    body.firstChild.style.color = {TARGET: '#715992', GAP: '#956925', DECLARED: '#315f54', OBSERVED: '#294c52'}[node.basis] || '#566c71';
    if (node.rule) body.append(make('p', 'Rule: ' + node.rule));
    if (node.join) body.append(make('p', 'Join: ' + node.join.toUpperCase() + (node.quorum ? ' / ' + node.quorum + ' arrivals' : '')));
    if (node.closure) body.append(make('p', 'Required closure: ' + node.closure));
    const provider = projection().providers.find(p => p.nodeId === id || p.portIds.includes(id));
    if (provider) body.append(make('p', 'Provider binding: ' + provider.binding + ' · State: ' + provider.state));
    body.append(sources(node.sourceRefs));
    $('stage').querySelectorAll('[data-entity]').forEach(group => group.classList.toggle('selected', group.id === id));
  }

  function summary() {
    selected = null; $('inspect-title').textContent = 'Every mark has a job.';
    $('inspect-body').replaceChildren(make('p', 'Select a node by mouse or keyboard. Inspect its meaning, evidence status and exact source support.'));
    $('stage').querySelectorAll('.selected').forEach(group => group.classList.remove('selected'));
  }

  function showPhase(index) {
    phase = index;
    const ids = new Set(), edges = new Set();
    projection().animationBeats.slice(0, index + 1).forEach(beat => { beat.entityIds.forEach(id => ids.add(id)); beat.edgeIds.forEach(id => edges.add(id)); });
    $('stage').querySelectorAll('[data-entity],[data-edge]').forEach(group => group.classList.toggle('muted', index >= 0 && !ids.has(group.id) && !edges.has(group.id) && group.dataset.basis !== 'GAP'));
    [...$('phases').children].forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
    $('phase-caption').textContent = index < 0 ? 'All paths are visible. Select a phase to follow the authored sequence.' : projection().animationBeats[index].caption;
  }

  function zoom(value, fitting = false) {
    scale = Math.max(.08, Math.min(2, value)); fitMode = fitting;
    $('stage').style.width = Math.round(projection().layout.width * scale) + 'px';
    $('zoom-label').textContent = Math.round(scale * 100) + '%';
    flow?.render(flow.time);
  }
  function fit() { zoom($('viewport').clientWidth / projection().layout.width, true); }

  function draw() {
    const snapshot = flow ? {time: flow.time, rate: flow.rate, running: flow.running} : null;
    clearFlow();
    const p = product();
    // Only validated compiler output is embedded by the build boundary.
    $('stage').innerHTML = material ? p.enhancedSvg : p.baseSvg;
    $('stage').firstElementChild.setAttribute('role', 'group');
    $('stage').querySelectorAll('[data-entity]').forEach(group => {
      group.onclick = () => inspect(group.id);
      group.onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); inspect(group.id); } };
    });
    $('enhanced').setAttribute('aria-pressed', String(material)); $('base').setAttribute('aria-pressed', String(!material));
    $('svg-download').href = rootUrl(p.directory + '/infographic' + (material ? '-enhanced' : '') + '.svg');
    showPhase(phase);
    if (selected) inspect(selected);
    if (snapshot || phase < 0) createFlow(snapshot);
  }

  function open(index) {
    clearFlow(); current = index; phase = -1; selected = null;
    const p = product(), relationship = {'scenario': 'Scenario', 'related-scenario': 'Related scenario', 'capability-overview': 'Capability overview'}[p.binding.relationship];
    $('circuit-relationship').textContent = relationship + ' / ' + p.projection.subtitle;
    $('circuit-title').textContent = p.projection.title; $('circuit-context').textContent = p.binding.context;
    $('circuit-scope').textContent = p.projection.scope;
    $('projection-link').href = rootUrl('declarations/infographics/' + p.projection.id + '.json');
    $('motion-link').hidden = !p.motion;
    if (p.motion) $('motion-link').href = rootUrl(p.motion);
    [...$('circuit-tabs').children].forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
    draw(); summary(); fit(); $('viewport').scrollTo(0, 0);
  }

  if (data.circuits.length) {
    data.circuits.forEach((p, index) => {
      const button = make('button', p.projection.title); button.onclick = () => open(index); $('circuit-tabs').append(button);
    });
    data.grammar.phases.forEach((name, index) => {
      const button = make('button', (index + 1) + ' ' + name); button.onclick = () => { clearFlow(); summary(); showPhase(index); }; $('phases').append(button);
    });
    const appearance = value => {
      const left = $('viewport').scrollLeft, top = $('viewport').scrollTop;
      material = value; draw(); zoom(scale, fitMode); $('viewport').scrollTo(left, top);
    };
    $('enhanced').onclick = () => appearance(true); $('base').onclick = () => appearance(false);
    $('fit').onclick = fit; $('zoom-in').onclick = () => zoom(scale * 1.3); $('zoom-out').onclick = () => zoom(scale / 1.3);
    $('reset').onclick = () => { clearFlow(); summary(); showPhase(-1); };
    $('play').onclick = () => {
      if (flow?.running) { stop(); return; }
      summary(); showPhase(-1); if (!flow) createFlow(); flow.play();
    };
    $('restart').onclick = () => { summary(); showPhase(-1); if (!flow) createFlow(); flow.seek(0); flow.play(); };
    $('flow-position').oninput = event => { const time = Number(event.target.value); summary(); showPhase(-1); if (!flow) createFlow(); flow.seek(time); };
    $('flow-speed').onchange = event => { flow?.setRate(Number(event.target.value)); };
    window.addEventListener('resize', () => { if (fitMode) fit(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
    window.addEventListener('pagehide', stop);
    open(0);
  }

  $('assessment').onsubmit = event => {
    event.preventDefault(); let correct = 0;
    const answers = new FormData(event.currentTarget);
    data.training.questions.forEach((q, index) => {
      const passed = Number(answers.get('q' + index)) === q.correct; if (passed) correct++;
      const feedback = $('feedback-' + index); feedback.classList.toggle('incorrect', !passed);
      feedback.textContent = (passed ? 'Correct. ' : 'Reconsider. ') + q.rationale;
    });
    $('assessment-result').textContent = correct + ' / ' + data.training.questions.length + ' distinctions understood. ' + (correct === data.training.questions.length ? 'Your reasoning preserves the evidence boundary.' : 'Review the explanations, then try again.');
  };
})();
