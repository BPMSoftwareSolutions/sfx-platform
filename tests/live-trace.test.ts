import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { CircuitViewer } from '../components/circuit/circuit-viewer';
import { CapabilityCircuitPanel } from '../components/estate/capability-circuit-panel';
import type { LiveRunView } from '../components/estate/live-run';
import type { SdaRunEvent, SdaRunGraph } from '../contracts/sda-api';
import type { CircuitProjection } from '../contracts/estate';
import { applyEvents, emptyTrace } from '../lib/live-trace';
import { buildRunGraphView, compiledGraphSurface, normalizeRunGraph, runGraphViewProjection } from '../lib/run-graph';

/**
 * Live trace — id binding only.
 *
 * A cell lights because its `cellId` has a membership entry in the run graph; an edge lights
 * because its `edgeId` does. Kernel step ids, delivery phases and cell altitudes are inert: they
 * name no node. Failure testimony marks; process exit does not.
 */

function graphOf(
  cells: Array<{ cellId: string; altitude: string; parentCellId: string | null }>,
  edges: Array<{ edgeId: string; from: string; to: string }> = []
): SdaRunGraph {
  return {
    graphId: 'graph:fixture',
    canonicalGraphDigest: 'sha256:' + 'b'.repeat(64),
    cells: cells.map((cell) => ({
      cellId: cell.cellId,
      altitude: cell.altitude,
      kind: cell.altitude,
      parentCellId: cell.parentCellId,
      semanticAddress: `fixture/${cell.cellId}`,
      ports: {
        input: { portId: `${cell.cellId}:input`, contractId: 'fixture.v1' },
        outcome: { portId: `${cell.cellId}:outcome`, contractId: 'fixture.v1' },
      },
    })),
    edges: edges.map((edge) => ({
      edgeId: edge.edgeId,
      kind: 'sequence',
      from: { cellId: edge.from, portId: `${edge.from}:outcome` },
      to: { cellId: edge.to, portId: `${edge.to}:input` },
    })),
  };
}

const fixture = graphOf(
  [
    { cellId: 'cell:scenario:root', altitude: 'scenario', parentCellId: null },
    { cellId: 'cell:mechanic:a', altitude: 'mechanic', parentCellId: 'cell:scenario:root' },
    { cellId: 'cell:mechanic:b', altitude: 'mechanic', parentCellId: 'cell:scenario:root' },
    { cellId: 'cell:provider:a.p', altitude: 'provider', parentCellId: 'cell:mechanic:a' },
  ],
  [
    { edgeId: 'edge:return:a', from: 'cell:mechanic:a', to: 'cell:scenario:root' },
    { edgeId: 'edge:return:b', from: 'cell:mechanic:b', to: 'cell:scenario:root' },
    { edgeId: 'edge:sequence:a.p', from: 'cell:provider:a.p', to: 'cell:mechanic:a' },
  ]
);

const view = buildRunGraphView(normalizeRunGraph(fixture));
const event = (cursor: number, kind: string, payload: unknown): SdaRunEvent => ({ cursor, at: '2026-09-23T00:00:00.000Z', kind, payload });
const cellTestimony = (cursor: number, cellId: string, facts: Record<string, unknown> = {}) =>
  event(cursor, 'cell-execution-testimony.v1', { testimonyType: 'cell-execution-testimony.v1', cellId, disposition: 'completed', ...facts });

test('cell testimony lights its bound drawn node in execution order', () => {
  const trace = applyEvents(emptyTrace(view), [
    event(1, 'run.admitted', { object: 'capability', operation: 'observe', subject: 'fixture' }),
    cellTestimony(2, 'cell:mechanic:a'),
    cellTestimony(3, 'cell:mechanic:b'),
    cellTestimony(4, 'cell:scenario:root'),
  ], view);
  assert.equal(trace.states['cell:mechanic:a'], 'done');
  assert.equal(trace.states['cell:mechanic:b'], 'done');
  assert.equal(trace.states['cell:scenario:root'], 'done');
  assert.equal(trace.states['cell:provider:a.p'], 'planned');
  assert.deepEqual(
    trace.transitions.map((transition) => `${transition.cursor} ${transition.nodeId} ${transition.from ?? 'idle'}>${transition.to}`),
    [
      '2 cell:mechanic:a planned>done',
      '3 cell:mechanic:b planned>done',
      '4 cell:scenario:root planned>done',
    ]
  );
});

test('planned-unobserved is drawn unlit and distinguishable from observed', () => {
  const before = emptyTrace(view);
  assert.deepEqual(before.states, {
    'cell:scenario:root': 'planned',
    'cell:mechanic:a': 'planned',
    'cell:mechanic:b': 'planned',
    'cell:provider:a.p': 'planned',
  });
  const after = applyEvents(before, [cellTestimony(1, 'cell:provider:a.p')], view);
  assert.equal(after.states['cell:provider:a.p'], 'done');
  assert.equal(after.states['cell:mechanic:a'], 'planned', 'a parent does not light from a child testimony');
  assert.equal(after.transitions.length, 1);
});

test('failure testimony fails its bound node; a later completion cannot repaint it', () => {
  const failed = applyEvents(emptyTrace(view), [
    cellTestimony(1, 'cell:mechanic:a', { disposition: 'failed', failureCode: 'PROVIDER_FAILED', failureMessage: 'refused' }),
  ], view);
  assert.equal(failed.states['cell:mechanic:a'], 'failed');
  const after = applyEvents(failed, [cellTestimony(2, 'cell:mechanic:a')], view);
  assert.equal(after.states['cell:mechanic:a'], 'failed');
});

test('a cell that completes but classifies its outcome as failure lights failed, not done', () => {
  const classified = applyEvents(emptyTrace(view), [
    cellTestimony(1, 'cell:provider:a.p', {
      disposition: 'completed',
      outcomeVariant: 'retained-non-success',
      outcomeClassification: 'failure',
      display: { entry: { status: 'failed' } },
    }),
  ], view);
  assert.equal(classified.states['cell:provider:a.p'], 'failed');
  // A parent does not inherit failure from a child testimony unless the collapse drew them together.
  assert.equal(classified.states['cell:mechanic:a'], 'planned');
});

test('the graph.captured marker names no node and does not disturb testimony', () => {
  const trace = applyEvents(emptyTrace(view), [
    event(1, 'graph.captured', { graphId: 'graph:fixture', canonicalGraphDigest: 'sha256:' + 'b'.repeat(64) }),
    cellTestimony(2, 'cell:mechanic:a'),
  ], view);
  assert.deepEqual(trace.transitions.map((transition) => transition.nodeId), ['cell:mechanic:a']);
});

test('kernel step ids, phases and altitudes name no node', () => {
  const trace = applyEvents(emptyTrace(view), [
    event(1, 'scenario-execution-observation.v1', { stepId: 'admit-input', status: 'observed' }),
    event(2, 'delivery-phase', { phase: 'executeDeclaredGraph', status: 'completed' }),
    event(3, 'scenario-execution-observation.v1', { cellAltitude: 'scenario', status: 'observed' }),
  ], view);
  assert.deepEqual(trace.transitions, []);
  for (const state of Object.values(trace.states)) assert.equal(state, 'planned');
});

test('run lifecycle events light nothing: only testimony moves a node', () => {
  const trace = applyEvents(emptyTrace(view), [
    event(1, 'run.admitted', {}),
    event(2, 'run.exited', { state: 'completed' }),
  ], view);
  assert.deepEqual(trace.transitions, []);
  for (const state of Object.values(trace.states)) assert.equal(state, 'planned');
});

test('edge testimony binds by edgeId; a cancelled admission stays unlit', () => {
  const trace = applyEvents(emptyTrace(view), [
    event(1, 'edge-execution-testimony.v1', { testimonyType: 'edge-execution-testimony.v1', edgeId: 'edge:return:a', admissionDisposition: 'admitted' }),
    event(2, 'edge-execution-testimony.v1', { testimonyType: 'edge-execution-testimony.v1', edgeId: 'edge:return:b', admissionDisposition: 'cancelled' }),
  ], view);
  assert.equal(trace.edgeStates['edge:return:a'], 'done');
  assert.equal(trace.edgeStates['edge:return:b'], 'planned');
  assert.equal(trace.edges['edge:return:a'], 'done');
});

test('testimony without a membership entry is recorded and never lit', () => {
  const trace = applyEvents(emptyTrace(view), [cellTestimony(1, 'cell:mechanic:not-in-this-graph')], view);
  assert.deepEqual(trace.unmatched, ['cell:mechanic:not-in-this-graph']);
  assert.deepEqual(trace.transitions, []);
  for (const state of Object.values(trace.states)) assert.equal(state, 'planned');
});

test('a route collapsed inside one drawn node is bound, not reported as unmatched', () => {
  const collapsedView = buildRunGraphView(normalizeRunGraph(fixture), 1);
  assert.equal(collapsedView.edgeMembership['edge:sequence:a.p'], undefined, 'an internal route is not drawn');
  assert.ok(collapsedView.internalEdgeNode['edge:sequence:a.p'], 'an internal route is bound to its node');
  const trace = applyEvents(emptyTrace(collapsedView), [
    event(1, 'edge-execution-testimony.v1', { testimonyType: 'edge-execution-testimony.v1', edgeId: 'edge:sequence:a.p', admissionDisposition: 'admitted' }),
    event(2, 'edge-execution-testimony.v1', { testimonyType: 'edge-execution-testimony.v1', edgeId: 'edge:not-in-this-graph', admissionDisposition: 'admitted' }),
  ], collapsedView);
  assert.deepEqual(trace.unmatched, ['edge:not-in-this-graph']);
});

test('without a graph there is no id binding and therefore no light', () => {
  const trace = applyEvents(emptyTrace(), [cellTestimony(1, 'cell:mechanic:a')]);
  assert.deepEqual(trace.transitions, []);
  assert.deepEqual(trace.states, {});
});

test('binding is identical for two capabilities with no shared vocabulary', () => {
  const other = graphOf([
    { cellId: 'cell:scenario:other-capability', altitude: 'scenario', parentCellId: null },
    { cellId: 'cell:provider:gemini', altitude: 'provider', parentCellId: 'cell:scenario:other-capability' },
  ]);
  const otherView = buildRunGraphView(normalizeRunGraph(other));
  const trace = applyEvents(emptyTrace(otherView), [cellTestimony(1, 'cell:provider:gemini')], otherView);
  assert.equal(trace.states['cell:provider:gemini'], 'done');
});

test('the viewer renders planned, observed and failed states and live edges', () => {
  const projection = runGraphViewProjection(view, { capabilityId: 'fixture', scenarioId: null });
  const markup = renderToStaticMarkup(createElement(CircuitViewer, {
    circuit: projection,
    liveNodes: {
      'cell:scenario:root': 'planned',
      'cell:mechanic:a': 'done',
      'cell:mechanic:b': 'active',
      'cell:provider:a.p': 'failed',
    },
    liveEdges: { 'edge:return:a': 'done', 'edge:return:b': 'planned' },
  }));
  assert.match(markup, /class="circuit-node circuit-node--planned"[^>]*data-live="planned"/);
  assert.match(markup, /class="circuit-node circuit-node--done"[^>]*data-live="done"/);
  assert.match(markup, /class="circuit-node circuit-node--active"[^>]*data-live="active"/);
  assert.match(markup, /class="circuit-node circuit-node--failed"[^>]*data-live="failed"/);
  assert.match(markup, /class="circuit-edge circuit-edge--done"[^>]*data-live="done"/);
  assert.match(markup, /class="circuit-edge circuit-edge--planned"[^>]*data-live="planned"/);
});

const authoredCircuit: CircuitProjection = {
  capabilityId: 'fixture',
  scenarioId: 'fixture',
  sourceProfile: 'test',
  sourceDigest: 'sha256:' + '0'.repeat(64),
  graphDigest: 'sha256:' + '1'.repeat(64),
  sclVersion: '1.0.0',
  rendererVersion: 'test',
  lens: 'SCENARIO',
  fidelity: 'BOUNDARY',
  renderer: {
    kind: 'AUTHORED_CIRCUIT',
    subjectKind: 'CAPABILITY',
    bundleRevision: 'a'.repeat(64),
    url: '/media/authored-circuit.html',
    label: 'authored',
    topologyViews: 3,
  },
  nodes: [
    { id: 'input', primitive: 'INPUT', label: 'Hello world request', sourceId: null, state: { value: null, readable: 'not declared' } },
  ],
  edges: [],
  diagnostics: [],
};

function liveView(graphView = view, overrides: Partial<LiveRunView> = {}): LiveRunView {
  const trace = applyEvents(emptyTrace(graphView), [
    cellTestimony(2, 'cell:mechanic:a'),
    cellTestimony(3, 'cell:mechanic:b'),
  ], graphView);
  return {
    phase: 'complete',
    runId: '11111111-1111-1111-1111-111111111111',
    terminalState: 'completed',
    events: [],
    graph: graphView,
    states: trace.states,
    edgeStates: trace.edgeStates,
    transitions: trace.transitions,
    unmatched: trace.unmatched,
    ...overrides,
  };
}

test('an authored bundle is a labelled comparison candidate beside the trace, never the trace surface', () => {
  const markup = renderToStaticMarkup(createElement(CapabilityCircuitPanel, {
    circuits: [authoredCircuit],
    liveOverride: liveView(),
  }));
  assert.match(markup, /Live execution trace/);
  assert.match(markup, /data-live="done"/);
  assert.match(markup, /Authored circuit — labelled comparison candidate \(not observed execution\)/);
  assert.match(markup, /src="\/media\/authored-circuit.html"/);
  assert.match(markup, /not observed/);
});

test('the trace surface shows the collapsed view with the declared limit', () => {
  const deepCells: Array<{ cellId: string; altitude: string; parentCellId: string | null }> = [
    { cellId: 'cell:scenario:root', altitude: 'scenario', parentCellId: null },
  ];
  for (let index = 0; index < 8; index += 1) {
    const mechanicId = `cell:mechanic:m${index}`;
    deepCells.push({ cellId: mechanicId, altitude: 'mechanic', parentCellId: 'cell:scenario:root' });
    for (let provider = 0; provider < 8; provider += 1) {
      deepCells.push({ cellId: `cell:provider:m${index}.p${provider}`, altitude: 'provider', parentCellId: mechanicId });
    }
  }
  const deepView = buildRunGraphView(normalizeRunGraph(graphOf(deepCells)));
  const markup = renderToStaticMarkup(createElement(CapabilityCircuitPanel, {
    circuits: [authoredCircuit],
    liveOverride: liveView(deepView),
  }));
  assert.match(markup, /collapsed at limit 30/);
  assert.match(markup, /9 of 73 cells drawn/);
  const nodeCount = (markup.match(/class="circuit-node circuit-node--/g) ?? []).length;
  assert.ok(nodeCount <= 30, `expected at most 30 drawn nodes, saw ${nodeCount}`);
});

test('the trace surface reports unmatched testimony rather than dropping it', () => {
  const graphView = view;
  const trace = applyEvents(emptyTrace(graphView), [cellTestimony(1, 'cell:ghost')], graphView);
  const markup = renderToStaticMarkup(createElement(CapabilityCircuitPanel, {
    circuits: [authoredCircuit],
    liveOverride: liveView(graphView, { states: trace.states, unmatched: trace.unmatched }),
  }));
  assert.match(markup, /Unmatched testimony \(1\)/);
  assert.match(markup, /cell:ghost/);
});

test('the compiled capability graph is drawn planned and unlit with no run', () => {
  const surface = compiledGraphSurface(fixture, 'fixture');
  const markup = renderToStaticMarkup(createElement(CapabilityCircuitPanel, {
    circuits: [authoredCircuit],
    capabilityGraph: surface,
  }));
  assert.match(markup, /Compiled execution graph/);
  assert.match(markup, /4 of 4 cells drawn/);
  assert.match(markup, /no run/);
  assert.match(markup, /class="circuit-node circuit-node--planned"[^>]*data-live="planned"/);
  const nodeCount = (markup.match(/class="circuit-node circuit-node--/g) ?? []).length;
  assert.equal(nodeCount, 4);
  assert.doesNotMatch(markup, /boundary/i);
  // The authored bundle stays a labelled comparison candidate, never the trace surface.
  assert.match(markup, /Authored circuit — labelled comparison candidate \(not observed execution\)/);
});

test('a compile the engine cannot complete names the engine reason and draws no substitute circuit', () => {
  const markup = renderToStaticMarkup(createElement(CapabilityCircuitPanel, {
    circuits: [authoredCircuit],
    capabilityGraph: { error: { code: 'CAPABILITY_PLAN_NOT_COMPILED', message: 'The capability names no executable plan.' } },
  }));
  assert.match(markup, /could not compile this capability/);
  assert.match(markup, /CAPABILITY_PLAN_NOT_COMPILED/);
  assert.match(markup, /The capability names no executable plan\./);
  assert.match(markup, /No substitute circuit is shown/);
  assert.equal((markup.match(/class="circuit-node/g) ?? []).length, 0);
  assert.match(markup, /Authored circuit — labelled comparison candidate \(not observed execution\)/);
});

const materialAssets = {
  event: '/media/materials/event.jpg',
  outcome: '/media/materials/outcome.jpg',
  'provider-port': '/media/materials/provider-port.jpg',
};

test('the dynamic trace draws the canonical material on cells and routes', () => {
  const markup = renderToStaticMarkup(createElement(CapabilityCircuitPanel, {
    circuits: [authoredCircuit],
    capabilityGraph: compiledGraphSurface(fixture, 'fixture'),
    materials: materialAssets,
  }));
  assert.match(markup, /href="\/media\/materials\/outcome.jpg"/, 'the scenario cell draws the outcome plate');
  assert.match(markup, /href="\/media\/materials\/event.jpg"/, 'a mechanic cell draws the event plate');
  assert.match(markup, /circuit-node-plate/);
  assert.match(markup, /stroke="url\(#circuit-edge-event\)"/, 'a sequence route is textured with the event material');
  assert.match(markup, /class="circuit-node circuit-node--planned"[^>]*data-live="planned"/);
});

test('observed transitions keep the material inside the lit node', () => {
  const markup = renderToStaticMarkup(createElement(CapabilityCircuitPanel, {
    circuits: [authoredCircuit],
    liveOverride: liveView(),
    materials: materialAssets,
  }));
  assert.match(markup, /class="circuit-node circuit-node--done"[^>]*data-live="done"/);
  const lit = markup.slice(markup.indexOf('circuit-node--done'));
  assert.match(lit, /circuit-node-plate/, 'the lit node still carries its plate');
  assert.match(lit, /href="\/media\/materials\/event.jpg"/, 'the lit node still references its material');
});

test('without materials the trace keeps the shaped primitive rendering and references no asset', () => {
  const markup = renderToStaticMarkup(createElement(CapabilityCircuitPanel, {
    circuits: [authoredCircuit],
    capabilityGraph: compiledGraphSurface(fixture, 'fixture'),
  }));
  assert.doesNotMatch(markup, /\/media\/materials\//);
  // Every drawn node still carries its silhouette: a shaped contour path, never a plain card.
  assert.equal((markup.match(/class="circuit-node-contour"/g) ?? []).length, 4);
  const silhouettes = [...markup.matchAll(/<path d="([^"]+)" fill="color-mix/g)].map((match) => match[1]);
  assert.equal(new Set(silhouettes).size, silhouettes.length, 'primitive silhouettes are distinct');
});
