// Capability Explorer workspace. The shell (tree, tabs, scenarios, sections) is
// the capability details document's declared navigation (explorer-model.mjs).
// The circuit is the database scene drawn by the Live Circuit's own renderer,
// without a runtime overlay; Observe, live following and replay stay on the Live
// Circuit page, which every view links to with the same selection.
import { $, json, session, signOut, circuitHref, release } from './site.js';
import { el, renderCircuitViewer } from './circuit-viewer.js';
import { buildTraversal, traversalState } from './traversal.js';
import { workspace, nodeStatus, nodeRows, sceneKey, selectionForScene, rowLabel } from './explorer-model.mjs';

const params = new URLSearchParams(location.search);
const state = { capability: params.get('capability') ?? '', namespace: params.get('namespace') ?? '', scenario: params.get('scenario') ?? '',
  node: params.get('node') ?? '', row: params.has('row') ? Number(params.get('row')) : null, component: null, showAll: false,
  catalog: [], document: null, ws: null, detailsError: null, detailsMs: null, deck: null, view: null, slideId: null, sceneError: null,
  serial: 0, sceneSerial: 0, health: null };
// Presentations whose few records read best as labelled fields; any other kind is a table.
const FIELD_PRESENTATIONS = new Set(['capability-overview', 'field-list', 'verdict', 'identity-digests', 'promise-flow']);
const FIELD_LIMIT = 3, TABLE_LIMIT = 200;
const words = text => String(text).toLowerCase().replaceAll('_', ' ');
const show = value => value == null ? '—' : typeof value === 'object' ? JSON.stringify(value) : String(value);
const fields = entries => el('dl', { class: 'fields' }, entries.flatMap(([k, v]) => [el('dt', { text: k }), el('dd', { text: show(v) })]));
const notice = (text, kind = '') => el('div', { class: `notice ${kind}`, text });

function syncUrl(push = false) {
  const url = new URL(location.href);
  for (const [key, value] of [['capability', state.capability], ['namespace', state.namespace], ['scenario', state.scenario], ['node', state.node], ['row', state.row]])
    if (value !== null && value !== '') url.searchParams.set(key, value); else url.searchParams.delete(key);
  history[push ? 'pushState' : 'replaceState'](null, '', url);
}
const scenario = () => state.ws ? (state.ws.scenarios.find(s => s.id === state.scenario) ?? state.ws.scenarios.find(s => s.root) ?? state.ws.scenarios[0] ?? null) : null;
const currentNode = () => state.ws ? (state.ws.nodes.get(state.node) ?? state.ws.nodes.get(state.ws.aliases[0]?.target) ?? state.ws.nodes.values().next().value) : null;
const liveHref = () => state.capability ? circuitHref(state.capability, state.namespace, state.deck?.scenarioId ?? state.scenario) : '/circuit/';

// Reads: details and scene in parallel; the circuit draws as soon as its scene arrives.
async function open(refresh = false) {
  const serial = ++state.serial;
  Object.assign(state, { document: null, ws: null, detailsError: null, detailsMs: null, showAll: false });
  render();
  if (!state.capability) return;
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
  await Promise.allSettled([details, readScene(refresh)]);
}
async function readScene(refresh = false) {
  const serial = ++state.sceneSerial;
  Object.assign(state, { deck: null, view: null, sceneError: null });
  renderCanvas();
  const q = new URLSearchParams({ capabilityId: state.capability });
  if (state.namespace) q.set('namespaceId', state.namespace);
  if (state.scenario) q.set('scenarioId', state.scenario);
  if (refresh) q.set('refresh', '1');
  const r = await json(`/api/circuit/v1/scenario?${q}`);
  if (serial !== state.sceneSerial) return;
  if (!r.ok) state.sceneError = r.body?.error ?? `HTTP_${r.status}`;
  else {
    state.deck = r.body;
    state.view = traversalState(buildTraversal(r.body, null), { run: null });
    state.slideId = (r.body.slides.find(s => s.blueprint?.role === 'scenario-blueprint') ?? r.body.slides[0])?.id ?? null;
  }
  render();
}

// Selection: tree, tabs, table rows and circuit components share one model.
function selectNode(id, push = true) {
  Object.assign(state, { node: id, row: null, component: null, showAll: false });
  syncUrl(push); render(); closeDrawers();
}
function selectRow(index) {
  const node = currentNode(); state.row = index;
  const row = nodeRows(state.document, node, scenario()).rows[index];
  const key = sceneKey(node, row);
  state.component = key && hasComponent(key) ? key : null;
  if (state.component) state.slideId = slideOf(state.component) ?? state.slideId;
  syncUrl(false); render();
}
function selectComponent(id) {
  state.component = id === state.component ? null : id;
  const found = id && state.ws ? selectionForScene(state.document, state.ws, id, scenario()) : null;
  if (found) Object.assign(state, { node: found.node, row: found.row, showAll: found.row >= TABLE_LIMIT || state.showAll });
  else state.row = null;
  syncUrl(false); render();
}
function selectTarget(target) {
  if (target?.kind === 'slide') { state.slideId = target.id; renderCanvas(); }
  else if (target?.kind === 'scenario' && state.ws?.scenarios.some(s => s.id === target.id)) changeScenario(target.id);
  else if (target?.id) selectComponent(target.id);
}
function changeScenario(id) {
  Object.assign(state, { scenario: id, row: null, component: null });
  syncUrl(true); render(); readScene();
}
const glyphs = slide => [...(slide.blueprint?.glyphs ?? []), ...(slide.blueprint?.boundaryGlyphs ?? [])];
const hasComponent = id => Boolean(state.deck?.slides.some(slide => glyphs(slide).some(g => g.nodeId === id)));
const slideOf = id => state.deck?.slides.find(slide => glyphs(slide).some(g => g.nodeId === id))?.id;

// Rendering.
function render() {
  renderHeader(); renderTree(); renderTabs(); renderCanvas(); renderSection(); renderContext(); renderStatus();
}
function renderHeader() {
  const node = currentNode(), coordinate = node && state.ws.coordinates.find(c => c.id === (node.coordinate ?? node.node.split('.')[0]));
  $('crumbs').textContent = ['Capabilities', coordinate?.label, node?.label].filter(Boolean).join(' › ');
  $('title').textContent = state.capability || 'Capability Explorer';
  document.title = `${state.capability ? state.capability + ' · ' : ''}Capability Explorer · SFX`;
  const d = state.document, lead = state.ws?.nodes.get(state.ws.aliases[0]?.target);
  $('meta').replaceChildren(...[d?.namespaceId, d?.capabilityVersionPk != null && `version ${d.capabilityVersionPk}`,
    lead?.value != null && `${lead.label}: ${words(lead.value).toUpperCase()}`,
    state.ws && `${state.ws.scenarios.length} scenario${state.ws.scenarios.length === 1 ? '' : 's'}`,
    state.ws?.policy && `navigation ${state.ws.policy.label} · ${words(state.ws.policy.state)}`].filter(Boolean).map(text => el('span', { text })));
  for (const id of ['refresh', 'expand']) $(id).disabled = !state.capability;
  $('open-live').href = $('live-link').href = liveHref();
  const bar = $('scenario-bar'), scenarios = state.ws?.scenarios ?? [];
  bar.hidden = scenarios.length < 2;
  if (!bar.hidden) {
    const current = scenario();
    $('scenario').replaceChildren(...scenarios.map(s => new Option(`${s.id}${s.root ? ' (root)' : ''}`, s.id, false, s.id === current?.id)));
    $('scenario-note').textContent = 'Scenario sections and the circuit follow this selection.';
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
function renderTree() {
  const host = $('tree-nodes');
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
  const host = $('tabs'), node = currentNode();
  host.replaceChildren(...(state.ws?.aliases ?? []).map(a => {
    const tab = el('button', { type: 'button', role: 'tab', class: 'tab', 'aria-selected': String(node?.alias === a.alias) }, [
      el('span', { text: a.label }),
      ...(a.refuse ? [el('span', { class: 'badge refuse', text: String(a.refuse) })] : []),
      ...(a.warn ? [el('span', { class: 'badge warn', text: String(a.warn) })] : [])]);
    tab.addEventListener('click', () => selectNode(a.target));
    return tab;
  }));
}
function renderCanvas() {
  const root = $('canvas'), page = $('page');
  const placeholder = text => { delete root.dataset.slide; root.replaceChildren(el('div', { class: 'canvas-state', text })); page.hidden = true; };
  if (!state.capability) return placeholder('Choose a capability to read its circuit.');
  if (state.sceneError) return placeholder(`The circuit could not be read (${state.sceneError}).`);
  if (!state.deck) return placeholder('Reading the circuit from the database…');
  if (!state.deck.slides.length) return placeholder(`Circuit held: ${state.deck.findings?.map(f => f.code).join(', ') || state.deck.status}.`);
  const slide = state.deck.slides.find(s => s.id === state.slideId) ?? state.deck.slides[0];
  page.hidden = state.deck.slides.length < 2;
  page.replaceChildren(...state.deck.slides.map((s, i) => new Option(`${String(i + 1).padStart(2, '0')} · ${s.title}`, s.id, false, s.id === slide.id)));
  $('circuit-caption').textContent = `${state.deck.scenarioId ?? 'Scenario'} · database scene${state.deck.snapshotDigest ? ' ' + state.deck.snapshotDigest.slice(0, 12) : ''}`;
  renderCircuitViewer(root, state.deck, slide, state.view, { selectedNode: state.component, selectNode: selectComponent,
    selectSlide: id => { state.slideId = id; renderCanvas(); }, selectTarget, overlay: false, run: null });
}
function renderSection() {
  const host = $('section'), node = currentNode();
  if (!state.capability) return host.replaceChildren();
  if (state.detailsError) return host.replaceChildren(el('div', { class: 'notice error' }, [el('strong', { text: `Reading failed · ${state.detailsError}` }),
    el('p', { text: 'The capability details reading failed in the estate. The circuit above is read separately and is unaffected. Open the Live Circuit to observe or replay this capability.' })]));
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
  if (!node) return host.replaceChildren(el('p', { class: 'note', text: 'Select a section, a row or a circuit component.' }));
  const { rows } = state.document ? nodeRows(state.document, node, scenario()) : { rows: [] };
  const row = state.row != null ? rows[state.row] : null;
  if (row) {
    const key = sceneKey(node, row), parts = [el('h3', { text: `${node.label} › ${rowLabel(node, row, state.row)}` }), fields(Object.entries(row).filter(([k]) => !['result_set', 'row_state'].includes(k)))];
    const item = key && state.deck?.navigation?.items.find(i => i.id === key);
    if (key) parts.push(el('p', { class: 'note', text: hasComponent(key) ? `Drawn on the circuit as ${key}.`
      : item ? `${key} is a ${item.kind} of this circuit; its detail opens in the Live Circuit.` : `Declared scene key ${key} is not part of this scenario’s circuit.` }));
    if (key && (item || hasComponent(key))) parts.push(el('a', { href: `${liveHref()}&detail=${encodeURIComponent(key)}`, text: 'Open this component in the Live Circuit' }));
    return host.replaceChildren(...parts);
  }
  if (state.component) {
    const item = state.deck?.navigation?.items.find(i => i.id === state.component);
    return host.replaceChildren(el('h3', { text: 'Circuit component' }), fields([['Component', state.component], ['Kind', item?.kind], ['Label', item?.label]]),
      el('p', { class: 'note', text: 'No Explorer section declares a scene key for this component, so no section is selected.' }),
      el('a', { href: `${liveHref()}&detail=${encodeURIComponent(state.component)}`, text: 'Open this component in the Live Circuit' }));
  }
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
  if (state.deck) parts.push(el('span', { text: `Circuit: database scene · no live overlay here` }));
  else if (state.sceneError) parts.push(el('span', { class: 'error', text: `Circuit: ${state.sceneError}` }));
  $('status').replaceChildren(...(parts.length ? parts : [el('span', { text: 'Ready to read a capability.' })]));
}
function closeDrawers() { for (const id of ['tree', 'context']) $(id).classList.remove('open'); }

// Identity, catalog and controls.
async function identity() {
  const s = (await session()).body, node = $('identity');
  if (s?.authenticated) {
    const out = el('button', { type: 'button', class: 'button secondary small', text: 'Sign out' });
    out.addEventListener('click', async () => { out.disabled = true; await signOut(); location.reload(); });
    node.replaceChildren(el('span', { class: 'who', text: `Signed in as ${s.identifier ?? 'principal ' + s.principalId.slice(0, 8)}` }), out);
  } else node.replaceChildren(el('a', { class: 'button secondary small', href: `/circuit/login?return=${encodeURIComponent(location.pathname + location.search)}`, text: 'Sign in' }));
}
$('picker').addEventListener('submit', event => {
  event.preventDefault();
  const id = $('capability').value.trim(), item = state.catalog.find(c => c.capabilityId === id);
  if (!id) return;
  Object.assign(state, { capability: id, namespace: item?.namespaceId ?? '', scenario: '', node: '', row: null, component: null });
  syncUrl(true); open();
});
$('scenario').addEventListener('change', event => changeScenario(event.target.value));
$('page').addEventListener('change', event => { state.slideId = event.target.value; renderCanvas(); });
$('refresh').addEventListener('click', () => open(true));
$('expand').addEventListener('click', () => {
  const expanded = $('workspace').classList.toggle('expanded');
  $('expand').textContent = expanded ? 'Show workspace' : 'Expand circuit';
});
for (const [button, panel] of [['toggle-tree', 'tree'], ['toggle-context', 'context']])
  $(button).addEventListener('click', () => $(panel).classList.toggle('open'));
window.addEventListener('popstate', () => {
  const p = new URLSearchParams(location.search), capability = p.get('capability') ?? '', previous = { ...state };
  Object.assign(state, { capability, namespace: p.get('namespace') ?? '', scenario: p.get('scenario') ?? '', node: p.get('node') ?? '',
    row: p.has('row') ? Number(p.get('row')) : null, component: null });
  if (capability !== previous.capability) open();
  else if (state.scenario !== previous.scenario) { render(); readScene(); }
  else render();
});

const [catalog, host, health] = await Promise.all([json('/api/circuit/v1/capabilities'), json('/api/circuit/v1/home'), release(), identity()]);
state.health = health;
if (catalog.ok) {
  state.catalog = catalog.body.capabilities ?? [];
  $('capabilities').replaceChildren(...state.catalog.map(c => new Option(c.namespaceId, c.capabilityId)));
}
if (host.ok && host.body?.environment) { $('env').textContent = host.body.environment; $('env').hidden = false; }
if (!state.capability && host.ok && host.body?.hero?.capabilityId)
  Object.assign(state, { capability: host.body.hero.capabilityId, namespace: host.body.hero.namespaceId ?? '' });
$('capability').value = state.capability;
syncUrl(false);
open();
