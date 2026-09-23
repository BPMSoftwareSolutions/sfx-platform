import type { SdaRunEvent } from '@/contracts/sda-api';
import type { RunGraphView, RunGraphViewNode } from '@/lib/run-graph';

/**
 * Live trace binding — §4.2 of the trace plan, id binding only.
 *
 * Step ids, delivery phases and cell altitudes are not vocabulary the platform understands. A
 * cell lights because its `cellId` has a membership entry in the run graph; an edge lights
 * because its `edgeId` does. Testimony with no membership is recorded as unmatched and never
 * lights anything. Planned nodes are drawn unlit until their own testimony arrives.
 *
 * State rules — decision D1 (docs/observation-altitudes-implementation-plan-2026-09-23.md §3),
 * obs §5, OA5 and acceptance item 5:
 *
 * - A cell's state comes from its own testimony only: its `disposition` (or `status`),
 *   `failureCode`, the declared failure testimony type and `outcomeClassification`. The display
 *   entry's `text` and `status` are presentation, never evidence, and no variant is read by name.
 *   - `failed`: an execution failure (a `failureCode`, the failure testimony type or a failed
 *     disposition), or a cell that completed with `outcomeClassification: "failure"`. A failed
 *     attempt shows as failed.
 *   - `done`: any other completed cell.
 *   - `active`: a started or pending cell.
 * - Every cell's testified outcome (`outcomeVariant`, `outcomeClassification`) is recorded beside
 *   its state: completion and outcome are distinct facts. A classification the testimony does
 *   not carry stays `null`; it is never inferred from the variant.
 * - A drawn node's id is a cellId. Once that cell has testified, the node's state is the cell's
 *   own state. Before then the node is `active` if any member has testified and `planned`
 *   otherwise. A member's failure never overrides the node's own testified state; the node keeps
 *   a count of its failed members so the failure stays visible.
 * - Nothing is marked superseded. No declared fact says a later route superseded an attempt,
 *   so no rule produces `held`.
 * - `run.admitted`, `run.started` and `run.exited` set the run's own status (`run`) and never a
 *   node. Process exit completes the run; it is not the scenario's outcome.
 */

/**
 * `held` is produced by no rule here (D1). It stays in the union because renderer code still
 * names it (`components/circuit/circuit-viewer.tsx`, `app/globals.css`).
 */
export type LiveNodeState = 'planned' | 'active' | 'done' | 'held' | 'failed';

/** An outcome as one cell testified it. A member the testimony did not carry is `null`. */
export interface LiveOutcome {
  variant: string | null;
  classification: string | null;
}

/** The run's own lifecycle, from the lane's run events alone. It never sets a node state. */
export interface LiveRunStatus {
  /** The latest run lifecycle event observed. */
  state: 'admitted' | 'started' | 'exited';
  /** The exit code `run.exited` carried; `null` before exit or when the host reported none. */
  exitCode: number | null;
}

export interface LiveTransition {
  cursor: number;
  kind: string;
  signal: string;
  nodeId: string;
  from: LiveNodeState | null;
  to: LiveNodeState;
}

/**
 * One step of the observed trail a run leaves: the drawn node or edge whose own testimony
 * advanced it, in cursor order. This is the only sequence a traveling token may follow —
 * nothing is inferred between testimonies and no declared route is walked without one.
 */
export interface LiveTrailStep {
  /** Drawn node id or drawn edge id. */
  id: string;
  /** The observed state the testimony carried. */
  state: LiveNodeState;
}

export interface LiveTrace {
  /** Drawn node id -> aggregated state over its member cells. */
  states: Record<string, LiveNodeState>;
  /** Drawn edge id -> aggregated state over its member edge testimony. */
  edgeStates: Record<string, LiveNodeState>;
  /** Raw cell id -> observed state, before aggregation onto the drawn node. */
  cells: Record<string, LiveNodeState>;
  /** Raw edge id -> observed state, before aggregation onto the drawn edge. */
  edges: Record<string, LiveNodeState>;
  /** Drawn node id -> the outcome its own cell testified; absent until that cell testifies one. */
  outcomes: Record<string, LiveOutcome>;
  /** Raw cell id -> the outcome that cell testified. */
  cellOutcomes: Record<string, LiveOutcome>;
  /** Drawn node id -> how many of its member cells, other than its own, are failed. */
  failedMembers: Record<string, number>;
  transitions: LiveTransition[];
  /** The most recently active drawn node, for the pulse. Cleared only by later testimony. */
  active: string | null;
  /** Testimony ids with no membership entry: bound to nothing, never dropped, never lit. */
  unmatched: string[];
  /** The run's lifecycle status; `null` until a run lifecycle event arrives. */
  run: LiveRunStatus | null;
}

interface EventFacts {
  testimonyType?: string;
  observationType?: string;
  status?: string;
  disposition?: string;
  admissionDisposition?: string;
  cellAltitude?: string;
  outcomeVariant?: string;
  outcomeClassification?: string;
  display?: { entry?: { status?: string } };
  failureCode?: string;
  failureMessage?: string;
  cellId?: string;
  edgeId?: string;
  destinationCellId?: string;
  logicalOrder?: number;
  exitCode?: number;
}

const FAILED_STATUS = new Set(['failed', 'rejected', 'admission-rejected', 'error']);
const DONE_STATUS = new Set(['completed', 'observed', 'admitted', 'terminated', 'succeeded', 'selected']);
const ACTIVE_STATUS = new Set(['started', 'deferred', 'buffered', 'pending']);
/** The kernel's declared failure record (`GraphObservationFailures.ObservationType`). */
const FAILURE_TESTIMONY_TYPE = 'execution-failure-testimony.v1';
/** The host's run lifecycle event kinds (sda-api-v1 authority, `runEvent.kind`). */
const RUN_LIFECYCLE = new Map<string, LiveRunStatus['state']>([
  ['run.admitted', 'admitted'],
  ['run.started', 'started'],
  ['run.exited', 'exited'],
]);

function factsOf(event: SdaRunEvent): EventFacts {
  return event.payload !== null && typeof event.payload === 'object' ? (event.payload as EventFacts) : {};
}

/** What the run panel shows for a transition line: the declared fact, never a parse. */
export function signalOf(event: SdaRunEvent): string {
  const facts = factsOf(event);
  return facts.testimonyType ?? facts.disposition ?? facts.admissionDisposition ?? facts.status ?? event.kind;
}

function isTestimony(facts: EventFacts): boolean {
  return typeof facts.testimonyType === 'string' && facts.testimonyType.length > 0;
}

/** The kernel's failure record, by its exact declared type; never a substring of a type name. */
function isFailureTestimony(facts: EventFacts): boolean {
  return facts.testimonyType === FAILURE_TESTIMONY_TYPE || facts.observationType === FAILURE_TESTIMONY_TYPE;
}

function cellState(facts: EventFacts): LiveNodeState | undefined {
  const status = facts.disposition ?? facts.status;
  // An execution failure is declared on the cell itself: a failure code, the failure testimony or
  // a failed disposition. The display entry is presentation and is never consulted.
  if (facts.failureCode || isFailureTestimony(facts) || (status ? FAILED_STATUS.has(status) : false)) {
    return 'failed';
  }
  // A completed cell is done unless its own outcome is classified `failure`: a failed attempt
  // shows as failed, with its variant recorded beside it. The classification is the engine's own
  // verdict; nothing is inferred from the variant's name.
  if (status && DONE_STATUS.has(status)) return facts.outcomeClassification === 'failure' ? 'failed' : 'done';
  if (status && ACTIVE_STATUS.has(status)) return 'active';
  if (facts.cellId && isTestimony(facts)) return 'active';
  return undefined;
}

/** The outcome a testimony carries, or undefined when it carries neither member. */
function outcomeOf(facts: EventFacts): LiveOutcome | undefined {
  const variant = typeof facts.outcomeVariant === 'string' ? facts.outcomeVariant : null;
  const classification = typeof facts.outcomeClassification === 'string' ? facts.outcomeClassification : null;
  return variant === null && classification === null ? undefined : { variant, classification };
}

function edgeState(facts: EventFacts): LiveNodeState | undefined {
  const admission = facts.admissionDisposition ?? facts.disposition;
  if (facts.failureCode || isFailureTestimony(facts) || (admission ? FAILED_STATUS.has(admission) : false)) return 'failed';
  if (admission && DONE_STATUS.has(admission)) return 'done';
  if (admission && ACTIVE_STATUS.has(admission)) return 'active';
  // A cancelled or rejected admission is observed testimony that the edge was not taken: the
  // drawn edge stays planned (unlit) rather than being shown as executed.
  if (admission === 'cancelled') return undefined;
  if (facts.edgeId && isTestimony(facts)) return 'done';
  return undefined;
}

/**
 * A drawn node's state is its own cell's testified state (the node id is that cell's id). Until
 * that cell testifies, the node is active when any member has testified and planned otherwise.
 * A member never overrides the node's own state; its failure is counted instead.
 */
function nodeState(
  node: RunGraphViewNode | undefined,
  cells: Record<string, LiveNodeState>
): { state: LiveNodeState; failedMembers: number } {
  if (!node) return { state: 'planned', failedMembers: 0 };
  let memberTestified = false;
  let failedMembers = 0;
  for (const member of node.memberCellIds) {
    if (member === node.id) continue;
    const state = cells[member];
    if (state === undefined) continue;
    memberTestified = true;
    if (state === 'failed') failedMembers += 1;
  }
  const own = cells[node.id];
  return { state: own ?? (memberTestified ? 'active' : 'planned'), failedMembers };
}

function aggregateEdge(view: RunGraphView, edgeId: string, edgeStates: Record<string, LiveNodeState>): LiveNodeState {
  const edge = view.edges.find((candidate) => candidate.id === edgeId);
  if (!edge) return 'planned';
  let result: LiveNodeState = 'planned';
  for (const member of edge.memberEdgeIds) {
    const state = edgeStates[member];
    if (state === 'failed') return 'failed';
    if (state === 'active') result = 'active';
    else if (state === 'done' && result !== 'active') result = 'done';
  }
  return result;
}

/** The observed trail in transition (cursor) order; the traveling token advances through it. */
export function testimonyTrail(transitions: LiveTransition[]): LiveTrailStep[] {
  return transitions.map((transition) => ({ id: transition.nodeId, state: transition.to }));
}

/** Initialise the trace for a fetched run graph: every drawn node and edge planned, unlit. */
export function emptyTrace(view?: RunGraphView): LiveTrace {
  const states: Record<string, LiveNodeState> = {};
  const edgeStates: Record<string, LiveNodeState> = {};
  const failedMembers: Record<string, number> = {};
  if (view) {
    for (const node of view.nodes) {
      states[node.id] = 'planned';
      failedMembers[node.id] = 0;
    }
    for (const edge of view.edges) edgeStates[edge.id] = 'planned';
  }
  return {
    states,
    edgeStates,
    cells: {},
    edges: {},
    outcomes: {},
    cellOutcomes: {},
    failedMembers,
    transitions: [],
    active: null,
    unmatched: [],
    run: null,
  };
}

/**
 * Apply one page of events in cursor order against the run graph's membership.
 *
 * Without a graph there is no id binding: no event can name a node, so the trace is unchanged.
 */
export function applyEvents(trace: LiveTrace, events: SdaRunEvent[], view?: RunGraphView): LiveTrace {
  if (!view) return trace;

  const states: Record<string, LiveNodeState> = { ...trace.states };
  const edgeStates: Record<string, LiveNodeState> = { ...trace.edgeStates };
  const cells: Record<string, LiveNodeState> = { ...trace.cells };
  const edges: Record<string, LiveNodeState> = { ...trace.edges };
  const outcomes: Record<string, LiveOutcome> = { ...trace.outcomes };
  const cellOutcomes: Record<string, LiveOutcome> = { ...trace.cellOutcomes };
  const failedMembers: Record<string, number> = { ...trace.failedMembers };
  const transitions = trace.transitions.slice();
  const unmatched = trace.unmatched.slice();
  let active = trace.active;
  let run = trace.run;
  const nodes = new Map(view.nodes.map((node) => [node.id, node]));

  const noteUnmatched = (id: string) => {
    if (!unmatched.includes(id)) unmatched.push(id);
  };

  const applyNode = (cursor: number, kind: string, signal: string, nodeId: string) => {
    const previous = states[nodeId] ?? 'planned';
    const next = nodeState(nodes.get(nodeId), cells);
    failedMembers[nodeId] = next.failedMembers;
    const own = cellOutcomes[nodeId];
    if (own) outcomes[nodeId] = own;
    if (next.state === previous) return;
    states[nodeId] = next.state;
    transitions.push({ cursor, kind, signal, nodeId, from: previous, to: next.state });
    if (next.state === 'active') active = nodeId;
    else if (active === nodeId) active = null;
  };

  const applyEdge = (cursor: number, kind: string, signal: string, edgeId: string) => {
    const previous = edgeStates[edgeId] ?? 'planned';
    if (previous === 'failed') return;
    const next = aggregateEdge(view, edgeId, edges);
    if (next === previous) return;
    edgeStates[edgeId] = next;
    transitions.push({ cursor, kind, signal, nodeId: edgeId, from: previous, to: next });
    if (next === 'active') active = edgeId;
    else if (active === edgeId) active = null;
  };

  for (const event of events) {
    const facts = factsOf(event);
    const kind = event.kind;
    const signal = signalOf(event);

    // The run's lifecycle is the run's status, never a node's: exit is not the scenario's outcome.
    const lifecycle = RUN_LIFECYCLE.get(kind);
    if (lifecycle) {
      run = { state: lifecycle, exitCode: lifecycle === 'exited' && typeof facts.exitCode === 'number' ? facts.exitCode : null };
      continue;
    }

    if (facts.cellId) {
      const cellId = facts.cellId;
      const state = cellState(facts);
      if (state) {
        // A failure sticks at its cell: later testimony repaints neither its state nor its outcome.
        if (cells[cellId] !== 'failed') {
          cells[cellId] = state;
          const outcome = outcomeOf(facts);
          if (outcome) cellOutcomes[cellId] = outcome;
        }
        const nodeId = view.membership[cellId];
        if (nodeId) applyNode(event.cursor, kind, signal, nodeId);
        else noteUnmatched(cellId);
      }
      continue;
    }

    if (facts.edgeId) {
      const state = edgeState(facts);
      if (state) {
        edges[facts.edgeId] = edges[facts.edgeId] === 'failed' ? 'failed' : state;
        const edgeId = view.edgeMembership[facts.edgeId];
        if (edgeId) applyEdge(event.cursor, kind, signal, edgeId);
        // A route internal to one drawn node is in the graph: its node carries the cell states.
        else if (!view.internalEdgeNode[facts.edgeId]) noteUnmatched(facts.edgeId);
      }
    }
  }

  return { states, edgeStates, cells, edges, outcomes, cellOutcomes, failedMembers, transitions, active, unmatched, run };
}
