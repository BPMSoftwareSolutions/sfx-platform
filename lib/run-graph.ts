import type { SdaRunGraph, SdaRunGraphEndpoint } from '@/contracts/sda-api';
import type { CircuitEdge, CircuitProjection, CircuitNode, MaterialToken } from '@/contracts/estate';
import { EDGE_FAMILY_MATERIAL, resolveCellMaterial, resolveEdgeMaterial } from '@/components/circuit/scl-theme';

/**
 * Run-graph view model — the platform half of the id binding.
 *
 * The run graph is the composed execution graph the run actually compiled, served as a declared
 * public projection. This module normalises it, collapses it to fit `DETAIL_CELL_LIMIT` and
 * converts the collapsed view into the renderer's projection. No capability vocabulary lives here:
 * binding is by `cellId` and `edgeId` alone.
 *
 * KNOWN DEFECT (review §15 item 4): the collapse rule, the limit and the altitude-to-primitive
 * table below are platform code, not declared authority. The declared homes are the estate's
 * `read-capability-circuit` view (nearest-enclosing-cell membership) and
 * `read-circuit-presentation` (`granularity.detailCellLimit`). Revisit when the declared view
 * serves membership per run (review §15 item 3) or the primitive mapping is declared (Phase 3).
 *
 * The material interpreter in `components/circuit/scl-theme.ts` is the same kind of platform
 * table applied to the engine's native `altitude`/`kind` vocabulary; it is the one place that
 * mapping lives, and it is consumed only here and by the viewer.
 */

/** Presentation cap mirrored from `read-circuit-presentation` (declared value 30); see KNOWN DEFECT. */
export const DETAIL_CELL_LIMIT = 30;

export interface RunGraphCell {
  cellId: string;
  altitude: string | null;
  kind: string | null;
  parentCellId: string | null;
  semanticAddress: string | null;
  ports: unknown;
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

/** One drawn node: either a raw cell or the nearest enclosing cell several cells collapsed into. */
export interface RunGraphViewNode {
  id: string;
  label: string;
  altitude: string | null;
  kind: string | null;
  parentCellId: string | null;
  semanticAddress: string | null;
  memberCellIds: string[];
  collapsed: boolean;
  /** Canonical component material resolved from altitude/kind and the cell's own topology. */
  material: MaterialToken | null;
}

/** One drawn edge: the collapsed route between drawn nodes. */
export interface RunGraphViewEdge {
  id: string;
  kind: string | null;
  from: string;
  to: string;
  selectsVariant: string | boolean | null;
  groupId: string | null;
  memberEdgeIds: string[];
  collapsed: boolean;
}

export interface RunGraphView {
  graphId: string;
  canonicalGraphDigest: string;
  detailCellLimit: number;
  totalCells: number;
  totalEdges: number;
  collapsed: boolean;
  /** The drawn nodes, in declared cell order. */
  nodes: RunGraphViewNode[];
  /** The drawn edges, in declared edge order, self-loops of the collapse removed. */
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

function endpointCellId(endpoint: SdaRunGraphEndpoint): string {
  return typeof endpoint === 'string' ? endpoint : endpoint.cellId;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
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

/** Normalise a parsed public projection into the platform's working shape. */
export function normalizeRunGraph(graph: SdaRunGraph): RunGraph {
  return {
    graphId: graph.graphId,
    canonicalGraphDigest: graph.canonicalGraphDigest,
    cells: graph.cells.map((cell) => ({
      cellId: cell.cellId,
      altitude: asString(cell.altitude),
      kind: asString(cell.kind),
      parentCellId: asString(cell.parentCellId),
      semanticAddress: semanticAddressText(cell.semanticAddress),
      ports: cell.ports,
    })),
    edges: graph.edges.map((edge) => ({
      edgeId: edge.edgeId,
      kind: asString(edge.kind),
      from: endpointCellId(edge.from),
      to: endpointCellId(edge.to),
      selectsVariant: edge.selectsVariant ?? null,
      groupId: asString(edge.groupId),
    })),  };
}

/**
 * The platform's collapse (not declared; see KNOWN DEFECT): when the graph carries more cells than the detail limit, redraw
 * with the nearest enclosing cells only — walk each drawn cell up its `parentCellId` chain until
 * the drawn set fits the limit. Cells with no parent stay drawn. A flat graph that cannot
 * collapse is drawn whole rather than truncated; `collapsed` records which happened.
 */
export function buildRunGraphView(graph: RunGraph, limit = DETAIL_CELL_LIMIT): RunGraphView {
  const byId = new Map(graph.cells.map((cell) => [cell.cellId, cell]));
  let drawn = new Set(byId.keys());

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

  // Route kinds touching each raw cell, so a drawn junction can be classified structurally even
  // though the public projection publishes no junction sub-kind.
  const inKindsByCell = new Map<string, string[]>();
  const outKindsByCell = new Map<string, string[]>();
  const pushKind = (map: Map<string, string[]>, cellId: string, kind: string | null) => {
    if (!kind) return;
    const kinds = map.get(cellId) ?? [];
    kinds.push(kind);
    map.set(cellId, kinds);
  };
  for (const edge of graph.edges) {
    if (!byId.has(edge.from) || !byId.has(edge.to)) continue;
    pushKind(outKindsByCell, edge.from, edge.kind);
    pushKind(inKindsByCell, edge.to, edge.kind);
  }

  // Composites are identified structurally: a drawn cell that encloses other graph cells. Its
  // body's declared mechanic roots and member altitudes are passed to the material table so an
  // operation resolves as its operation, not as the generic event plate.
  const childrenByCell = new Map<string, string[]>();
  for (const cell of graph.cells) {
    if (!cell.parentCellId || !byId.has(cell.parentCellId)) continue;
    const children = childrenByCell.get(cell.parentCellId) ?? [];
    children.push(cell.cellId);
    childrenByCell.set(cell.parentCellId, children);
  }
  const bodyOf = (cellId: string) => {
    const roots: string[] = [];
    const altitudes = new Set<string>();
    const walk = (id: string) => {
      for (const childId of childrenByCell.get(id) ?? []) {
        const child = byId.get(childId);
        if (!child) continue;
        if (child.altitude) altitudes.add(child.altitude);
        const address = child.semanticAddress ?? '';
        if (address.includes('#')) roots.push(address.slice(0, address.indexOf('#')));
        walk(childId);
      }
    };
    walk(cellId);
    return { roots, altitudes: [...altitudes] };
  };

  const nodes: RunGraphViewNode[] = [];
  for (const cell of graph.cells) {
    if (!drawn.has(cell.cellId) || !membership[cell.cellId]) continue;
    if (nodes.some((node) => node.id === cell.cellId)) continue;
    const members = membersByNode.get(cell.cellId) ?? [cell.cellId];
    const body = bodyOf(cell.cellId);
    const composite = members.length > 1 || body.altitudes.length > 0;
    const label = labelForCell(cell);
    // Only expression addresses name the operation behind a cell; the enclosing path repeats the
    // capability slug (e.g. `…-evidence/operation/…`) and structural tails (`/provider`, `/physical`)
    // carry no operation semantics. Exact altitude/kind resolution does not depend on any of this.
    const semanticHints = [
      cell.semanticAddress ?? '',
      ...members
        .filter((memberId) => memberId !== cell.cellId)
        .map((memberId) => byId.get(memberId)?.semanticAddress ?? ''),
    ].filter((address) => /#|:expression/.test(address));
    nodes.push({
      id: cell.cellId,
      label: members.length > 1 ? `${label} · ${members.length} cells` : label,
      altitude: cell.altitude,
      kind: cell.kind,
      parentCellId: cell.parentCellId,
      semanticAddress: cell.semanticAddress,
      memberCellIds: members,
      collapsed: members.length > 1,
      material: resolveCellMaterial({
        altitude: cell.altitude,
        kind: cell.kind,
        semanticHints,
        routeKinds: {
          in: inKindsByCell.get(cell.cellId) ?? [],
          out: outKindsByCell.get(cell.cellId) ?? [],
        },
        composite,
        operationRoots: body.roots,
        memberAltitudes: body.altitudes,
      }),
    });
  }

  const edgeMembership: Record<string, string> = {};
  const internalEdgeNode: Record<string, string> = {};
  const drawnEdges: RunGraphViewEdge[] = [];
  const edgeByKey = new Map<string, RunGraphViewEdge>();
  for (const edge of graph.edges) {
    const from = membership[edge.from];
    const to = membership[edge.to];
    // Only a route between two distinct drawn nodes is drawn. A route whose endpoints collapsed
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

  return {
    graphId: graph.graphId,
    canonicalGraphDigest: graph.canonicalGraphDigest,
    detailCellLimit: limit,
    totalCells: graph.cells.length,
    totalEdges: graph.edges.length,
    collapsed: drawn.size < byId.size,
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

function familyForEdge(kind: string | null): CircuitEdge['family'] {
  const value = kind?.toLowerCase() ?? '';
  if (value.includes('product')) return 'PRODUCT_TRANSFER';
  if (value.includes('support')) return 'SUPPORT';
  return 'EXECUTION';
}

/**
 * Build the renderer projection for the collapsed run graph. The viewer's live classes are the
 * only state; this projection is the declared skeleton drawn unlit.
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
      primitive: primitiveForAltitude(node.altitude),
      label: node.label,
      sourceId: node.semanticAddress ?? node.id,
      state: {
        value: node.altitude,
        readable: node.collapsed
          ? `Planned view cell enclosing ${node.memberCellIds.length} raw cells; lit only by their testimony.`
          : `Planned ${node.altitude ?? 'unresolved'} cell; lit only by its own testimony.`,
      },
      material: node.material ?? undefined,
    })),
    edges: view.edges.map((edge) => {
      const family = familyForEdge(edge.kind);
      return {
        id: edge.id,
        from: edge.from,
        to: edge.to,
        family,
        /** The engine's own route kind, so the layout can draw loop-backs and join channels. */
        kind: edge.kind ?? undefined,
        /** The route kind's material, or the family's: a connector always has its family shape. */
        material: resolveEdgeMaterial(edge.kind) ?? EDGE_FAMILY_MATERIAL[family],
      };
    }),
    diagnostics: [],
  };
}

/** The collapsed-view measurements the compiled surface states beside its badge. */
export interface RunGraphViewStats {
  totalCells: number;
  totalEdges: number;
  drawnNodes: number;
  drawnEdges: number;
  collapsed: boolean;
  detailCellLimit: number;
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
    collapsed: view.collapsed,
    detailCellLimit: view.detailCellLimit,
  };
}

/**
 * The engine-compiled capability graph, collapsed by the same id-binding rule a run uses and
 * rendered unlit. No run exists: nothing on this surface is observed, and an engine that cannot
 * compile returns the absence, never a substitute circuit.
 */
export function compiledGraphSurface(graph: SdaRunGraph, capabilityId: string): CompiledGraphSurface {
  const view = buildRunGraphView(normalizeRunGraph(graph));
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
