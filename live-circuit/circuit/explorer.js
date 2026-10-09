// Capability Explorer workspace. The shell (tree, tabs, scenarios, sections) is
// the capability details document's declared navigation (explorer-model.mjs).
// The circuit, its live and replay overlay, run controls, component drill-down
// and Observe are the circuit runtime (circuit-runtime.js) mounted in this page.
import { $, json, session, signOut, release, footerRelease } from './site.js';
import { el } from './circuit-viewer.js';
import { createCircuitRuntime } from './circuit-runtime.js';
import { workspace, nodeStatus, nodeRows, sceneKey, selectionForScene, rowLabel } from './explorer-model.mjs';
import { createPaneLayout } from './pane-layout.js';
import { createObjectiveRun, admissionBody, OBJECTIVE_CAPABILITY } from './objective-run.js';
import { createRegionRuntime, HEADER_REGION_ID, FOOTER_REGION_ID } from './region-runtime.js';
import { headerSlots, leftSidebarSlots, middleSlots, rightSidebarSlots } from './explorer-shell.js';
import { mountFooter } from './footer.js';

const params = new URLSearchParams(location.search);
const requestedFrom = p => ({ page: p.get('page'), detail: p.get('detail'), pointer: p.get('pointer') ?? '', detailPage: p.get('detailPage'), view: p.get('view'), run: p.get('run') });
const state = { capability: params.get('capability') ?? '', namespace: params.get('namespace') ?? '', scenario: params.get('scenario') ?? '',
  node: params.get('node') ?? '', row: params.has('row') ? Number(params.get('row')) : null, component: null, showAll: false,
  catalog: [], document: null, ws: null, detailsError: null, detailsMs: null, sceneError: null, serial: 0, sceneSerial: 0, health: null };
// Presentations whose few records read best as labelled fields; any other kind is a table.
const FIELD_PRESENTATIONS = new Set(['capability-overview', 'field-list', 'verdict', 'identity-digests', 'promise-flow']);
const FIELD_LIMIT = 3, TABLE_LIMIT = 200;
const words = text => String(text).toLowerCase().replaceAll('_', ' ');
const show = value => value == null ? '—' : typeof value === 'object' ? JSON.stringify(value) : String(value);
const fields = entries => el('dl', { class: 'fields' }, entries.flatMap(([k, v]) => [el('dt', { text: k }), el('dd', { text: show(v) })]));
const notice = (text, kind = '') => el('div', { class: `notice ${kind}`, text });
const action = (text, run) => { const link = el('a', { href: '#', text }); link.addEventListener('click', event => { event.preventDefault(); run(); }); return link; };

// The declared shell regions. Each region is mounted through the host's
// ui.region.load before the runtime binds to the ids its slots carry: the
// region supplies the structure and style, the shell supplies the behavior
// nodes (headerSlots / leftSidebarSlots / middleSlots / rightSidebarSlots).
// The shared footer mounts last. There is no fallback: a region that cannot be
// read renders its named state in place of that region only.
const leftRegion = await createRegionRuntime({ root: $('tree'), regionId: 'left-sidebar', slots: leftSidebarSlots() });
const middleRegion = await createRegionRuntime({ root: $('region-middle'), regionId: 'middle', slots: middleSlots() });
const rightRegion = await createRegionRuntime({ root: $('context'), regionId: 'right-sidebar', slots: rightSidebarSlots() });
const headerRegion = await createRegionRuntime({ root: $('region-header'), regionId: HEADER_REGION_ID, slots: headerSlots() });
// The context tabs toggle the declared slot hosts in place of the old
// tabpanels; the run/runs/evidence groups stay with their tab.
for (const [name, panel, hidden] of [['run-report', 'run', false], ['run-steps', 'run', false], ['observe-form', 'run', false],
  ['runs-history', 'runs', true], ['component-evidence', 'evidence', true], ['selection-details', 'evidence', true], ['declared-authority', 'evidence', true]]) {
  const host = rightRegion.slot?.(name);
  if (!host) continue;
  host.dataset.contextPanel = panel; host.hidden = hidden;
}
rightRegion.slot?.('run-report')?.setAttribute('id', 'context-run');
rightRegion.slot?.('runs-history')?.setAttribute('id', 'context-runs');
rightRegion.slot?.('component-evidence')?.setAttribute('id', 'context-evidence');
const footerRegion = await mountFooter();

const runtimeShell = {
  selection: () => ({ capabilityId: state.capability, namespaceId: state.namespace }),
  loadRoot: async () => { Object.assign(state, { scenario: '', row: null, component: null }); syncUrl(false); await readScene(false, {}); },
  scenario: id => changeScenario(id),
  location: push => syncUrl(push),
  component: id => selectComponent(id),
  authenticationRequired: () => identity().catch(() => {})
};
// When the middle region rendered its named failure state there is no canvas to
// drive: the runtime is a named no-op so the other declared regions keep
// rendering and no path reaches a missing element.
const runtime = $('circuit-frame') && $('slide') ? createCircuitRuntime(runtimeShell) : {
  state: { deck: null, apiId: null, apiResult: null, output: undefined, outputError: null },
  install: async () => {}, clear: () => {}, render: () => {}, selectSlide: () => {}, openDetail: () => {},
  closeDetail: () => {}, focus: () => {}, hasComponent: () => false, slideOf: () => null, setView: () => {},
  reset: () => {}, openRun: async () => {}, contextTab: () => {}, selection: () => ({})
};
const deck = () => runtime.state.deck;

function syncUrl(push = false) {
  const url = new URL(location.href), circuit = runtime.selection();
  for (const [key, value] of [['capability', state.capability], ['namespace', state.namespace], ['scenario', state.scenario], ['node', state.node],
    ['row', state.row], ['page', circuit.page], ['detail', circuit.detail], ['pointer', circuit.pointer], ['detailPage', circuit.detailPage], ['view', circuit.view], ['run', circuit.run]])
    if (value !== null && value !== undefined && value !== '') url.searchParams.set(key, value); else url.searchParams.delete(key);
  history[push ? 'pushState' : 'replaceState'](null, '', url);
}
// The selected scenario: the requested one, or the root when none is requested. A
// called scenario of another capability selects no section scenario.
const scenario = () => !state.ws ? null : state.scenario ? state.ws.scenarios.find(s => s.id === state.scenario) ?? null
  : state.ws.scenarios.find(s => s.root) ?? state.ws.scenarios[0] ?? null;
const currentNode = () => state.ws ? (state.ws.nodes.get(state.node) ?? state.ws.nodes.get(state.ws.aliases[0]?.target) ?? state.ws.nodes.values().next().value) : null;

// Reads: details and scene in parallel; the circuit draws as soon as its scene arrives.
async function open(refresh = false, requested = {}) {
  const serial = ++state.serial;
  Object.assign(state, { document: null, ws: null, detailsError: null, detailsMs: null, showAll: false });
  render();
  if (!state.capability) { runtime.clear('Choose a capability to read its circuit.'); return; }
  const q = new URLSearchParams({ capabilityId: state.capability });
  if (state.namespace) q.set('namespaceId', state.namespace);
  if (refresh) q.set('refresh', '1');
  const started = performance.now();
  const details = json(`/api/circuit/v1/capability-details?${q}`).then(r => {
    if (serial !== state.serial) return;
    state.detailsMs = Math.round(performance.now() - started);
    if (!r.ok) state.detailsError = r.body?.error ?? `HTTP_${r.status}`;
    else try { state.document = r.body; state.ws = workspace(r.body); state.namespace ||= r.body.namespaceId ?? ''; }
    catch (error) { state.detailsError = error.message; }
    render();
  });
  await Promise.allSettled([details, readScene(refresh, requested)]);
}
async function readScene(refresh = false, requested = {}) {
  const serial = ++state.sceneSerial;
  state.sceneError = null;
  runtime.clear('Reading the circuit from the database…');
  const q = new URLSearchParams({ capabilityId: state.capability });
  if (state.namespace) q.set('namespaceId', state.namespace);
  if (state.scenario) q.set('scenarioId', state.scenario);
  if (refresh) q.set('refresh', '1');
  const r = await json(`/api/circuit/v1/scenario?${q}`);
  if (serial !== state.sceneSerial) return;
  if (!r.ok) { state.sceneError = r.body?.error ?? `HTTP_${r.status}`; runtime.clear(`Circuit loading held: ${state.sceneError}. The capability’s sections remain available.`); }
  else { state.namespace ||= r.body.namespaceId ?? ''; await runtime.install(r.body, requested); if (requested.run && requested.run !== runtime.selection().run) await runtime.openRun(requested.run); }
  render();
}
function changeScenario(id) {
  Object.assign(state, { scenario: id, row: null, component: null });
  syncUrl(true); render(); readScene(false, {});
}

// Selection: tree, tabs, table rows and circuit components share one model.
function selectNode(id, push = true) {
  Object.assign(state, { node: id, row: null, component: null, showAll: false });
  syncUrl(push); render(); runtime.contextTab('evidence'); closeDrawers();
}
function selectRow(index) {
  const node = currentNode(); state.row = index; state.component = null;
  const key = sceneKey(node, nodeRows(state.document, node, scenario()).rows[index]);
  if (key && runtime.hasComponent(key)) { state.component = key; runtime.focus(key); }
  syncUrl(false); render();
  runtime.contextTab('evidence');
}
// Canvas to tree: the section and row that declare this component's scene key.
function selectComponent(id) {
  state.component = id;
  const found = id && state.ws ? selectionForScene(state.document, state.ws, id, scenario()) : null;
  if (found) Object.assign(state, { node: found.node, row: found.row, showAll: found.row >= TABLE_LIMIT || state.showAll });
  else state.row = null;
  syncUrl(false); render();
}

// Rendering of the shell; the runtime renders the circuit and its panels.
function render() {
  renderHeader(); renderTree(); renderTabs(); renderSection(); renderContext(); renderStatus();
}
function renderHeader() {
  const crumbs = $('crumbs'), title = $('title'), meta = $('meta'), bar = $('scenario-bar');
  if (!crumbs || !title || !meta || !bar) return;
  const node = currentNode(), coordinate = node && state.ws.coordinates.find(c => c.id === (node.coordinate ?? node.node.split('.')[0]));
  crumbs.textContent = ['Capabilities', coordinate?.label, node?.label].filter(Boolean).join(' › ');
  title.textContent = state.capability || 'Capability Explorer';
  document.title = `${state.capability ? state.capability + ' · ' : ''}Capability Explorer · SFX`;
  const d = state.document, lead = state.ws?.nodes.get(state.ws.aliases[0]?.target);
  meta.replaceChildren(...[d?.namespaceId, d?.capabilityVersionPk != null && `version ${d.capabilityVersionPk}`,
    lead?.value != null && `${lead.label}: ${words(lead.value).toUpperCase()}`,
    state.ws && `${state.ws.scenarios.length} scenario${state.ws.scenarios.length === 1 ? '' : 's'}`,
    state.ws?.policy && `navigation ${state.ws.policy.label} · ${words(state.ws.policy.state)}`].filter(Boolean).map(text => el('span', { text })));
  for (const id of ['refresh', 'expand']) { const button = $(id); if (button) button.disabled = !state.capability; }
  const scenarios = state.ws?.scenarios ?? [];
  bar.hidden = scenarios.length < 2 && !(state.scenario && !scenario());
  if (!bar.hidden) {
    const current = scenario(), names = new Map((deck()?.scenarios ?? []).map(s => [s.id, s.name]));
    const options = scenarios.map(s => new Option(`${names.get(s.id) || s.id}${s.root ? ' (root)' : ''}`, s.id, false, s.id === current?.id));
    if (state.scenario && !current) options.push(new Option(`${names.get(state.scenario) || state.scenario} (called scenario)`, state.scenario, false, true));
    $('scenario').replaceChildren(...options);
    $('scenario-note').textContent = current ? 'Scenario sections and the circuit follow this selection.'
      : 'The circuit shows a called scenario; sections cover this capability’s own scenarios.';
  }
}
function treeItem(node) {
  const status = nodeStatus(state.ws, node, scenario());
  const item = el('button', { type: 'button', class: 'tree-item', 'aria-current': String(node.node === currentNode()?.node), title: `${node.label} · ${words(status.state)}` }, [
    el('span', { class: 'label', text: node.label }),
    ...(status.count != null ? [el('span', { class: 'count', text: String(status.count) })] : []),
    ...(status.refuse ? [el('span', { class: 'badge refuse', text: String(status.refuse), title: `${status.refuse} refuse` })] : []),
    ...(status.warn ? [el('span', { class: 'badge warn', text: String(status.warn), title: `${status.warn} warn` })] : []),
    ...(status.state !== 'POPULATED' ? [el('span', { class: 'chip', text: words(status.state) })] : [])]);
  item.addEventListener('click', () => selectNode(node.node));
  return item;
}
function more(label, nodes) {
  const box = el('details', { class: 'tree-more' }, [el('summary', { text: `${label} (${nodes.length})` }), ...nodes.map(treeItem)]);
  box.open = nodes.some(n => n.node === currentNode()?.node);
  return box;
}
// Sections, groups and nodes are one interleaved tree (each coordinate heads
// its own groups and nodes), so the whole tree renders into the node-navigation
// host; the section/group/count/state/badge hosts stay as declared slots.
function renderTree() {
  const host = $('tree-nodes');
  if (!host) return;
  if (!state.capability) return host.replaceChildren(el('p', { class: 'note', text: 'Find a capability to explore its declared sections.' }));
  if (state.detailsError) return host.replaceChildren(el('div', { class: 'notice error' }, [el('strong', { text: 'Reading failed' }),
    el('p', { text: `The estate could not read this capability (${state.detailsError}). No sections are shown in its place.` })]));
  if (!state.ws) return host.replaceChildren(el('p', { class: 'note', text: 'Reading the capability’s declared sections… An uncached read takes a few seconds.' }));
  const ws = state.ws, items = [];
  if (ws.policy?.state !== 'RESOLVED') items.push(notice(`Navigation policy ${words(ws.policy?.state ?? 'not returned')}.`, 'error'));
  if (ws.coverage.length) items.push(notice(`${ws.coverage.length} navigation coverage violation${ws.coverage.length === 1 ? '' : 's'}: ${ws.coverage.map(c => c.check_key).join(', ')}.`, 'error'));
  for (const c of ws.coordinates) {
    items.push(el('div', { class: 'tree-coordinate', text: c.label }));
    for (const g of c.groups) { if (g.label) items.push(el('div', { class: 'tree-group', text: g.label })); items.push(...g.nodes.map(treeItem)); }
    if (c.empty.length) items.push(more('Empty sections', c.empty));
    if (c.diagnostics.length) items.push(more('Diagnostics', c.diagnostics));
  }
  host.replaceChildren(...items);
}
function renderTabs() {
  const host = $('tabs');
  if (!host) return;
  const node = currentNode();
  host.replaceChildren(...(state.ws?.aliases ?? []).map(a => {
    const tab = el('button', { type: 'button', role: 'tab', class: 'tab', 'aria-selected': String(node?.alias === a.alias) }, [
      el('span', { text: a.label }),
      ...(a.refuse ? [el('span', { class: 'badge refuse', text: String(a.refuse) })] : []),
      ...(a.warn ? [el('span', { class: 'badge warn', text: String(a.warn) })] : [])]);
    tab.addEventListener('click', () => selectNode(a.target));
    return tab;
  }));
}
function renderSection() {
  const host = $('section'), node = currentNode();
  if (!host) return;
  if (!state.capability) return host.replaceChildren();
  if (state.detailsError) return host.replaceChildren(el('div', { class: 'notice error' }, [el('strong', { text: `Reading failed · ${state.detailsError}` }),
    el('p', { text: 'The capability details reading failed in the estate. The circuit above is read separately; Observe and replay remain available.' })]));
  if (!node) return host.replaceChildren(el('p', { class: 'note', text: 'Reading the capability’s declared sections…' }));
  const status = nodeStatus(state.ws, node, scenario()), current = scenario();
  const head = el('div', { class: 'section-head' }, [el('h2', { text: node.label }),
    ...[node.page, words(status.state), status.count != null && `${status.count} counted`].filter(Boolean).map(text => el('span', { class: 'chip', text })),
    ...(status.refuse ? [el('span', { class: 'badge refuse', text: `${status.refuse} refuse` })] : []),
    ...(status.warn ? [el('span', { class: 'badge warn', text: `${status.warn} warn` })] : [])]);
  const body = [];
  if (status.state === 'READ_ON_DEMAND') body.push(notice(`Read on demand: ${node.source_result_set} is not part of the capability reading.`));
  else if (status.state === 'READING_IDENTITY') body.push(fields([['Capability', state.document.capabilityId], ['Namespace', state.document.namespaceId],
    ['Capability version', state.document.capabilityVersionPk], ['Estate model', state.document.estateModelPk],
    ['Reading definition (SHA-256)', state.document.readingDefinitionSha256], ['Read at', state.document.readAt], ['Source', state.document.source]]));
  else {
    const { read, rows, markers, columns, scopedBy } = nodeRows(state.document, node, current);
    if (!read) body.push(notice(`Not read: the reading returned no ${node.source_result_set} set.`));
    if (scopedBy) body.push(el('p', { class: 'note', text: `Rows of scenario ${current.id} (by ${scopedBy}).` }));
    if (node.value != null) body.push(fields([['Declared value', node.value]]));
    for (const marker of markers) body.push(notice(`${words(marker.row_state)} marker: ${Object.entries(marker).filter(([k, v]) => v != null && !['result_set', 'row_state'].includes(k)).map(([k, v]) => `${k} ${show(v)}`).join(' · ') || 'no fields'}`));
    if (read && !rows.length && !markers.length) body.push(notice('No rows.'));
    if (rows.length) body.push(...rowsView(node, rows, columns));
  }
  host.replaceChildren(head, ...body);
}
function rowsView(node, rows, columns) {
  const shown = columns.filter(c => c !== 'row_state');
  if (FIELD_PRESENTATIONS.has(node.presentation) && rows.length <= FIELD_LIMIT)
    return [el('p', { class: 'note', text: `Declared presentation: ${node.presentation}.` }),
      ...rows.map((row, i) => { const box = el('div', { class: 'record' }, [fields(shown.map(c => [c, row[c]]))]); box.addEventListener('click', () => selectRow(i)); return box; })];
  const limit = state.showAll ? rows.length : Math.min(rows.length, TABLE_LIMIT);
  const body = el('tbody', {}, rows.slice(0, limit).map((row, i) => {
    const tr = el('tr', { 'aria-selected': String(i === state.row) }, shown.map(c => el('td', { text: show(row[c]), title: show(row[c]) })));
    tr.addEventListener('click', () => selectRow(i)); return tr;
  }));
  const out = [el('p', { class: 'note', text: `Declared presentation: ${node.presentation} · shown as a table · ${rows.length} row${rows.length === 1 ? '' : 's'}.` }),
    el('div', { class: 'table-wrap' }, [el('table', {}, [el('thead', {}, [el('tr', {}, shown.map(c => el('th', { text: c })))]), body])])];
  if (limit < rows.length) { const all = el('button', { type: 'button', class: 'button secondary small', text: `Show all ${rows.length} rows` }); all.addEventListener('click', () => { state.showAll = true; renderSection(); }); out.push(all); }
  return out;
}
function renderContext() {
  const host = $('context-body'), node = currentNode();
  if (!host) return;
  if (!node) return host.replaceChildren(el('p', { class: 'note', text: state.component ? '' : 'Select a section, a row or a circuit component.' }));
  const { rows } = state.document ? nodeRows(state.document, node, scenario()) : { rows: [] };
  const row = state.row != null ? rows[state.row] : null;
  if (row) {
    const key = sceneKey(node, row), item = key && deck()?.navigation?.items.find(i => i.id === key);
    const parts = [el('h3', { text: `${node.label} › ${rowLabel(node, row, state.row)}` }), fields(Object.entries(row).filter(([k]) => !['result_set', 'row_state'].includes(k)))];
    if (key) parts.push(el('p', { class: 'note', text: runtime.hasComponent(key) ? `Drawn on the circuit as ${key}.`
      : item ? `${key} is a ${item.kind} of this circuit.` : `Declared scene key ${key} is not part of this scenario’s circuit.` }));
    const links = [];
    if (key && runtime.hasComponent(key)) links.push(action('Show on the circuit', () => runtime.focus(key)));
    if (item) links.push(action('Open component authority', () => runtime.openDetail(key)));
    if (links.length) parts.push(el('p', { class: 'related-links' }, links));
    return host.replaceChildren(...parts);
  }
  if (state.component) return host.replaceChildren(el('p', { class: 'note', text: 'No Explorer section declares a scene key for this circuit component, so no section is selected.' }));
  const status = nodeStatus(state.ws, node, scenario());
  host.replaceChildren(el('h3', { text: node.label }), fields([['Coordinate', node.coordinate], ['Group', node.group_label], ['Page', node.page],
    ['Presentation', node.presentation], ['State', words(status.state)], ['Counted', status.count], ['Markers', node.markers], ['Other rows', node.other_rows],
    ['Rows emitted', node.rows_emitted], ['Refuse', status.refuse], ['Warn', status.warn], ['Value', node.value], ['Source set', node.source_result_set],
    ['Scope', node.scope], ['Placement', words(node.placement)]]));
}
function renderStatus() {
  const d = state.document, parts = [];
  if (state.health) parts.push(el('span', { text: `${state.health.release} · kernel ${state.health.kernelLanguage ?? ''} ${String(state.health.kernelDigest ?? '').replace('sha256:', '').slice(0, 12)}` }));
  if (d) parts.push(el('span', { text: `Details read ${new Date(d.readAt).toLocaleTimeString()} · ${state.detailsMs} ms · reading ${d.readingDefinitionSha256.slice(0, 12)} · estate ${d.estateModelPk}` }));
  else if (state.detailsError) parts.push(el('span', { class: 'error', text: `Details: ${state.detailsError}` }));
  else if (state.capability) parts.push(el('span', { text: 'Reading capability details…' }));
  if (deck()) parts.push(el('span', { text: `Circuit: database scene ${deck().snapshotDigest?.slice(0, 12) ?? ''} · read ${deck().readAt ? new Date(deck().readAt).toLocaleTimeString() : 'time not reported'}` }));
  else if (state.sceneError) parts.push(el('span', { class: 'error', text: `Circuit: ${state.sceneError}` }));
  const status = $('status');
  if (status) status.replaceChildren(...(parts.length ? parts : [el('span', { text: 'Ready to read a capability.' })]));
}
function closeDrawers() { for (const id of ['tree', 'context']) $(id)?.classList.remove('open'); layout.sync(); }

// Identity, catalog and controls.
async function identity(node) {
  if (!node) return;
  const s = (await session()).body;
  if (s?.authenticated) {
    const out = el('button', { type: 'button', class: 'button secondary small', text: 'Sign out' });
    out.addEventListener('click', async () => { out.disabled = true; await signOut(); location.reload(); });
    node.replaceChildren(el('span', { class: 'who', text: `Signed in as ${s.identifier ?? 'principal ' + s.principalId.slice(0, 8)}` }), out);
  } else {
    const parts = [el('a', { class: 'button secondary small', href: `/circuit/login?return=${encodeURIComponent(location.pathname + location.search)}`, text: 'Sign in' })];
    if (s?.observeRequiresSession) parts.push(el('small', { class: 'who', text: 'Observe requires sign-in' }));
    node.replaceChildren(...parts);
  }
}
const picker = $('picker');
if (picker) picker.addEventListener('submit', event => {
  event.preventDefault();
  const id = $('capability').value.trim(), item = state.catalog.find(c => c.capabilityId === id);
  if (!id) return;
  if (id !== state.capability) runtime.reset();
  Object.assign(state, { capability: id, namespace: item?.namespaceId ?? '', scenario: '', node: '', row: null, component: null });
  syncUrl(true); open();
});
$('scenario')?.addEventListener('change', event => changeScenario(event.target.value));
$('refresh')?.addEventListener('click', () => open(true, runtime.selection()));
$('expand')?.addEventListener('click', () => {
  const expanded = $('workspace').classList.toggle('expanded');
  $('expand').textContent = expanded ? 'Show workspace' : 'Expand circuit';
});
// Both sidebars drag-resize and collapse on desktop; the same buttons open the
// narrow-window drawers. Widths and collapsed state persist per browser.
const layout = $('resizer-tree') && $('resizer-context') && $('toggle-tree') && $('toggle-context') ? createPaneLayout({
  workspace: $('workspace'),
  panes: [
    { id: 'tree', variable: '--tree', side: 'left', handle: 'resizer-tree', aside: 'tree', toggle: 'toggle-tree', name: 'sections', minimum: 220, maximum: 640, defaultWidth: 300 },
    { id: 'context', variable: '--context', side: 'right', handle: 'resizer-context', aside: 'context', toggle: 'toggle-context', name: 'details', minimum: 300, maximum: 760, defaultWidth: 380 }
  ]
}) : { sync() {}, resize() {}, toggle() {} };
// The universal capability's objective row, above the run bar. Run admits it,
// then the Explorer switches to that circuit and follows the run.
async function followObjectiveRun(runId) {
  if (state.capability !== OBJECTIVE_CAPABILITY) {
    Object.assign(state, { capability: OBJECTIVE_CAPABILITY, namespace: '', scenario: '', node: '', row: null, component: null });
    const input = $('capability'); if (input) input.value = state.capability;
    syncUrl(true);
    await open(false, { run: runId });
  } else {
    await runtime.openRun(runId);
  }
}
if ($('objective-form')) createObjectiveRun({
  admit: objective => json('/api/circuit/v1/runs', { method: 'POST',
    headers: { 'idempotency-key': crypto.randomUUID() }, body: JSON.stringify(admissionBody(objective)) }),
  follow: followObjectiveRun,
  signIn: () => { location.assign('/circuit/login?return=' + encodeURIComponent(location.pathname + location.search)); },
  currentCapability: () => state.capability,
  runState: () => ({ id: runtime.state.apiId, result: runtime.state.apiResult, output: runtime.state.output, error: runtime.state.outputError })
});
window.addEventListener('popstate', () => {
  const p = new URLSearchParams(location.search), previous = { ...state }, requested = requestedFrom(p);
  Object.assign(state, { capability: p.get('capability') ?? '', namespace: p.get('namespace') ?? '', scenario: p.get('scenario') ?? '',
    node: p.get('node') ?? '', row: p.has('row') ? Number(p.get('row')) : null, component: null });
  const input = $('capability'); if (input) input.value = state.capability;
  if (state.capability !== previous.capability || state.namespace !== previous.namespace) { runtime.reset(); open(false, requested); return; }
  if (state.scenario !== previous.scenario) { render(); readScene(false, requested); return; }
  const circuit = runtime.selection();
  if ((requested.run ?? null) !== circuit.run) {
    if (requested.run) runtime.openRun(requested.run);
    else { runtime.reset(); readScene(false, requested); }
  }
  const requestedView = requested.view === 'paged' ? 'paged' : 'linear';
  if (requestedView !== circuit.view) runtime.setView(requestedView, false);
  if (requested.detail && requested.detail !== circuit.detail) runtime.openDetail(requested.detail, false, requested.pointer, requested.detailPage);
  else if (!requested.detail && circuit.detail) { runtime.closeDetail(); runtime.render(); }
  else if (requested.page && requested.page !== circuit.page) runtime.selectSlide(requested.page, false);
  render();
});

// The declared ui-region-header mount moved above the runtime, together with
// the three Explorer regions; see explorer-shell.js for the shell slot content.

const [catalog, host, health] = await Promise.all([json('/api/circuit/v1/capabilities'), json('/api/circuit/v1/home'), release(), identity($('identity'))]);
state.health = health;
footerRelease($('release'), health);
if (catalog.ok) {
  state.catalog = catalog.body.capabilities ?? [];
  $('capabilities')?.replaceChildren(...state.catalog.map(c => new Option(c.namespaceId, c.capabilityId)));
}
const env = $('env');
if (env && host.ok && host.body?.environment) { env.textContent = host.body.environment; env.hidden = false; }
if (!state.capability && host.ok && host.body?.hero?.capabilityId)
  Object.assign(state, { capability: host.body.hero.capabilityId, namespace: host.body.hero.namespaceId ?? '' });
const capabilityInput = $('capability');
if (capabilityInput) capabilityInput.value = state.capability;
open(false, requestedFrom(params));
