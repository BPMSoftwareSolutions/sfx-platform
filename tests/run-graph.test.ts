import assert from 'node:assert/strict';
import test from 'node:test';

import type { SdaRunGraph } from '../contracts/sda-api';
import {
  DETAIL_CELL_LIMIT,
  buildRunGraphView,
  normalizeRunGraph,
  primitiveForAltitude,
  runGraphViewProjection,
  semanticAddressText,
} from '../lib/run-graph';

/**
 * Run-graph view — the declared granularity rule before layout.
 *
 * The view is built only from ids and the parent chain: no capability vocabulary, no per-capability
 * code. Collapse walks to the nearest enclosing cell; edges remap onto the drawn nodes and routes
 * internal to one drawn node are not drawn.
 */

function graphOf(
  cells: Array<{ cellId: string; altitude?: string; parentCellId?: string | null; kind?: string }>,
  edges: Array<{ edgeId: string; from: string; to: string; kind?: string }> = []
): SdaRunGraph {
  return {
    graphId: 'graph:test',
    canonicalGraphDigest: 'sha256:' + 'a'.repeat(64),
    cells: cells.map((cell) => ({
      cellId: cell.cellId,
      altitude: cell.altitude ?? 'mechanic',
      kind: cell.kind ?? cell.altitude ?? 'mechanic',
      parentCellId: cell.parentCellId ?? null,
      semanticAddress: `test/scenario/${cell.cellId.replace(/^cell:/, '')}`,
      ports: {
        input: { portId: `${cell.cellId}:input`, contractId: 'test.v1' },
        outcome: { portId: `${cell.cellId}:outcome`, contractId: 'test.v1' },
      },
    })),
    edges: edges.map((edge) => ({
      edgeId: edge.edgeId,
      kind: edge.kind ?? 'sequence',
      from: { cellId: edge.from, portId: `${edge.from}:outcome` },
      to: { cellId: edge.to, portId: `${edge.to}:input` },
    })),
  };
}

/** A capability-shaped graph: one scenario root, four mechanics, thirty-six providers. */
function deepGraph(): SdaRunGraph {
  const cells: Array<{ cellId: string; altitude: string; parentCellId: string | null }> = [
    { cellId: 'cell:scenario:root', altitude: 'scenario', parentCellId: null },
  ];
  const edges: Array<{ edgeId: string; from: string; to: string }> = [];
  for (let mechanic = 0; mechanic < 4; mechanic += 1) {
    const mechanicId = `cell:mechanic:m${mechanic}`;
    cells.push({ cellId: mechanicId, altitude: 'mechanic', parentCellId: 'cell:scenario:root' });
    edges.push({ edgeId: `edge:return:m${mechanic}`, from: mechanicId, to: 'cell:scenario:root' });
    for (let provider = 0; provider < 9; provider += 1) {
      const providerId = `cell:provider:m${mechanic}.p${provider}`;
      cells.push({ cellId: providerId, altitude: 'provider', parentCellId: mechanicId });
      edges.push({ edgeId: `edge:seq:m${mechanic}.p${provider}`, from: providerId, to: mechanicId });
      if (provider > 0) {
        edges.push({
          edgeId: `edge:seq:m${mechanic}.p${provider - 1}`,
          from: `cell:provider:m${mechanic}.p${provider - 1}`,
          to: providerId,
        });
      }
    }
  }
  return graphOf(cells, edges);
}

test('a graph within the detail limit is drawn whole and uncollapsed', () => {
  const view = buildRunGraphView(normalizeRunGraph(graphOf([
    { cellId: 'cell:scenario:root', altitude: 'scenario', parentCellId: null },
    { cellId: 'cell:mechanic:work', altitude: 'mechanic', parentCellId: 'cell:scenario:root' },
  ])));
  assert.equal(view.totalCells, 2);
  assert.equal(view.collapsed, false);
  assert.deepEqual(view.nodes.map((node) => node.id), ['cell:scenario:root', 'cell:mechanic:work']);
  assert.equal(view.membership['cell:mechanic:work'], 'cell:mechanic:work');
});

test('a deep graph collapses to the nearest enclosing cells before layout', () => {
  const view = buildRunGraphView(normalizeRunGraph(deepGraph()));
  assert.equal(view.totalCells, 41);
  assert.ok(view.nodes.length <= DETAIL_CELL_LIMIT, `expected <= ${DETAIL_CELL_LIMIT} drawn nodes, got ${view.nodes.length}`);
  assert.equal(view.collapsed, true);
  // Every provider collapses into its mechanic; the root stays unchanged.
  assert.equal(view.membership['cell:provider:m2.p7'], 'cell:mechanic:m2');
  assert.equal(view.membership['cell:scenario:root'], 'cell:scenario:root');
  const collapsed = view.nodes.find((node) => node.id === 'cell:mechanic:m2');
  assert.ok(collapsed && collapsed.memberCellIds.length === 10);
});

test('collapsed edges remap onto drawn nodes and internal routes are not drawn', () => {
  const view = buildRunGraphView(normalizeRunGraph(deepGraph()));
  assert.ok(view.edges.length > 0);
  for (const edge of view.edges) {
    assert.notEqual(edge.from, edge.to, 'a route internal to one drawn node is not drawn');
    assert.ok(view.nodes.every((node) => node.id !== edge.from || node.memberCellIds.length >= 1));
  }
  // Provider->mechanic and provider->provider routes collapse into one drawn node and are not
  // drawn; return routes from each mechanic to the scenario root survive.
  assert.equal(view.edgeMembership['edge:seq:m1.p0'], undefined, 'a route internal to one drawn node is not drawn');
  assert.equal(view.internalEdgeNode['edge:seq:m1.p0'], 'cell:mechanic:m1', 'an internal route is bound to the node it collapsed inside');
  assert.ok(view.edgeMembership['edge:return:m3']);
  const returnEdge = view.edges.find((edge) => edge.id === view.edgeMembership['edge:return:m3']);
  assert.equal(returnEdge?.from, 'cell:mechanic:m3');
  assert.equal(returnEdge?.to, 'cell:scenario:root');
});

test('a flat graph beyond the limit is drawn whole rather than truncated', () => {
  const cells = Array.from({ length: DETAIL_CELL_LIMIT + 5 }, (_, index) => ({
    cellId: `cell:mechanic:flat${index}`,
    altitude: 'mechanic',
    parentCellId: null,
  }));
  const view = buildRunGraphView(normalizeRunGraph(graphOf(cells)));
  assert.equal(view.nodes.length, DETAIL_CELL_LIMIT + 5);
  assert.equal(view.collapsed, false);
});

test('altitude maps to a primitive; an undeclared altitude is visibly unresolved', () => {
  assert.equal(primitiveForAltitude('scenario'), 'SCENARIO');
  assert.equal(primitiveForAltitude('mechanic'), 'MECHANIC');
  assert.equal(primitiveForAltitude('provider'), 'PROVIDER');
  assert.equal(primitiveForAltitude('physical'), 'PHYSICAL');
  assert.equal(primitiveForAltitude('quantum'), 'UNRESOLVED');
  assert.equal(primitiveForAltitude(null), 'UNRESOLVED');
});

test('the projection is the declared run-graph fidelity, filled from ids alone', () => {
  const view = buildRunGraphView(normalizeRunGraph(deepGraph()));
  const projection = runGraphViewProjection(view, { capabilityId: 'demo', scenarioId: null });
  assert.equal(projection.fidelity, 'RUN_GRAPH');
  assert.equal(projection.graphDigest, view.canonicalGraphDigest);
  assert.equal(projection.nodes.length, view.nodes.length);
  assert.equal(projection.edges.length, view.edges.length);
  for (const node of projection.nodes) {
    assert.ok(['SCENARIO', 'MECHANIC', 'PROVIDER', 'PHYSICAL', 'UNRESOLVED'].includes(node.primitive));
    assert.ok(node.state.readable.includes('testimony'), 'planned copy names its only source of light');
  }
});

test('a declared address object is preserved as text without asserting its structure', () => {
  assert.equal(semanticAddressText('scenario/root'), 'scenario/root');
  assert.equal(semanticAddressText({ mechanicId: 'object', mechanicPath: 'payload' }), 'object');
  assert.equal(semanticAddressText({ semanticRole: 'SCENARIO_OUTCOME' }), 'SCENARIO_OUTCOME');
  assert.equal(semanticAddressText(undefined), null);
});
