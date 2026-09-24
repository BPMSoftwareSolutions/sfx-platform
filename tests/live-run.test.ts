import assert from 'node:assert/strict';
import test from 'node:test';

import { drainRunLane, graphCapturedDigest, type RunLaneProgress } from '../components/estate/live-run';
import type { RunAdvance, RunGraphResult, SdaRunEvent, SdaRunGraph, SdaRunState } from '../contracts/sda-api';

/**
 * Live run binding — the `graph.captured` marker, not a timer.
 *
 * The lane's own marker is the fetch trigger; a compiled graph with the marker's
 * `canonicalGraphDigest` is adopted without a fetch; a terminal run that never captured a graph
 * reports a visible error. Testimony read before the marker is rebound when the graph arrives.
 */

const DIGEST = 'sha256:' + 'a'.repeat(64);

function graphOf(digest = DIGEST): SdaRunGraph {
  return {
    graphId: 'graph:fixture',
    canonicalGraphDigest: digest,
    cells: [
      { cellId: 'cell:scenario:root', altitude: 'scenario', kind: 'scenario', parentCellId: null, semanticAddress: 'fixture/scenario', ports: {} },
      { cellId: 'cell:mechanic:a', altitude: 'mechanic', kind: 'mechanic', parentCellId: 'cell:scenario:root', semanticAddress: 'fixture/mechanic', ports: {} }
    ],
    edges: []
  };
}

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
