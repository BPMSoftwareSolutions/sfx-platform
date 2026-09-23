import type { SdaRunEvent } from '@/contracts/sda-api';
import type { RunGraphView } from '@/lib/run-graph';

/**
 * Live trace binding — §4.2 of the trace plan, id binding only.
 *
 * Step ids, delivery phases and cell altitudes are not vocabulary the platform understands. A
 * cell lights because its `cellId` has a membership entry in the run graph; an edge lights
 * because its `edgeId` does. Testimony with no membership is recorded as unmatched and never
 * lights anything. Planned nodes are drawn unlit until their own testimony arrives, and a run
 * reaching a terminal state never invents a node state — only testimony moves a node.
 */

export type LiveNodeState = 'planned' | 'active' | 'done' | 'failed';

export interface LiveTransition {
  cursor: number;
  kind: string;
  signal: string;
  nodeId: string;
  from: LiveNodeState | null;
  to: LiveNodeState;
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
  transitions: LiveTransition[];
  /** The most recently active drawn node, for the pulse. Cleared only by later testimony. */
  active: string | null;
  /** Testimony ids with no membership entry: bound to nothing, never dropped, never lit. */
  unmatched: string[];
}

interface EventFacts {
  testimonyType?: string;
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
}

const FAILED_STATUS = new Set(['failed', 'rejected', 'admission-rejected', 'error']);
const DONE_STATUS = new Set(['completed', 'observed', 'admitted', 'terminated', 'succeeded', 'selected']);
const ACTIVE_STATUS = new Set(['started', 'deferred', 'buffered', 'pending']);

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

function cellState(facts: EventFacts): LiveNodeState | undefined {
  const status = facts.disposition ?? facts.status;
  const testimony = facts.testimonyType ?? '';
  const displayStatus = facts.display?.entry?.status;
  const variant = facts.outcomeVariant ?? '';
  // A cell's own testimony may classify its outcome without a failed disposition: a provider
  // exchange retained as a non-success is a failure state, shown as such rather than hidden
  // behind `completed`.
  if (
    facts.failureCode ||
    testimony.includes('failure') ||
    displayStatus === 'failed' ||
    facts.outcomeClassification === 'failure' ||
    variant.startsWith('retained-non-success') ||
    (status ? FAILED_STATUS.has(status) : false)
  ) {
    return 'failed';
  }
  if (status && DONE_STATUS.has(status)) return 'done';
  if (status && ACTIVE_STATUS.has(status)) return 'active';
  if (facts.cellId && isTestimony(facts)) return 'active';
  return undefined;
}

function edgeState(facts: EventFacts): LiveNodeState | undefined {
  const admission = facts.admissionDisposition ?? facts.disposition;
  const testimony = facts.testimonyType ?? '';
  if (facts.failureCode || testimony.includes('failure') || (admission ? FAILED_STATUS.has(admission) : false)) return 'failed';
  if (admission && DONE_STATUS.has(admission)) return 'done';
  if (admission && ACTIVE_STATUS.has(admission)) return 'active';
  // A cancelled or rejected admission is observed testimony that the edge was not taken: the
  // drawn edge stays planned (unlit) rather than being shown as executed.
  if (admission === 'cancelled') return undefined;
  if (facts.edgeId && isTestimony(facts)) return 'done';
  return undefined;
}

function aggregateNode(view: RunGraphView, nodeId: string, cells: Record<string, LiveNodeState>): LiveNodeState {
  const node = view.nodes.find((candidate) => candidate.id === nodeId);
  if (!node) return 'planned';
  let failed = false;
  let observed = false;
  let incomplete = false;
  for (const member of node.memberCellIds) {
    const state = cells[member];
    if (state === 'failed') failed = true;
    else if (state === 'done') observed = true;
    else if (state === 'active') {
      observed = true;
      incomplete = true;
    }
  }
  if (failed) return 'failed';
  if (!observed) return 'planned';
  if (incomplete) return 'active';
  return 'done';
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

/** Initialise the trace for a fetched run graph: every drawn node and edge planned, unlit. */
export function emptyTrace(view?: RunGraphView): LiveTrace {
  const states: Record<string, LiveNodeState> = {};
  const edgeStates: Record<string, LiveNodeState> = {};
  if (view) {
    for (const node of view.nodes) states[node.id] = 'planned';
    for (const edge of view.edges) edgeStates[edge.id] = 'planned';
  }
  return { states, edgeStates, cells: {}, edges: {}, transitions: [], active: null, unmatched: [] };
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
  const transitions = trace.transitions.slice();
  const unmatched = trace.unmatched.slice();
  let active = trace.active;

  const noteUnmatched = (id: string) => {
    if (!unmatched.includes(id)) unmatched.push(id);
  };

  const applyNode = (cursor: number, kind: string, signal: string, nodeId: string) => {
    const previous = states[nodeId] ?? 'planned';
    if (previous === 'failed') return;
    const next = aggregateNode(view, nodeId, cells);
    if (next === previous) return;
    states[nodeId] = next;
    transitions.push({ cursor, kind, signal, nodeId, from: previous, to: next });
    if (next === 'active') active = nodeId;
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

    if (facts.cellId) {
      const state = cellState(facts);
      if (state) {
        cells[facts.cellId] = cells[facts.cellId] === 'failed' ? 'failed' : state;
        const nodeId = view.membership[facts.cellId];
        if (nodeId) applyNode(event.cursor, kind, signal, nodeId);
        else noteUnmatched(facts.cellId);
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

  return { states, edgeStates, cells, edges, transitions, active, unmatched };
}
