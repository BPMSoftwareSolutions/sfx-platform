import assert from 'node:assert/strict';
import test from 'node:test';

import type { SdaRunGraph } from '../contracts/sda-api';
import { CircuitPresentationPolicy } from '../contracts/circuit-presentation';
import policyJson from './fixtures/circuit/circuit-presentation-policy.json' with { type: 'json' };
import {
  MATERIAL_STYLES,
  PRIMITIVE_MATERIAL,
  materialsFromPolicy,
  resolveCellMaterial,
  resolveEdgeMaterial,
} from '../components/circuit/scl-theme';
import {
  buildRunGraphView,
  compiledGraphSurface,
  normalizeRunGraph,
  primitiveForAltitude,
  runGraphViewProjection,
  semanticAddressText,
} from '../lib/run-graph';

/** The declared policy fixture the platform renders: exact maps, no platform tables. */
const policy = CircuitPresentationPolicy.parse(policyJson);
const materials = materialsFromPolicy(policy)!;

/**
 * Run-graph view — the declared granularity rule before layout.
 *
 * The view is built only from ids and the parent chain: no capability vocabulary, no per-capability
 * code. Collapse walks to the nearest enclosing cell; edges remap onto the drawn nodes and routes
 * internal to one drawn node are not drawn.
 */

function graphOf(
  cells: Array<{ cellId: string; altitude?: string; parentCellId?: string | null; kind?: string; semanticAddress?: string }>,
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
      semanticAddress: cell.semanticAddress ?? `test/scenario/${cell.cellId.replace(/^cell:/, '')}`,
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

test('the declared operation grain draws one node per operation plus the scenario boundary', () => {
  const view = buildRunGraphView(normalizeRunGraph(graphOf([
    { cellId: 'cell:scenario:root', altitude: 'scenario', parentCellId: null },
    { cellId: 'cell:mechanic:work', altitude: 'mechanic', parentCellId: 'cell:scenario:root' },
  ])));
  assert.equal(view.totalCells, 2);
  assert.equal(view.grain, 'operation');
  assert.deepEqual(view.nodes.map((node) => node.id), [
    'cell:scenario:root',
    'cell:scenario:root:input',
    'cell:scenario:root:event',
    'cell:scenario:root:outcome',
    'cell:mechanic:work',
  ]);
  assert.equal(view.membership['cell:mechanic:work'], 'cell:mechanic:work');
});

test('the declared grain groups expression and provider cells into their enclosing operation', () => {
  const view = buildRunGraphView(normalizeRunGraph(deepGraph()));
  assert.equal(view.totalCells, 41);
  assert.equal(view.grain, 'operation');
  assert.equal(view.collapsed, true);
  // Every provider belongs to its mechanic operation; the root keeps its own node.
  assert.deepEqual(
    view.nodes.filter((node) => !node.boundaryRole).map((node) => node.id),
    ['cell:scenario:root', 'cell:mechanic:m0', 'cell:mechanic:m1', 'cell:mechanic:m2', 'cell:mechanic:m3']
  );
  assert.equal(view.membership['cell:provider:m2.p7'], 'cell:mechanic:m2');
  assert.equal(view.membership['cell:scenario:root'], 'cell:scenario:root');
  const grouped = view.nodes.find((node) => node.id === 'cell:mechanic:m2');
  assert.ok(grouped && grouped.memberCellIds.length === 10);
  assert.equal(grouped.parentDrawnId, 'cell:scenario:root');
});

test('routes internal to one drawn operation are not drawn; routes between operations are', () => {
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

test('cells with no operation ancestor draw as themselves at the declared grain', () => {
  const cells = Array.from({ length: 35 }, (_, index) => ({
    cellId: `cell:mechanic:flat${index}`,
    altitude: 'mechanic',
    parentCellId: null,
  }));
  const view = buildRunGraphView(normalizeRunGraph(graphOf(cells)));
  assert.equal(view.nodes.length, 35);
  assert.equal(view.collapsed, false);
});

test('the scenario is drawn with its declared Input, Event and Outcome from the phase 1 fields', () => {
  const graph = graphOf([{ cellId: 'cell:scenario:equity', altitude: 'scenario', parentCellId: null }]);
  graph.cells[0]!.authorityId = 'resolve-equity-market-price-evidence.v1';
  graph.cells[0]!.ports = {
    input: { portId: 'cell:scenario:equity:input', contractId: 'live-equity-price-request.v1' },
    outcome: {
      portId: 'cell:scenario:equity:outcome',
      contractId: 'equity-market-price-evidence.v1',
      variants: ['EQUITY_MARKET_PRICE_EVIDENCE_RESOLVED', 'NATIVE_MARKET_PRICE_TESTIMONY_REJECTED'],
      variantClassifications: { EQUITY_MARKET_PRICE_EVIDENCE_RESOLVED: 'success' },
    },
  };
  const view = buildRunGraphView(normalizeRunGraph(graph));
  const role = (name: string) => view.nodes.find((node) => node.boundaryRole === name)!;
  assert.equal(role('input').label, 'live-equity-price-request.v1');
  assert.equal(role('input').material, 'input');
  assert.equal(role('event').label, 'resolve-equity-market-price-evidence.v1', 'the Event role is the event execution authority');
  assert.equal(role('event').material, 'event');
  assert.equal(role('outcome').label, 'equity-market-price-evidence.v1');
  assert.equal(role('outcome').material, 'outcome');
  assert.deepEqual(role('outcome').outcomeVariants, ['EQUITY_MARKET_PRICE_EVIDENCE_RESOLVED', 'NATIVE_MARKET_PRICE_TESTIMONY_REJECTED']);
  assert.equal(role('outcome').parentDrawnId, 'cell:scenario:equity');
  const projection = runGraphViewProjection(view, { capabilityId: 'equity' });
  assert.equal(projection.nodes.find((node) => node.primitive === 'INPUT')?.label, 'live-equity-price-request.v1');
  assert.equal(projection.nodes.find((node) => node.primitive === 'EVENT')?.label, 'resolve-equity-market-price-evidence.v1');
  assert.equal(projection.nodes.find((node) => node.primitive === 'OUTCOME')?.label, 'equity-market-price-evidence.v1');
});

test('a scenario whose record predates the declared authority shows its Event role as UNRESOLVED', () => {
  const view = buildRunGraphView(normalizeRunGraph(graphOf([{ cellId: 'cell:scenario:old', altitude: 'scenario', parentCellId: null }])));
  const event = view.nodes.find((node) => node.boundaryRole === 'event')!;
  assert.equal(event.label, 'UNRESOLVED');
  assert.equal(event.material, 'event', 'the role is declared by the policy; the value is absent');
});

test('every operation is drawn: the equity shape is one scenario, three boundary roles and 35 operations', () => {
  const cells: Array<{ cellId: string; altitude: string; parentCellId: string | null; kind?: string }> = [
    { cellId: 'cell:scenario:x', altitude: 'scenario', parentCellId: null },
  ];
  for (let operation = 1; operation <= 35; operation += 1) {
    const operationId = `cell:mechanic:x.operation.${operation}`;
    cells.push({ cellId: operationId, altitude: 'mechanic', parentCellId: 'cell:scenario:x' });
    cells.push({ cellId: `${operationId}:junction`, altitude: 'mechanic', kind: 'junction', parentCellId: operationId });
  }
  const view = buildRunGraphView(normalizeRunGraph(graphOf(cells)), { policy });
  assert.equal(view.nodes.length, 39, '1 scenario + its Input/Event/Outcome + 35 operations');
  assert.equal(view.nodes.filter((node) => node.boundaryRole).length, 3);
  assert.equal(view.nodes.filter((node) => node.id.includes('.operation.')).length, 35);
});

test('drawn edges keep junction arms distinct by their declared variant', () => {
  const graph = graphOf(
    [
      { cellId: 'cell:scenario:root', altitude: 'scenario', parentCellId: null },
      { cellId: 'cell:mechanic:selection', altitude: 'mechanic', parentCellId: 'cell:scenario:root' },
      { cellId: 'cell:mechanic:selection:arm', altitude: 'mechanic', parentCellId: 'cell:mechanic:selection' },
      { cellId: 'cell:mechanic:target', altitude: 'mechanic', parentCellId: 'cell:scenario:root' },
    ],
    [
      { edgeId: 'edge:arm:false', from: 'cell:mechanic:selection:arm', to: 'cell:mechanic:target', kind: 'selection' },
      { edgeId: 'edge:arm:true', from: 'cell:mechanic:selection:arm', to: 'cell:mechanic:target', kind: 'selection' },
      { edgeId: 'edge:arm:false:again', from: 'cell:mechanic:selection:arm', to: 'cell:mechanic:target', kind: 'selection' },
    ]
  );
  graph.edges[0]!.selectsVariant = 'FALSE';
  graph.edges[1]!.selectsVariant = 'TRUE';
  graph.edges[2]!.selectsVariant = 'FALSE';
  const view = buildRunGraphView(normalizeRunGraph(graph), { policy });
  const selectionEdges = view.edges.filter((edge) => edge.kind === 'selection');
  assert.equal(selectionEdges.length, 2, 'two variants between the same drawn nodes stay distinct');
  assert.deepEqual(selectionEdges.map((edge) => edge.selectsVariant), ['FALSE', 'TRUE']);
  assert.equal(view.edgeMembership['edge:arm:false'], 'edge:arm:false');
  assert.equal(view.edgeMembership['edge:arm:false:again'], 'edge:arm:false', 'the same variant collapses into one drawn edge');
  assert.equal(selectionEdges[0]!.memberEdgeIds.length, 2);
  assert.equal(selectionEdges[1]!.memberEdgeIds.length, 1);
  // The declared arm variant travels onto the renderer projection as data, verbatim: the viewer
  // labels only an arm with its own observed state, so unwalked arms read this value and stay unlit.
  const projection = runGraphViewProjection(view, { capabilityId: 'demo' });
  const projectedSelection = projection.edges.filter((edge) => edge.kind === 'selection');
  assert.deepEqual(
    projectedSelection.map((edge) => edge.selectsVariant),
    ['FALSE', 'TRUE'],
    'the drawn arm keeps its declared variant on the projected edge'
  );
});

test('a declared boolean arm variant travels onto the projection unchanged', () => {
  const graph = graphOf(
    [
      { cellId: 'cell:scenario:root', altitude: 'scenario', parentCellId: null },
      { cellId: 'cell:mechanic:selection', altitude: 'mechanic', parentCellId: 'cell:scenario:root' },
      { cellId: 'cell:mechanic:target', altitude: 'mechanic', parentCellId: 'cell:scenario:root' },
    ],
    [{ edgeId: 'edge:arm:boolean', from: 'cell:mechanic:selection', to: 'cell:mechanic:target', kind: 'selection' }]
  );
  graph.edges[0]!.selectsVariant = false;
  const view = buildRunGraphView(normalizeRunGraph(graph), { policy });
  const projection = runGraphViewProjection(view, { capabilityId: 'demo' });
  assert.equal(projection.edges[0]!.selectsVariant, false);
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
    assert.ok(
      ['SCENARIO', 'MECHANIC', 'PROVIDER', 'PHYSICAL', 'INPUT', 'EVENT', 'OUTCOME', 'UNRESOLVED'].includes(node.primitive),
      `declared primitive, got ${node.primitive}`
    );
    assert.ok(node.state.readable.includes('testimony'), 'planned copy names its only source of light');
  }
});

test('a declared address object is preserved as text without asserting its structure', () => {
  assert.equal(semanticAddressText('scenario/root'), 'scenario/root');
  assert.equal(semanticAddressText({ mechanicId: 'object', mechanicPath: 'payload' }), 'object');
  assert.equal(semanticAddressText({ semanticRole: 'SCENARIO_OUTCOME' }), 'SCENARIO_OUTCOME');
  assert.equal(semanticAddressText(undefined), null);
});

test('normalization carries the declared authorityId, port contracts and outcome variants', () => {
  const graph = graphOf([{ cellId: 'cell:scenario:root', altitude: 'scenario', parentCellId: null }]);
  graph.cells[0]!.authorityId = 'resolve-equity-market-price-evidence.v1';
  graph.cells[0]!.ports = {
    input: { portId: 'cell:scenario:root:input', contractId: 'live-equity-price-request.v1' },
    outcome: {
      portId: 'cell:scenario:root:outcome',
      contractId: 'equity-market-price-evidence.v1',
      variants: ['EQUITY_MARKET_PRICE_EVIDENCE_RESOLVED', 'NATIVE_MARKET_PRICE_TESTIMONY_REJECTED'],
      variantClassifications: { EQUITY_MARKET_PRICE_EVIDENCE_RESOLVED: 'success', NATIVE_MARKET_PRICE_TESTIMONY_REJECTED: 'failure' },
    },
  };
  const normalized = normalizeRunGraph(graph);
  const cell = normalized.cells[0]!;
  assert.equal(cell.authorityId, 'resolve-equity-market-price-evidence.v1');
  assert.equal(cell.inputContractId, 'live-equity-price-request.v1');
  assert.equal(cell.outcomeContractId, 'equity-market-price-evidence.v1');
  assert.deepEqual(cell.outcomeVariants, ['EQUITY_MARKET_PRICE_EVIDENCE_RESOLVED', 'NATIVE_MARKET_PRICE_TESTIMONY_REJECTED']);
  assert.deepEqual(cell.outcomeClassifications, {
    EQUITY_MARKET_PRICE_EVIDENCE_RESOLVED: 'success',
    NATIVE_MARKET_PRICE_TESTIMONY_REJECTED: 'failure',
  });
});

test('a record captured before the declared identities normalizes them as absent, never guessed', () => {
  const normalized = normalizeRunGraph(graphOf([{ cellId: 'cell:mechanic:old', altitude: 'mechanic' }]));
  const cell = normalized.cells[0]!;
  assert.equal(cell.authorityId, null);
  assert.deepEqual(cell.outcomeVariants, []);
  assert.equal(cell.outcomeClassifications, null);
});

test('the declared maps resolve cells by exact authorityId, never by name', () => {
  assert.equal(resolveCellMaterial({ authorityId: 'operation:sda-authority-transformation-port.v1' }, materials), 'event');
  assert.equal(resolveCellMaterial({ authorityId: 'operation:sda-external-credential-reference-binding-port.v1' }, materials), 'provider-port');
  assert.equal(resolveCellMaterial({ authorityId: 'operation:sda-governed-http-exchange-port.v1' }, materials), 'provider');
  assert.equal(resolveCellMaterial({ authorityId: 'provider:sda-governed-http-exchange-port.v1' }, materials), 'provider-port');
  assert.equal(resolveCellMaterial({ authorityId: 'physical:sda-governed-http-exchange-port.v1' }, materials), 'provider');
  assert.equal(resolveCellMaterial({ authorityId: 'mechanic:let.v1' }, materials), 'event');
  assert.equal(resolveCellMaterial({ authorityId: 'junction:boolean-selection.v1' }, materials), 'branch');
});

test('the credential binding and the governed HTTP exchange get different declared materials', () => {
  const credential = resolveCellMaterial({ authorityId: 'operation:sda-external-credential-reference-binding-port.v1' }, materials);
  const exchange = resolveCellMaterial({ authorityId: 'operation:sda-governed-http-exchange-port.v1' }, materials);
  assert.equal(credential, 'provider-port');
  assert.equal(exchange, 'provider');
  assert.notEqual(credential, exchange);
});

test('an unmapped identity or kind is UNRESOLVED, never a fallback', () => {
  assert.equal(resolveCellMaterial({ authorityId: 'mechanic:if.v1' }, materials), null);
  assert.equal(resolveCellMaterial({ authorityId: 'quantum:x' }, materials), null);
  assert.equal(resolveCellMaterial({ authorityId: null }, materials), null);
  assert.equal(resolveCellMaterial({ authorityId: 'operation:sda-authority-transformation-port.v1' }, null), null);
  assert.equal(resolveEdgeMaterial('product-transfer', materials), null);
  assert.equal(resolveEdgeMaterial('support-link', materials), null);
  assert.equal(resolveEdgeMaterial(null, materials), null);
});

test('the scenario boundary roles resolve through the declared boundary map', () => {
  assert.equal(resolveCellMaterial({ authorityId: null, boundaryRole: 'input' }, materials), 'input');
  assert.equal(resolveCellMaterial({ authorityId: null, boundaryRole: 'event' }, materials), 'event');
  assert.equal(resolveCellMaterial({ authorityId: null, boundaryRole: 'outcome' }, materials), 'outcome');
});

test('route kinds resolve by exact declared key', () => {
  assert.equal(resolveEdgeMaterial('sequence', materials), 'event');
  assert.equal(resolveEdgeMaterial('selection', materials), 'branch');
  assert.equal(resolveEdgeMaterial('broadcast', materials), 'fan-out');
  assert.equal(resolveEdgeMaterial('join', materials), 'convergence');
  assert.equal(resolveEdgeMaterial('recurrence', materials), 'branch');
  assert.equal(resolveEdgeMaterial('return', materials), 'outcome');
  assert.equal(resolveEdgeMaterial('failure', materials), 'rejection');
});

test('a drawn cell resolves by its own declared authority, collapsed or not', () => {
  const graph = graphOf([
    { cellId: 'cell:scenario:root', altitude: 'scenario', parentCellId: null },
    { cellId: 'cell:mechanic:op', altitude: 'mechanic', parentCellId: 'cell:scenario:root', semanticAddress: 'cap/scenario/cap/operation/cap.operation.1' },
    { cellId: 'cell:mechanic:op:expression', altitude: 'mechanic', parentCellId: 'cell:mechanic:op', semanticAddress: 'build-equity-price-binding-request#/expression' },
    { cellId: 'cell:provider:leg', altitude: 'provider', parentCellId: 'cell:mechanic:op', semanticAddress: 'cap/scenario/cap/operation/cap.operation.1/provider' },
    { cellId: 'cell:physical:leg', altitude: 'physical', parentCellId: 'cell:mechanic:op', semanticAddress: 'cap/scenario/cap/operation/cap.operation.1/physical' },
  ]);
  graph.cells[0]!.authorityId = 'resolve-equity-market-price-evidence.v1';
  graph.cells[1]!.authorityId = 'operation:sda-authority-transformation-port.v1';
  graph.cells[2]!.authorityId = 'mechanic:let.v1';
  graph.cells[3]!.authorityId = 'provider:sda-external-credential-reference-binding-port.v1';
  graph.cells[4]!.authorityId = 'physical:sda-external-credential-reference-binding-port.v1';
  const view = buildRunGraphView(normalizeRunGraph(graph), { policy, full: true });
  assert.equal(view.nodes.find((node) => node.id === 'cell:scenario:root')!.material, 'outcome', 'the scenario is its declared outcome face');
  assert.equal(view.nodes.find((node) => node.id === 'cell:mechanic:op')!.material, 'event');
  assert.equal(view.nodes.find((node) => node.id === 'cell:provider:leg')!.material, 'provider-port');
  assert.equal(view.nodes.find((node) => node.id === 'cell:physical:leg')!.material, 'provider');
});

test('a cell the policy does not declare draws as the visible UNRESOLVED primitive', () => {
  const graph = graphOf([{ cellId: 'cell:mechanic:unknown', altitude: 'mechanic', parentCellId: null }]);
  graph.cells[0]!.authorityId = 'mechanic:not-declared.v1';
  const view = buildRunGraphView(normalizeRunGraph(graph), { policy });
  assert.equal(view.nodes[0]!.material, null);
  const projection = runGraphViewProjection(view, { capabilityId: 'demo' });
  assert.equal(projection.nodes[0]!.primitive, 'UNRESOLVED');
  assert.equal(projection.nodes[0]!.material, undefined);
  assert.match(projection.nodes[0]!.state.readable, /UNRESOLVED/);
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

test('the run-graph projection carries a declared material per drawn cell and route', () => {
  const graph = deepGraph();
  for (const cell of graph.cells) {
    if (cell.altitude === 'scenario') cell.authorityId = 'resolve-equity-market-price-evidence.v1';
    else if (cell.altitude === 'mechanic') cell.authorityId = 'operation:sda-authority-transformation-port.v1';
    else if (cell.altitude === 'provider') cell.authorityId = 'provider:sda-governed-http-exchange-port.v1';
    else if (cell.altitude === 'physical') cell.authorityId = 'physical:sda-governed-http-exchange-port.v1';
  }
  const view = buildRunGraphView(normalizeRunGraph(graph), { policy });
  const projection = runGraphViewProjection(view, { capabilityId: 'demo', scenarioId: null });
  assert.equal(projection.nodes.length, view.nodes.length);
  assert.equal(projection.edges.length, view.edges.length);
  assert.equal(projection.nodes.length, 8, 'the scenario boundary plus four operations');
  assert.equal(view.collapsed, true);
  assert.equal(view.nodes.find((node) => node.id === 'cell:scenario:root')!.label, 'root');
  assert.match(view.nodes.find((node) => node.id === 'cell:mechanic:m0')!.label, /10 cells/);
  const root = projection.nodes.find((node) => node.id === 'cell:scenario:root');
  const mechanic = projection.nodes.find((node) => node.id === 'cell:mechanic:m0');
  assert.equal(root?.material, 'outcome');
  assert.equal(mechanic?.material, 'event');
  assert.ok(projection.edges.every((edge) => edge.material === 'event'), 'fixture routes are declared sequences');
  assert.ok(projection.edges.every((edge) => edge.kind === 'sequence'), 'the engine route kind travels with the projection');
  assert.ok(projection.edges.every((edge) => edge.selectsVariant === undefined), 'a route with no declared arm carries no variant');
  assert.ok(!projection.nodes.some((node) => node.id === 'cell:provider:m0.p0'), 'a collapsed provider is drawn inside its mechanic');
  // Containment travels as data for the viewer's container frames: the scenario draws the frame
  // around the operations it encloses, and each operation names its nearest drawn enclosing cell.
  assert.equal(root?.parent, null, 'the scenario root has no drawn parent');
  assert.equal(root?.container, true, 'the scenario encloses drawn children, so it draws a container frame');
  assert.equal(mechanic?.parent, 'cell:scenario:root', 'an operation names its nearest drawn enclosing cell');
});

test('the engine-compiled capability surface collapses by the same id rule and names no run', () => {
  const surface = compiledGraphSurface(deepGraph(), 'demo', policy);
  assert.equal(surface.projection.fidelity, 'COMPILED_GRAPH');
  assert.equal(surface.projection.nodes.length, surface.stats.drawnNodes);
  assert.equal(surface.projection.edges.length, surface.stats.drawnEdges);
  assert.equal(surface.stats.drawnNodes, 8, 'the scenario boundary plus four operations');
  assert.equal(surface.stats.groupedCells, 36);
  assert.equal(surface.stats.grain, 'operation');
  assert.equal(surface.projection.edges.length, surface.stats.drawnEdges);
  assert.equal(surface.stats.totalCells, 41);
  assert.equal(surface.stats.collapsed, true);
  assert.match(surface.projection.sourceProfile, /^capability-graph:/);
  for (const node of surface.projection.nodes) {
    assert.ok(node.state.readable.includes('testimony'), 'the compiled surface is lit by testimony only');
  }
});
