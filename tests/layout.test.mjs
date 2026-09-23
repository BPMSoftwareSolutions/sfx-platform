import assert from 'node:assert/strict';
import test from 'node:test';

import { layoutCircuit, wrapLabel } from '../components/circuit/geometry.js';

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

test('ranks follow altitude bands raised by the longest forward path', () => {
  const { nodeById } = layoutCircuit(branched);
  assert.equal(nodeById.scenario.rank, 0);
  assert.equal(nodeById.m1.rank, 1);
  assert.equal(nodeById.m2.rank, 1);
  assert.equal(nodeById.m3.rank, 1);
  assert.equal(nodeById.p1.rank, 2);
  assert.equal(nodeById.p2.rank, 2);
});

test('siblings branch side by side instead of stacking into a list', () => {
  const { nodeById, nodes } = layoutCircuit(branched);
  const siblings = [nodeById.m1, nodeById.m2, nodeById.m3];
  assert.equal(new Set(siblings.map((node) => node.y)).size, 1, 'siblings share a rank row');
  assert.equal(new Set(siblings.map((node) => node.x)).size, 3, 'siblings occupy distinct lanes');
  const ranks = nodes.map((node) => node.rank);
  assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b), 'nodes are laid out rank by rank');
});

test('a split draws staggered channels with junction dots at the trunk', () => {
  const { edges } = layoutCircuit(branched);
  const fan = edges.filter((edge) => edge.from === 'scenario');
  assert.equal(fan.length, 3);
  // Every fan-out route but the trunk end meets the trunk at a junction dot.
  const dots = fan.filter((edge) => edge.junctions.length === 1).map((edge) => edge.junctions[0]);
  assert.equal(dots.length, 2);
  assert.equal(new Set(dots.map((dot) => dot.x)).size, 1, 'dots sit on the shared trunk');
  assert.equal(new Set(dots.map((dot) => dot.y)).size, 2, 'channels stagger so dots are distinct');
});

test('a join converges on the target with a junction dot', () => {
  const { edges } = layoutCircuit(branched);
  const joined = edges.filter((edge) => edge.to === 'p1');
  assert.equal(joined.length, 2);
  assert.equal(joined.filter((edge) => edge.junctions.length === 1).length, 1, 'the second route joins the drop');
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

test('the drawing keeps every node inside its bounds', () => {
  const { width, height, nodes } = layoutCircuit(branched);
  for (const node of nodes) {
    assert.ok(node.x >= 0 && node.x + node.width <= width, `${node.id} stays inside the width`);
    assert.ok(node.y >= 0 && node.y + node.height <= height, `${node.id} stays inside the height`);
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
