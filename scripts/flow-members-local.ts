import { readFileSync } from 'node:fs';

import type { SdaRunGraph } from '@/contracts/sda-api';
import { normalizeRunGraph, buildRunGraphView } from '@/lib/run-graph';

interface Capture {
  graph: { json: SdaRunGraph };
}

const capture = JSON.parse(readFileSync(process.argv[2]!, 'utf8')) as Capture;
const graph = normalizeRunGraph(capture.graph.json);
const view = buildRunGraphView(graph);
const short = (id: string) => id.replace(/^cell:[a-z]+:[^:]+/, '');

for (const node of view.nodes) {
  if (node.altitude === 'scenario') continue;
  console.log('NODE', short(node.id), 'members', node.memberCellIds.length, 'material', node.material);
  for (const id of node.memberCellIds) {
    const cell = graph.cells.find((c) => c.cellId === id);
    console.log('   ', short(id), '| alt=', cell?.altitude, 'kind=', cell?.kind, '| parent=', short(cell?.parentCellId ?? ''));
  }
}
console.log('--- collapse passes');
const byId = new Map(graph.cells.map((cell) => [cell.cellId, cell]));
let drawn = new Set(byId.keys());
for (let pass = 1; pass <= 8; pass += 1) {
  const promoted = new Set<string>();
  for (const cellId of drawn) {
    const parent = byId.get(cellId)?.parentCellId ?? null;
    if (parent && byId.has(parent) && parent !== cellId) promoted.add(parent);
    else promoted.add(cellId);
  }
  console.log('pass', pass, 'size', promoted.size);
  if (promoted.size >= drawn.size) break;
  drawn = promoted;
  if (drawn.size <= 30) break;
}
