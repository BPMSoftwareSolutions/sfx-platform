'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import type { RunAdmission, RunAdvance, RunGraphResult, SdaRunEvent, SdaRunState } from '@/contracts/sda-api';
import { applyEvents, emptyTrace, type LiveNodeState, type LiveTransition } from '@/lib/live-trace';
import { buildRunGraphView, normalizeRunGraph, type RunGraphView } from '@/lib/run-graph';

/**
 * Live run context — §6 item 2, trace plan §4.2.
 *
 * Admit a run, fetch the run's declared public graph (the id-binding skeleton) at run start,
 * advance the cursor, bind each testimony to its cell or edge by id and hold the lean output.
 * Node states change only when the node's own testimony arrives; the graph is never invented.
 * Cursor polling only (T1); no timeline framework and no replay.
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
const GRAPH_FETCH_ATTEMPTS = 12;
const GRAPH_FETCH_DELAY_MS = 250;
/** The graph is emitted at compile time; until then the host reports no capture yet. */
const GRAPH_PENDING_CODES = new Set(['GRAPH_UNAVAILABLE', 'RUN_NOT_FOUND', 'RUN_NOT_TERMINAL', 'CONFLICT', 'NOT_FOUND']);

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

/** The graph can lag admission; retry only while the host reports the run has not compiled yet. */
async function readGraphWithRetry(
  readGraph: (runId: string) => Promise<RunGraphResult>,
  runId: string,
  cancelled: () => boolean
): Promise<RunGraphResult> {
  let last: RunGraphResult = { ok: false, code: 'UNREACHABLE', message: 'The run graph could not be read.' };
  for (let attempt = 0; attempt < GRAPH_FETCH_ATTEMPTS; attempt += 1) {
    if (cancelled()) return last;
    last = await readGraph(runId);
    if (last.ok || !GRAPH_PENDING_CODES.has(last.code)) return last;
    await new Promise((resolve) => setTimeout(resolve, GRAPH_FETCH_DELAY_MS));
  }
  return last;
}

export function LiveRunProvider({
  admit: admitAction,
  advance,
  graph: graphAction,
  children,
}: {
  admit: (namespace: string, capabilityId: string, input: string) => Promise<RunAdmission>;
  advance: (runId: string, after: number) => Promise<RunAdvance>;
  graph: (runId: string) => Promise<RunGraphResult>;
  children: ReactNode;
}) {
  const [view, setView] = useState<LiveRunView>({ phase: 'idle', events: [], states: {}, edgeStates: {}, transitions: [], unmatched: [] });
  const runToken = useRef(0);

  useEffect(() => () => { runToken.current += 1; }, []);

  const reset = useCallback(() => {
    runToken.current += 1;
    setView({ phase: 'idle', events: [], states: {}, edgeStates: {}, transitions: [], unmatched: [] });
  }, []);

  const admit = useCallback(
    (namespace: string, capabilityId: string, input: string) => {
      const request = ++runToken.current;
      setView({ phase: 'admitting', events: [], states: {}, edgeStates: {}, transitions: [], unmatched: [] });
      void (async () => {
        const admission = await admitAction(namespace, capabilityId, input);
        if (runToken.current !== request) return;
        if (!admission.ok) {
          setView((current) => ({ ...current, phase: 'failed', error: { code: admission.code, message: admission.message } }));
          return;
        }

        // Bind by id: without the run graph, no event has a node to light. Fetch it first.
        const graphResult = await readGraphWithRetry(graphAction, admission.runId, () => runToken.current !== request);
        if (runToken.current !== request) return;
        const graph = graphResult.ok ? buildRunGraphView(normalizeRunGraph(graphResult.value)) : undefined;

        let trace = emptyTrace(graph);
        let events: SdaRunEvent[] = [];
        let cursor = 0;
        let logged = 0;
        setView((current) => ({
          ...current,
          phase: 'polling',
          runId: admission.runId,
          graph,
          graphError: graphResult.ok ? undefined : { code: graphResult.code, message: graphResult.message },
          states: trace.states,
          edgeStates: trace.edgeStates,
        }));

        for (;;) {
          const page = await advance(admission.runId, cursor);
          if (runToken.current !== request) return;
          if (!page.ok) {
            setView((current) => ({ ...current, phase: 'failed', error: { code: page.code, message: page.message } }));
            return;
          }

          events = events.concat(page.events);
          trace = applyEvents(trace, page.events, graph);
          cursor = page.nextCursor;
          // The terminal page can still carry more events than one page holds; drain them before
          // reporting terminal so the cursor closes on the last observed event.
          const drained = page.terminal && page.hasMore !== true;
          logTransitions(trace.transitions, logged);
          logged = trace.transitions.length;

          setView({
            phase: drained ? (page.state === 'completed' ? 'complete' : 'failed') : 'polling',
            runId: admission.runId,
            terminalState: drained ? page.state : undefined,
            events,
            graph,
            graphError: graphResult.ok ? undefined : { code: graphResult.code, message: graphResult.message },
            states: trace.states,
            edgeStates: trace.edgeStates,
            transitions: trace.transitions,
            unmatched: trace.unmatched,
            output: page.output?.document,
            outputText: page.output?.text,
            error: drained && page.state !== 'completed' ? failureOf(events) ?? { code: 'RUN_FAILED', message: 'The run reached a failed terminal state.' } : undefined,
          });
          if (drained) return;
          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        }
      })();
    },
    [admitAction, advance, graphAction]
  );

  const value = useMemo<LiveRunApi>(() => ({ ...view, admit, reset }), [view, admit, reset]);

  return <LiveRunContext.Provider value={value}>{children}</LiveRunContext.Provider>;
}
