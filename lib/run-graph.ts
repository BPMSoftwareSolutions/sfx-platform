import type { SdaRunGraph, SdaRunGraphEndpoint } from '@/contracts/sda-api';
import type { BoundaryRole, CircuitPresentationPolicy } from '@/contracts/circuit-presentation';
import type { CircuitEdge, CircuitProjection, CircuitNode, MaterialToken } from '@/contracts/estate';
import { materialsFromPolicy, resolveCellMaterial, resolveEdgeMaterial } from '@/components/circuit/scl-theme';
import { getCircuitPresentation } from '@/lib/circuit-presentation';

/**
 * Run-graph view model — the platform half of the id binding.
 *
 * The run graph is the composed execution graph the run actually compiled, served as a declared
 * public record. This module normalises it, collapses it to fit the declared presentation limit
 * and converts the view into the renderer's projection. No capability vocabulary lives here:
 * binding is by `cellId` and `edgeId` alone.
 *
 * Materials come from the declared presentation policy (`read-circuit-presentation`,
 * `circuit-presentation.v1`), by exact key only: a cell resolves through `materials.byAuthority`
 * (its verbatim `execution.authorityId`), a route through `materials.byEdgeKind`, and the
 * scenario cell through `materials.boundary.outcome`. A miss is `UNRESOLVED`, drawn as the
 * visible unresolved primitive — never a guessed plate.
 *
 * KNOWN DEFECT (review finding 3, phase 3): the collapse rule and the limit are still platform
 * code. `read-circuit-presentation` now declares `granularity.node: "operation"`; the next phase
 * groups by that declared grain along the `parentCellId` chain and deletes this collapse.
 */

export interface RunGraphCell {
  cellId: string;
  altitude: string | null;
  kind: string | null;
  /** The declared `execution.authorityId`, verbatim; null when the record predates it. */
  authorityId: string | null;
  parentCellId: string | null;
  semanticAddress: string | null;
  ports: unknown;
  /** The declared input port contract, as the scenario's Input identity. */
  inputContractId: string | null;
  /** The declared outcome port contract, as the scenario's Outcome identity. */
  outcomeContractId: string | null;
  /** The outcome port's declared variants, verbatim, in declaration order. */
  outcomeVariants: string[];
  /** The outcome port's declared variant classifications, verbatim; null when undeclared. */
  outcomeClassifications: Record<string, string> | null;
}

export interface RunGraphEdge {
  edgeId: string;
  kind: string | null;
  from: string;
  to: string;
  selectsVariant: string | boolean | null;
  groupId: string | null;
}

export interface RunGraph {
  graphId: string;
  canonicalGraphDigest: string;
  cells: RunGraphCell[];
  edges: RunGraphEdge[];
}

/** One drawn node: a raw cell, several cells collapsed into their operation, or a boundary role. */
export interface RunGraphViewNode {
  id: string;
  label: string;
  altitude: string | null;
  kind: string | null;
  parentCellId: string | null;
  /** The nearest drawn enclosing cell; null for a root. Container frames wrap their children. */
  parentDrawnId: string | null;
  semanticAddress: string | null;
  memberCellIds: string[];
  collapsed: boolean;
  /** Set on the scenario cell's three boundary role nodes. */
  boundaryRole: BoundaryRole | null;
  /** Canonical component material resolved from the declared policy; null is UNRESOLVED. */
  material: MaterialToken | null;
  /** The node's own cell outcome variants, when the record declares them. */
  outcomeVariants: string[];
  /** The node's own cell variant classifications, when the record declares them. */
  outcomeClassifications: Record<string, string> | null;
}

/** One drawn edge: the route between drawn nodes, distinct per declared variant. */
export interface RunGraphViewEdge {
  id: string;
  kind: string | null;
  from: string;
  to: string;
  selectsVariant: string | boolean | null;
  groupId: string | null;
  memberEdgeIds: string[];
  collapsed: boolean;
  /** Canonical route material resolved from the declared policy; null is UNRESOLVED. */
  material: MaterialToken | null;
}

export interface RunGraphView {
  graphId: string;
  canonicalGraphDigest: string;
  /** The declared grain this view was drawn at; null when no policy declared one. */
  grain: string | null;
  /** The declared terminal-renderer limit, retained as the policy value; never a grouping cap. */
  detailCellLimit: number | null;
  totalCells: number;
  totalEdges: number;
  /** True when at least one raw cell is drawn as part of another node rather than as itself. */
  collapsed: boolean;
  /** The drawn nodes, in declared cell order (scenario boundary roles follow their scenario). */
  nodes: RunGraphViewNode[];
  /** The drawn edges, in declared edge order, routes internal to one drawn node removed. */
  edges: RunGraphViewEdge[];
  /** Raw `cellId` -> drawn node id. The binding key of every cell testimony. */
  membership: Record<string, string>;
  /** Raw `edgeId` -> drawn edge id. The binding key of every edge testimony. */
  edgeMembership: Record<string, string>;
  /**
   * Raw `edgeId` -> the drawn node a route collapsed inside. The edge is in the graph and bound
   * to that node, but not drawn; its testimony is never reported as unmatched.
   */
  internalEdgeNode: Record<string, string>;
}

export interface RunGraphViewOptions {
  /** The declared policy; defaults to the published `circuit-presentation.v1`. */
  policy?: CircuitPresentationPolicy | null;
  /** Draw every cell as its own node: the measuring instrument's full view, not a grain. */
  full?: boolean;
}

function endpointCellId(endpoint: SdaRunGraphEndpoint): string {
  return typeof endpoint === 'string' ? endpoint : endpoint.cellId;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function stringsOf(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.length > 0) : [];
}

function classificationsOf(value: unknown): Record<string, string> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const entries = Object.entries(value as Record<string, unknown>).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string'
  );
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

function portRecord(ports: unknown, key: 'input' | 'outcome'): Record<string, unknown> {
  if (ports === null || typeof ports !== 'object') return {};
  const port = (ports as Record<string, unknown>)[key];
  return port !== null && typeof port === 'object' ? (port as Record<string, unknown>) : {};
}

/**
 * A cell's semantic address may be published as a string or as the declared address object.
 * Either way it is preserved; a label is derived from it without asserting structure.
 */
export function semanticAddressText(address: unknown): string | null {
  if (typeof address === 'string') return asString(address);
  if (address === null || typeof address !== 'object') return null;
  const record = address as Record<string, unknown>;
  for (const key of ['mechanicId', 'responsibilityId', 'outcomeId', 'eventId', 'inputId']) {
    const value = asString(record[key]);
    if (value) return value;
  }
  return asString(record.semanticRole);
}

function labelForCell(cell: RunGraphCell): string {
  const address = cell.semanticAddress ?? cell.cellId;
  const tail = address.split('/').filter(Boolean).pop() ?? address;
  const cleaned = tail.replace(/^cell:/, '');
  if (cleaned.includes(':')) {
    const parts = cleaned.split(':');
    return parts[parts.length - 1] ?? cleaned;
  }
  return cleaned;
}

/** Normalise a parsed public record into the platform's working shape. */
export function normalizeRunGraph(graph: SdaRunGraph): RunGraph {
  return {
    graphId: graph.graphId,
    canonicalGraphDigest: graph.canonicalGraphDigest,
    cells: graph.cells.map((cell) => {
      const input = portRecord(cell.ports, 'input');
      const outcome = portRecord(cell.ports, 'outcome');
      return {
        cellId: cell.cellId,
        altitude: asString(cell.altitude),
        kind: asString(cell.kind),
        authorityId: asString(cell.authorityId),
        parentCellId: asString(cell.parentCellId),
        semanticAddress: semanticAddressText(cell.semanticAddress),
        ports: cell.ports,
        inputContractId: asString(input.contractId),
        outcomeContractId: asString(outcome.contractId),
        outcomeVariants: stringsOf(outcome.variants),
        outcomeClassifications: classificationsOf(outcome.variantClassifications),
      };
    }),
    edges: graph.edges.map((edge) => ({
      edgeId: edge.edgeId,
      kind: asString(edge.kind),
      from: endpointCellId(edge.from),
      to: endpointCellId(edge.to),
      selectsVariant: edge.selectsVariant ?? null,
      groupId: asString(edge.groupId),
    })),
  };
}

const SCENARIO_ALTITUDE = 'scenario';

/** Presentation cap mirrored from `read-circuit-presentation` (declared value 30); see KNOWN DEFECT. */
export const DETAIL_CELL_LIMIT = 30;

/**
 * Draw the graph whole (`full`, the measuring instrument's view) or collapsed to the detail
 * limit. Membership is nearest-enclosing along the `parentCellId` chain; a route between two
 * different drawn nodes is drawn, a route inside one is bound to that node and not drawn.
 */
export function buildRunGraphView(
  graph: RunGraph,
  options: RunGraphViewOptions | number = {}
): RunGraphView {
  const explicit = typeof options === 'number' ? {} : options;
  const full = typeof options === 'number' ? true : options.full === true;
  const policy = explicit.policy ?? (typeof options === 'number' ? null : getCircuitPresentation());
  const materials = materialsFromPolicy(policy);
  const limit = policy?.granularity?.detailCellLimit ?? DETAIL_CELL_LIMIT;

  const byId = new Map(graph.cells.map((cell) => [cell.cellId, cell]));
  let drawn = new Set(byId.keys());

  if (!full) {
    while (drawn.size > limit) {
      const promoted = new Set<string>();
      let promotedAny = false;
      for (const cellId of drawn) {
        const parent = byId.get(cellId)?.parentCellId ?? null;
        if (parent && byId.has(parent) && parent !== cellId) {
          promoted.add(parent);
          promotedAny = true;
        } else {
          promoted.add(cellId);
        }
      }
      if (!promotedAny || promoted.size >= drawn.size) break;
      drawn = promoted;
    }
  }

  const nearestDrawn = (cellId: string): string | null => {
    if (drawn.has(cellId)) return cellId;
    let cursor = byId.get(cellId)?.parentCellId ?? null;
    const seen = new Set<string>();
    while (cursor && byId.has(cursor) && !seen.has(cursor)) {
      if (drawn.has(cursor)) return cursor;
      seen.add(cursor);
      cursor = byId.get(cursor)?.parentCellId ?? null;
    }
    return null;
  };

  const membership: Record<string, string> = {};
  const membersByNode = new Map<string, string[]>();
  for (const cell of graph.cells) {
    const target = nearestDrawn(cell.cellId);
    if (!target) continue;
    membership[cell.cellId] = target;
    const members = membersByNode.get(target) ?? [];
    members.push(cell.cellId);
    membersByNode.set(target, members);
  }

  const nodes: RunGraphViewNode[] = [];
  for (const cell of graph.cells) {
    if (!drawn.has(cell.cellId) || !membership[cell.cellId]) continue;
    if (nodes.some((node) => node.id === cell.cellId)) continue;
    const members = membersByNode.get(cell.cellId) ?? [cell.cellId];
    const label = labelForCell(cell);
    const parentDrawn = cell.parentCellId ? membership[cell.parentCellId] ?? null : null;
    const isScenario = cell.altitude?.toLowerCase() === SCENARIO_ALTITUDE;
    nodes.push({
      id: cell.cellId,
      label: members.length > 1 ? `${label} · ${members.length} cells` : label,
      altitude: cell.altitude,
      kind: cell.kind,
      parentCellId: cell.parentCellId,
      parentDrawnId: parentDrawn && parentDrawn !== cell.cellId ? parentDrawn : null,
      semanticAddress: cell.semanticAddress,
      memberCellIds: members,
      collapsed: members.length > 1,
      boundaryRole: null,
      material: resolveCellMaterial(
        { authorityId: cell.authorityId, boundaryRole: isScenario ? 'outcome' : null },
        materials
      ),
      outcomeVariants: cell.outcomeVariants,
      outcomeClassifications: cell.outcomeClassifications,
    });
  }

  const edgeMembership: Record<string, string> = {};
  const internalEdgeNode: Record<string, string> = {};
  const drawnEdges: RunGraphViewEdge[] = [];
  const edgeByKey = new Map<string, RunGraphViewEdge>();
  for (const edge of graph.edges) {
    const from = membership[edge.from];
    const to = membership[edge.to];
    // Only a route between two distinct drawn nodes is drawn. A route whose endpoints collapse
    // into the same drawn node is internal to it: bound to that node, not drawn. An endpoint
    // outside the graph leaves the edge unbound.
    if (!from || !to) continue;
    if (from === to) {
      internalEdgeNode[edge.edgeId] = from;
      continue;
    }
    const key = `${from}|${to}|${edge.kind ?? ''}`;
    let viewEdge = edgeByKey.get(key);
    if (!viewEdge) {
      viewEdge = {
        id: edge.edgeId,
        kind: edge.kind,
        from,
        to,
        selectsVariant: edge.selectsVariant,
        groupId: edge.groupId,
        memberEdgeIds: [],
        collapsed: false,
        material: resolveEdgeMaterial(edge.kind, materials),
      };
      edgeByKey.set(key, viewEdge);
      drawnEdges.push(viewEdge);
    }
    viewEdge.memberEdgeIds.push(edge.edgeId);
    edgeMembership[edge.edgeId] = viewEdge.id;
  }
  for (const viewEdge of drawnEdges) {
    // The first member edge keeps the drawn edge's id; every member binds through edgeMembership.
    viewEdge.collapsed = viewEdge.memberEdgeIds.length > 1;
  }

  const groupedCells = graph.cells.filter((cell) => membership[cell.cellId] && membership[cell.cellId] !== cell.cellId).length;

  return {
    graphId: graph.graphId,
    canonicalGraphDigest: graph.canonicalGraphDigest,
    grain: null,
    detailCellLimit: limit,
    totalCells: graph.cells.length,
    totalEdges: graph.edges.length,
    collapsed: groupedCells > 0,
    nodes,
    edges: drawnEdges,
    membership,
    edgeMembership,
    internalEdgeNode,
  };
}

const ALTITUDE_PRIMITIVE: Record<string, CircuitNode['primitive']> = {
  scenario: 'SCENARIO',
  mechanic: 'MECHANIC',
  provider: 'PROVIDER',
  physical: 'PHYSICAL',
};

/** §4.3 — an unmapped altitude renders as the visible UNRESOLVED primitive, never a guess. */
export function primitiveForAltitude(altitude: string | null): CircuitNode['primitive'] {
  if (!altitude) return 'UNRESOLVED';
  return ALTITUDE_PRIMITIVE[altitude.toLowerCase()] ?? 'UNRESOLVED';
}

/** A drawn node's primitive: its altitude, or UNRESOLVED when no declared material resolved. */
function primitiveForNode(node: RunGraphViewNode): CircuitNode['primitive'] {
  if (!node.material) return 'UNRESOLVED';
  return primitiveForAltitude(node.altitude);
}

function familyForEdge(kind: string | null): CircuitEdge['family'] {
  const value = kind?.toLowerCase() ?? '';
  if (value.includes('product')) return 'PRODUCT_TRANSFER';
  if (value.includes('support')) return 'SUPPORT';
  return 'EXECUTION';
}

/**
 * Build the renderer projection for the drawn run graph. The viewer's live classes are the only
 * state; this projection is the declared skeleton drawn unlit. A node whose material the declared
 * policy does not carry is drawn as the visible UNRESOLVED primitive — never a fallback plate.
 *
 * A capability graph compiled by the engine with no run uses `COMPILED_GRAPH` copy; a graph bound
 * to an observed run keeps `RUN_GRAPH`. Everything else is identical: ids, altitude primitives and
 * the same planned-only skeleton.
 */
export function runGraphViewProjection(
  view: RunGraphView,
  options: {
    capabilityId: string;
    scenarioId?: string | null;
    fidelity?: 'RUN_GRAPH' | 'COMPILED_GRAPH';
    sourceProfile?: string;
  }
): CircuitProjection {
  const fidelity = options.fidelity ?? 'RUN_GRAPH';
  const containerIds = new Set(view.nodes.map((node) => node.parentDrawnId).filter((id): id is string => Boolean(id)));
  return {
    capabilityId: options.capabilityId,
    scenarioId: options.scenarioId ?? null,
    sourceProfile: options.sourceProfile ?? `run-graph:${view.graphId}`,
    sourceDigest: view.canonicalGraphDigest,
    graphDigest: view.canonicalGraphDigest,
    sclVersion: 'run-graph.v1',
    rendererVersion: fidelity === 'COMPILED_GRAPH' ? 'sda-capability-graph.v1' : 'sda-run-graph.v1',
    lens: 'SCENARIO',
    fidelity,
    nodes: view.nodes.map((node) => ({
      id: node.id,
      primitive: primitiveForNode(node),
      label: node.label,
      sourceId: node.semanticAddress ?? node.id,
      state: {
        value: node.boundaryRole ?? node.altitude,
        readable: node.material
          ? node.collapsed
            ? `Planned ${node.altitude ?? 'unresolved'} cell enclosing ${node.memberCellIds.length} raw cells; lit only by their testimony.`
            : `Planned ${node.altitude ?? 'unresolved'} cell; lit only by its own testimony.`
          : `No declared material resolved this cell: UNRESOLVED. Lit only by its own testimony.`,
      },
      material: node.material ?? undefined,
      parent: node.parentDrawnId,
      container: node.collapsed || containerIds.has(node.id),
    })),
    edges: view.edges.map((edge) => ({
      id: edge.id,
      from: edge.from,
      to: edge.to,
      family: familyForEdge(edge.kind),
      /** The engine's own route kind, so the layout can draw loop-backs and join channels. */
      kind: edge.kind ?? undefined,
      /** The route kind's declared material; a miss stays unresolved rather than a family guess. */
      material: edge.material ?? undefined,
    })),
    diagnostics: [],
  };
}

/** The view measurements the surfaces state beside their badge. */
export interface RunGraphViewStats {
  totalCells: number;
  totalEdges: number;
  drawnNodes: number;
  drawnEdges: number;
  /** Raw cells drawn as part of another node rather than as themselves. */
  groupedCells: number;
  collapsed: boolean;
  detailCellLimit: number | null;
  grain: string | null;
}

export interface CompiledGraphSurface {
  projection: CircuitProjection;
  stats: RunGraphViewStats;
}

/** What the page hands the panel for the compiled (unobserved) surface. */
export type CapabilityGraphSurface = CompiledGraphSurface | { error: { code: string; message: string } };

function viewStats(view: RunGraphView): RunGraphViewStats {
  return {
    totalCells: view.totalCells,
    totalEdges: view.totalEdges,
    drawnNodes: view.nodes.length,
    drawnEdges: view.edges.length,
    groupedCells: view.totalCells - view.nodes.filter((node) => !node.boundaryRole).length,
    collapsed: view.collapsed,
    detailCellLimit: view.detailCellLimit,
    grain: view.grain,
  };
}

/**
 * The engine-compiled capability graph, drawn at the declared grain and rendered unlit. No run
 * exists: nothing on this surface is observed, and an engine that cannot compile returns the
 * absence, never a substitute circuit.
 */
export function compiledGraphSurface(
  graph: SdaRunGraph,
  capabilityId: string,
  policy?: CircuitPresentationPolicy | null
): CompiledGraphSurface {
  const view = buildRunGraphView(normalizeRunGraph(graph), { policy });
  return {
    projection: runGraphViewProjection(view, {
      capabilityId,
      scenarioId: null,
      fidelity: 'COMPILED_GRAPH',
      sourceProfile: `capability-graph:${view.graphId}`,
    }),
    stats: viewStats(view),
  };
}
