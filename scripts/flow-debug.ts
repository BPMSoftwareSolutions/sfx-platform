import { normalizeRunGraph, buildRunGraphView } from '@/lib/run-graph';
import type { SdaRunGraph } from '@/contracts/sda-api';

async function main() {
  const id = 'resolve-equity-market-price-evidence';
  const endpoint = 'http://127.0.0.1:8799';
  const token = 'local-sda-platform-token';
  const response = await fetch(`${endpoint}/v1/capabilities/${encodeURIComponent(id)}/graph`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const graph = (await response.json()) as SdaRunGraph;
  const normalized = normalizeRunGraph(graph);
  const view = buildRunGraphView(normalized);
  console.log('drawn nodes:');
  for (const node of view.nodes) console.log(`  ${node.id} | members=${node.memberCellIds.length} | ${node.label}`);
  console.log('sample parentCellId values:');
  for (const cellId of [
    'cell:mechanic:resolve-equity-market-price-evidence.operation.2',
    'cell:mechanic:resolve-equity-market-price-evidence.operation.2:expression',
    'cell:mechanic:resolve-equity-market-price-evidence.operation.2:expression.fields.contractId',
  ]) {
    console.log(`  ${cellId} -> ${JSON.stringify(normalized.cells.find((c) => c.cellId === cellId)?.parentCellId)}`);
  }
  console.log('membership entries:', Object.keys(view.membership).length, 'of', normalized.cells.length);
  console.log('members of scenario:', view.nodes.find((n) => n.altitude === 'scenario')?.memberCellIds.length);
  console.log('edges drawn:');
  for (const edge of view.edges) console.log(`  ${edge.id} | ${edge.from} -> ${edge.to} | members=${edge.memberEdgeIds.length}`);
}
void main();
