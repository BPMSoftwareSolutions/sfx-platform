import { normalizeRunGraph, buildRunGraphView, runGraphViewProjection } from '@/lib/run-graph';
import { layoutCircuit } from '@/components/circuit/layout';
import type { SdaRunGraph } from '@/contracts/sda-api';

async function main() {
const id = process.argv[2] ?? 'resolve-equity-market-price-evidence';
const endpoint = process.env.SDA_API_ENDPOINT ?? 'http://127.0.0.1:8799';
const token = process.env.SDA_API_TOKEN ?? 'local-sda-platform-token';
const response = await fetch(`${endpoint}/v1/capabilities/${encodeURIComponent(id)}/graph`, {
  headers: { authorization: `Bearer ${token}` },
});
const graph = (await response.json()) as SdaRunGraph;
const view = buildRunGraphView(normalizeRunGraph(graph));
const projection = runGraphViewProjection(view, { capabilityId: id, scenarioId: null, fidelity: 'COMPILED_GRAPH' });
const layout = layoutCircuit(projection);

console.log(`graph=${view.graphId} cells=${view.totalCells} edges=${view.totalEdges} drawn=${view.nodes.length} drawnEdges=${view.edges.length} collapsed=${view.collapsed}`);
for (const node of layout.nodes) {
  const source = projection.nodes.find((n) => n.id === node.id)!;
  console.log(
    `rank=${node.rank} row=${node.row} col=${node.column} x=${node.x} y=${node.y} mat=${source.material ?? '-'} prim=${source.primitive} label=${source.label}`
  );
}
console.log('--- edges');
for (const edge of layout.edges) {
  const source = projection.edges.find((e) => e.id === edge.id)!;
  console.log(`from=${edge.from} to=${edge.to} kind=${edge.kind} fam=${source.family} mat=${source.material ?? '-'} back=${edge.back}`);
}
console.log(`--- size ${layout.width}x${layout.height}`);
}
void main();
