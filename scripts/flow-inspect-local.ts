import { readFileSync } from 'node:fs';

import type { SdaRunGraph, SdaRunEvent } from '@/contracts/sda-api';
import { normalizeRunGraph, buildRunGraphView, runGraphViewProjection } from '@/lib/run-graph';
import { layoutCircuit } from '@/components/circuit/layout';

interface Capture {
  graph: { json: SdaRunGraph };
  pages: Array<{ body?: { events?: SdaRunEvent[] } }>;
}

const path = process.argv[2]!;
const capture = JSON.parse(readFileSync(path, 'utf8')) as Capture;
const graph = capture.graph.json;
const events = capture.pages.flatMap((page) => page.body?.events ?? []);
const view = buildRunGraphView(normalizeRunGraph(graph));
const projection = runGraphViewProjection(view, { capabilityId: 'x', scenarioId: null, fidelity: 'COMPILED_GRAPH' });
const layout = layoutCircuit(projection);
const byId = new Map(view.nodes.map((node) => [node.id, node]));

console.log(`cells=${view.totalCells} edges=${view.totalEdges} drawn=${view.nodes.length} drawnEdges=${view.edges.length} collapsed=${view.collapsed} events=${events.length}`);
console.log('--- nodes');
for (const node of layout.nodes) {
  const source = projection.nodes.find((n) => n.id === node.id)!;
  const raw = byId.get(node.id)!;
  console.log(
    `rank=${node.rank} y=${node.y} x=${node.x} mat=${source.material ?? '-'} prim=${source.primitive} members=${raw.memberCellIds.length} label=${source.label.slice(0, 70)}`
  );
}
console.log('--- edges');
for (const edge of layout.edges) {
  const source = projection.edges.find((e) => e.id === edge.id)!;
  console.log(`from=${edge.from.replace(/^cell:mechanic:[^:]+:/, '')} to=${edge.to.replace(/^cell:mechanic:[^:]+:/, '')} kind=${edge.kind} fam=${source.family} back=${edge.back} members=${view.edges.find((e) => e.id === edge.id)?.memberEdgeIds.length}`);
}
console.log(`--- size ${layout.width}x${layout.height}`);
