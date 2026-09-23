'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import type { RunAdmission, RunAdvance, SdaRunEvent, SdaRunState } from '@/contracts/sda-api';
import { applyEvents, emptyTrace, settleTrace, type LiveNodeState, type LiveTransition } from '@/lib/live-trace';

/**
 * Live run context — §6 item 2, minimal v1.
 *
 * Admit a run, advance the cursor, map observed events onto circuit nodes and hold the lean
 * output. Cursor polling only (T1); no timeline framework and no replay.
 */

export type LivePhase = 'idle' | 'admitting' | 'polling' | 'complete' | 'failed';

export interface LiveRunView {
  phase: LivePhase;
  runId?: string;
  terminalState?: SdaRunState;
  events: SdaRunEvent[];
  states: Record<string, LiveNodeState>;
  transitions: LiveTransition[];
  output?: unknown;
  outputText?: string;
  error?: { code: string; message: string };
}

interface LiveRunApi extends LiveRunView {
  admit: (namespace: string, capabilityId: string, input: string) => void;
  reset: () => void;
}

const POLL_INTERVAL_MS = 300;

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

export function LiveRunProvider({
  admit: admitAction,
  advance,
  children,
}: {
  admit: (namespace: string, capabilityId: string, input: string) => Promise<RunAdmission>;
  advance: (runId: string, after: number) => Promise<RunAdvance>;
  children: ReactNode;
}) {
  const [view, setView] = useState<LiveRunView>({ phase: 'idle', events: [], states: {}, transitions: [] });
  const runToken = useRef(0);

  useEffect(() => () => { runToken.current += 1; }, []);

  const reset = useCallback(() => {
    runToken.current += 1;
    setView({ phase: 'idle', events: [], states: {}, transitions: [] });
  }, []);

  const admit = useCallback(
    (namespace: string, capabilityId: string, input: string) => {
      const request = ++runToken.current;
      setView({ phase: 'admitting', events: [], states: {}, transitions: [] });
      void (async () => {
        const admission = await admitAction(namespace, capabilityId, input);
        if (runToken.current !== request) return;
        if (!admission.ok) {
          setView((current) => ({ ...current, phase: 'failed', error: { code: admission.code, message: admission.message } }));
          return;
        }

        let trace = emptyTrace();
        let events: SdaRunEvent[] = [];
        let cursor = 0;
        let logged = 0;
        setView((current) => ({ ...current, phase: 'polling', runId: admission.runId }));

        for (;;) {
          const page = await advance(admission.runId, cursor);
          if (runToken.current !== request) return;
          if (!page.ok) {
            setView((current) => ({ ...current, phase: 'failed', error: { code: page.code, message: page.message } }));
            return;
          }

          events = events.concat(page.events);
          trace = applyEvents(trace, page.events);
          cursor = page.nextCursor;
          // The terminal page can still carry more events than one page holds; drain them before
          // settling so the trace is complete and the cursor closes on the last observed event.
          const drained = page.terminal && page.hasMore !== true;
          if (drained) trace = settleTrace(trace, page.state, page.latestCursor);
          logTransitions(trace.transitions, logged);
          logged = trace.transitions.length;

          setView({
            phase: drained ? (page.state === 'completed' ? 'complete' : 'failed') : 'polling',
            runId: admission.runId,
            terminalState: drained ? page.state : undefined,
            events,
            states: trace.states,
            transitions: trace.transitions,
            output: page.output?.document,
            outputText: page.output?.text,
            error: drained && page.state !== 'completed' ? failureOf(events) ?? { code: 'RUN_FAILED', message: 'The run reached a failed terminal state.' } : undefined,
          });
          if (drained) return;
          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        }
      })();
    },
    [admitAction, advance]
  );

  const value = useMemo<LiveRunApi>(() => ({ ...view, admit, reset }), [view, admit, reset]);

  return <LiveRunContext.Provider value={value}>{children}</LiveRunContext.Provider>;
}
