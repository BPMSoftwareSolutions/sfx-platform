// Capability Explorer projection: the workspace shell (coordinates, tree, tabs,
// scenarios) and each node's rows, taken from one capability-details.v1
// document's declared navigation rows. Generic by construction: no capability,
// scenario, provider, result-set or page name appears in this module. Counts,
// states, placements and badges are shown as returned, never recomputed.
const parse = text => { try { return text ? JSON.parse(text) : {}; } catch { return {}; } };
const order = (a, b) => (a.row_ordinal - b.row_ordinal) || (a.sub_ordinal - b.sub_ordinal);

export function workspace(document) {
  const navigation = document?.sets?.capability_navigation;
  if (!Array.isArray(navigation)) throw new Error('CAPABILITY_NAVIGATION_NOT_READ');
  const of = kind => navigation.filter(row => row.row_kind === kind).sort(order);
  const policy = of('POLICY')[0] ?? null;
  const nodes = of('NODE').map(row => ({ ...row, declaration: parse(row.declaration) }));
  const byId = new Map(nodes.map(node => [node.node, node]));
  const coordinates = of('COORDINATE').map(row => ({ id: row.coordinate, label: row.label, groups: [], empty: [], diagnostics: [] }));
  const coordinateOf = node => coordinates.find(c => c.id === (node.coordinate ?? node.node.split('.')[0]));
  for (const node of nodes) {
    const coordinate = coordinateOf(node); if (!coordinate) continue;
    if (node.placement === 'DIAGNOSTICS') coordinate.diagnostics.push(node);
    else if (node.placement === 'EMPTY_SECTIONS') coordinate.empty.push(node);
    else {
      let group = coordinate.groups.find(g => g.label === (node.group_label ?? null));
      if (!group) coordinate.groups.push(group = { label: node.group_label ?? null, nodes: [] });
      group.nodes.push(node);
    }
  }
  const scenarioNodes = new Map(of('SCENARIO_NODE').map(row => [`${row.scenario_version_pk}|${row.node}`, row]));
  return {
    policy, nodes: byId, coordinates,
    aliases: of('ALIAS').map(row => ({ alias: row.alias, label: row.label, target: row.target_node, badge: row.badge_node, refuse: row.refuse, warn: row.warn })),
    scenarios: of('SCENARIO').map(row => ({ id: row.scenario_id, pk: row.scenario_version_pk, root: Boolean(row.is_root) })),
    scenarioNodes,
    coverage: of('COVERAGE'), unresolved: of('UNRESOLVED_SET')
  };
}

// The node's count, state and badges for the selected scenario: a scenario-scoped
// node reads its per-scenario row when one is returned, otherwise the node row.
export function nodeStatus(ws, node, scenario) {
  const scoped = node.scope === 'scenario' && scenario ? ws.scenarioNodes.get(`${scenario.pk}|${node.node}`) : null;
  return { count: scoped ? scoped.item_count : node.item_count, state: scoped?.state ?? node.state,
    refuse: scoped?.refuse ?? node.refuse ?? 0, warn: scoped?.warn ?? node.warn ?? 0, value: node.value, scoped: Boolean(scoped) };
}

// The node's rows from its declared result set. Rows carrying row_state split into
// counted rows (ROW) and markers (EMPTY and any other state), shown separately.
// A scenario-scoped node keeps only the selected scenario's rows by its declared key.
export function nodeRows(document, node, scenario) {
  const set = document.sets?.[node.source_result_set];
  if (!Array.isArray(set)) return { read: false, rows: [], markers: [], columns: [] };
  const key = node.declaration?.scenarioKey;
  const scoped = node.scope === 'scenario' && scenario && key ? set.filter(row => !(key in row) || String(row[key]) === String(key === 'scenario_id' ? scenario.id : scenario.pk)) : set;
  const stated = scoped.some(row => 'row_state' in row);
  const rows = stated ? scoped.filter(row => row.row_state === 'ROW') : scoped;
  const markers = stated ? scoped.filter(row => row.row_state !== 'ROW') : [];
  const columns = [...new Set(set.flatMap(row => Object.keys(row)))].filter(column => column !== 'result_set');
  return { read: true, rows, markers, columns, scopedBy: node.scope === 'scenario' && scenario && key ? key : null };
}

// A row's live-scene identity from the node's declared template, e.g. "provider:{provider_id}".
export function sceneKey(node, row) {
  const template = node.declaration?.sceneKey;
  if (!template || !row) return null;
  let missing = false;
  const key = template.replace(/\{([a-z0-9_]+)\}/g, (_, column) => { const value = row[column]; if (value == null) missing = true; return value; });
  return missing ? null : key;
}

// Canvas to tree: the node and row whose declared scene key equals a circuit
// component identity, searching only nodes that declare a scene key.
export function selectionForScene(document, ws, componentId, scenario) {
  for (const node of ws.nodes.values()) {
    if (!node.declaration?.sceneKey) continue;
    const { rows } = nodeRows(document, node, scenario);
    const index = rows.findIndex(row => sceneKey(node, row) === componentId);
    if (index >= 0) return { node: node.node, row: index };
  }
  return null;
}

export const rowLabel = (node, row, index) => (node.declaration?.childLabel && row[node.declaration.childLabel] != null)
  ? String(row[node.declaration.childLabel]) : `Row ${index + 1}`;
