import { normalizeRunGraph } from '@/lib/run-graph';
import type { SdaRunGraph } from '@/contracts/sda-api';

async function main() {
  const response = await fetch('http://127.0.0.1:8799/v1/capabilities/resolve-equity-market-price-evidence/graph', {
    headers: { authorization: 'Bearer local-sda-platform-token' },
  });
  const graph = (await response.json()) as SdaRunGraph;
  const normalized = normalizeRunGraph(graph);
  console.log('raw cells:', graph.cells.length, 'normalized:', normalized.cells.length);
  const op2 = normalized.cells.filter((c) => c.cellId.includes('operation.2') && c.cellId.includes('expression'));
  console.log('op.2 expression-ish cells:', op2.length);
  for (const c of op2.slice(0, 4)) console.log(`  ${c.cellId} parent=${String(c.parentCellId)}`);
  const nullParents = normalized.cells.filter((c) => !c.parentCellId).length;
  console.log('cells with null parent:', nullParents);
  const sample = normalized.cells.find((c) => c.cellId === 'cell:mechanic:resolve-equity-market-price-evidence.operation.2:expression');
  console.log('sample op.2:expression:', sample ? String(sample.parentCellId) : 'MISSING');
  const parents = new Set(normalized.cells.map((c) => c.parentCellId).filter(Boolean));
  const roots = normalized.cells.filter((c) => !parents.has(c.cellId) && !c.parentCellId);
  const top = normalized.cells.filter((c) => !parents.has(c.cellId));
  console.log('cells never a parent and root:', roots.length, 'cells never a parent:', top.length);
  const children = new Map<string, number>();
  for (const c of normalized.cells) if (c.parentCellId) children.set(c.parentCellId, (children.get(c.parentCellId) ?? 0) + 1);
  const sorted = [...children.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  console.log('biggest child counts:', sorted);
}
void main();
