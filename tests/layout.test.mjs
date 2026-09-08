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
