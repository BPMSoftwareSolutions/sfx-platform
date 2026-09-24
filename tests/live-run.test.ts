import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { CapabilityCircuitPanel } from '../components/estate/capability-circuit-panel';
import { drainRunLane, graphCapturedDigest, type LiveRunView, type RunLaneProgress } from '../components/estate/live-run';
import type { RunAdvance, RunGraphResult, SdaRunEvent, SdaRunGraph, SdaRunState } from '../contracts/sda-api';
import type { CircuitProjection } from '../contracts/estate';
import { applyEvents, emptyTrace } from '../lib/live-trace';
import { buildRunGraphView, normalizeRunGraph } from '../lib/run-graph';

/**
 * Live run binding — the `graph.captured` marker, not a timer.
 *
 * The lane's own marker is the fetch trigger; a compiled graph with the marker's
 * `canonicalGraphDigest` is adopted without a fetch; a terminal run that never captured a graph
 * reports a visible error. Testimony read before the marker is rebound when the graph arrives.
 *
 * The drained progress also carries each cell's own testified outcome, and the panel hands it to
 * the viewer: a drawn operation shows the variant it testified, and a walked selection arm names
 * the variant it walked. An arm with no observed state is never lit and never labelled.
 */

const DIGEST = 'sha256:' + 'a'.repeat(64);

function graphOf(digest = DIGEST, edges: SdaRunGraph['edges'] = []): SdaRunGraph {
  return {
    graphId: 'graph:fixture',
    canonicalGraphDigest: digest,
    cells: [
      { cellId: 'cell:scenario:root', altitude: 'scenario', kind: 'scenario', parentCellId: null, semanticAddress: 'fixture/scenario', ports: {} },
      { cellId: 'cell:mechanic:a', altitude: 'mechanic', kind: 'mechanic', parentCellId: 'cell:scenario:root', semanticAddress: 'fixture/mechanic', ports: {} }
    ],
    edges
  };
}

/**
 * A compact junction fixture: two drawn operations and two declared selection arms between them.
 * The arms differ only by `selectsVariant`, so the drawn edge key and the walked-arm label are
 * what keep them apart.
 */
function junctionGraph(): SdaRunGraph {
  const endpoint = (cellId: string) => ({ cellId, portId: `${cellId}:port` });
  return {
    graphId: 'graph:junction',
    canonicalGraphDigest: 'sha256:' + 'd'.repeat(64),
    cells: [
      {
        cellId: 'cell:scenario:fixture',
        altitude: 'scenario',
        kind: 'scenario',
        parentCellId: null,
        semanticAddress: 'fixture/scenario',
        ports: {
          input: { portId: 'cell:scenario:fixture:input', contractId: 'fixture-request.v1' },
          outcome: {
            portId: 'cell:scenario:fixture:outcome',
            contractId: 'fixture-evidence.v1',
            variants: ['EQUITY_MARKET_PRICE_EVIDENCE_RESOLVED', 'NATIVE_MARKET_PRICE_TESTIMONY_REJECTED'],
            variantClassifications: {
              EQUITY_MARKET_PRICE_EVIDENCE_RESOLVED: 'success',
              NATIVE_MARKET_PRICE_TESTIMONY_REJECTED: 'failure'
            }
          }
        }
      },
      { cellId: 'cell:mechanic:fixture.operation.1', altitude: 'mechanic', kind: 'mechanic', parentCellId: 'cell:scenario:fixture', semanticAddress: 'fixture/operation/1', ports: {} },
      { cellId: 'cell:mechanic:fixture.operation.1:junction', altitude: 'mechanic', kind: 'junction', parentCellId: 'cell:mechanic:fixture.operation.1', semanticAddress: 'fixture/operation/1/junction', ports: {} },
      { cellId: 'cell:mechanic:fixture.operation.2', altitude: 'mechanic', kind: 'mechanic', parentCellId: 'cell:scenario:fixture', semanticAddress: 'fixture/operation/2', ports: {} }
    ],
    edges: [
      {
        edgeId: 'edge:arm:false',
        kind: 'selection',
        from: endpoint('cell:mechanic:fixture.operation.1:junction'),
        to: endpoint('cell:mechanic:fixture.operation.2'),
        selectsVariant: false
      },
      {
        edgeId: 'edge:arm:true',
        kind: 'selection',
        from: endpoint('cell:mechanic:fixture.operation.1:junction'),
        to: endpoint('cell:mechanic:fixture.operation.2'),
        selectsVariant: true
      }
    ]
  };
}

/** The panel needs a circuit face; the live override is the surface under test. */
const panelCircuit: CircuitProjection = {
  capabilityId: 'fixture',
  scenarioId: 'fixture',
  sourceProfile: 'test',
  sourceDigest: 'sha256:' + '0'.repeat(64),
  graphDigest: 'sha256:' + '1'.repeat(64),
  sclVersion: '1.0.0',
  rendererVersion: 'test',
  lens: 'SCENARIO',
  fidelity: 'RUN_GRAPH',
  nodes: [],
  edges: [],
  diagnostics: []
};

function event(cursor: number, kind: string, payload: unknown): SdaRunEvent {
  return { cursor, at: new Date(0).toISOString(), kind, payload };
}

function page(events: SdaRunEvent[], options: { terminal?: boolean; state?: SdaRunState; hasMore?: boolean } = {}): RunAdvance {
  const last = events[events.length - 1]?.cursor ?? 0;
  const terminal = options.terminal ?? false;
  return {
    ok: true,
    state: options.state ?? (terminal ? 'completed' : 'executing'),
    terminal,
    events,
    nextCursor: last,
    latestCursor: last,
    hasMore: options.hasMore
  };
}

async function drain(
  pages: RunAdvance[],
  options: { compiledGraph?: SdaRunGraph; graph?: (runId: string) => Promise<RunGraphResult> } = {}
): Promise<{ progress: RunLaneProgress[]; graphCalls: number }> {
  const progress: RunLaneProgress[] = [];
  let graphCalls = 0;
  let index = 0;
  await drainRunLane({
    runId: 'run-1',
    advance: async () => pages[Math.min(index++, pages.length - 1)]!,
    graph: async (runId) => {
      graphCalls += 1;
      return options.graph ? options.graph(runId) : { ok: true, value: graphOf() };
    },
    compiledGraph: options.compiledGraph,
    cancelled: () => false,
    onPage: (snapshot) => progress.push(snapshot)
  });
  return { progress, graphCalls };
}

test('the graph.captured marker names the canonical digest', () => {
  assert.equal(graphCapturedDigest([]), undefined);
  assert.equal(
    graphCapturedDigest([
      event(1, 'run.started', {}),
      event(2, 'graph.captured', { graphId: 'graph:fixture', canonicalGraphDigest: DIGEST })
    ]),
    DIGEST
  );
});

test('the graph is fetched when the marker arrives, never before', async () => {
  const { progress, graphCalls } = await drain([
    page([event(1, 'run.started', {})]),
    page([event(2, 'graph.captured', { graphId: 'graph:fixture', canonicalGraphDigest: DIGEST })], { terminal: true })
  ]);
  assert.equal(graphCalls, 1, 'one fetch at the marker');
  assert.equal(progress[0]!.graph, undefined, 'no graph is invented before the marker');
  assert.equal(progress[0]!.graphError, undefined, 'a pending graph is not an error');
  assert.ok(progress[progress.length - 1]!.graph, 'the marker binds the fetched graph');
  assert.equal(progress[progress.length - 1]!.graph!.canonicalGraphDigest, DIGEST);
});

test('a compiled graph with the marker digest is adopted without a fetch', async () => {
  const { progress, graphCalls } = await drain(
    [page([event(1, 'graph.captured', { canonicalGraphDigest: DIGEST })], { terminal: true })],
    { compiledGraph: graphOf(DIGEST) }
  );
  assert.equal(graphCalls, 0, 'the compiled graph is used once its digest matches');
  assert.equal(progress[0]!.graph!.canonicalGraphDigest, DIGEST);
  assert.equal(progress[0]!.graphError, undefined);
});

test('a compiled graph with a different digest is not adopted', async () => {
  const other = 'sha256:' + 'c'.repeat(64);
  const { progress, graphCalls } = await drain(
    [page([event(1, 'graph.captured', { canonicalGraphDigest: DIGEST })], { terminal: true })],
    { compiledGraph: graphOf(other) }
  );
  assert.equal(graphCalls, 1, 'a digest mismatch fetches the run graph');
  assert.equal(progress[0]!.graph!.canonicalGraphDigest, DIGEST);
});

test('a terminal run without a marker reports a visible GRAPH_UNAVAILABLE', async () => {
  const { progress, graphCalls } = await drain([
    page([event(1, 'run.started', {}), event(2, 'run.exited', { exitCode: 0 })], { terminal: true })
  ]);
  assert.equal(graphCalls, 0);
  const last = progress[progress.length - 1]!;
  assert.equal(last.terminal, true);
  assert.equal(last.graph, undefined);
  assert.equal(last.graphError?.code, 'GRAPH_UNAVAILABLE', 'a missing graph is a visible error');
});

test('testimony read before the marker is rebound when the graph arrives', async () => {
  const { progress } = await drain([
    page([event(1, 'cell-execution-testimony.v1', { testimonyType: 'cell-execution-testimony.v1', cellId: 'cell:mechanic:a', disposition: 'completed' })]),
    page([event(2, 'graph.captured', { canonicalGraphDigest: DIGEST })], { terminal: true })
  ]);
  assert.equal(progress[0]!.graph, undefined);
  const last = progress[progress.length - 1]!;
  assert.equal(last.trace.states['cell:mechanic:a'], 'done', 'the pre-marker testimony lights once the graph binds');
});

test('a graph fetch failure at the marker is a visible error and never an empty drawing', async () => {
  const { progress, graphCalls } = await drain(
    [page([event(1, 'graph.captured', { canonicalGraphDigest: DIGEST })], { terminal: true })],
    { graph: async () => ({ ok: false, code: 'GRAPH_UNAVAILABLE', message: 'not captured yet' }) }
  );
  assert.equal(graphCalls, 1);
  const last = progress[progress.length - 1]!;
  assert.equal(last.graph, undefined);
  assert.equal(last.graphError?.code, 'GRAPH_UNAVAILABLE');
  assert.equal(last.graphError?.message, 'not captured yet');
});

test('the drained lane carries each cell’s own testified outcome for the panel', async () => {
  const { progress } = await drain([
    page(
      [
        event(1, 'graph.captured', { canonicalGraphDigest: DIGEST }),
        event(2, 'cell-execution-testimony.v1', {
          testimonyType: 'cell-execution-testimony.v1',
          cellId: 'cell:mechanic:a',
          disposition: 'completed',
          outcomeVariant: 'SUCCESS',
          outcomeClassification: 'success'
        })
      ],
      { terminal: true }
    )
  ]);
  const last = progress[progress.length - 1]!;
  assert.deepEqual(last.trace.cellOutcomes['cell:mechanic:a'], { variant: 'SUCCESS', classification: 'success' });
  assert.deepEqual(
    last.trace.outcomes['cell:mechanic:a'],
    { variant: 'SUCCESS', classification: 'success' },
    'the drawn node carries its own cell’s testified outcome'
  );
});

test('a lane advance failure is a terminal failure carrying the declared cause', async () => {
  const progress: RunLaneProgress[] = [];
  await drainRunLane({
    runId: 'run-1',
    advance: async () => ({ ok: false, code: 'RUN_NOT_FOUND', message: 'the run is gone' }),
    graph: async () => ({ ok: true, value: graphOf() }),
    cancelled: () => false,
    onPage: (snapshot) => progress.push(snapshot)
  });
  assert.equal(progress.length, 1);
  assert.equal(progress[0]!.terminal, true);
  assert.deepEqual(progress[0]!.failure, { code: 'RUN_NOT_FOUND', message: 'the run is gone' });
});

test('a cancellation stops the drain without a page report', async () => {
  const progress: RunLaneProgress[] = [];
  let cancelled = false;
  await drainRunLane({
    runId: 'run-1',
    advance: async () => {
      cancelled = true;
      return page([event(1, 'run.started', {})]);
    },
    graph: async () => ({ ok: true, value: graphOf() }),
    cancelled: () => cancelled,
    onPage: (snapshot) => progress.push(snapshot)
  });
  assert.equal(progress.length, 0);
});

test('the provider module exposes no retry-timer graph reader', async () => {
  const module = await import('../components/estate/live-run');
  assert.equal('readGraphWithRetry' in module, false);
  assert.equal('GRAPH_FETCH_ATTEMPTS' in module, false);
  assert.equal('GRAPH_FETCH_DELAY_MS' in module, false);
});

test('the panel shows each drawn operation’s testified variant and labels only the walked arm', () => {
  const graphView = buildRunGraphView(normalizeRunGraph(junctionGraph()));
  const trace = applyEvents(
    emptyTrace(graphView),
    [
      event(1, 'cell-execution-testimony.v1', {
        testimonyType: 'cell-execution-testimony.v1',
        cellId: 'cell:mechanic:fixture.operation.1',
        disposition: 'completed',
        outcomeVariant: 'EQUITY_MARKET_PRICE_EVIDENCE_RESOLVED',
        outcomeClassification: 'success'
      }),
      event(2, 'cell-execution-testimony.v1', {
        testimonyType: 'cell-execution-testimony.v1',
        cellId: 'cell:mechanic:fixture.operation.2',
        disposition: 'completed',
        outcomeVariant: 'NATIVE_MARKET_PRICE_TESTIMONY_REJECTED',
        outcomeClassification: 'failure'
      }),
      event(3, 'edge-execution-testimony.v1', {
        testimonyType: 'edge-execution-testimony.v1',
        edgeId: 'edge:arm:false',
        admissionDisposition: 'admitted'
      })
    ],
    graphView
  );
  const live: LiveRunView = {
    phase: 'complete',
    runId: '11111111-1111-1111-1111-111111111111',
    terminalState: 'completed',
    events: [],
    graph: graphView,
    states: trace.states,
    edgeStates: trace.edgeStates,
    outcomes: trace.outcomes,
    cellOutcomes: trace.cellOutcomes,
    transitions: trace.transitions,
    unmatched: trace.unmatched
  };
  const markup = renderToStaticMarkup(
    createElement(CapabilityCircuitPanel, { circuits: [panelCircuit], liveOverride: live })
  );
  // Every drawn operation shows the variant its own cell testified: resolved and rejected alike.
  assert.match(markup, /EQUITY_MARKET_PRICE_EVIDENCE_RESOLVED · success/);
  assert.match(markup, /NATIVE_MARKET_PRICE_TESTIMONY_REJECTED · failure/);
  assert.match(markup, /circuit-outcome--failure/, 'the rejected outcome is drawn as its own failure, not done');
  assert.match(markup, /class="circuit-node circuit-node--done"[^>]*data-live="done"/);
  assert.match(markup, /class="circuit-node circuit-node--failed"[^>]*data-live="failed"/);
  // The walked arm names the variant it walked; the unwalked arm is neither lit nor labelled.
  assert.match(markup, />FALSE</);
  assert.doesNotMatch(markup, />TRUE</);
  assert.equal((markup.match(/class="circuit-arm-label"/g) ?? []).length, 1, 'only the walked arm is labelled');
  assert.equal((markup.match(/class="circuit-edge circuit-edge--done"/g) ?? []).length, 1, 'only the walked arm is lit');
  assert.equal(
    (markup.match(/class="circuit-edge circuit-edge--planned"/g) ?? []).length,
    1,
    'the unwalked arm is drawn planned and unlit'
  );
});
