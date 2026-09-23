import assert from 'node:assert/strict';
import test from 'node:test';

import type { SdaRunGraph } from '../contracts/sda-api';
import {
  MATERIAL_STYLES,
  PRIMITIVE_MATERIAL,
  resolveCellMaterial,
  resolveEdgeMaterial,
} from '../components/circuit/scl-theme';
import {
  DETAIL_CELL_LIMIT,
  buildRunGraphView,
  compiledGraphSurface,
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

test('the material interpreter resolves altitude/kind exactly and refines a mechanic by its name', () => {
  const none = { in: [], out: [] };
  assert.equal(resolveCellMaterial({ altitude: 'scenario', kind: 'scenario', semanticHints: [], routeKinds: none }), 'outcome');
  assert.equal(resolveCellMaterial({ altitude: 'mechanic', kind: 'mechanic', semanticHints: [], routeKinds: none }), 'event');
  assert.equal(resolveCellMaterial({ altitude: 'provider', kind: 'provider', semanticHints: [], routeKinds: none }), 'provider-port');
  assert.equal(resolveCellMaterial({ altitude: 'physical', kind: 'physical', semanticHints: [], routeKinds: none }), 'provider');
  assert.equal(resolveCellMaterial({
    altitude: 'mechanic', kind: 'mechanic', semanticHints: ['validate-semantic-carrier/scenario/validate-carrier-source'], routeKinds: none,
  }), 'validation');
  assert.equal(resolveCellMaterial({
    altitude: 'mechanic', kind: 'mechanic', semanticHints: ['seal-capability-change/scenario/seal-capability-change'], routeKinds: none,
  }), 'authority');
  assert.equal(resolveCellMaterial({
    altitude: 'mechanic', kind: 'mechanic', semanticHints: ['select-equity-price-route#/expression/value/selection'], routeKinds: none,
  }), 'decision');
  assert.equal(resolveCellMaterial({
    altitude: 'mechanic', kind: 'mechanic', semanticHints: ['hold-unsealable-capability-change.v1#/expression'], routeKinds: none,
  }), 'rejection');
  assert.equal(resolveCellMaterial({ altitude: 'quantum', kind: 'quantum', semanticHints: [], routeKinds: none }), null);
  assert.equal(resolveCellMaterial({ altitude: null, kind: null, semanticHints: [], routeKinds: none }), null);
});

test('junction cells take their material from the route kinds touching them', () => {
  const junction = (routeKinds: { in: string[]; out: string[] }) =>
    resolveCellMaterial({ altitude: 'mechanic', kind: 'junction', semanticHints: [], routeKinds });
  assert.equal(junction({ in: [], out: ['selection', 'selection'] }), 'branch');
  assert.equal(junction({ in: [], out: ['selection'] }), 'branch');
  assert.equal(junction({ in: [], out: ['broadcast'] }), 'fan-out');
  assert.equal(junction({ in: ['join'], out: [] }), 'convergence');
  assert.equal(junction({ in: [], out: ['failure'] }), 'rejection');
  assert.equal(junction({ in: ['sequence'], out: [] }), 'termination');
});

test('route kinds resolve to the material their conduit is textured with', () => {
  assert.equal(resolveEdgeMaterial('sequence'), 'event');
  assert.equal(resolveEdgeMaterial('selection'), 'branch');
  assert.equal(resolveEdgeMaterial('broadcast'), 'fan-out');
  assert.equal(resolveEdgeMaterial('join'), 'convergence');
  assert.equal(resolveEdgeMaterial('failure'), 'rejection');
  assert.equal(resolveEdgeMaterial('return'), 'outcome');
  assert.equal(resolveEdgeMaterial('product-transfer'), 'outcome');
  assert.equal(resolveEdgeMaterial('support-link'), 'evidence');
  assert.equal(resolveEdgeMaterial(null), null);
});

test('the mapping table keys the engine’s own primitive kinds directly, with no capability code', () => {
  const none = { in: [], out: [] };
  for (const token of [
    'input',
    'event',
    'outcome',
    'authority',
    'validation',
    'evidence',
    'human-approval',
    'decision',
    'branch',
    'fan-out',
    'convergence',
    'rejection',
    'termination',
  ] as const) {
    assert.equal(
      resolveCellMaterial({ altitude: 'mechanic', kind: token, semanticHints: [], routeKinds: none }),
      token,
      `a declared mechanic|${token} keeps its material`
    );
  }
  assert.equal(
    resolveCellMaterial({ altitude: 'mechanic', kind: 'junction', semanticHints: [], routeKinds: { in: [], out: ['recurrence'] } }),
    'branch',
    'a recurrence junction is a branch, not a guess'
  );
});

test('every canonical material keeps a unique silhouette and every primitive selects one', () => {
  const tokens = Object.keys(MATERIAL_STYLES);
  const shapes = tokens.map((token) => MATERIAL_STYLES[token as keyof typeof MATERIAL_STYLES].shape);
  assert.equal(tokens.length, 15);
  assert.equal(new Set(shapes).size, 15, 'no two materials share a silhouette');
  assert.equal(Object.keys(PRIMITIVE_MATERIAL).length, 10, 'every engine primitive has a fallback silhouette');
  for (const [primitive, token] of Object.entries(PRIMITIVE_MATERIAL)) {
    assert.ok(MATERIAL_STYLES[token], `${primitive} selects a declared material`);
  }
  assert.equal(PRIMITIVE_MATERIAL.RESPONSIBILITY, 'decision');
  assert.equal(PRIMITIVE_MATERIAL.UNRESOLVED, 'rejection');
});

test('the run-graph projection carries a material per drawn cell and route, collapsed counts unchanged', () => {
  const graph = deepGraph();
  const view = buildRunGraphView(normalizeRunGraph(graph));
  const projection = runGraphViewProjection(view, { capabilityId: 'demo', scenarioId: null });
  assert.equal(projection.nodes.length, view.nodes.length);
  assert.equal(projection.edges.length, view.edges.length);
  assert.equal(projection.nodes.length, 5, 'four mechanics collapse into the scenario root');
  assert.equal(view.collapsed, true);
  assert.equal(view.nodes.find((node) => node.id === 'cell:scenario:root')!.label, 'root');
  assert.match(view.nodes.find((node) => node.id === 'cell:mechanic:m0')!.label, /10 cells/);
  const root = projection.nodes.find((node) => node.id === 'cell:scenario:root');
  const mechanic = projection.nodes.find((node) => node.id === 'cell:mechanic:m0');
  assert.equal(root?.material, 'outcome');
  assert.equal(mechanic?.material, 'event');
  assert.ok(projection.edges.every((edge) => edge.material === 'event'), 'fixture routes are sequences');
  assert.ok(projection.edges.every((edge) => edge.kind === 'sequence'), 'the engine route kind travels with the projection');
  assert.ok(!projection.nodes.some((node) => node.id === 'cell:provider:m0.p0'), 'a collapsed provider is drawn inside its mechanic');
});

test('the engine-compiled capability surface collapses by the same id rule and names no run', () => {
  const surface = compiledGraphSurface(deepGraph(), 'demo');
  assert.equal(surface.projection.fidelity, 'COMPILED_GRAPH');
  assert.equal(surface.projection.nodes.length, surface.stats.drawnNodes);
  assert.equal(surface.projection.edges.length, surface.stats.drawnEdges);
  assert.ok(surface.stats.drawnNodes <= DETAIL_CELL_LIMIT);
  assert.equal(surface.stats.totalCells, 41);
  assert.equal(surface.stats.collapsed, true);
  assert.match(surface.projection.sourceProfile, /^capability-graph:/);
  for (const node of surface.projection.nodes) {
    assert.ok(node.state.readable.includes('testimony'), 'the compiled surface is lit by testimony only');
  }
});
