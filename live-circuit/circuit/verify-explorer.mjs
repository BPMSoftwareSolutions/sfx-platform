// Explorer projection checks against a running circuit host. Reads only.
//   node verify-explorer.mjs <base-url> <capabilityId>...
// For each capability: every declared node is placed exactly once, every tab
// targets a node, and scenario-scoped rows follow the selected scenario. The
// Explorer's client code must name no result set the reading returns
// (specification rule 7: clients hold no conditions on capability content).
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { workspace, nodeStatus, nodeRows } from './explorer-model.mjs';
const [base, ...capabilities] = process.argv.slice(2);
assert(base && capabilities.length, 'Supply base URL and capability IDs');
const sources = Object.fromEntries(await Promise.all(['explorer.js', 'explorer-model.mjs', 'explorer.html', 'pane-layout.js', 'objective-run.js']
  .map(async file => [file, await readFile(new URL(`./${file}`, import.meta.url), 'utf8')])));
const client = Object.values(sources).join('\n');
// The two sidebars are focusable separators; the layout module owns their behavior.
for (const [id, pane] of [['resizer-tree', 'tree'], ['resizer-context', 'context']]) {
  const tag = sources['explorer.html'].match(new RegExp(`<div[^>]*id="${id}"[^>]*>`))?.[0] ?? '';
  assert.match(tag, /class="splitter"/, `${id} is declared`);
  assert.match(tag, /role="separator"/, `${id} is a separator`);
  assert.match(tag, new RegExp(`aria-controls="${pane}"`), `${id} controls ${pane}`);
  assert.match(tag, /tabindex="0"/, `${id} is keyboard reachable`);
}
assert.match(client, /createPaneLayout\(/, 'The layout module drives the splitters');

const evidence = [];
for (const capabilityId of capabilities) {
  const response = await fetch(new URL(`/api/circuit/v1/capability-details?${new URLSearchParams({ capabilityId })}`, base));
  assert.equal(response.status, 200, capabilityId);
  const document = await response.json(), ws = workspace(document);
  const placed = ws.coordinates.flatMap(c => [...c.groups.flatMap(g => g.nodes), ...c.empty, ...c.diagnostics]).map(n => n.node);
  assert.equal(placed.length, ws.nodes.size, 'Every node is placed'); assert.equal(new Set(placed).size, placed.length, 'No node is placed twice');
  for (const tab of ws.aliases) assert(ws.nodes.has(tab.target), `Tab ${tab.alias} targets a declared node`);
  for (const set of Object.keys(document.sets)) assert(!client.includes(`'${set}'`) && !client.includes(`"${set}"`), `Client names result set ${set}`);
  for (const s of ws.scenarios) for (const node of ws.nodes.values()) {
    if (node.scope !== 'scenario' || node.state !== 'POPULATED' || !node.declaration.scenarioKey) continue;
    const status = nodeStatus(ws, node, s), { rows } = nodeRows(document, node, s);
    if (status.scoped && status.count != null) assert.equal(rows.length, status.count, `${node.node} rows for ${s.id} equal its per-scenario count`);
  }
  evidence.push({ capabilityId, nodes: ws.nodes.size, tabs: ws.aliases.length, scenarios: ws.scenarios.length, policy: ws.policy?.state });
}
console.log(JSON.stringify({ checked: evidence, clientNamesNoResultSet: true }));
