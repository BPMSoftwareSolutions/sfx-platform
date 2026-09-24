'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import type { RunAdmission, RunAdvance, RunGraphResult, SdaRunEvent, SdaRunGraph, SdaRunState } from '@/contracts/sda-api';
import { applyEvents, emptyTrace, type LiveNodeState, type LiveOutcome, type LiveTrace, type LiveTransition } from '@/lib/live-trace';
import { buildRunGraphView, normalizeRunGraph, type RunGraphView } from '@/lib/run-graph';

/**
 * Live run context — §6 item 2, trace plan §4.2.
 *
 * Admit a run, then bind the declared public graph by the lane's own `graph.captured` marker:
 * the engine emits the projection at compile time and appends the marker to the sequence, so the
 * marker — not a timer — is the fetch trigger. A compiled capability graph the caller already
 * holds is used when its `canonicalGraphDigest` matches the marker. Advance the cursor, bind each
 * testimony to its cell or edge by id and hold the lean output. Node states change only when the
 * node's own testimony arrives; the graph is never invented, and a terminal run with no graph is
 * a visible error, never a silently empty drawing. Cursor polling only (T1); no timeline
 * framework and no replay.
 */

export type LivePhase = 'idle' | 'admitting' | 'polling' | 'complete' | 'failed';

export interface LiveRunView {
  phase: LivePhase;
  runId?: string;
  terminalState?: SdaRunState;
  events: SdaRunEvent[];
  graph?: RunGraphView;
  graphError?: { code: string; message: string };
  /** Drawn node id -> aggregated observed state. Planned nodes are `planned`, drawn unlit. */
  states: Record<string, LiveNodeState>;
  /** Drawn edge id -> observed state. */
  edgeStates: Record<string, LiveNodeState>;
  /** Drawn node id -> the outcome its own cell testified; absent until that cell testifies one. */
  outcomes: Record<string, LiveOutcome>;
  /** Raw cell id -> the outcome that cell testified, before aggregation onto the drawn node. */
  cellOutcomes: Record<string, LiveOutcome>;
  transitions: LiveTransition[];
  /** Testimony whose id has no membership entry in the run graph. Never lit, never dropped. */
  unmatched: string[];
  output?: unknown;
  outputText?: string;
  error?: { code: string; message: string };
}

interface LiveRunApi extends LiveRunView {
  admit: (namespace: string, capabilityId: string, input: string) => void;
  reset: () => void;
}

const POLL_INTERVAL_MS = 300;
/** The engine appends this marker to the lane when the run's public graph is captured. */
const GRAPH_CAPTURED_MARKER = 'graph.captured';

/** The canonical digest the lane's `graph.captured` marker names, or undefined before capture. */
export function graphCapturedDigest(events: SdaRunEvent[]): string | undefined {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event?.kind !== GRAPH_CAPTURED_MARKER) continue;
    const payload = event.payload;
    if (payload !== null && typeof payload === 'object' && 'canonicalGraphDigest' in payload) {
      const digest = (payload as { canonicalGraphDigest?: unknown }).canonicalGraphDigest;
      if (typeof digest === 'string' && digest.length > 0) return digest;
    }
  }
  return undefined;
}

const LiveRunContext = createContext<LiveRunApi | undefined>(undefined);

export function useLiveRun(): LiveRunApi {
  const context = useContext(LiveRunContext);
  if (!context) throw new Error('useLiveRun must be used within LiveRunProvider');
  return context;
}

export function useLiveRunOptional(): LiveRunApi | undefined {
  return useContext(LiveRunContext);
}

function failureOf(events: SdaRunEvent[]): { code: string; message: string } | undefined {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event?.kind !== 'run.exited') continue;
    const payload = event.payload;
    if (payload && typeof payload === 'object' && 'failure' in payload) {
      const failure = (payload as { failure?: { code?: unknown; message?: unknown } }).failure;
      if (failure && typeof failure.code === 'string' && typeof failure.message === 'string') return { code: failure.code, message: failure.message };
    }
  }
  return undefined;
}

function logTransitions(transitions: LiveTransition[], from: number): void {
  for (const transition of transitions.slice(from)) {
    console.info(
      `[sda-live] node ${transition.nodeId}: ${transition.from ?? 'idle'} -> ${transition.to} ` +
        `(cursor ${transition.cursor}, ${transition.kind}/${transition.signal})`
    );
  }
}

/** One observed page of the run lane: the accumulated sequence, the bound trace and the graph. */
export interface RunLaneProgress {
  events: SdaRunEvent[];
  trace: LiveTrace;
  graph?: RunGraphView;
  graphError?: { code: string; message: string };
  terminal: boolean;
  state: SdaRunState;
  output?: unknown;
  outputText?: string;
  failure?: { code: string; message: string };
}

/**
 * Drain the lane from admission to terminal. The graph is bound exactly when the lane says it
 * was captured: the marker's `canonicalGraphDigest` selects the caller's compiled graph when it
 * matches, otherwise the run graph is fetched once. Testimony seen before the graph is replayed
 * onto it, so no observed light is lost. A terminal run that never captured a graph reports a
 * visible `GRAPH_UNAVAILABLE` — the trace never draws from an absent graph.
 */
export async function drainRunLane(options: {
  runId: string;
  advance: (runId: string, after: number) => Promise<RunAdvance>;
  graph: (runId: string) => Promise<RunGraphResult>;
  compiledGraph?: SdaRunGraph;
  cancelled: () => boolean;
  onPage: (progress: RunLaneProgress) => void;
}): Promise<void> {
  let events: SdaRunEvent[] = [];
  let cursor = 0;
  let graph: RunGraphView | undefined;
  let graphError: { code: string; message: string } | undefined;
  let graphCaptured = false;
  let trace = emptyTrace();
  for (;;) {
    const page = await options.advance(options.runId, cursor);
    if (options.cancelled()) return;
    if (!page.ok) {
      options.onPage({
        events,
        trace,
        graph,
        graphError,
        terminal: true,
        state: 'failed',
        failure: { code: page.code, message: page.message }
      });
      return;
    }

    events = events.concat(page.events);
    cursor = page.nextCursor;
    if (!graphCaptured) {
      const digest = graphCapturedDigest(page.events);
      if (digest !== undefined) {
        const compiled = options.compiledGraph;
        if (compiled !== undefined && compiled.canonicalGraphDigest === digest) {
          graph = buildRunGraphView(normalizeRunGraph(compiled));
          graphCaptured = true;
        } else {
          const result = await options.graph(options.runId);
          if (options.cancelled()) return;
          if (result.ok) {
            graph = buildRunGraphView(normalizeRunGraph(result.value));
            graphCaptured = true;
            graphError = undefined;
          } else {
            graphError = { code: result.code, message: result.message };
          }
        }
        // The graph binds after some testimony may already have been read: replay the whole
        // observed sequence onto it so those lights are not lost.
        trace = applyEvents(emptyTrace(graph), events, graph);
      } else {
        trace = applyEvents(trace, page.events, graph);
      }
    } else {
      trace = applyEvents(trace, page.events, graph);
    }

    const drained = page.terminal && page.hasMore !== true;
    if (drained && !graphCaptured && graphError === undefined) {
      graphError = {
        code: 'GRAPH_UNAVAILABLE',
        message: 'The run reached a terminal state without a graph.captured marker; the trace cannot bind by cell id.'
      };
    }
    options.onPage({
      events,
      trace,
      graph,
      graphError: graphCaptured ? undefined : graphError,
      terminal: drained,
      state: page.state,
      output: page.output?.document,
      outputText: page.output?.text,
      failure: drained && page.state !== 'completed'
        ? failureOf(events) ?? { code: 'RUN_FAILED', message: 'The run reached a failed terminal state.' }
        : undefined
    });
    if (drained) return;
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

export function LiveRunProvider({
  admit: admitAction,
  advance,
  graph: graphAction,
  compiledGraph,
  children,
}: {
  admit: (namespace: string, capabilityId: string, input: string) => Promise<RunAdmission>;
  advance: (runId: string, after: number) => Promise<RunAdvance>;
  graph: (runId: string) => Promise<RunGraphResult>;
  /** A compiled capability graph (no run) the trace may adopt when its digest matches the marker. */
  compiledGraph?: SdaRunGraph;
  children: ReactNode;
}) {
  const [view, setView] = useState<LiveRunView>({ phase: 'idle', events: [], states: {}, edgeStates: {}, outcomes: {}, cellOutcomes: {}, transitions: [], unmatched: [] });
  const runToken = useRef(0);

  useEffect(() => () => { runToken.current += 1; }, []);

  const reset = useCallback(() => {
    runToken.current += 1;
    setView({ phase: 'idle', events: [], states: {}, edgeStates: {}, outcomes: {}, cellOutcomes: {}, transitions: [], unmatched: [] });
  }, []);

  const admit = useCallback(
    (namespace: string, capabilityId: string, input: string) => {
      const request = ++runToken.current;
      setView({ phase: 'admitting', events: [], states: {}, edgeStates: {}, outcomes: {}, cellOutcomes: {}, transitions: [], unmatched: [] });
      void (async () => {
        const admission = await admitAction(namespace, capabilityId, input);
        if (runToken.current !== request) return;
        if (!admission.ok) {
          setView((current) => ({ ...current, phase: 'failed', error: { code: admission.code, message: admission.message } }));
          return;
        }
        setView({
          phase: 'polling',
          runId: admission.runId,
          events: [],
          states: {},
          edgeStates: {},
          outcomes: {},
          cellOutcomes: {},
          transitions: [],
          unmatched: []
        });

        let logged = 0;
        await drainRunLane({
          runId: admission.runId,
          advance,
          graph: graphAction,
          compiledGraph,
          cancelled: () => runToken.current !== request,
          onPage: (progress) => {
            if (runToken.current !== request) return;
            logTransitions(progress.trace.transitions, logged);
            logged = progress.trace.transitions.length;
            setView({
              phase: progress.terminal ? (progress.state === 'completed' ? 'complete' : 'failed') : 'polling',
              runId: admission.runId,
              terminalState: progress.terminal ? progress.state : undefined,
              events: progress.events,
              graph: progress.graph,
              graphError: progress.graphError,
              states: progress.trace.states,
              edgeStates: progress.trace.edgeStates,
              outcomes: progress.trace.outcomes,
              cellOutcomes: progress.trace.cellOutcomes,
              transitions: progress.trace.transitions,
              unmatched: progress.trace.unmatched,
              output: progress.output,
              outputText: progress.outputText,
              error: progress.failure
            });
          }
        });
      })();
    },
    [admitAction, advance, graphAction, compiledGraph]
  );

  const value = useMemo<LiveRunApi>(() => ({ ...view, admit, reset }), [view, admit, reset]);

  return <LiveRunContext.Provider value={value}>{children}</LiveRunContext.Provider>;
}
