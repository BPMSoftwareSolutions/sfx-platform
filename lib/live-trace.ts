import type { SdaRunEvent, SdaRunState } from '@/contracts/sda-api';

/**
 * Live node-state mapping — §6 item 2.
 *
 * Kernel step ids and delivery phases map explicitly to the canonical circuit node ids.
 * Observed state is applied as a class by the viewer; the declared route is never presented
 * as observed execution.
 */

export type LiveNodeState = 'active' | 'done' | 'failed';

export interface LiveTransition {
  cursor: number;
  kind: string;
  signal: string;
  nodeId: string;
  from: LiveNodeState | null;
  to: LiveNodeState;
}

export interface LiveTrace {
  states: Record<string, LiveNodeState>;
  transitions: LiveTransition[];
  active: string | null;
}

export function emptyTrace(): LiveTrace {
  return { states: {}, transitions: [], active: null };
}

interface EventFacts {
  stepId?: string;
  phase?: string;
  status?: string;
  disposition?: string;
  admissionDisposition?: string;
  testimonyType?: string;
  cellAltitude?: string;
  outcomeVariant?: string;
}

const STEP_NODE: Record<string, string> = {
  'admit-input': 'input',
  'resolve-event-authority': 'event',
  'execute-event-authority': 'event',
  'admit-outcome': 'outcome',
  'resolve-disposition': 'outcome',
};

const PHASE_NODE: Record<string, string> = {
  readExecutionDelivery: 'input',
  readAuthority: 'input',
  executeDeclaredGraph: 'responsibility',
};

const FAILED_STATUS = new Set(['failed', 'rejected', 'admission-rejected', 'error']);

function factsOf(event: SdaRunEvent): EventFacts {
  return event.payload !== null && typeof event.payload === 'object' ? (event.payload as EventFacts) : {};
}

export function signalOf(event: SdaRunEvent): string {
  const facts = factsOf(event);
  return facts.stepId ?? facts.phase ?? facts.testimonyType ?? event.kind;
}

function nodeFor(event: SdaRunEvent, facts: EventFacts): string | undefined {
  if (event.kind === 'run.admitted') return 'input';
  if (facts.stepId && STEP_NODE[facts.stepId]) return STEP_NODE[facts.stepId];
  if (facts.phase && PHASE_NODE[facts.phase]) return PHASE_NODE[facts.phase];
  if (facts.testimonyType === 'cell-execution-testimony.v1' || facts.cellAltitude) {
    return facts.cellAltitude === 'scenario' ? 'outcome' : 'responsibility';
  }
  return undefined;
}

function desiredFor(event: SdaRunEvent, facts: EventFacts): LiveNodeState | undefined {
  if (event.kind === 'run.exited' || event.kind === 'run.stderr') return undefined;
  const status = facts.status ?? facts.disposition ?? facts.admissionDisposition;
  if (status && FAILED_STATUS.has(status)) return 'failed';
  if (event.kind === 'run.admitted') return 'active';
  if (facts.testimonyType === 'cell-execution-testimony.v1' || facts.cellAltitude) return 'active';
  if (status === 'started' || status === 'deferred') return 'active';
  if (status === 'completed' || status === 'observed' || facts.disposition === 'completed') return 'done';
  return undefined;
}

/** Apply one page of events in cursor order. Returns a new trace; unchanged states add no transition. */
export function applyEvents(trace: LiveTrace, events: SdaRunEvent[]): LiveTrace {
  const states: Record<string, LiveNodeState> = { ...trace.states };
  const transitions = trace.transitions.slice();
  let active = trace.active;

  for (const event of events) {
    const facts = factsOf(event);
    const nodeId = nodeFor(event, facts);
    if (!nodeId) continue;
    const desired = desiredFor(event, facts);
    if (!desired) continue;
    const current = states[nodeId] ?? null;
    if (current === 'failed') continue;

    if (desired === 'active') {
      if (current === 'done') continue;
      if (current === 'active') { active = nodeId; continue; }
      if (active && active !== nodeId && states[active] === 'active') {
        states[active] = 'done';
        transitions.push({ cursor: event.cursor, kind: event.kind, signal: signalOf(event), nodeId: active, from: 'active', to: 'done' });
      }
      states[nodeId] = 'active';
      active = nodeId;
      transitions.push({ cursor: event.cursor, kind: event.kind, signal: signalOf(event), nodeId, from: null, to: 'active' });
      continue;
    }

    if (current === desired) continue;
    states[nodeId] = desired;
    transitions.push({ cursor: event.cursor, kind: event.kind, signal: signalOf(event), nodeId, from: current, to: desired });
    if (active === nodeId) active = null;
  }

  return { states, transitions, active };
}

/** Close the trace when the run reaches a terminal state. */
export function settleTrace(trace: LiveTrace, finalState: SdaRunState, cursor: number): LiveTrace {
  const states: Record<string, LiveNodeState> = { ...trace.states };
  const transitions = trace.transitions.slice();
  let active = trace.active;

  if (!active) {
    if (states.outcome === undefined) {
      states.outcome = 'active';
      active = 'outcome';
      transitions.push({ cursor, kind: 'run.exited', signal: 'run.exited', nodeId: 'outcome', from: null, to: 'active' });
    } else if (states.outcome === 'active') {
      active = 'outcome';
    }
  }
  if (active) {
    const to: LiveNodeState = finalState === 'failed' ? 'failed' : 'done';
    if (states[active] !== to) {
      transitions.push({ cursor, kind: 'run.exited', signal: 'run.exited', nodeId: active, from: states[active] ?? null, to });
      states[active] = to;
    }
  }

  return { states, transitions, active: null };
}
