/**
 * Deterministic circuit geometry — §12.3.
 *
 * The same graph always produces the same coordinates: layout is a pure function of the
 * projection, so base and enhanced renderings, exports and tests all agree on IDs, topology and
 * geometry. Nothing here consults the viewport.
 *
 * The layout reads as a top-to-bottom flow, not a list:
 *   - rank is the declared operation order (the `sequence` routes and the declared operation
 *     list), raised below the declared-context floor by the longest forward declared route, so a
 *     serial operation chain descends one rank per operation and is never split into parallel
 *     lanes. A material never orders the drawing (`obs` §4: materials follow component meaning,
 *     they do not determine causal order or altitude);
 *   - parallel siblings share a rank and are drawn side by side as branch rails — a rank never
 *     wraps into stacked sub-rows; each node is pulled toward its parents' centres;
 *   - a split draws one shared branch rail with a junction dot at every tap; a join converges on
 *     one shared merge rail with a junction dot where the later routes land;
 *   - a composite whose drawn children are also drawn is a container: a frame with a header band
 *     around its children, so containment is drawn, never inferred from the label;
 *   - return/recurrence routes that point back up the flow (and same-context cycles) are
 *     loop-backs around the outside of the drawing; a loop into a container merges under the
 *     frame;
 *   - routes are orthogonal with rounded corners, so crossings read as traces.
 *
 * This is plain JavaScript so the geometry can be exercised directly by the test runner without
 * a build step; `layout.ts` re-exports it with the project's types.
 */

export const VIEW_WIDTH = 720;
const MIN_VIEW_WIDTH = VIEW_WIDTH;
const NODE_WIDTH = 212;
const NODE_PADDING_Y = 14;
const LINE_HEIGHT = 19;
const LABEL_LINE_HEIGHT = 15;
const NODE_GAP_X = 26;
const RANK_GAP_Y = 62;
const TOP_MARGIN = 20;
const SIDE_MARGIN = 30;
/** Clearance between a source's outlet and the shared horizontal rail of a split. */
const BUS_CLEARANCE = 18;
/** Clearance between a shared merge rail and its target's inlet. */
const JOIN_CLEARANCE = 18;
/** Frame padding around a container's children and below them. */
const FRAME_PAD = 18;
/** Container header band; the label and material live here, clear of the children. */
const FRAME_HEADER = 34;
/** Space between the header's outlet and the first child rank, for the split rail. */
const FRAME_RAIL = 44;
/** Clearance between a routing channel, a shared rail or a loop rail and the boxes it passes. */
const CHANNEL_CLEARANCE = 16;
const LOOP_RAIL_GAP = 30;
const LOOP_RAIL_STEP = 10;
const CORNER_RADIUS = 9;
/** Characters per line for the drawn plate; wider than the raw word wrap so labels fit lanes. */
const NODE_WRAP_AT = 20;
/** Characters per line for the declared label (the lossless wrap used by the text surface). */
const WRAP_AT = 54;

/**
 * Rank floors by declared context — §12.3. The engine's own altitude is the only floor:
 *
 *   scenario/input (0) -> event/mechanic (1) -> responsibility (2) -> provider/effect (3) -> outcome (4)
 *
 * The floor is a minimum, not an order: the longest forward declared route always deepens a cell
 * below it, so the declared operation chain descends one rank per operation. A resolved material
 * is never consulted here — a plate cannot raise, lower or reorder a declared route.
 */
const BAND = {
  INPUT: 0,
  SCENARIO: 0,
  EVENT: 1,
  MECHANIC: 1,
  UNRESOLVED: 1,
  RESPONSIBILITY: 2,
  PROVIDER_SLOT: 3,
  PROVIDER: 3,
  PHYSICAL: 3,
  OUTCOME: 4,
};

/**
 * Greedy word wrap at a fixed column. Deterministic for a given string, and lossless: joining
 * the returned lines with a single space reproduces the input.
 *
 * @param {string} text
 * @param {number} [columns]
 * @returns {string[]}
 */
export function wrapLabel(text, columns = WRAP_AT) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > columns && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Display wrap: like `wrapLabel`, but a token longer than the column is hard-split instead of
 * overflowing, so a compact plate stays readable. Presentation only; the declared label keeps
 * its lossless wrap in `lines`.
 */
function wrapDisplay(text, columns) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines = [];
  let line = '';
  for (const word of words) {
    let rest = word;
    if (line && line.length + 1 + rest.length > columns) {
      lines.push(line);
      line = '';
    }
    while (rest.length > columns) {
      if (line) {
        lines.push(line);
        line = '';
      }
      lines.push(rest.slice(0, columns));
      rest = rest.slice(columns);
    }
    line = line ? `${line} ${rest}` : rest;
  }
  if (line) lines.push(line);
  return lines;
}

function commonLabelPrefix(labels) {
  if (labels.length < 2) return '';
  let prefix = labels[0];
  for (const label of labels) {
    while (prefix && !label.startsWith(prefix)) prefix = prefix.slice(0, -1);
    if (!prefix) return '';
  }
  return prefix;
}

function displayLabel(label, prefix) {
  if (!prefix) return label;
  const stripped = label.slice(prefix.length).replace(/^[\s.\u00b7:\-/#]+/, '').trim();
  return stripped.length >= 6 ? stripped : label;
}

function bandFor(node) {
  const primitive = node.primitive ?? 'UNRESOLVED';
  // The root context is fixed: a scenario closes its routes at the top even though its material
  // reads as the scenario outcome.
  if (primitive === 'SCENARIO' || primitive === 'INPUT') return 0;
  // Declared context alone sets the floor. The material is deliberately not read: geometry must
  // not decide meaning, and a material band would rank the drawing by a plate (review finding 8).
  return BAND[primitive] ?? 1;
}

/**
 * Rank assignment: declared-context floor, raised by the longest forward declared route. An edge
 * is forward when it descends or stays on its context — including a `sequence` between two
 * operations, which is exactly how declared operation order reaches the geometry — so the serial
 * chain deepens one rank per operation regardless of the plate each operation resolves. Only
 * edges that point back up a context, self-loops, and same-context cycles are loop-backs (a
 * composite `return` that closes after its members is forward); they never carry rank.
 */
function rankNodes(order, bands, edges) {
  const back = new Set();
  const outgoing = new Map();
  const incoming = new Map();
  const push = (map, key, value) => map.set(key, [...(map.get(key) ?? []), value]);
  for (const edge of edges) {
    if (!bands.has(edge.from) || !bands.has(edge.to)) continue;
    if (edge.from === edge.to || bands.get(edge.from) > bands.get(edge.to)) {
      back.add(edge.id);
      continue;
    }
    push(outgoing, edge.from, edge);
    push(incoming, edge.to, edge);
  }

  // Kahn order over the forward routes; a same-band cycle is broken at the least declared
  // un-settled node and its remaining incoming routes become loop-backs.
  const inDegree = new Map(order.map((id) => [id, (incoming.get(id) ?? []).length]));
  const ready = order.filter((id) => inDegree.get(id) === 0);
  const settled = new Set();
  const topo = [];
  while (settled.size < order.length) {
    let pick = ready.shift();
    if (pick === undefined) {
      pick = order.find((id) => !settled.has(id));
      for (const edge of incoming.get(pick) ?? []) {
        if (!settled.has(edge.from)) {
          back.add(edge.id);
          inDegree.set(pick, (inDegree.get(pick) ?? 1) - 1);
        }
      }
    }
    if (settled.has(pick)) continue;
    settled.add(pick);
    topo.push(pick);
    for (const edge of outgoing.get(pick) ?? []) {
      inDegree.set(edge.to, (inDegree.get(edge.to) ?? 1) - 1);
      if ((inDegree.get(edge.to) ?? 0) <= 0 && !settled.has(edge.to) && !ready.includes(edge.to)) {
        ready.push(edge.to);
      }
    }
  }

  const rank = new Map();
  for (const id of topo) {
    let value = bands.get(id);
    for (const edge of incoming.get(id) ?? []) {
      if (back.has(edge.id)) continue;
      value = Math.max(value, (rank.get(edge.from) ?? 0) + 1);
    }
    rank.set(id, value);
  }
  return { rank, back, incoming, outgoing };
}

/** Stable barycenter ordering within a rank, read from the adjacent ranks. */
function orderRank(rankIds, declared, directed, orderOf, direction) {
  const keyed = rankIds.map((id, index) => {
    const neighbours = directed(direction === 'down' ? 'in' : 'out', id);
    const indexes = neighbours
      .map((other) => orderOf.get(other))
      .filter((value) => value !== undefined);
    const barycenter = indexes.length > 0 ? indexes.reduce((sum, value) => sum + value, 0) / indexes.length : orderOf.get(id) ?? index;
    return { id, barycenter, declared: declared.get(id) ?? 0 };
  });
  keyed.sort((a, b) => a.barycenter - b.barycenter || a.declared - b.declared);
  return keyed.map((entry) => entry.id);
}

function roundedPath(points, radius = CORNER_RADIUS) {
  const deduped = points.filter((point, index) => {
    if (index === 0) return true;
    const previous = points[index - 1];
    return point.x !== previous.x || point.y !== previous.y;
  });
  if (deduped.length < 2) return `M ${deduped[0]?.x ?? 0} ${deduped[0]?.y ?? 0}`;
  const parts = [`M ${deduped[0].x} ${deduped[0].y}`];
  for (let index = 1; index < deduped.length - 1; index += 1) {
    const previous = deduped[index - 1];
    const point = deduped[index];
    const next = deduped[index + 1];
    const inLength = Math.hypot(point.x - previous.x, point.y - previous.y);
    const outLength = Math.hypot(next.x - point.x, next.y - point.y);
    const r = Math.min(radius, inLength / 2, outLength / 2);
    if (r < 1) {
      parts.push(`L ${point.x} ${point.y}`);
      continue;
    }
    const entry = {
      x: point.x + ((previous.x - point.x) / inLength) * r,
      y: point.y + ((previous.y - point.y) / inLength) * r,
    };
    const exit = {
      x: point.x + ((next.x - point.x) / outLength) * r,
      y: point.y + ((next.y - point.y) / outLength) * r,
    };
    parts.push(`L ${entry.x.toFixed(2)} ${entry.y.toFixed(2)}`);
    parts.push(`Q ${point.x} ${point.y} ${exit.x.toFixed(2)} ${exit.y.toFixed(2)}`);
  }
  const last = deduped[deduped.length - 1];
  parts.push(`L ${last.x} ${last.y}`);
  return parts.join(' ');
}

function polylineMidpoint(points) {
  const lengths = [];
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const length = Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y);
    lengths.push(length);
    total += length;
  }
  let remaining = total / 2;
  for (let index = 1; index < points.length; index += 1) {
    if (remaining <= lengths[index - 1] || index === points.length - 1) {
      const ratio = lengths[index - 1] > 0 ? remaining / lengths[index - 1] : 0;
      return {
        x: points[index - 1].x + (points[index].x - points[index - 1].x) * ratio,
        y: points[index - 1].y + (points[index].y - points[index - 1].y) * ratio,
      };
    }
    remaining -= lengths[index - 1];
  }
  return points[0];
}

/** Rank of one container in the containment forest, for innermost-first frame placement. */
function containmentDepth(id, byId, cache) {
  const cached = cache.get(id);
  if (cached !== undefined) return cached;
  const parent = byId.get(id)?.parent ?? null;
  const value = parent && byId.has(parent) ? containmentDepth(parent, byId, cache) + 1 : 0;
  cache.set(id, value);
  return value;
}

/**
 * @param {{ nodes: { id: string, label: string, primitive: string, material?: string, container?: boolean, parent?: string | null }[], edges: { id: string, from: string, to: string, kind?: string | null }[] }} circuit
 */
export function layoutCircuit(circuit) {
  const declared = new Map(circuit.nodes.map((node, index) => [node.id, index]));
  const bands = new Map(circuit.nodes.map((node) => [node.id, bandFor(node)]));
  const edges = circuit.edges.filter((edge) => declared.has(edge.from) && declared.has(edge.to));
  const { rank, back, incoming, outgoing } = rankNodes(circuit.nodes.map((node) => node.id), bands, edges);
  const directed = (side, id) => (side === 'in' ? incoming.get(id) ?? [] : outgoing.get(id) ?? [])
    .filter((edge) => !back.has(edge.id))
    .map((edge) => (side === 'in' ? edge.from : edge.to));

  // Containment: a drawn composite's nearest drawn children. A container with two or more drawn
  // children is drawn as a frame around them; a chain of single children stays a chain rather
  // than five nested borders.
  const childrenByParent = new Map();
  for (const node of circuit.nodes) {
    if (!node.parent || !declared.has(node.parent)) continue;
    childrenByParent.set(node.parent, [...(childrenByParent.get(node.parent) ?? []), node.id]);
  }
  const descendantCache = new Map();
  const descendantsOf = (id) => {
    const cached = descendantCache.get(id);
    if (cached) return cached;
    const result = [];
    for (const childId of childrenByParent.get(id) ?? []) {
      result.push(childId, ...descendantsOf(childId));
    }
    descendantCache.set(id, result);
    return result;
  };
  const containers = new Set();
  const containerChildIds = new Map();
  for (const node of circuit.nodes) {
    const children = childrenByParent.get(node.id) ?? [];
    if (node.container && descendantsOf(node.id).length >= 2) {
      containers.add(node.id);
      containerChildIds.set(node.id, children);
    }
  }
  const byId = new Map(circuit.nodes.map((node) => [node.id, node]));
  const depthCache = new Map();
  const frameOrder = [...containers].sort(
    (a, b) =>
      containmentDepth(b, byId, depthCache) - containmentDepth(a, byId, depthCache) ||
      (declared.get(a) ?? 0) - (declared.get(b) ?? 0)
  );

  const prefix = commonLabelPrefix(circuit.nodes.map((node) => node.label));
  const measured = new Map();
  for (const node of circuit.nodes) {
    measured.set(node.id, {
      lines: wrapLabel(node.label),
      displayLines: wrapDisplay(displayLabel(node.label, prefix), NODE_WRAP_AT),
    });
  }

  // Lane ranks hold the leaves; a container frame is placed around its children afterwards.
  const rankIds = new Map();
  for (const node of circuit.nodes) {
    if (containers.has(node.id)) continue;
    const value = rank.get(node.id) ?? 0;
    rankIds.set(value, [...(rankIds.get(value) ?? []), node.id]);
  }
  const rankValues = [...rankIds.keys()].sort((a, b) => a - b);

  // Barycenter sweeps order siblings, then rows wrap so the drawing stays bounded.
  const orderOf = new Map(circuit.nodes.map((node, index) => [node.id, index]));
  for (let pass = 0; pass < 4; pass += 1) {
    const sweep = pass % 2 === 0 ? rankValues : [...rankValues].reverse();
    for (const value of sweep) {
      const ids = rankIds.get(value) ?? [];
      const ordered = orderRank(ids, declared, directed, orderOf, pass % 2 === 0 ? 'down' : 'up');
      rankIds.set(value, ordered);
      ordered.forEach((id, index) => orderOf.set(id, index));
    }
  }
  const nodeHeight = (id) => {
    const { displayLines } = measured.get(id);
    return NODE_PADDING_Y * 2 + LABEL_LINE_HEIGHT + displayLines.length * LINE_HEIGHT;
  };
  const rowWidth = (row) => row.length * NODE_WIDTH + (row.length - 1) * NODE_GAP_X;

  let viewWidth = MIN_VIEW_WIDTH;
  for (const value of rankValues) {
    viewWidth = Math.max(viewWidth, rowWidth(rankIds.get(value) ?? []) + SIDE_MARGIN * 2);
  }

  // Place ranks top to bottom. A rank is one lane row: the row is centred as a block under its
  // forward parents' preferred positions and clamped inside the drawing, so parallel paths stay
  // side by side under the node that branches them and the drawing widens (the surface scrolls)
  // instead of stacking sub-rows that break the downward flow. Empty ranks leave no hole: a
  // container's children start at the top of the lane area and the frame wraps them.
  const boxes = new Map();
  let cursorY = TOP_MARGIN;
  for (const value of rankValues) {
    const row = rankIds.get(value) ?? [];
    if (row.length === 0) continue;
    const rowHeight = Math.max(...row.map(nodeHeight));
    const rowW = rowWidth(row);
    const preferred = row.map((id) => {
      const anchors = directed('in', id)
        .filter((parent) => boxes.has(parent))
        .map((parent) => boxes.get(parent).x + NODE_WIDTH / 2);
      return anchors.length > 0 ? anchors.reduce((sum, x) => sum + x, 0) / anchors.length : viewWidth / 2;
    });
    const blockCenter = preferred.reduce((sum, x) => sum + x, 0) / (preferred.length || 1);
    const maxStart = Math.max(SIDE_MARGIN, viewWidth - SIDE_MARGIN - rowW);
    const startX = Math.min(Math.max(blockCenter - rowW / 2, SIDE_MARGIN), maxStart);
    row.forEach((id, column) => {
      const height = nodeHeight(id);
      const y = cursorY + (rowHeight - height);
      const x = startX + column * (NODE_WIDTH + NODE_GAP_X);
      boxes.set(id, { id, x, y, width: NODE_WIDTH, height, rank: value, row: 0, column, container: false, headerHeight: 0 });
    });
    cursorY += rowHeight + RANK_GAP_Y;
  }

  // Container frames, innermost first: wrap the union of the direct drawn children, then pull the
  // subtree down if the frame would start above the drawing.
  const shiftSubtree = (id, dy) => {
    const box = boxes.get(id);
    if (box) box.y += dy;
    for (const childId of childrenByParent.get(id) ?? []) shiftSubtree(childId, dy);
  };
  for (const id of frameOrder) {
    const descendantIds = descendantsOf(id);
    const members = descendantIds.map((childId) => boxes.get(childId)).filter(Boolean);
    if (members.length === 0) continue;
    const minX = Math.min(...members.map((member) => member.x));
    const maxX = Math.max(...members.map((member) => member.x + member.width));
    const minY = Math.min(...members.map((member) => member.y));
    let maxY = Math.max(...members.map((member) => member.y + member.height));
    let y = minY - FRAME_HEADER - FRAME_RAIL;
    const dy = y < TOP_MARGIN ? TOP_MARGIN - y : 0;
    if (dy > 0) {
      for (const childId of childrenByParent.get(id) ?? []) shiftSubtree(childId, dy);
      maxY += dy;
    }
    y += dy;
    boxes.set(id, {
      id,
      x: minX - FRAME_PAD,
      y,
      width: maxX - minX + FRAME_PAD * 2,
      height: maxY - y + FRAME_PAD,
      rank: rank.get(id) ?? 0,
      row: 0,
      column: 0,
      container: true,
      headerHeight: FRAME_HEADER,
      containerChildIds: containerChildIds.get(id),
    });
  }

  // How many loop-back rails sit outside the drawing on each side, and how many loops merge
  // under each container.
  const loopEdges = edges.filter((edge) => back.has(edge.id));
  const loopRails = new Map();
  const loopSideCount = { left: 0, right: 0, under: 0 };
  const loopInCount = new Map();
  for (const edge of loopEdges) {
    const from = boxes.get(edge.from);
    const to = boxes.get(edge.to);
    if (!from || !to) continue;
    if (to.container) {
      loopRails.set(edge.id, { under: true, index: loopSideCount.under });
      loopSideCount.under += 1;
    } else {
      const side = to.x + to.width / 2 <= from.x + from.width / 2 ? 'left' : 'right';
      loopRails.set(edge.id, { side, index: loopSideCount[side] });
      loopSideCount[side] += 1;
    }
    loopInCount.set(edge.to, (loopInCount.get(edge.to) ?? 0) + 1);
  }
  const entering = new Map();
  for (const edge of loopEdges) {
    const rail = loopRails.get(edge.id);
    if (!rail) continue;
    rail.entering = entering.get(edge.to) ?? 0;
    entering.set(edge.to, rail.entering + 1);
  }

  // Final bounds pass: reserve the loop rails and keep the side margins.
  let minX = Infinity;
  let maxX = -Infinity;
  let maxY = 0;
  let maxUnderY = 0;
  for (const box of boxes.values()) {
    minX = Math.min(minX, box.x);
    maxX = Math.max(maxX, box.x + box.width);
    maxY = Math.max(maxY, box.y + box.height);
  }
  for (const edge of loopEdges) {
    const rail = loopRails.get(edge.id);
    const to = boxes.get(edge.to);
    if (!rail || !to || !to.container) continue;
    maxUnderY = Math.max(maxUnderY, maxY + CHANNEL_CLEARANCE + (rail.entering ?? 0) * LOOP_RAIL_STEP);
  }
  const leftPad = SIDE_MARGIN + (loopSideCount.left > 0 ? LOOP_RAIL_GAP + (loopSideCount.left - 1) * LOOP_RAIL_STEP : 0);
  const rightPad = SIDE_MARGIN + (loopSideCount.right > 0 ? LOOP_RAIL_GAP + (loopSideCount.right - 1) * LOOP_RAIL_STEP : 0);
  const shiftX = leftPad - minX;
  for (const box of boxes.values()) box.x += shiftX;
  const width = Math.max(MIN_VIEW_WIDTH, maxX + shiftX + rightPad);
  const height = Math.max(maxY, maxUnderY) + TOP_MARGIN + RANK_GAP_Y;

  // Channel indexes per source (splits) and per target (joins), in declared route order.
  const outChannel = new Map();
  const inChannel = new Map();
  for (const edge of edges) {
    if (back.has(edge.id)) continue;
    if (!outChannel.has(edge.from)) outChannel.set(edge.from, new Map());
    outChannel.get(edge.from).set(edge.id, outChannel.get(edge.from).size);
    if (!inChannel.has(edge.to)) inChannel.set(edge.to, new Map());
    inChannel.get(edge.to).set(edge.id, inChannel.get(edge.to).size);
  }

  const laidOutEdges = [];
  for (const edge of edges) {
    const from = boxes.get(edge.from);
    const to = boxes.get(edge.to);
    if (!from || !to) continue;
    const points = [];
    const junctions = [];
    const isBack = back.has(edge.id);
    // A container's outlet is the bottom of its header band, so the route stays inside the frame.
    const outletY = from.container ? from.y + from.headerHeight : from.y + from.height;
    if (isBack) {
      const rail = loopRails.get(edge.id);
      const start = { x: from.x + from.width / 2, y: from.y + from.height };
      if (to.container) {
        // A composite closes after its members: the loop merges under the container's frame.
        const below = to.y + to.height;
        const entries = loopInCount.get(edge.to) ?? 1;
        const slot = rail?.entering ?? 0;
        const underY = below + CHANNEL_CLEARANCE + slot * LOOP_RAIL_STEP;
        const entryX = to.x + ((slot + 1) / (entries + 1)) * to.width;
        points.push(start, { x: start.x, y: underY }, { x: entryX, y: underY }, { x: entryX, y: below });
        junctions.push({ x: entryX, y: below });
      } else {
        const side = rail?.side ?? 'left';
        const railX =
          side === 'left'
            ? leftPad - LOOP_RAIL_GAP - (rail?.index ?? 0) * LOOP_RAIL_STEP
            : maxX + shiftX + LOOP_RAIL_GAP + (rail?.index ?? 0) * LOOP_RAIL_STEP;
        const exit = { x: side === 'left' ? from.x : from.x + from.width, y: from.y + from.height / 2 };
        const entries = loopInCount.get(edge.to) ?? 1;
        const offset = ((rail?.entering ?? 0) - (entries - 1) / 2) * 11;
        const entryY = Math.max(to.y + 10, Math.min(to.y + to.height - 10, to.y + to.height / 2 + offset));
        const entry = { x: side === 'left' ? to.x : to.x + to.width, y: entryY };
        points.push(exit, { x: railX, y: exit.y }, { x: railX, y: entryY }, entry);
        // A loop entry is a convergence point when other routes also arrive at this node.
        if (entries > 1 || (inChannel.get(edge.to)?.size ?? 0) > 0) junctions.push(entry);
      }
    } else {
      const sameRank = (rank.get(edge.from) ?? 0) === (rank.get(edge.to) ?? 0);
      const below = from.y + from.height;
      const above = to.y;
      const start = { x: from.x + from.width / 2, y: outletY };
      const end = { x: to.x + to.width / 2, y: above };
      const outlets = outChannel.get(edge.from)?.size ?? 0;
      const inlets = inChannel.get(edge.to)?.size ?? 0;
      if (sameRank) {
        const channel = (to.y >= below ? below : Math.max(below, to.y + to.height)) + CHANNEL_CLEARANCE;
        points.push(start, { x: start.x, y: channel }, { x: end.x, y: channel }, end);
        if (outlets > 1) {
          const index = outChannel.get(edge.from)?.get(edge.id) ?? 0;
          if (index < outlets - 1) junctions.push({ x: start.x, y: channel });
        }
        if (inlets > 1) {
          const index = inChannel.get(edge.to)?.get(edge.id) ?? 0;
          if (index < inlets - 1) junctions.push({ x: end.x, y: channel });
        }
      } else if (outlets > 1) {
        // One shared branch rail below the source; every drop leaves the same rail, and the rail
        // is drawn once as the overlapping horizontals of its routes.
        const busY = (from.container ? start.y : below) + BUS_CLEARANCE;
        points.push(start, { x: start.x, y: busY }, { x: end.x, y: busY }, end);
        const index = outChannel.get(edge.from)?.get(edge.id) ?? 0;
        if (index === 0) junctions.push({ x: start.x, y: busY });
        junctions.push({ x: end.x, y: busY });
      } else if (inlets > 1) {
        // One shared merge rail above the target; the first route drops the trunk to the target.
        const busY = above - JOIN_CLEARANCE;
        points.push(start, { x: start.x, y: busY }, { x: end.x, y: busY }, end);
        const index = inChannel.get(edge.to)?.get(edge.id) ?? 0;
        if (index > 0) junctions.push({ x: end.x, y: busY });
      } else {
        let channel = below + (above - below) / 2;
        if (channel <= below + 6) channel = below + 6;
        if (channel >= above - 6) channel = Math.max(below + 6, (below + above) / 2);
        points.push(start, { x: start.x, y: channel }, { x: end.x, y: channel }, end);
      }
    }
    laidOutEdges.push({
      id: edge.id,
      from: edge.from,
      to: edge.to,
      kind: edge.kind ?? null,
      back: isBack,
      path: roundedPath(points),
      midpoint: polylineMidpoint(points),
      junctions,
    });
  }

  const nodes = circuit.nodes
    .filter((node) => boxes.has(node.id))
    .map((node) => {
      const box = boxes.get(node.id);
      return {
        id: node.id,
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        lines: measured.get(node.id).lines,
        displayLines: measured.get(node.id).displayLines,
        rank: box.rank,
        row: box.row,
        column: box.column,
        container: box.container,
        headerHeight: box.headerHeight,
        containerChildIds: box.containerChildIds,
      };
    })
    .sort((a, b) => Number(b.container) - Number(a.container) || a.rank - b.rank || a.y - b.y || a.x - b.x || (declared.get(a.id) ?? 0) - (declared.get(b.id) ?? 0));

  const nodeById = Object.fromEntries(nodes.map((node) => [node.id, node]));
  return { width, height, nodes, edges: laidOutEdges, nodeById };
}

/** The camera window for live watching: a fixed-height frame around the active operation (M12). */
export const FOCUS_VIEW_HEIGHT = 760;

/**
 * The focused camera for live watching (M12): a viewport centred on one drawn node and clamped
 * to the drawing's bounds. The drawing itself is never trimmed — every node, route and id stays
 * laid out and bound — so following the active operation moves the camera, never the view or its
 * coverage (obs §3: a focused subgraph retains the altitude and reports coverage; a camera move
 * is not a projection). A node the layout does not carry returns `null`, so a caller falls back
 * to the full view rather than inventing a frame.
 *
 * @param {{ width: number, height: number, nodeById: Record<string, { x: number, y: number, width: number, height: number } | undefined> }} layout
 * @param {string} focusId
 * @param {number} [height]
 * @returns {{ x: number, y: number, width: number, height: number } | null}
 */
export function focusViewport(layout, focusId, height = FOCUS_VIEW_HEIGHT) {
  const box = layout?.nodeById?.[focusId];
  if (!box) return null;
  const width = Math.min(layout.width, VIEW_WIDTH);
  const viewHeight = Math.min(layout.height, height);
  const centreX = box.x + box.width / 2;
  const centreY = box.y + box.height / 2;
  const maxX = Math.max(0, layout.width - width);
  const maxY = Math.max(0, layout.height - viewHeight);
  return {
    x: Math.max(0, Math.min(Math.round(centreX - width / 2), maxX)),
    y: Math.max(0, Math.min(Math.round(centreY - viewHeight / 2), maxY)),
    width,
    height: viewHeight,
  };
}
