/**
 * Deterministic circuit geometry — §12.3.
 *
 * The same graph always produces the same coordinates: layout is a pure function of the
 * projection, so base and enhanced renderings, exports and tests all agree on IDs, topology and
 * geometry. Nothing here consults the viewport.
 *
 * The layout reads as a circuit/blueprint, not a list:
 *   - ranks are altitude bands (scenario -> mechanic -> provider -> physical) raised by the
 *     longest forward path from the roots;
 *   - siblings of one rank sit side by side in lanes, wrapping into rows so the drawing stays
 *     bounded; each node is pulled toward its parents' centres;
 *   - selection/broadcast splits and joins are drawn as bus channels with junction dots;
 *   - return/recurrence routes are loop-backs around the outside of the drawing;
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
const ROW_GAP_Y = 30;
const RANK_GAP_Y = 62;
const TOP_MARGIN = 20;
const SIDE_MARGIN = 30;
/** Most siblings drawn side by side in one row before a rank wraps. */
const MAX_LANES = 6;
/** Vertical separation between the staggered channels of one split/join bus. */
const CHANNEL_STEP = 8;
const CHANNEL_CLEARANCE = 16;
const LOOP_RAIL_GAP = 30;
const LOOP_RAIL_STEP = 10;
const CORNER_RADIUS = 9;
/** Characters per line for the drawn plate; wider than the raw word wrap so labels fit lanes. */
const NODE_WRAP_AT = 20;
/** Characters per line for the declared label (the lossless wrap used by the text surface). */
const WRAP_AT = 54;

/** Altitude bands: lower flows downward. The band is a floor; longest path may deepen it. */
const BAND = {
  INPUT: 0,
  SCENARIO: 0,
  EVENT: 1,
  MECHANIC: 1,
  UNRESOLVED: 1,
  RESPONSIBILITY: 2,
  PROVIDER_SLOT: 2,
  PROVIDER: 2,
  OUTCOME: 3,
  PHYSICAL: 3,
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

function bandFor(primitive) {
  return BAND[primitive] ?? 1;
}

const LOOP_KINDS = new Set(['return', 'recurrence']);

/**
 * Rank assignment: altitude band floor, raised by the longest forward path. Edges pointing up a
 * band, routes the engine declares as return/recurrence, and edges that close a same-band cycle
 * are loop-backs; they never carry rank.
 */
function rankNodes(order, bands, edges) {
  const back = new Set();
  const forward = [];
  const outgoing = new Map();
  const incoming = new Map();
  const push = (map, key, value) => map.set(key, [...(map.get(key) ?? []), value]);
  for (const edge of edges) {
    if (!bands.has(edge.from) || !bands.has(edge.to)) continue;
    if (
      edge.from === edge.to ||
      LOOP_KINDS.has(edge.kind) ||
      bands.get(edge.from) > bands.get(edge.to)
    ) {
      back.add(edge.id);
      continue;
    }
    forward.push(edge);
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

function chunkRows(ids) {
  if (ids.length <= MAX_LANES) return [ids];
  const rowCount = Math.ceil(ids.length / MAX_LANES);
  const perRow = Math.ceil(ids.length / rowCount);
  const rows = [];
  for (let start = 0; start < ids.length; start += perRow) rows.push(ids.slice(start, start + perRow));
  return rows;
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

/**
 * @param {{ nodes: { id: string, label: string, primitive: string }[], edges: { id: string, from: string, to: string, kind?: string | null }[] }} circuit
 */
export function layoutCircuit(circuit) {
  const declared = new Map(circuit.nodes.map((node, index) => [node.id, index]));
  const bands = new Map(circuit.nodes.map((node) => [node.id, bandFor(node.primitive)]));
  const edges = circuit.edges.filter((edge) => declared.has(edge.from) && declared.has(edge.to));
  const { rank, back, incoming, outgoing } = rankNodes(circuit.nodes.map((node) => node.id), bands, edges);
  const directed = (side, id) => (side === 'in' ? incoming.get(id) ?? [] : outgoing.get(id) ?? [])
    .filter((edge) => !back.has(edge.id))
    .map((edge) => (side === 'in' ? edge.from : edge.to));

  const prefix = commonLabelPrefix(circuit.nodes.map((node) => node.label));
  const measured = new Map();
  for (const node of circuit.nodes) {
    measured.set(node.id, {
      lines: wrapLabel(node.label),
      displayLines: wrapDisplay(displayLabel(node.label, prefix), NODE_WRAP_AT),
    });
  }

  const rankIds = new Map();
  for (const node of circuit.nodes) {
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
  const rowsByRank = new Map(rankValues.map((value) => [value, chunkRows(rankIds.get(value) ?? [])]));

  const nodeHeight = (id) => {
    const { displayLines } = measured.get(id);
    return NODE_PADDING_Y * 2 + LABEL_LINE_HEIGHT + displayLines.length * LINE_HEIGHT;
  };
  const rowWidth = (row) => row.length * NODE_WIDTH + (row.length - 1) * NODE_GAP_X;

  let viewWidth = MIN_VIEW_WIDTH;
  for (const value of rankValues) {
    for (const row of rowsByRank.get(value) ?? []) viewWidth = Math.max(viewWidth, rowWidth(row) + SIDE_MARGIN * 2);
  }

  // Place ranks top to bottom; each node is pulled toward its forward parents and packed so
  // siblings never collide.
  const boxes = new Map();
  let cursorY = TOP_MARGIN;
  for (const value of rankValues) {
    const rows = rowsByRank.get(value) ?? [];
    const rowHeights = rows.map((row) => Math.max(...row.map(nodeHeight)));
    let rowTop = cursorY;
    rows.forEach((row, rowIndex) => {
      let cursorX = (viewWidth - rowWidth(row)) / 2;
      row.forEach((id, column) => {
        const height = nodeHeight(id);
        const y = rowTop + (rowHeights[rowIndex] - height);
        const anchors = directed('in', id).filter((parent) => boxes.has(parent)).map((parent) => boxes.get(parent).x + NODE_WIDTH / 2);
        const anchor = anchors.length > 0 ? anchors.reduce((sum, x) => sum + x, 0) / anchors.length : cursorX + NODE_WIDTH / 2;
        const x = Math.max(Math.max(anchor - NODE_WIDTH / 2, SIDE_MARGIN), cursorX);
        boxes.set(id, { id, x, y, width: NODE_WIDTH, height, rank: value, row: rowIndex, column });
        cursorX = x + NODE_WIDTH + NODE_GAP_X;
      });
      rowTop += rowHeights[rowIndex] + ROW_GAP_Y;
    });
    cursorY = rowTop - ROW_GAP_Y + RANK_GAP_Y;
  }

  // How many loop-back rails sit outside the drawing on each side.
  const loopEdges = edges.filter((edge) => back.has(edge.id));
  const loopRails = new Map();
  const loopSideCount = { left: 0, right: 0 };
  const loopInCount = new Map();
  for (const edge of loopEdges) {
    const from = boxes.get(edge.from);
    const to = boxes.get(edge.to);
    if (!from || !to) continue;
    const side = to.x + to.width / 2 <= from.x + from.width / 2 ? 'left' : 'right';
    loopRails.set(edge.id, { side, index: loopSideCount[side] });
    loopSideCount[side] += 1;
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
  for (const box of boxes.values()) {
    minX = Math.min(minX, box.x);
    maxX = Math.max(maxX, box.x + box.width);
    maxY = Math.max(maxY, box.y + box.height);
  }
  const leftPad = SIDE_MARGIN + (loopSideCount.left > 0 ? LOOP_RAIL_GAP + (loopSideCount.left - 1) * LOOP_RAIL_STEP : 0);
  const rightPad = SIDE_MARGIN + (loopSideCount.right > 0 ? LOOP_RAIL_GAP + (loopSideCount.right - 1) * LOOP_RAIL_STEP : 0);
  const shiftX = leftPad - minX;
  for (const box of boxes.values()) box.x += shiftX;
  const width = Math.max(MIN_VIEW_WIDTH, maxX + shiftX + rightPad);
  const height = maxY + TOP_MARGIN + RANK_GAP_Y;

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
    if (isBack) {
      const rail = loopRails.get(edge.id);
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
    } else {
      const sameRank = (rank.get(edge.from) ?? 0) === (rank.get(edge.to) ?? 0);
      const below = from.y + from.height;
      const above = to.y;
      let channel;
      if (sameRank) {
        channel = (to.y >= below ? below : Math.max(below, to.y + to.height)) + CHANNEL_CLEARANCE;
      } else {
        const outlets = outChannel.get(edge.from)?.size ?? 0;
        const inlets = inChannel.get(edge.to)?.size ?? 0;
        if (outlets > 1) {
          channel = below + CHANNEL_CLEARANCE + (outChannel.get(edge.from)?.get(edge.id) ?? 0) * CHANNEL_STEP;
        } else if (inlets > 1) {
          channel = above - CHANNEL_CLEARANCE - (inlets - 1 - (inChannel.get(edge.to)?.get(edge.id) ?? 0)) * CHANNEL_STEP;
        } else {
          channel = below + (above - below) / 2;
        }
        if (channel <= below + 6) channel = below + 6;
        if (channel >= above - 6) channel = Math.max(below + 6, (below + above) / 2);
      }
      const start = { x: from.x + from.width / 2, y: below };
      const end = { x: to.x + to.width / 2, y: above };
      points.push(start, { x: start.x, y: channel }, { x: end.x, y: channel }, end);
      if ((outChannel.get(edge.from)?.size ?? 0) > 1) {
        const index = outChannel.get(edge.from)?.get(edge.id) ?? 0;
        if (index < (outChannel.get(edge.from)?.size ?? 1) - 1) junctions.push({ x: start.x, y: channel });
      }
      if ((inChannel.get(edge.to)?.size ?? 0) > 1) {
        const index = inChannel.get(edge.to)?.get(edge.id) ?? 0;
        if (index < (inChannel.get(edge.to)?.size ?? 1) - 1) junctions.push({ x: end.x, y: channel });
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
      };
    })
    .sort((a, b) => a.rank - b.rank || a.y - b.y || a.x - b.x || (declared.get(a.id) ?? 0) - (declared.get(b.id) ?? 0));

  const nodeById = Object.fromEntries(nodes.map((node) => [node.id, node]));
  return { width, height, nodes, edges: laidOutEdges, nodeById };
}
