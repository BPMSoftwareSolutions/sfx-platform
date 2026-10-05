// The original slide supplies all geometry and artwork; this is a generic overlay.
// It draws the traversal state (traversal.js) and makes no decisions of its own.
export function el(tag, attributes = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (key === 'text') node.textContent = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value);
  }
  node.append(...children); return node;
}
const position = (x, y, w, h) => `left:${x / 9.6}%;top:${y / 5.4}%;width:${w / 9.6}%;height:${h / 5.4}%;`;
const svg = (tag, attributes = {}) => {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  return node;
};
const equalPoint = (a, b) => a && b && a.length === 2 && b.length === 2 && a.every((n, i) => Math.abs(n - b[i]) < 0.01);
const onBoundary = (point, bounds) => point && bounds &&
  point[0] >= bounds.x - 0.01 && point[0] <= bounds.x + bounds.w + 0.01 &&
  point[1] >= bounds.y - 0.01 && point[1] <= bounds.y + bounds.h + 0.01 &&
  [Math.abs(point[0] - bounds.x), Math.abs(point[0] - bounds.x - bounds.w),
    Math.abs(point[1] - bounds.y), Math.abs(point[1] - bounds.y - bounds.h)].some(n => n < 0.01);

// Locate the exported deck shapes by declared captions and containment. No new
// layout is synthesized, and ambiguous caption matches produce no overlay.
export function boundaryGlyphs(deck, slide) {
  if (slide.blueprint?.boundaryGlyphs) return slide.blueprint.boundaryGlyphs;
  const policy = deck.observationMap?.flowPolicy?.boundaryPolicy;
  if (!policy || slide.blueprint?.role !== policy.role) return [];
  const normalize = text => String(text).replace(/\s+/g, '').toLowerCase();
  const contains = (a, b) => a.x <= b.x && a.y <= b.y && a.x + a.w >= b.x + b.w - .01 && a.y + a.h >= b.y + b.h - .01;
  const shapes = slide.commands.filter(command => command.op === 'shape').map(command => ({
    type: command.args[0], x: command.args[1], y: command.args[2], w: command.args[3], h: command.args[4] }));
  const locate = (caption, type, parent) => {
    const texts = slide.commands.filter(command => command.op === 't' && normalize(command.args[0]) === normalize(caption))
      .map(command => ({ x: command.args[1], y: command.args[2], w: command.args[3], h: command.args[4] }))
      .filter(bounds => !parent || contains(parent, bounds));
    if (texts.length !== 1) return null;
    const candidates = shapes.filter(shape => shape.type === type && contains(shape, texts[0]) && (!parent || contains(parent, shape)))
      .sort((a, b) => a.w * a.h - b.w * b.h);
    if (!candidates.length || candidates[1]?.w * candidates[1]?.h === candidates[0].w * candidates[0].h) return null;
    return candidates[0];
  };
  const glyphs = [];
  for (const boundary of deck.observationMap.boundaries ?? []) {
    if (boundary.scenarioId !== slide.blueprint.scenarioId) continue;
    const input = locate(policy.inputPanel, policy.panelShape), outcome = locate(policy.outcomePanel, policy.panelShape);
    if (input) {
      glyphs.push({ nodeId: boundary.inputNodeId, label: boundary.inputCaption, kind: 'input', bounds: input, boundary: true });
      for (const field of boundary.fields ?? []) {
        const bounds = locate(field.caption, policy.fieldShape, input);
        if (bounds) glyphs.push({ ...field, label: field.caption, kind: 'input-field', bounds });
      }
    }
    if (outcome) {
      glyphs.push({ nodeId: boundary.outcomeNodeId, label: boundary.outcomeCaption, kind: 'outcome', bounds: outcome, boundary: true });
      const variants = (boundary.variants ?? []).map(variant => ({ ...variant, label: variant.caption, kind: 'variant',
        bounds: locate(variant.caption, policy.fieldShape, outcome) })).filter(variant => variant.bounds);
      glyphs.push(...variants);
      const bottom = outcome.y + outcome.h;
      const last = Math.max(outcome.y, ...variants.map(variant => variant.bounds.y + variant.bounds.h));
      const height = Math.min(policy.reportedVariantSlot.height, bottom - last - 1);
      if (height > 0) glyphs.push({ nodeId: boundary.outcomeNodeId + policy.reportedVariantSuffix, kind: 'reported-variant',
        label: 'Reported outcome variant', bounds: { x: outcome.x + policy.reportedVariantSlot.inset, y: bottom - height,
          w: outcome.w - 2 * policy.reportedVariantSlot.inset, h: height } });
    }
  }
  return glyphs;
}

// Routes come from exported geometry, never from node order or a new layout.
export function slideRoutes(deck, slide, flow) {
  const routes = (slide.blueprint?.render?.routes ?? []).map(route => ({ ...route, evidence: flow.routes.get(route.id) }));
  if (slide.blueprint?.flow) return routes;
  const policy = deck.observationMap?.flowPolicy;
  if (!policy) return routes;
  const commands = (slide.commands ?? []).filter(command => command.op === 'route');
  for (const rule of policy.scenarioWires) for (const edge of deck.edges.filter(edge => edge.kind === rule.edgeKind)) {
    const glyph = slide.blueprint?.glyphs?.find(glyph => glyph.nodeId === edge[rule.eventEnd]);
    const state = flow.activity.get(glyph?.nodeId);
    if (!glyph || !state) continue;
    const matches = commands.filter(command => equalPoint(command.args[0][rule.eventEnd === 'to' ? command.args[0].length - 1 : 0], glyph.anchors[rule.anchor]));
    if (matches.length !== 1) continue;
    const at = rule.phase === 'completion' ? state.completedAt : state.firstAt;
    if (at !== undefined) routes.push({ id: edge.id, points: matches[0].args[0],
      focusNodeId: glyph.nodeId, stage: rule.phase === 'completion' ? 'outcome' : 'input',
      evidence: { at, key: `${edge.id}:${at}`, fact: state.fact }, basis: `Scenario ${rule.phase}` });
  }
  for (const port of slide.blueprint?.providerPorts ?? []) {
    const own = flow.nodes.get(port.operationId)?.findLast(fact =>
      policy.providerIdentityPrefix + fact.providerProfileId === port.providerId);
    const state = flow.activity.get(port.operationId);
    const event = slide.blueprint.glyphs.find(glyph => glyph.nodeId === port.eventId);
    const operation = slide.blueprint.glyphs.find(glyph => glyph.nodeId === port.operationId &&
      equalPoint(glyph.anchors.bottom, port.callAnchor));
    const owner = deck.nodes.find(node => node.id === port.eventId);
    const member = deck.nodes.find(node => node.id === port.operationId);
    // A scenario owns these operation calls. This connection shows that call's
    // activity; it does not assert a sequence edge between displayed ports.
    const eventMatches = commands.filter(command => equalPoint(command.args[0][0], port.eventAnchor) &&
      equalPoint(command.args[0].at(-1), operation?.anchors.bottom));
    if (state && owner?.kind === 'event' && owner.scenarioId === slide.blueprint.scenarioId &&
        member?.scenarioIds?.includes(owner.scenarioId) && onBoundary(port.eventAnchor, event?.bounds) &&
        eventMatches.length === 1) routes.push({ id: `${port.eventId}:${port.operationId}:${port.providerId}`, points: eventMatches[0].args[0],
      focusNodeId: port.operationId, stage: 'call',
      evidence: { at: state.firstAt, key: state.key, fact: state.fact }, basis: 'Observed operation of the declared event' });
    const provider = slide.blueprint.glyphs.find(glyph => glyph.nodeId === port.providerId);
    const matches = commands.filter(command => equalPoint(command.args[0][0], port.anchor) && onBoundary(command.args[0].at(-1), provider?.bounds));
    if (own && state && matches.length === 1) routes.push({ id: `${port.operationId}:${port.providerId}`, points: matches[0].args[0],
      focusNodeId: port.operationId, providerId: port.providerId, stage: 'provider',
      evidence: { at: state.completedAt, key: own.cellExecutionId, fact: own }, basis: 'Provider receipt' });
  }
  return routes;
}
const defectText = terminal => terminal.code === 'OUTCOME_RETURN_NOT_OBSERVED' ? 'No outcome return observed'
  : terminal.code === 'OUTCOME_CONTRACT_MISMATCH' ? `Contract mismatch: ${terminal.reported ?? 'not reported'}`
    : `Unmatched: ${terminal.reported ?? 'not reported'}`;
const DEFECT_KINDS = new Set(['outcome-defect', 'reported-variant']);

// `view` is the traversal state for this instant: phases (evidence), current,
// busy, visited, tokens and terminal. Nothing here reinterprets receipts.
export function renderCircuitViewer(root, deck, slide, view, options) {
  const { selectedNode, selectNode, selectSlide, selectTarget, overlay, run, mode, paused } = options;
  const key = `${deck.id}:${deck.presentationDigest ?? ''}:${slide.id}:${slide.svgDigest??''}:${run?.id ?? ''}:${options.playbackId ?? ''}:${deck.observationMap?.boundaries?.length ?? 0}`;
  if (root.dataset.slide !== key) {
    root.dataset.slide = key;
    root.replaceChildren(el('img', { src: slide.imageUrl, alt: `${slide.title} — ${deck.capabilityId}`, class: 'deck-image' }),
      svg('svg', { class: 'flow-wires', viewBox: '0 0 960 540', 'aria-hidden': 'true' }),
      el('div', { class: 'deck-overlay', role: 'group', 'aria-label': 'Deck component inspection and observations' }));
    const layer = root.querySelector('.deck-overlay');
    for (const glyph of [...(slide.blueprint?.glyphs ?? []), ...boundaryGlyphs(deck, slide)]) {
      const { x, y, w, h } = glyph.bounds;
      const group = el('button', { type: 'button', 'data-node-id': glyph.nodeId, 'data-kind': glyph.kind, 'data-label': glyph.label ?? glyph.nodeId,
        class: `component-hit${glyph.boundary ? ' boundary-hit' : ''}`, style: position(x,y,w,h) },
        [el('span', { class: 'observed-marker' })]);
      group.addEventListener('click', () => selectNode(group.getAttribute('aria-pressed') === 'true' ? null : glyph.nodeId));
      layer.append(group);
    }
    for (const command of slide.commands ?? []) {
      if (command.op !== 't' || !Number.isInteger(command.args[9]?.slideIndex)) continue;
      const [label, x, y, w, h] = command.args, target = deck.slides[command.args[9].slideIndex];
      if (!target) continue;
      const link = el('a', { href: `#${target.id}`, 'aria-label': `${label}: ${target.title}`, class: 'slide-link', style: position(x,y,w,h) });
      link.addEventListener('click', (event) => { event.preventDefault(); selectSlide(target.id); });
      layer.append(link);
    }
    for (const item of slide.blueprint?.navigation ?? []) {
      const {x,y,w,h}=item.bounds;
      const link=el('a',{href:'#', 'aria-label':`Open ${item.label}`,class:'slide-link',style:position(x,y,w,h)});
      link.addEventListener('click',event=>{event.preventDefault();selectTarget?.(item.target);});
      layer.append(link);
    }
  }
  root.classList.toggle('is-paused', Boolean(paused));
  const terminal = overlay ? view.terminal : null;
  for (const group of root.querySelectorAll('.component-hit')) {
    const id = group.dataset.nodeId, state = overlay ? view.phases.get(id) : null;
    const phase = state ? state.phase : 'unobserved';
    const flags = { current: overlay && view.current.has(id), busy: overlay && view.busy.has(id), visited: overlay && view.visited.has(id) };
    Object.assign(group.dataset, { phase, current: String(flags.current), busy: String(flags.busy), visited: String(flags.visited),
      receipt: state?.key ?? '' });
    const where = [flags.current && 'current location', flags.busy && 'busy', flags.visited && !flags.current && 'visited'].filter(Boolean).join(', ');
    group.setAttribute('aria-label', `${group.dataset.label}: ${phase}${where ? ` · ${where}` : ''}`);
    group.setAttribute('title', `${phase}${where ? ` · ${where}` : ''}${state ? ` · ${state.basis}` : ''}`);
    group.setAttribute('aria-pressed', String(id === selectedNode));
    group.classList.toggle('selection', id === selectedNode);
    if (DEFECT_KINDS.has(group.dataset.kind)) {
      const reached = terminal?.kind === 'defect' && terminal.nodeId === id;
      group.textContent = reached ? defectText(terminal) : '';
      // Exported decks have no drawn defect endpoint; their synthesized slot appears only when reached.
      group.hidden = group.dataset.kind === 'reported-variant' && !reached;
    }
  }
  const wires = root.querySelector('.flow-wires');
  wires.style.display = overlay ? '' : 'none';
  const routes = slideRoutes(deck, slide, view.evidence).filter(route => route.evidence);
  routes.push(...(view.liveRoutes ?? []).filter(route => route.sceneId === slide.id));
  if (overlay && view.terminalRoute?.sceneId === slide.id)
    routes.push({ id: `terminal:${view.terminalRoute.nodeId}`, points: view.terminalRoute.points, terminal: view.terminal?.kind ?? 'defect' });
  for (const existing of wires.querySelectorAll('[data-route]')) if (!routes.some(route => route.id === existing.dataset.route)) existing.remove();
  for (const route of routes) {
    const existing = [...wires.children].find(node => node.dataset.route === route.id);
    if (existing) {
      existing.querySelector('polyline').setAttribute('points', route.points.map(point => point.join(',')).join(' '));
      continue;
    }
    const group = svg('g', { 'data-route': route.id, ...(route.terminal ? { 'data-terminal': route.terminal } : {}) });
    group.append(svg('polyline', { points: route.points.map(point => point.join(',')).join(' '), class: route.terminal ? 'wire-terminal' : 'wire-observed' }));
    wires.append(group);
  }
  // One persistent dot per concurrent captured span, positioned from the
  // scenario clock; pause and speed changes never restart a path animation.
  const lanesOf = id => JSON.stringify(deck.slides.find(s => s.id === id)?.blueprint?.flow?.lanes);
  const tokens = overlay ? view.tokens.filter(t => t.sceneId === slide.id ||
    t.kind !== 'outcome' && slide.blueprint?.flow && JSON.stringify(slide.blueprint.flow.lanes) === lanesOf(t.sceneId)) : [];
  for (const node of wires.querySelectorAll('[data-flow-token]')) if (!tokens.some((t, i) => String(i) === node.dataset.flowToken)) node.remove();
  for (const [i, token] of tokens.entries()) {
    let dot = wires.querySelector(`[data-flow-token="${i}"]`);
    if (!dot) { dot = svg('circle', { r: 3.5, class: 'flow-signal', 'data-flow-token': i }); dot.append(svg('title')); wires.append(dot); }
    dot.setAttribute('cx', token.point[0]); dot.setAttribute('cy', token.point[1]);
    Object.assign(dot.dataset, { stage: token.stage, operation: token.nodeId, receipt: token.key, current: token.current ?? '',
      progress: String(token.progress ?? ''), direction: token.direction ?? 'forward' });
    dot.querySelector('title').textContent = `${token.stage} · ${token.basis ?? 'received execution evidence'}`;
  }
  wires.querySelector('[data-telemetry]')?.remove();
  if (run) {
    const telemetry = svg('g', { 'data-telemetry': 'true' });
    const fields = { mode, state: run.ambiguous ? 'Held' : options.scenarioComplete ? 'Scenario complete' : run.ended ? 'Run ended' : paused ? 'Paused' : 'Flowing',
      counts: `${run.cells.size} cell / ${run.edges.size} edge receipts` };
    for (const field of deck.observationMap?.flowPolicy?.telemetryFields ?? []) {
      for (const command of slide.commands ?? []) if (command.op === 't' && command.args[0] === field.placeholder) {
        const [, x, y, w, h, size] = command.args;
        telemetry.append(svg('rect', { x, y, width: w, height: h, fill: '#102238' }));
        const text = svg('text', { x: x + 2, y: y + h / 2, 'dominant-baseline': 'middle',
          fill: '#72D7EE', 'font-size': size, 'font-family': 'Arial' });
        text.textContent = fields[field.field] ?? ''; telemetry.append(text);
      }
    }
    wires.append(telemetry);
  }
}
