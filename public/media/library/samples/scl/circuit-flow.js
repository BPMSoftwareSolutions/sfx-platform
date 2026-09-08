/* Silver flow is a decorative projection of selected contract paths, never telemetry. */
(function (root) {
  'use strict';
  const FLOW = new Set(['transition', 'product-transfer']);
  const dwell = node => ({input: .65, event: .85, validation: 1, decision: .55,
    branch: .2, 'fan-out': .2, convergence: .65, outcome: 1}[node.type] || .6);
  const require = (condition, message) => { if (!condition) throw new Error(message); };

  // Pure scheduling, shared with adversarial tests. Lengths are measured from the
  // actual SVG paths (including the visible arms), in SVG coordinate units.
  function plan(projection, lengths, speed = 260) {
    require(Number.isFinite(speed) && speed > 0, 'INVALID_FLOW_SPEED');
    const selected = new Set(projection.animationBeats.flatMap(beat => beat.edgeIds));
    require(!projection.edges.some(edge => selected.has(edge.id) && edge.type === 'retry'), 'FLOW_RETRY_REQUIRES_EXPLICIT_ITERATIONS');
    const edges = projection.edges.filter(edge => FLOW.has(edge.type) && selected.has(edge.id));
    require(edges.length > 0, 'NO_AUTHORED_FLOW');
    const ids = new Set(edges.flatMap(edge => [edge.source, edge.target]));
    const nodes = [...projection.nodes, ...projection.junctions].filter(node => ids.has(node.id));
    require(nodes.length === ids.size, 'FLOW_UNKNOWN_NODE');
    const incoming = id => edges.filter(edge => edge.target === id);
    const outgoing = id => edges.filter(edge => edge.source === id);
    for (const node of nodes) {
      const allOut = projection.edges.filter(edge => FLOW.has(edge.type) && edge.source === node.id);
      if (node.type === 'fan-out') require(outgoing(node.id).length === allOut.length, 'FLOW_INCOMPLETE_FANOUT:' + node.id);
      if (['branch', 'decision'].includes(node.type)) require(outgoing(node.id).length === 1, 'FLOW_BRANCH_NEEDS_ONE_ALTERNATIVE:' + node.id);
      if (node.type === 'convergence') {
        const count = projection.edges.filter(edge => FLOW.has(edge.type) && edge.target === node.id).length;
        const needed = node.join === 'all' ? count : node.join === 'any' ? 1 : node.quorum;
        require(needed > 0 && incoming(node.id).length >= needed, 'FLOW_INCOMPLETE_JOIN:' + node.id);
      } else require(incoming(node.id).length <= 1, 'FLOW_UNDECLARED_MERGE:' + node.id);
      require(node.basis !== 'GAP', 'FLOW_CANNOT_EXECUTE_GAP:' + node.id);
    }
    const roots = nodes.filter(node => !incoming(node.id).length);
    require(roots.length && roots.every(node => node.type === 'input'), 'FLOW_MUST_START_AT_INPUT');
    const timings = {}, flights = {}, pending = new Set(nodes.map(node => node.id));
    while (pending.size) {
      const ready = nodes.filter(node => pending.has(node.id) && incoming(node.id).every(edge => flights[edge.id]));
      require(ready.length, 'FLOW_CYCLE');
      for (const node of ready) {
        const arrivals = incoming(node.id).map(edge => flights[edge.id].end).sort((a, b) => a - b);
        const required = node.type === 'convergence' ? (node.join === 'all' ? arrivals.length : node.join === 'any' ? 1 : node.quorum) : arrivals.length;
        const start = arrivals.length ? arrivals[required - 1] : roots.findIndex(n => n.id === node.id) * .2;
        const parent = incoming(node.id).length === 1 ? nodes.find(n => n.id === incoming(node.id)[0].source) : null;
        // Presentation pacing makes the ALL wait legible. This is deliberately
        // an illustrative sibling offset, not an assertion of provider latency.
        const siblingOffset = parent?.type === 'fan-out' && node.type === 'event'
          ? outgoing(parent.id).findIndex(edge => edge.target === node.id) * .65 : 0;
        const release = start + dwell(node) + siblingOffset;
        timings[node.id] = {start, release, arrivals, required, type: node.type, basis: node.basis};
        for (const edge of outgoing(node.id)) {
          require(Number.isFinite(lengths[edge.id]) && lengths[edge.id] > 0, 'FLOW_INVALID_PATH_LENGTH:' + edge.id);
          flights[edge.id] = {id: edge.id, source: edge.source, target: edge.target, start: release,
            end: release + lengths[edge.id] / speed, length: lengths[edge.id], basis: edge.basis};
        }
        pending.delete(node.id);
      }
    }
    const terminals = nodes.filter(node => !outgoing(node.id).length).map(node => node.id);
    require(terminals.every(id => ['outcome', 'termination', 'rejection'].includes(nodes.find(n => n.id === id).type)), 'FLOW_INCOMPLETE_END');
    const finish = Math.max(...Object.values(timings).map(t => t.release), ...Object.values(flights).map(f => f.end));
    return {nodes: timings, flights: Object.values(flights), roots: roots.map(n => n.id), terminals,
      duration: finish + 1.6, finish, speed, timingBasis: 'ILLUSTRATIVE_NOT_TELEMETRY', selectedEdges: edges.map(e => e.id),
      stops: [...new Set([0, ...Object.values(timings).flatMap(t => [t.start, t.release]), finish + 1.6])].sort((a, b) => a - b)};
  }

  // Keep the compiler's path commands verbatim. Only prepend/append the precise
  // visible junction arms, so no ball jumps between an arm tip and its hub.
  function route(projection, edge, originalD) {
    require(/^M\s*[-+\d.]/.test(originalD), 'FLOW_PATH_MUST_BE_ABSOLUTE');
    const a = projection.layout.junctionGlyphs[edge.source]?.hub;
    const b = projection.layout.junctionGlyphs[edge.target]?.hub;
    return (a ? `M${a[0]} ${a[1]} ` + originalD.replace(/^M/, 'L') : originalD) + (b ? ` L${b[0]} ${b[1]}` : '');
  }

  const NS = 'http://www.w3.org/2000/svg';
  const svgNode = (name, attrs = {}) => {
    const node = document.createElementNS(NS, name);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    return node;
  };
  let serial = 0;

  // Shared vector artwork for the browser player and offline episode renderer.
  function sphereMarkup(prefix) {
    return {
      definitions: `<radialGradient id="${prefix}-metal" cx="32%" cy="24%" r="76%"><stop offset="0" stop-color="#fff"/><stop offset=".2" stop-color="#f7fcff"/><stop offset=".4" stop-color="#adb9c8"/><stop offset=".58" stop-color="#36475c"/><stop offset=".73" stop-color="#c8d4e1"/><stop offset="1" stop-color="#1b2839"/></radialGradient><radialGradient id="${prefix}-aura"><stop stop-color="#e6f5ff" stop-opacity=".65"/><stop offset="1" stop-color="#b2d8ff" stop-opacity="0"/></radialGradient><clipPath id="${prefix}-clip"><circle r="14"/></clipPath>`,
      body: `<ellipse cx="1" cy="12" rx="16" ry="5" fill="#000" opacity=".5"/><circle r="29" fill="url(#${prefix}-aura)"/><circle r="14" fill="url(#${prefix}-metal)" stroke="#d1e3ef" stroke-width=".7"/><g clip-path="url(#${prefix}-clip)"><g data-flow-roll="sphere"><ellipse rx="6" ry="14" fill="none" stroke="#eef7ff" stroke-width="1.8" opacity=".55"/><path d="M-13 4 Q0 12 13 4" fill="none" stroke="#16283c" stroke-width="2" opacity=".38"/></g></g><ellipse cx="-4" cy="-6" rx="5" ry="2.8" fill="#fff" opacity=".95"/><circle cx="-6" cy="-8" r="1.5" fill="#fff"/>`
    };
  }

  class Player {
    constructor(svg, projection, onUpdate) {
      this.svg = svg; this.projection = projection; this.onUpdate = onUpdate;
      this.time = 0; this.rate = 1; this.running = false; this.frame = null; this.started = false;
      this.entities = new Map([...svg.querySelectorAll('[data-entity]')].map(node => [node.id, node]));
      this.edges = new Map([...svg.querySelectorAll('[data-edge]')].map(node => [node.id, node]));
      this.layer = svgNode('g', {'data-flow-overlay': 'silver-ball', 'aria-hidden': 'true', 'pointer-events': 'none'});
      const prefix = 'silver-flow-' + ++serial;
      const defs = svgNode('defs');
      const artwork = sphereMarkup(prefix);
      defs.innerHTML = artwork.definitions;
      this.layer.append(defs); svg.append(this.layer);
      this.paths = new Map(); this.tokens = new Map(); this.waitLabels = new Map();
      const chosen = new Set(projection.animationBeats.flatMap(beat => beat.edgeIds));
      const lengths = {};
      for (const edge of projection.edges.filter(e => FLOW.has(e.type) && chosen.has(e.id))) {
        const path = this.edges.get(edge.id)?.querySelector('path[marker-end]');
        require(path, 'FLOW_SVG_EDGE_MISSING:' + edge.id);
        const track = svgNode('path', {d: route(projection, edge, path.getAttribute('d')), fill: 'none',
          stroke: '#d9efff', 'stroke-width': 3.4, 'stroke-linecap': 'round', opacity: 0, 'data-flow-trail': edge.id});
        this.layer.append(track); this.paths.set(edge.id, track); lengths[edge.id] = track.getTotalLength();
      }
      this.plan = plan(projection, lengths);
      const ball = id => {
        const group = svgNode('g', {'data-flow-ball': id, visibility: 'hidden'});
        group.innerHTML = artwork.body;
        const roll = group.querySelector('[data-flow-roll]'); roll.setAttribute('data-flow-roll', id);
        this.layer.append(group); return {group, roll};
      };
      for (const flight of this.plan.flights) this.tokens.set(flight.id, ball(flight.id));
      for (const id of this.plan.roots) this.tokens.set('seed:' + id, ball('seed:' + id));
      for (const node of projection.junctions.filter(n => n.type === 'convergence')) {
        const hub = projection.layout.junctionGlyphs[node.id]?.hub;
        if (!hub) continue;
        const label = svgNode('text', {x: hub[0], y: hub[1] - 42, 'text-anchor': 'middle', fill: '#e4f0fc',
          'font-size': 15, 'font-weight': 700, 'font-family': 'Segoe UI, sans-serif', 'data-flow-arrivals': node.id});
        this.layer.append(label); this.waitLabels.set(node.id, label);
      }
      this.render(0);
    }

    place(token, point, distance, opacity = 1) {
      token.group.setAttribute('visibility', 'visible'); token.group.setAttribute('opacity', opacity);
      token.group.setAttribute('transform', `translate(${point.x} ${point.y}) scale(${this.ballScale})`);
      token.roll.setAttribute('transform', `rotate(${distance / (14 * this.ballScale) * 180 / Math.PI})`);
    }

    render(time) {
      this.time = Math.max(0, Math.min(this.plan.duration, time));
      const t = this.time;
      const screenScale = this.svg.getBoundingClientRect().width / this.projection.layout.width;
      this.ballScale = Math.min(2.5, Math.max(1, 6.5 / Math.max(.01, 14 * screenScale)));
      this.layer.setAttribute('data-flow-time', t.toFixed(3));
      this.layer.setAttribute('data-flow-state', this.running ? 'running' : t >= this.plan.duration ? 'finished' : 'paused');
      for (const token of this.tokens.values()) token.group.setAttribute('visibility', 'hidden');
      const completed = [], active = [];
      for (const [id, node] of this.entities) {
        const timing = this.plan.nodes[id];
        node.classList.remove('muted');
        const glow = !!timing && t >= timing.start && t < timing.release;
        node.classList.toggle('flow-active', glow);
        node.classList.toggle('flow-reached', !!timing && t >= timing.release);
        if (glow) active.push(id);
        if (timing && t >= timing.release) completed.push(id);
        // GAP is visible from start to finish, never absorbed into a success state.
        node.classList.toggle('flow-gap', node.dataset.basis === 'GAP' && t >= this.plan.finish - 1);
      }
      for (const edge of this.edges.values()) edge.classList.remove('muted');
      for (const flight of this.plan.flights) {
        const path = this.paths.get(flight.id), token = this.tokens.get(flight.id);
        const distance = Math.max(0, Math.min(flight.length, (t - flight.start) * this.plan.speed));
        path.setAttribute('stroke-dasharray', `${Math.min(distance, 90)} ${flight.length + 90}`);
        path.setAttribute('stroke-dashoffset', -Math.max(0, distance - 90));
        path.setAttribute('opacity', t >= flight.start && t < flight.end ? '.65' : '0');
        if (t >= flight.start && t < flight.end) this.place(token, path.getPointAtLength(distance), distance);
        else if (t >= flight.end) {
          const target = this.plan.nodes[flight.target];
          // Only junction arrivals park on a physical hub. Node bodies absorb
          // the token at the inlet, pulse during work, then emit at the outlet.
          const junction = this.projection.layout.junctionGlyphs[flight.target]?.hub;
          const until = junction ? Math.max(flight.end, target.release) : flight.end + .18;
          if (t < until) this.place(token, path.getPointAtLength(flight.length), flight.length,
            junction ? 1 : Math.max(0, 1 - (t - flight.end) / .18));
        }
      }
      for (const id of this.plan.roots) {
        const timing = this.plan.nodes[id], flight = this.plan.flights.find(f => f.source === id);
        if (t >= timing.start && t < timing.release) this.place(this.tokens.get('seed:' + id), this.paths.get(flight.id).getPointAtLength(0), 0);
      }
      const joins = [];
      for (const [id, label] of this.waitLabels) {
        const timing = this.plan.nodes[id];
        if (!timing) continue;
        const arrived = timing.arrivals.filter(at => at <= t).length;
        label.textContent = arrived && t < timing.release ? `${arrived} / ${timing.required}${arrived < timing.required ? ' · waiting' : ' · merge'}` : '';
        if (arrived && t < timing.release) joins.push({id, arrived, required: timing.required});
      }
      this.onUpdate?.({time: t, duration: this.plan.duration, running: this.running, active, completed, joins,
        moving: this.plan.flights.filter(f => t >= f.start && t < f.end).map(f => f.id), finished: t >= this.plan.duration});
    }

    play() {
      if (this.running) return;
      this.started = true;
      if (this.time >= this.plan.duration) this.time = 0;
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
        this.seek(this.plan.stops.find(t => t > this.time + .01) ?? this.plan.duration); return;
      }
      this.running = true; this.last = performance.now();
      const tick = now => {
        if (!this.running) return;
        const time = this.time + (now - this.last) / 1000 * this.rate; this.last = now;
        if (time >= this.plan.duration) this.running = false;
        this.render(time);
        if (this.running) this.frame = requestAnimationFrame(tick);
      };
      this.render(this.time); this.frame = requestAnimationFrame(tick);
    }
    pause() { this.running = false; cancelAnimationFrame(this.frame); this.frame = null; this.render(this.time); }
    seek(time) { this.pause(); this.started = true; this.render(time); }
    setRate(rate) { require([.5, 1, 1.5, 2].includes(rate), 'INVALID_PLAYBACK_RATE'); this.rate = rate; }
    destroy() {
      this.running = false; cancelAnimationFrame(this.frame); this.layer.remove();
      for (const node of this.entities.values()) node.classList.remove('flow-active', 'flow-reached', 'flow-gap');
    }
  }
  const api = {plan, route, sphereMarkup, Player};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SideFXCircuitFlow = api;
})(typeof window !== 'undefined' ? window : globalThis);
