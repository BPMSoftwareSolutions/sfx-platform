/**
 * Deterministic circuit geometry — §12.3.
 *
 * The same graph always produces the same coordinates: layout is a pure function of the
 * projection, so base and enhanced renderings, exports and tests all agree on IDs, topology and
 * geometry. Nothing here consults the viewport.
 *
 * This is plain JavaScript so the geometry can be exercised directly by the test runner without
 * a build step; `layout.ts` re-exports it with the project's types.
 */

export const VIEW_WIDTH = 720;
const NODE_X = 96;
const NODE_WIDTH = VIEW_WIDTH - NODE_X - 24;
const NODE_PADDING_Y = 14;
const LINE_HEIGHT = 19;
const LABEL_LINE_HEIGHT = 15;
const NODE_GAP = 34;
const TOP_MARGIN = 16;
/** Characters per line at the rendered font size; fixed so wrapping is deterministic. */
const WRAP_AT = 54;

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
 * @param {{ nodes: { id: string, label: string, primitive: string }[], edges: { id: string, from: string, to: string }[] }} circuit
 */
export function layoutCircuit(circuit) {
  const nodes = [];
  let cursorY = TOP_MARGIN;

  for (const node of circuit.nodes) {
    const lines = wrapLabel(node.label);
    // Node height: the primitive label line plus every wrapped content line.
    const height = NODE_PADDING_Y * 2 + LABEL_LINE_HEIGHT + lines.length * LINE_HEIGHT;
    nodes.push({ id: node.id, x: NODE_X, y: cursorY, width: NODE_WIDTH, height, lines });
    cursorY += height + NODE_GAP;
  }

  const nodeById = Object.fromEntries(nodes.map((n) => [n.id, n]));

  const edges = circuit.edges.flatMap((edge) => {
    const from = nodeById[edge.from];
    const to = nodeById[edge.to];
    // An edge whose endpoints do not both resolve is dropped rather than drawn to nowhere.
    if (!from || !to) return [];
    const railX = NODE_X - 40;
    const startY = from.y + from.height;
    const endY = to.y;
    const path = [
      `M ${NODE_X} ${startY - 12}`,
      `L ${railX} ${startY - 12}`,
      `L ${railX} ${endY + 12}`,
      `L ${NODE_X} ${endY + 12}`,
    ].join(' ');
    return [{ id: edge.id, from: edge.from, to: edge.to, path, midpoint: { x: railX, y: (startY + endY) / 2 } }];
  });

  const last = nodes[nodes.length - 1];
  const height = last ? last.y + last.height + TOP_MARGIN : TOP_MARGIN * 2;

  return { width: VIEW_WIDTH, height, nodes, edges, nodeById };
}
