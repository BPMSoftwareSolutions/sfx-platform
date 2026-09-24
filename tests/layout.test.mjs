import assert from 'node:assert/strict';
import test from 'node:test';

import { focusViewport, layoutCircuit, wrapLabel } from '../components/circuit/geometry.js';

/**
 * Deterministic circuit geometry — §12.3, §12.6.
 *
 * The same graph must always produce the same coordinates, so base and enhanced renderings,
 * exports and comparisons all agree on IDs, topology and geometry.
 */

const circuit = {
  capabilityId: 'example-capability',
  scenarioId: 'example-scenario',
  nodes: [
    { id: 'input', primitive: 'INPUT', label: 'Quote request', sourceId: 'quote-request', state: {} },
    { id: 'event', primitive: 'EVENT', label: 'Quote requested', sourceId: 'quote-requested', state: {} },
    {
      id: 'responsibility',
      primitive: 'RESPONSIBILITY',
      label:
        'the requested company quote is retrieved from the selected provider and validated against the declared response contract before it is returned',
      sourceId: 'retrieve-quote',
      state: {},
    },
    { id: 'outcome', primitive: 'OUTCOME', label: 'Quote product', sourceId: 'quote-product', state: {} },
  ],
  edges: [
    { id: 'e1', from: 'input', to: 'event', family: 'PRODUCT_TRANSFER' },
    { id: 'e2', from: 'event', to: 'responsibility', family: 'EXECUTION' },
    { id: 'e3', from: 'responsibility', to: 'outcome', family: 'EXECUTION' },
  ],
};

test('layout is a pure function of the graph', () => {
  const first = layoutCircuit(circuit);
  const second = layoutCircuit(circuit);
  assert.deepEqual(first, second);
});

test('nodes never overlap vertically', () => {
  const { nodes } = layoutCircuit(circuit);
  for (let i = 1; i < nodes.length; i += 1) {
    const previous = nodes[i - 1];
    assert.ok(nodes[i].y > previous.y + previous.height, 'node boxes must not overlap');
  }
});

test('a long label grows its node instead of being truncated', () => {
  const { nodeById } = layoutCircuit(circuit);
  assert.ok(nodeById.responsibility.lines.length > 1, 'a long label must wrap onto several lines');
  assert.ok(
    nodeById.responsibility.height > nodeById.input.height,
    'a wrapped node must be taller than a single-line one',
  );
  const rejoined = nodeById.responsibility.lines.join(' ');
  assert.equal(rejoined, circuit.nodes[2].label, 'wrapping must preserve the label exactly');
});

test('wrapping is deterministic and lossless', () => {
  const text = 'the adapter receipt is bound to the record and verified against its declared contract';
  assert.deepEqual(wrapLabel(text, 20), wrapLabel(text, 20));
  assert.equal(wrapLabel(text, 20).join(' '), text);
  for (const line of wrapLabel(text, 20)) {
    // A single word longer than the column is allowed to overflow rather than be cut.
    assert.ok(line.length <= 20 || !line.includes(' '), `line exceeded the column: ${line}`);
  }
});

test('an edge with an unresolved endpoint is dropped rather than drawn to nowhere', () => {
  const broken = {
    ...circuit,
    edges: [...circuit.edges, { id: 'e4', from: 'outcome', to: 'missing-node', family: 'SUPPORT' }],
  };
  const { edges } = layoutCircuit(broken);
  assert.equal(edges.length, 3, 'the unresolved edge must not be laid out');
});

test('the viewport grows to contain every node', () => {
  const { height, nodes } = layoutCircuit(circuit);
  const last = nodes[nodes.length - 1];
  assert.ok(height >= last.y + last.height, 'the graph bounds must contain the last node');
});

/**
 * A branchy circuit: one scenario root fanning into three mechanics, a provider joined from two
 * of them, a recurrence loop and a return loop. The contract under test is the circuit shape:
 * ranks by altitude/flow, siblings side by side, splits and joins with junction dots, loop-backs
 * outside the drawing.
 */
const branched = {
  capabilityId: 'branchy',
  scenarioId: 'branchy',
  nodes: [
    { id: 'scenario', primitive: 'SCENARIO', label: 'Root scenario' },
    { id: 'm1', primitive: 'MECHANIC', label: 'First mechanic' },
    { id: 'm2', primitive: 'MECHANIC', label: 'Second mechanic' },
    { id: 'm3', primitive: 'MECHANIC', label: 'Third mechanic' },
    { id: 'p1', primitive: 'PROVIDER', label: 'Provider one' },
    { id: 'p2', primitive: 'PROVIDER', label: 'Provider two' },
  ],
  edges: [
    { id: 'e1', from: 'scenario', to: 'm1', family: 'EXECUTION', kind: 'sequence' },
    { id: 'e2', from: 'scenario', to: 'm2', family: 'EXECUTION', kind: 'selection' },
    { id: 'e3', from: 'scenario', to: 'm3', family: 'EXECUTION', kind: 'broadcast' },
    { id: 'e4', from: 'm1', to: 'p1', family: 'EXECUTION', kind: 'sequence' },
    { id: 'e5', from: 'm2', to: 'p1', family: 'EXECUTION', kind: 'join' },
    { id: 'e6', from: 'p1', to: 'm3', family: 'EXECUTION', kind: 'recurrence' },
    { id: 'e7', from: 'm3', to: 'scenario', family: 'EXECUTION', kind: 'return' },
  ],
};

test('ranks follow the declared context raised by the longest forward declared route', () => {
  const { nodeById } = layoutCircuit(branched);
  assert.equal(nodeById.scenario.rank, 0, 'the root/input context is the top floor');
  assert.equal(nodeById.m1.rank, 1, 'mechanics are the event context');
  assert.equal(nodeById.m2.rank, 1);
  assert.equal(nodeById.m3.rank, 1);
  assert.equal(nodeById.p1.rank, 3, 'providers are the provider/effect context');
  assert.equal(nodeById.p2.rank, 3);
});

test('a material never orders the drawing: only declared context and routes rank it', () => {
  const layered = {
    capabilityId: 'layered',
    scenarioId: 'layered',
    nodes: [
      { id: 'input', primitive: 'INPUT', material: 'input', label: 'Request' },
      { id: 'event', primitive: 'MECHANIC', material: 'event', label: 'Observed' },
      { id: 'validate', primitive: 'MECHANIC', material: 'validation', label: 'Validate' },
      { id: 'provider', primitive: 'PROVIDER', material: 'provider-port', label: 'Port' },
      { id: 'physical', primitive: 'PHYSICAL', material: 'provider', label: 'Fulfiller' },
      { id: 'outcome', primitive: 'OUTCOME', material: 'outcome', label: 'Result' },
      // A declared evidence material on a mechanic cell: the material must not lift its rank.
      { id: 'evidence', primitive: 'MECHANIC', material: 'evidence', label: 'Evidence' },
    ],
    edges: [
      { id: 'l1', from: 'input', to: 'event', family: 'EXECUTION', kind: 'sequence' },
      { id: 'l2', from: 'event', to: 'validate', family: 'EXECUTION', kind: 'sequence' },
      { id: 'l3', from: 'validate', to: 'provider', family: 'EXECUTION', kind: 'sequence' },
      { id: 'l4', from: 'provider', to: 'physical', family: 'EXECUTION', kind: 'sequence' },
      { id: 'l5', from: 'physical', to: 'outcome', family: 'EXECUTION', kind: 'sequence' },
    ],
  };
  const withoutMaterials = {
    ...layered,
    nodes: layered.nodes.map((node) => ({ id: node.id, primitive: node.primitive, label: node.label })),
  };
  const { nodeById } = layoutCircuit(layered);
  assert.deepEqual(
    layoutCircuit(layered),
    layoutCircuit(withoutMaterials),
    'the material tables must not reach the geometry (review finding 8)',
  );
  assert.equal(nodeById.input.rank, 0);
  assert.equal(nodeById.event.rank, 1);
  assert.equal(nodeById.validate.rank, 2);
  assert.equal(nodeById.provider.rank, 3, 'a provider context draws in provider/effect');
  assert.equal(nodeById.physical.rank, 4, 'the realized fulfiller descends below its provider');
  assert.equal(nodeById.outcome.rank, 5, 'the outcome closes the flow at the bottom');
  assert.equal(nodeById.evidence.rank, 1, 'an evidence material never lifts a mechanic out of its declared context');
});

test('a rank draws every parallel path side by side and never wraps into stacked rows', () => {
  const many = {
    capabilityId: 'many',
    scenarioId: 'many',
    nodes: [
      { id: 'root', primitive: 'SCENARIO', label: 'Root' },
      ...Array.from({ length: 8 }, (_, index) => ({
        id: `m${index}`,
        primitive: 'MECHANIC',
        material: 'event',
        label: `Operation ${index}`,
      })),
    ],
    edges: Array.from({ length: 8 }, (_, index) => ({
      id: `e${index}`,
      from: 'root',
      to: `m${index}`,
      family: 'EXECUTION',
      kind: 'sequence',
    })),
  };
  const { nodes, nodeById } = layoutCircuit(many);
  const siblings = nodes.filter((node) => node.rank === 1);
  assert.equal(siblings.length, 8);
  assert.equal(new Set(siblings.map((node) => node.y)).size, 1, 'one lane row per rank: all paths share y');
  assert.equal(new Set(siblings.map((node) => node.x)).size, 8, 'each parallel path keeps its own lane');
  for (const sibling of siblings) assert.equal(sibling.row, 0);
  assert.ok(nodeById.m7.y > nodeById.root.y, 'flow still descends');
});

test('siblings branch side by side instead of stacking into a list', () => {
  const { nodeById, nodes } = layoutCircuit(branched);
  const siblings = [nodeById.m1, nodeById.m2, nodeById.m3];
  assert.equal(new Set(siblings.map((node) => node.y)).size, 1, 'siblings share a rank row');
  assert.equal(new Set(siblings.map((node) => node.x)).size, 3, 'siblings occupy distinct lanes');
  const ranks = nodes.map((node) => node.rank);
  assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b), 'nodes are laid out rank by rank');
});

test('a split draws one shared branch rail with a junction dot at every tap', () => {
  const { edges } = layoutCircuit(branched);
  const fan = edges.filter((edge) => edge.from === 'scenario');
  assert.equal(fan.length, 3);
  const dots = fan.flatMap((edge) => edge.junctions);
  assert.equal(dots.length, 4, 'one trunk tap and three branch taps');
  assert.equal(new Set(dots.map((dot) => dot.y)).size, 1, 'every branch leaves one shared rail');
  assert.equal(fan.filter((edge) => edge.junctions.length >= 1).length, 3, 'every branch meets the rail');
  assert.ok(fan.some((edge) => edge.junctions.length === 2), 'the trunk and its own tap share the split point');
});

test('a join converges on one shared merge rail with a junction dot', () => {
  const { edges } = layoutCircuit(branched);
  const joined = edges.filter((edge) => edge.to === 'p1');
  assert.equal(joined.length, 2);
  const merged = joined.filter((edge) => edge.junctions.length === 1);
  assert.equal(merged.length, 1, 'the second route lands on the first route’s drop');
  const busY = merged[0].junctions[0].y;
  for (const edge of joined) {
    const ys = [...edge.path.matchAll(/[MLQ] [\d.-]+ ([\d.-]+)/g)].map((match) => Number(match[1]));
    assert.ok(ys.includes(busY), 'both routes share the merge rail y');
  }
});

test('recurrence and return routes render as loop-backs outside the node band', () => {
  const { edges, nodeById } = layoutCircuit(branched);
  const recurrence = edges.find((edge) => edge.id === 'e6');
  const returns = edges.find((edge) => edge.id === 'e7');
  assert.equal(recurrence.back, true);
  assert.equal(returns.back, true);
  assert.equal(edges.find((edge) => edge.id === 'e1').back, false);
  // The loop rail sits outside every node box.
  for (const edge of [recurrence, returns]) {
    const xs = [...edge.path.matchAll(/[MLQ] ([\d.-]+)/g)].map((match) => Number(match[1]));
    assert.ok(Math.min(...xs) < nodeById.scenario.x || Math.max(...xs) > nodeById.m3.x + nodeById.m3.width);
  }
});

test('a return that closes a composite after its members still descends, and only the upward close loops back', () => {
  const postOrder = {
    capabilityId: 'post-order',
    scenarioId: 'post-order',
    nodes: [
      { id: 'scenario', primitive: 'SCENARIO', material: 'outcome', label: 'Root' },
      { id: 'expression', primitive: 'MECHANIC', material: 'event', label: 'Expression' },
      { id: 'operation', primitive: 'MECHANIC', material: 'event', label: 'Operation' },
    ],
    edges: [
      { id: 'p1', from: 'scenario', to: 'expression', family: 'EXECUTION', kind: 'sequence' },
      { id: 'p2', from: 'expression', to: 'operation', family: 'EXECUTION', kind: 'return' },
      { id: 'p3', from: 'operation', to: 'scenario', family: 'EXECUTION', kind: 'return' },
    ],
  };
  const { nodeById, edges } = layoutCircuit(postOrder);
  assert.equal(nodeById.expression.rank, 1);
  assert.equal(nodeById.operation.rank, 2, 'the composite closes after its members (post-order)');
  assert.equal(edges.find((edge) => edge.id === 'p2').back, false, 'a descending return is the close-out, not a loop');
  assert.equal(edges.find((edge) => edge.id === 'p3').back, true, 'the upward close loops back to the root');
});

test('a provider leg reads provider -> physical -> composite return, the return looping back', () => {
  const leg = {
    capabilityId: 'provider-leg',
    scenarioId: 'provider-leg',
    nodes: [
      { id: 'operation', primitive: 'MECHANIC', material: 'provider-port', label: 'Exchange' },
      { id: 'port', primitive: 'PROVIDER', material: 'provider-port', label: 'Port' },
      { id: 'physical', primitive: 'PHYSICAL', material: 'provider', label: 'Fulfiller' },
    ],
    edges: [
      { id: 'g1', from: 'operation', to: 'port', family: 'EXECUTION', kind: 'sequence' },
      { id: 'g2', from: 'port', to: 'physical', family: 'EXECUTION', kind: 'sequence' },
      { id: 'g3', from: 'physical', to: 'operation', family: 'EXECUTION', kind: 'return' },
    ],
  };
  const { nodeById, edges } = layoutCircuit(leg);
  assert.ok(nodeById.operation.rank < nodeById.port.rank, 'the port descends from its operation');
  assert.ok(nodeById.port.rank < nodeById.physical.rank, 'the physical fulfiller descends from the port');
  assert.equal(edges.find((edge) => edge.id === 'g1').back, false);
  assert.equal(edges.find((edge) => edge.id === 'g2').back, false);
  assert.equal(edges.find((edge) => edge.id === 'g3').back, true, 'the return loops back to the composite');
});

test('a composite with drawn children is a container frame around them; a single-child chain is not', () => {
  const contained = {
    capabilityId: 'contained',
    scenarioId: 'contained',
    nodes: [
      { id: 'root', primitive: 'SCENARIO', material: 'outcome', label: 'Root', container: true },
      { id: 'a', primitive: 'MECHANIC', material: 'provider-port', label: 'Operation A', parent: 'root', container: true },
      { id: 'b', primitive: 'MECHANIC', material: 'provider-port', label: 'Operation B', parent: 'root', container: true },
      { id: 'ap', primitive: 'PROVIDER', material: 'provider', label: 'A fulfiller', parent: 'a' },
      { id: 'bp', primitive: 'PROVIDER', material: 'provider', label: 'B fulfiller', parent: 'b' },
    ],
    edges: [
      { id: 'r1', from: 'root', to: 'a', family: 'EXECUTION', kind: 'sequence' },
      { id: 'r2', from: 'root', to: 'b', family: 'EXECUTION', kind: 'sequence' },
      { id: 'a1', from: 'a', to: 'ap', family: 'EXECUTION', kind: 'sequence' },
      { id: 'b1', from: 'b', to: 'bp', family: 'EXECUTION', kind: 'sequence' },
    ],
  };
  const { nodeById, edges } = layoutCircuit(contained);
  assert.equal(nodeById.root.container, true, 'the root frames its two drawn children');
  assert.ok(nodeById.root.headerHeight > 0);
  for (const childId of ['a', 'b']) {
    const child = nodeById[childId];
    assert.ok(child.x >= nodeById.root.x && child.x + child.width <= nodeById.root.x + nodeById.root.width);
    assert.ok(child.y >= nodeById.root.y + nodeById.root.headerHeight);
    assert.ok(child.y + child.height <= nodeById.root.y + nodeById.root.height);
  }
  assert.equal(nodeById.a.container, false, 'a frame with one drawn child stays a chain');
  const outlet = edges.find((edge) => edge.id === 'r1').path.match(/^M ([\d.-]+) ([\d.-]+)/);
  assert.equal(Number(outlet[2]), nodeById.root.y + nodeById.root.headerHeight, 'a container routes out of its header');
});

test('a return into a container merges under its frame', () => {
  const contained = {
    capabilityId: 'return-to-container',
    scenarioId: 'return-to-container',
    nodes: [
      { id: 'root', primitive: 'SCENARIO', material: 'outcome', label: 'Root', container: true },
      { id: 'a', primitive: 'MECHANIC', material: 'provider-port', label: 'Operation A', parent: 'root' },
      { id: 'b', primitive: 'MECHANIC', material: 'provider-port', label: 'Operation B', parent: 'root' },
    ],
    edges: [
      { id: 'r1', from: 'root', to: 'a', family: 'EXECUTION', kind: 'sequence' },
      { id: 'r2', from: 'root', to: 'b', family: 'EXECUTION', kind: 'sequence' },
      { id: 'r3', from: 'a', to: 'root', family: 'EXECUTION', kind: 'return' },
    ],
  };
  const { nodeById, edges } = layoutCircuit(contained);
  const close = edges.find((edge) => edge.id === 'r3');
  assert.equal(close.back, true);
  assert.equal(close.junctions.length, 1);
  assert.equal(close.junctions[0].y, nodeById.root.y + nodeById.root.height, 'the loop merges on the frame bottom');
});

test('the drawing keeps every node inside its bounds', () => {
  const { width, height, nodes } = layoutCircuit(branched);
  for (const node of nodes) {
    assert.ok(node.x >= 0 && node.x + node.width <= width, `${node.id} stays inside the width`);
    assert.ok(node.y >= 0 && node.y + node.height <= height, `${node.id} stays inside the height`);
  }
});

test('a wide rank of parallel paths stays centred under its parent and inside the view', () => {
  const wide = {
    capabilityId: 'wide',
    scenarioId: 'wide',
    nodes: [
      { id: 'root', primitive: 'SCENARIO', label: 'Root' },
      ...Array.from({ length: 14 }, (_, index) => ({
        id: `branch${index}`,
        primitive: 'MECHANIC',
        material: 'event',
        label: `Branch ${index}`,
      })),
    ],
    edges: Array.from({ length: 14 }, (_, index) => ({
      id: `w${index}`,
      from: 'root',
      to: `branch${index}`,
      family: 'EXECUTION',
      kind: 'sequence',
    })),
  };
  const { width, nodes, nodeById } = layoutCircuit(wide);
  const centre = (node) => node.x + node.width / 2;
  const blockCentre = (nodes.reduce((sum, node) => sum + centre(node), 0)) / nodes.length;
  assert.ok(
    Math.abs(blockCentre - centre(nodeById.root)) < 1,
    'the branch block is centred under the root, not pushed off it',
  );
  for (const node of nodes) {
    assert.ok(node.x >= 0 && node.x + node.width <= width, `${node.id} stays inside the width`);
  }
});

test('a same-band chain of mechanics deepens through flow, not altitude alone', () => {
  const chained = {
    ...branched,
    nodes: [
      { id: 'scenario', primitive: 'SCENARIO', label: 'Root scenario' },
      { id: 'm1', primitive: 'MECHANIC', label: 'One' },
      { id: 'm2', primitive: 'MECHANIC', label: 'Two' },
      { id: 'm3', primitive: 'MECHANIC', label: 'Three' },
    ],
    edges: [
      { id: 'c1', from: 'scenario', to: 'm1', family: 'EXECUTION', kind: 'sequence' },
      { id: 'c2', from: 'm1', to: 'm2', family: 'EXECUTION', kind: 'sequence' },
      { id: 'c3', from: 'm2', to: 'm3', family: 'EXECUTION', kind: 'sequence' },
    ],
  };
  const { nodeById } = layoutCircuit(chained);
  assert.deepEqual(
    [nodeById.scenario.rank, nodeById.m1.rank, nodeById.m2.rank, nodeById.m3.rank],
    [0, 1, 2, 3]
  );
});

/**
 * The equity shape the mapping trace measured: one scenario, its declared Input/Event/Outcome
 * boundary and 35 operations in one declared serial chain (P1, L1). Ranking must follow the
 * declared `sequence` routes; the operations carry deliberately different materials, and none of
 * them may raise, lower or reorder a rank (review finding 8).
 */
function equityCircuit() {
  const operation = (index) => `cell:mechanic:x.operation.${index}`;
  const nodes = [
    { id: 'cell:scenario:x', primitive: 'SCENARIO', label: 'resolve-equity-market-price-evidence', container: true },
    { id: 'cell:scenario:x:input', primitive: 'INPUT', label: 'live-equity-price-request.v1', parent: 'cell:scenario:x' },
    { id: 'cell:scenario:x:event', primitive: 'EVENT', label: 'resolve-equity-market-price-evidence.v1', parent: 'cell:scenario:x' },
    { id: 'cell:scenario:x:outcome', primitive: 'OUTCOME', label: 'equity-market-price-evidence.v1', parent: 'cell:scenario:x' },
  ];
  const edges = [];
  for (let index = 1; index <= 35; index += 1) {
    nodes.push({
      id: operation(index),
      primitive: 'MECHANIC',
      material: index % 3 === 0 ? 'provider-port' : index % 3 === 1 ? 'input' : 'evidence',
      label: index % 2 === 0 ? 'build-equity-price-binding-request' : 'observe-governed-http-exchange',
      parent: 'cell:scenario:x',
      container: true,
    });
    if (index > 1) {
      edges.push({
        id: `edge:sequence:x:${index - 1}`,
        from: operation(index - 1),
        to: operation(index),
        family: 'EXECUTION',
        kind: 'sequence',
      });
    }
  }
  edges.push({ id: 'edge:return:x', from: operation(35), to: 'cell:scenario:x', family: 'EXECUTION', kind: 'return' });
  return { capabilityId: 'resolve-equity-market-price-evidence', scenarioId: 'x', nodes, edges };
}

test('the equity operation view is one serial column ranked by declared operation order', () => {
  const circuit = equityCircuit();
  const { width, nodeById, edges } = layoutCircuit(circuit);
  for (let index = 1; index <= 35; index += 1) {
    assert.equal(nodeById[`cell:mechanic:x.operation.${index}`].rank, index, 'rank follows the declared sequence');
  }
  for (let index = 1; index < 35; index += 1) {
    const edge = edges.find((candidate) => candidate.id === `edge:sequence:x:${index}`);
    assert.equal(edge.back, false, 'a declared sequence route is forward regardless of its materials');
  }
  assert.deepEqual(
    edges.filter((edge) => edge.back).map((edge) => edge.id),
    ['edge:return:x'],
    'only the upward close is a loop-back',
  );
  assert.equal(width, 720, 'the serial column keeps the published view width');
});

test('materials never reorder the equity operation column', () => {
  const circuit = equityCircuit();
  const withoutMaterials = {
    ...circuit,
    nodes: circuit.nodes.map((node) => ({
      id: node.id,
      primitive: node.primitive,
      label: node.label,
      parent: node.parent,
      container: node.container,
    })),
  };
  assert.deepEqual(layoutCircuit(circuit), layoutCircuit(withoutMaterials));
});

test('the focused camera keeps the active operation inside its viewport', () => {
  const circuit = equityCircuit();
  const layout = layoutCircuit(circuit);
  const viewportOf = (operation) => focusViewport(layout, `cell:mechanic:x.operation.${operation}`);
  const middle = viewportOf(18);
  const box = layout.nodeById['cell:mechanic:x.operation.18'];
  assert.ok(middle, 'a drawn operation has a focused camera');
  assert.ok(box.y >= middle.y && box.y + box.height <= middle.y + middle.height, 'the active operation stays in view');
  assert.equal(viewportOf(1).y, 0, 'the camera clamps at the top of the drawing');
  assert.equal(viewportOf(35).y, layout.height - viewportOf(35).height, 'the camera clamps at the bottom');
  assert.ok(layout.height > viewportOf(18).height, 'the serial column is deeper than one camera window');
});

test('an unknown focus falls back to no camera rather than a frame around nothing', () => {
  const layout = layoutCircuit(equityCircuit());
  assert.equal(focusViewport(layout, 'cell:missing'), null);
});

test('a wide drawing gets a camera window that still contains the focused node', () => {
  const wide = {
    capabilityId: 'wide-focus',
    scenarioId: 'wide-focus',
    nodes: [
      { id: 'root', primitive: 'SCENARIO', label: 'Root' },
      ...Array.from({ length: 8 }, (_, index) => ({
        id: `m${index}`,
        primitive: 'MECHANIC',
        label: `Operation ${index}`,
      })),
    ],
    edges: Array.from({ length: 8 }, (_, index) => ({
      id: `e${index}`,
      from: 'root',
      to: `m${index}`,
      family: 'EXECUTION',
      kind: 'sequence',
    })),
  };
  const layout = layoutCircuit(wide);
  const box = layout.nodeById.m7;
  const viewport = focusViewport(layout, 'm7');
  assert.ok(viewport.width < layout.width, 'a drawing wider than the camera is windowed');
  assert.ok(box.x >= viewport.x && box.x + box.width <= viewport.x + viewport.width, 'the focused lane stays in view');
});

test('geometry carries no material band ranking (review finding 8)', async () => {
  const geometry = await import('../components/circuit/geometry.js');
  assert.equal('MATERIAL_BAND' in geometry, false, 'a material band may not rank the drawing');
});
