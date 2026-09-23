/**
 * Event -> graph element -> material -> drawn element -> flow step, for one captured run.
 * Uses the platform's own view builder and material tables (sfx-platform working tree).
 * Usage (cwd sfx-platform): node --import tsx docs/circuit-mapping-trace-2026-09-23/mapping-trace.mts <run.json> <outDir> <events.jsonl> [graph-source.json]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const root = new URL('../../', import.meta.url).href; // repository root
const { buildRunGraphView, normalizeRunGraph } = await import(new URL('lib/run-graph.ts', root).href);
const theme = await import(new URL('components/circuit/scl-theme.ts', root).href);
const { CELL_MATERIAL, MATERIAL_WORDS } = theme;

const [runPath, outDir] = process.argv.slice(2);
const run = JSON.parse(readFileSync(runPath, 'utf8'));
const graph = run.graph?.json ?? run.graph;
const byCursor = new Map<number, any>();
for (const page of run.pages ?? []) for (const event of page.body?.events ?? []) byCursor.set(event.cursor, event);
const rawCursors = byCursor.size;
// Cursors the raw page walk did not reach come from the normalized events file (no classification field).
const normalizedPath = process.argv[4];
let filled = 0;
if (normalizedPath) {
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

const cells = new Map<string, any>(graph.cells.map((c: any) => [c.cellId, c]));
const edges = new Map<string, any>(graph.edges.map((e: any) => [e.edgeId, e]));
const full = buildRunGraphView(normalizeRunGraph(graph), Number.MAX_SAFE_INTEGER); // every cell drawn: its own material
const view = buildRunGraphView(normalizeRunGraph(graph)); // the platform's default drawn view
const fullNode = new Map<string, any>(full.nodes.map((n: any) => [n.id, n]));
const viewNode = new Map<string, any>(view.nodes.map((n: any) => [n.id, n]));

const rootOf = (address: string | null) => (address ?? '').split('#')[0];
const wordsOf = (address: string | null) => rootOf(address).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
function stemHit(address: string | null) {
  const words = wordsOf(address);
  for (const entry of MATERIAL_WORDS) {
    for (const stem of entry.stems) {
      const word = words.find((w: string) => w.startsWith(stem));
      if (word) return { token: entry.token, stem, word };
    }
  }
  return null;
}
function operationOf(cellId: string) {
  let cursor = cells.get(cellId);
  while (cursor && cursor.parentCellId && cells.get(cursor.parentCellId)?.altitude !== 'scenario') cursor = cells.get(cursor.parentCellId);
  return cursor && cursor.altitude !== 'scenario' ? cursor.cellId : null;
}
function driverOf(cell: any, material: string | null) {
  const altitude = (cell.altitude ?? '').toLowerCase();
  const kind = (cell.kind ?? '').toLowerCase();
  if (kind === 'junction') return 'junction route kinds';
  const exact = CELL_MATERIAL[`${altitude}|${kind}`];
  if (!exact) return 'unmapped altitude|kind';
  if (exact !== 'event') return `declared altitude|kind (${altitude}|${kind})`;
  if (material === 'event') return 'generic default (event plate)';
  const hit = stemHit(cell.semanticAddress);
  return hit && hit.token === material ? `name word-stem "${hit.stem}" in "${hit.word}"` : 'composite member-altitude rule';
}

const rows: any[] = [];
let previousDrawn: string | null = null;
let drawnMoves = 0;
for (const event of events) {
  const p = event.payload ?? {};
  const row: any = { cursor: event.cursor, eventKind: event.kind };
  if (p.testimonyType === 'cell-execution-testimony.v1' && cells.has(p.cellId)) {
    const cell = cells.get(p.cellId);
    const own = fullNode.get(p.cellId);
    const drawnId = view.membership[p.cellId] ?? null;
    Object.assign(row, {
      element: 'cell', id: p.cellId, altitude: cell.altitude, graphKind: cell.kind,
      operation: operationOf(p.cellId), declaredRoot: rootOf(cell.semanticAddress),
      ownMaterial: own?.material ?? null, materialDriver: driverOf(cell, own?.material ?? null),
      drawnNode: drawnId, drawnNodeMaterial: drawnId ? viewNode.get(drawnId)?.material ?? null : null,
      disposition: p.disposition ?? null, outcomeVariant: p.outcomeVariant ?? null, outcomeClassification: p.outcomeClassification ?? null,
    });
    if (drawnId && drawnId !== previousDrawn) { drawnMoves += 1; previousDrawn = drawnId; }
  } else if (p.testimonyType === 'edge-execution-testimony.v1' && edges.has(p.edgeId)) {
    const edge = edges.get(p.edgeId);
    const from = edge.from.cellId, to = edge.to.cellId;
    Object.assign(row, {
      element: 'edge', id: p.edgeId, edgeKind: edge.kind, selectsVariant: edge.selectsVariant ?? null,
      from, to, fromAltitude: cells.get(from)?.altitude, toAltitude: cells.get(to)?.altitude,
      admission: p.admissionDisposition ?? null,
      drawnEdge: view.edgeMembership[p.edgeId] ?? null,
      internalTo: view.internalEdgeNode[p.edgeId] ?? null,
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
const materialByDriver = count(cellRows, (r) => `${r.ownMaterial} <- ${r.materialDriver.replace(/ "[^"]*" in "[^"]*"/, '')}`);
const stems = count(cellRows.filter((r) => r.materialDriver.startsWith('name')), (r) => `${r.ownMaterial} <- ${r.materialDriver}`);
const deadTableKeys = Object.keys(CELL_MATERIAL).filter((k) => !graphPairs[k]);
const drawnMaterials = count(view.nodes, (n: any) => `${n.material}${n.collapsed ? ' (collapsed)' : ''}`);
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
  run: { subject: run.subject, events: events.length, rawCursors, filledFromNormalized: filled, cellTestimony: cellRows.length, edgeTestimony: edgeRows.length, unbound: rows.filter((r) => r.element === 'UNBOUND').length },
  graphAltitudeKindPairs: graphPairs,
  cellMaterialTableKeysNeverInGraph: deadTableKeys,
  observedCellMaterialByDriver: materialByDriver,
  wordStemAssignments: stems,
  defaultViewNodes: { nodes: view.nodes.length, materials: drawnMaterials },
  drawnNodeChangesAcrossRun: drawnMoves,
  flowGrammar: grammar,
  edgeDrawing,
  operationsInCursorOrder: operations.length,
  operationsInterleaved: interleaved.length,
  rootOutcome: cellRows.filter((r) => r.altitude === 'scenario').map((r) => ({ cursor: r.cursor, disposition: r.disposition, outcomeVariant: r.outcomeVariant, outcomeClassification: r.outcomeClassification })),
};
const sourcePath = process.argv[5];
const opTable: any[] = [];
if (sourcePath) {
  const src = JSON.parse(readFileSync(sourcePath, 'utf8'));
  const bindings = new Map<string, any>(src.interfaceAuthority.portBindings.map((b: any) => [b.portId, b]));
  const ops = src.executionAuthorities[0].operations;
  const opCells = graph.cells.filter((c: any) => c.altitude === 'mechanic' && cells.get(c.parentCellId)?.altitude === 'scenario');
  ops.forEach((op: any, index: number) => {
    const cellId = opCells.find((c: any) => c.cellId.endsWith(`.operation.${index + 1}`))?.cellId;
    const own = cellId ? rows.filter((r) => r.element === 'cell' && r.id === cellId) : [];
    const leg = cellId ? rows.filter((r) => r.element === 'cell' && r.operation === cellId && (r.altitude === 'provider' || r.altitude === 'physical')) : [];
    const junctions = cellId ? rows.filter((r) => r.element === 'cell' && r.operation === cellId && r.graphKind === 'junction').length : 0;
    const drawn = cellId ? view.membership[cellId] : null;
    opTable.push({
      op: index + 1, portId: op.portId, binding: bindings.get(op.portId)?.platformCapabilityId ?? null,
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
mkdirSync(outDir, { recursive: true });
writeFileSync(`${outDir}/mapping-trace.jsonl`, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
mkdirSync(outDir, { recursive: true });
writeFileSync(`${outDir}/mapping-summary.json`, JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
