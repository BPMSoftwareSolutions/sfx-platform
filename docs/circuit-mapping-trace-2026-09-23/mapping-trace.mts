/**
 * Event -> graph element -> declared material -> drawn element -> flow step, for one captured run.
 * Uses the platform's own view builder and the declared circuit-presentation policy (working tree).
 *
 * Usage (cwd sfx-platform):
 *   node --import tsx docs/circuit-mapping-trace-2026-09-23/mapping-trace.mts <run.json> <outDir> [events.jsonl] [declared-bindings.json]
 *
 * Materials come from the estate policy fixture, by exact declared key only. Captures taken
 * before the kernel carried `execution.authorityId` (SDA 1322d1f) are joined to the declared
 * bindings fixture named after the run's subject
 * (`tests/fixtures/circuit/<subject>-declared-bindings.json`, derived by
 * derive-declared-bindings.mjs) or to the explicit 5th argument. The join is measurement only:
 * every authority is the declared identity the current record carries.
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- this generator walks untyped machine-local JSON captures and assembles dynamic measurement rows */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../../', import.meta.url).href; // repository root
const { buildRunGraphView, normalizeRunGraph } = await import(new URL('lib/run-graph.ts', root).href);

const policy = JSON.parse(
  readFileSync(new URL('../../tests/fixtures/circuit/circuit-presentation-policy.json', import.meta.url), 'utf8')
);

const [runPath, outDir] = process.argv.slice(2);
if (!runPath || !outDir) throw new Error('usage: mapping-trace.mts <run.json> <outDir> [events.jsonl] [declared-bindings.json]');
mkdirSync(outDir, { recursive: true });

const run = JSON.parse(readFileSync(runPath, 'utf8'));
const graph = run.graph?.json ?? run.graph;
const byCursor = new Map<number, any>();
for (const page of run.pages ?? []) for (const event of page.body?.events ?? []) byCursor.set(event.cursor, event);
const rawCursors = byCursor.size;
// Cursors the raw page walk did not reach come from the normalized events file (no classification field).
const normalizedPath = process.argv[4];
let filled = 0;
if (normalizedPath && existsSync(normalizedPath)) {
  for (const line of readFileSync(normalizedPath, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const row = JSON.parse(line);
    if (byCursor.has(row.cursor)) continue;
    const { cursor, kind, at, ...payload } = row;
    byCursor.set(cursor, { cursor, kind, at, payload, fromNormalized: true });
    filled += 1;
  }
}
const events = [...byCursor.values()].sort((a, b) => a.cursor - b.cursor);
if (!graph?.cells || events.length === 0) throw new Error(`unexpected run shape: graph ${!!graph?.cells}, events ${events.length}`);

// The declared bindings the capture predates: an explicit path, or the fixture named after the subject.
function locateBindings() {
  const explicit = process.argv[5];
  if (explicit) return explicit;
  const subject = String(run.subject ?? '');
  const candidate = new URL(`../../tests/fixtures/circuit/${subject}-declared-bindings.json`, import.meta.url);
  return existsSync(candidate) ? candidate : null;
}
const bindingsPath = locateBindings();
const bindings = bindingsPath ? JSON.parse(readFileSync(bindingsPath, 'utf8')) : null;

/**
 * The declared `execution.authorityId` of a captured cell: taken verbatim when the record carries
 * one, else joined from the declared graph source. A cell the join cannot name stays unresolved.
 */
function declaredAuthorityOf(cell: any, cells: Map<string, any>): string | null {
  if (typeof cell.authorityId === 'string' && cell.authorityId.length > 0) return cell.authorityId;
  if (!bindings) return null;
  const altitude = (cell.altitude ?? '').toLowerCase();
  const kind = (cell.kind ?? '').toLowerCase();
  const scenarioIdOf = (candidate: any): string | null => {
    let cursor = candidate;
    const seen = new Set<string>();
    while (cursor && !seen.has(cursor.cellId)) {
      seen.add(cursor.cellId);
      const parent = cursor.parentCellId ? cells.get(cursor.parentCellId) : undefined;
      if (!parent) return null;
      if ((parent.altitude ?? '').toLowerCase() === 'scenario') {
        return parent.cellId.replace(/^cell:scenario:/, '');
      }
      cursor = parent;
    }
    return null;
  };
  const operationOf = (candidate: any) =>
    (candidate.cellId.match(/\.operation\.(\d+)$/) ?? [])[1] ?? null;
  const bindingFor = (candidate: any) => {
    if (!bindings.operations) return null;
    const scenarioId = scenarioIdOf(candidate);
    const index = operationOf(candidate);
    if (!scenarioId || !index) return null;
    return (
      bindings.operations.find(
        (operation: any) => operation.owningScenarioId === scenarioId && operation.index === Number(index)
      ) ?? null
    );
  };

  if (kind === 'junction') return 'junction:boolean-selection.v1';
  if (altitude === 'scenario') {
    const scenario = (bindings.scenarios ?? []).find((entry: any) => `cell:scenario:${entry.scenarioId}` === cell.cellId);
    return scenario?.event?.executionAuthorityId ?? null;
  }
  if (altitude === 'provider' || altitude === 'physical') {
    const parent = cell.parentCellId ? cells.get(cell.parentCellId) : undefined;
    const binding = parent ? bindingFor(parent) : null;
    return binding?.platformCapabilityId ? `${altitude}:${binding.platformCapabilityId}` : null;
  }
  if (altitude === 'mechanic') {
    const address = typeof cell.semanticAddress === 'string' ? cell.semanticAddress : '';
    const hash = address.indexOf('#');
    if (hash >= 0) {
      const transformationId = address.slice(0, hash);
      const pointer = address.slice(hash + 2);
      const op = bindings.transformations?.[transformationId]?.[pointer];
      // The compiler realizes an `if` node as `junction:boolean-selection.v1` (the `/selection`
      // cell) plus its own `mechanic:identity.v1` result cell; it never emits `mechanic:if.v1`.
      const declared = op === 'if' ? 'identity' : op;
      return declared ? `mechanic:${declared}.v1` : null;
    }
    const binding = bindingFor(cell);
    return binding?.platformCapabilityId ? `operation:${binding.platformCapabilityId}` : null;
  }
  return null;
}

const capturedCells = new Map<string, any>(graph.cells.map((cell: any) => [cell.cellId, cell]));
const declaredCells = graph.cells.map((cell: any) => ({
  ...cell,
  authorityId: declaredAuthorityOf(cell, capturedCells),
}));
const declaredGraph = { ...graph, cells: declaredCells };
const declaredById = new Map<string, any>(declaredCells.map((cell: any) => [cell.cellId, cell]));
const edges = new Map<string, any>(graph.edges.map((edge: any) => [edge.edgeId, edge]));

const full = buildRunGraphView(normalizeRunGraph(declaredGraph), { policy, full: true }); // every cell its own node
const view = buildRunGraphView(normalizeRunGraph(declaredGraph), { policy }); // the declared operation grain
const fullNode = new Map<string, any>(full.nodes.map((node: any) => [node.id, node]));
const viewNode = new Map<string, any>(view.nodes.map((node: any) => [node.id, node]));
const viewEdge = new Map<string, any>(view.edges.map((edge: any) => [edge.id, edge]));

function operationOf(cellId: string) {
  let cursor = capturedCells.get(cellId);
  while (cursor && cursor.parentCellId && capturedCells.get(cursor.parentCellId)?.altitude !== 'scenario') {
    cursor = capturedCells.get(cursor.parentCellId);
  }
  return cursor && cursor.altitude !== 'scenario' ? cursor.cellId : null;
}

const rows: any[] = [];
let previousDrawn: string | null = null;
let drawnMoves = 0;
for (const event of events) {
  const p = event.payload ?? {};
  const row: any = { cursor: event.cursor, eventKind: event.kind };
  if (p.testimonyType === 'cell-execution-testimony.v1' && capturedCells.has(p.cellId)) {
    const cell = declaredById.get(p.cellId);
    const own = fullNode.get(p.cellId);
    const drawnId = view.membership[p.cellId] ?? null;
    Object.assign(row, {
      element: 'cell', id: p.cellId, altitude: cell.altitude, graphKind: cell.kind,
      authorityId: cell.authorityId ?? null,
      operation: operationOf(p.cellId),
      ownMaterial: own?.material ?? null,
      materialDriver: own?.material ? 'declared' : 'UNRESOLVED',
      drawnNode: drawnId, drawnNodeMaterial: drawnId ? viewNode.get(drawnId)?.material ?? null : null,
      disposition: p.disposition ?? null, outcomeVariant: p.outcomeVariant ?? null, outcomeClassification: p.outcomeClassification ?? null,
    });
    if ((cell.altitude ?? '').toLowerCase() === 'scenario') {
      row.boundaryRoles = Object.fromEntries(
        (['input', 'event', 'outcome'] as const).map((role) => {
          const node = view.nodes.find(
            (candidate: any) => candidate.boundaryRole === role && candidate.parentCellId === p.cellId
          );
          return [role, { id: node?.id ?? null, label: node?.label ?? null, material: node?.material ?? null, driver: node?.material ? 'declared' : 'UNRESOLVED' }];
        })
      );
    }
    if (drawnId && drawnId !== previousDrawn) { drawnMoves += 1; previousDrawn = drawnId; }
  } else if (p.testimonyType === 'edge-execution-testimony.v1' && edges.has(p.edgeId)) {
    const edge = edges.get(p.edgeId);
    const from = edge.from.cellId, to = edge.to.cellId;
    Object.assign(row, {
      element: 'edge', id: p.edgeId, edgeKind: edge.kind, selectsVariant: edge.selectsVariant ?? null,
      from, to, fromAltitude: capturedCells.get(from)?.altitude, toAltitude: capturedCells.get(to)?.altitude,
      admission: p.admissionDisposition ?? null,
      drawnEdge: view.edgeMembership[p.edgeId] ?? null,
      internalTo: view.internalEdgeNode[p.edgeId] ?? null,
      drawnEdgeMaterial: view.edgeMembership[p.edgeId] ? viewEdge.get(view.edgeMembership[p.edgeId])?.material ?? null : null,
    });
  } else if (p.testimonyType && (p.cellId || p.edgeId)) {
    Object.assign(row, { element: 'UNBOUND', id: p.cellId ?? p.edgeId });
  } else if (p.cellId) {
    Object.assign(row, { element: 'evidence-record', id: p.cellId, detail: p.observationType ?? null, drawnNode: view.membership[p.cellId] ?? null });
  } else {
    Object.assign(row, { element: 'lifecycle', detail: p.phase ?? p.observationType ?? p.exitCode ?? null });
  }
  rows.push(row);
}

// Summaries
const count = (list: any[], key: (r: any) => string) => list.reduce((acc: any, r: any) => ((acc[key(r)] = (acc[key(r)] ?? 0) + 1), acc), {});
const cellRows = rows.filter((r) => r.element === 'cell');
const edgeRows = rows.filter((r) => r.element === 'edge');
const graphPairs = count(graph.cells, (c: any) => `${c.altitude}|${c.kind}`);
const materialByDriver = count(cellRows, (r) => `${r.ownMaterial} <- ${r.materialDriver}`);
const unresolvedAuthorities = [
  ...new Set(cellRows.filter((r) => r.materialDriver === 'UNRESOLVED').map((r) => r.authorityId ?? '(no declared authority)')),
];
const drawnMaterials = count(view.nodes, (n: any) => `${n.material}${n.collapsed ? ' (grouped)' : ''}`);
const boundaryRoles = cellRows
  .filter((r) => r.boundaryRoles)
  .map((r) => ({ cursor: r.cursor, cellId: r.id, roles: r.boundaryRoles }));
// Flow grammar: consecutive cell altitudes joined by the edge kind between them
const grammar = count(edgeRows, (r) => `${r.fromAltitude} -${r.edgeKind}${r.selectsVariant ? `[${r.selectsVariant}]` : ''}-> ${r.toAltitude}`);
const edgeDrawing = count(edgeRows, (r) => (r.drawnEdge ? 'drawn edge' : r.internalTo ? 'internal to a drawn node (not drawn)' : 'unbound'));
const perOperation = new Map<string, { first: number; last: number; cells: number }>();
for (const r of cellRows) {
  if (!r.operation) continue;
  const entry = perOperation.get(r.operation) ?? { first: r.cursor, last: r.cursor, cells: 0 };
  entry.last = r.cursor; entry.cells += 1; perOperation.set(r.operation, entry);
}
const operations = [...perOperation.entries()].map(([id, v]) => ({ id: id.replace(/^.*\.operation\./, 'op.'), ...v }));
const interleaved = operations.filter((a, i) => operations.some((b, j) => j !== i && b.first > a.first && b.first < a.last));
const summary = {
  run: {
    subject: run.subject, events: events.length, rawCursors, filledFromNormalized: filled,
    cellTestimony: cellRows.length, edgeTestimony: edgeRows.length,
    unbound: rows.filter((r) => r.element === 'UNBOUND').length,
  },
  policy: {
    policyType: policy.policyType,
    grain: policy.granularity?.node ?? null,
    detailCellLimit: policy.granularity?.detailCellLimit ?? null,
    boundary: policy.materials?.boundary ?? null,
    authorities: Object.keys(policy.materials?.byAuthority ?? {}).length,
    edgeKinds: Object.keys(policy.materials?.byEdgeKind ?? {}).length,
  },
  declaredBindings: bindings
    ? { capabilityId: bindings.capabilityId ?? null, scenarios: bindings.scenarios.length, operations: bindings.operations.length }
    : null,
  graphAltitudeKindPairs: graphPairs,
  cellMaterialByDriver: materialByDriver,
  unresolvedAuthorities,
  boundaryRoles,
  defaultViewNodes: { nodes: view.nodes.length, grain: view.grain, materials: drawnMaterials },
  drawnNodeChangesAcrossRun: drawnMoves,
  flowGrammar: grammar,
  edgeDrawing,
  operationsInCursorOrder: operations.length,
  operationsInterleaved: interleaved.length,
  rootOutcome: cellRows
    .filter((r) => r.altitude === 'scenario')
    .map((r) => ({ cursor: r.cursor, disposition: r.disposition, outcomeVariant: r.outcomeVariant, outcomeClassification: r.outcomeClassification })),
};
const opTable: any[] = [];
if (bindings) {
  const operationsByScenario = new Map<string, any[]>();
  for (const operation of bindings.operations) {
    const list = operationsByScenario.get(operation.owningScenarioId) ?? [];
    list.push(operation);
    operationsByScenario.set(operation.owningScenarioId, list);
  }
  const opCells = graph.cells.filter((c: any) => c.altitude === 'mechanic' && capturedCells.get(c.parentCellId)?.altitude === 'scenario');
  const operationBindings = [...operationsByScenario.entries()].flatMap(([scenarioId, list]) =>
    list.map((operation: any) => ({ ...operation, scenarioId }))
  );
  operationBindings.forEach((operation: any) => {
    const cellId = opCells.find((c: any) => c.cellId.endsWith(`.operation.${operation.index}`) && c.parentCellId === `cell:scenario:${operation.scenarioId}`)?.cellId;
    const own = cellId ? rows.filter((r) => r.element === 'cell' && r.id === cellId) : [];
    const leg = cellId ? rows.filter((r) => r.element === 'cell' && r.operation === cellId && (r.altitude === 'provider' || r.altitude === 'physical')) : [];
    const junctions = cellId ? rows.filter((r) => r.element === 'cell' && r.operation === cellId && r.graphKind === 'junction').length : 0;
    const drawn = cellId ? view.membership[cellId] : null;
    opTable.push({
      scenarioId: operation.scenarioId,
      op: operation.index,
      portId: operation.portId,
      binding: operation.platformCapabilityId,
      authorityId: operation.platformCapabilityId ? `operation:${operation.platformCapabilityId}` : null,
      opCellMaterialInDefaultView: drawn ? viewNode.get(drawn)?.material ?? null : null,
      drawnAs: drawn === cellId ? 'own node' : drawn ? 'inside ' + drawn.replace(/^cell:/, '') : null,
      opMaterialAsLeafDrawn: cellId ? fullNode.get(cellId)?.material ?? null : null,
      testimonyCells: cellId ? rows.filter((r) => r.element === 'cell' && r.operation === cellId).length : 0,
      junctionsReached: junctions,
      opOutcome: own[0] ? `${own[0].disposition}/${own[0].outcomeVariant ?? '-'}/${own[0].outcomeClassification ?? '-'}` : 'not observed',
      providerLeg: leg.map((r) => `${r.altitude}:${r.outcomeVariant ?? r.disposition}/${r.outcomeClassification ?? '-'}`).join(' '),
      firstCursor: own[0] ? rows.find((r) => r.element === 'cell' && r.operation === cellId)?.cursor : null,
      closeCursor: own[0]?.cursor ?? null,
    });
  });
  writeFileSync(`${outDir}/operations.json`, JSON.stringify(opTable, null, 2));
}
writeFileSync(`${outDir}/mapping-trace.jsonl`, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
writeFileSync(`${outDir}/mapping-summary.json`, JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
