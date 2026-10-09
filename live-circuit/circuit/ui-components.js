// Declarative page component adapters (ui-component.v1) for the Live Circuit
// shell. Every adapter renders declared data as elements and text: text roles
// reach the DOM through textContent, and every URL passes through
// context.safeUrl before it is written to an href. Declarations never supply
// markup, style or handler text that the shell evaluates.

const SCENE_PENDING = 'Reading the circuit from the database…';
const SCENE_EMPTY = 'The scene returned no circuit page.';
const DIGEST_FAILURE = 'The circuit failed its digest check and is not shown.';
const TEXT_ROLES = new Set(['eyebrow', 'display', 'lede', 'micro', 'section-title', 'paragraph', 'note']);
const NOTICE_TONES = new Set(['info', 'warning', 'error', 'empty']);

// The only DOM construction primitive. Attributes that would introduce
// script or styling are dropped; text is always a text node.
function h(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (name === 'text') { node.textContent = String(value); continue; }
    if (name === 'class') { node.className = String(value); continue; }
    if (name === 'id') { node.id = String(value); continue; }
    if (name === 'dataset') { for (const [key, item] of Object.entries(value)) node.dataset[key] = String(item); continue; }
    if (name.startsWith('on')) continue;
    node.setAttribute(name, value === true ? '' : String(value));
  }
  for (const child of [children].flat(3)) if (child !== undefined && child !== null && child !== false) node.append(child);
  return node;
}

function formatTime(value) {
  if (value === undefined || value === null || value === '') return 'not reported';
  const at = new Date(value);
  return Number.isNaN(at.getTime()) ? 'not reported' : at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function displayValue(value) {
  if (value === undefined || value === null || value === '') return '–';
  if (Array.isArray(value)) return value.length.toLocaleString('en-US');
  if (typeof value === 'number') return value.toLocaleString('en-US');
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
      const at = new Date(value);
      if (!Number.isNaN(at.getTime())) return `${at.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
    }
    return value;
  }
  if (typeof value === 'object') return String(value.release ?? value.identifier ?? '');
  return String(value);
}

function safeHref(context, value) {
  if (typeof value !== 'string' || value.length === 0) return null;
  if (typeof context?.safeUrl === 'function') {
    const admitted = context.safeUrl(value);
    return typeof admitted === 'string' && admitted.length > 0 ? admitted : null;
  }
  return /^(?:\/(?!\/)|#)/.test(value) ? value : null;
}

// A declared URL only becomes an anchor when the context admits it; otherwise
// the label stays visible as plain text.
function linked(context, attrs, textValue) {
  const safe = safeHref(context, attrs?.href);
  if (safe) return h('a', { ...attrs, href: safe, text: textValue });
  return h('span', { id: attrs?.id, class: attrs?.class, 'data-href-refused': attrs?.href ? 'true' : null, text: textValue });
}

function setHref(node, context, value) {
  if (!node || node.tagName !== 'A') return;
  const safe = safeHref(context, value);
  if (safe) node.setAttribute('href', safe); else node.removeAttribute('href');
}

function bindingValue(context, entry, name) {
  if (!name) return undefined;
  const binding = entry?.bindings?.[name];
  try {
    if (binding !== undefined && typeof context?.resolve === 'function') return context.resolve(binding);
    return context?.sources?.[name];
  } catch {
    return undefined;
  }
}

// A component role resolves from its declared prop, else from its declared
// binding; a missing value stays undefined so the adapter renders a state.
function declared(context, entry, role) {
  if (!entry) return undefined;
  if (entry.props != null && Object.prototype.hasOwnProperty.call(entry.props, role)) return entry.props[role];
  if (entry.bindings != null && Object.prototype.hasOwnProperty.call(entry.bindings, role)) return bindingValue(context, entry, role);
  return undefined;
}

function declaredText(context, entry, role) {
  const value = declared(context, entry, role);
  if (value === undefined || value === null) return '';
  return typeof value === 'string' ? value : String(value);
}

function actionFor(entry, actionId) {
  return (entry?.actions ?? []).find(action => action?.actionId === actionId) ?? null;
}

function actionControl(context, entry, actionId, attrs, label) {
  const action = actionId ? actionFor(entry, actionId) : null;
  if (action?.kind === 'navigate' && typeof action.to === 'string') {
    const link = linked(context, { ...attrs, href: action.to }, label);
    if (link.tagName === 'A') return link;
  }
  const control = h('button', { ...attrs, type: 'button', text: label });
  control.addEventListener('click', () => {
    if (actionId && typeof context?.dispatch === 'function') context.dispatch(actionId, {});
  });
  return control;
}

function circuitHref(capabilityId, namespaceId, scenarioId, page) {
  const query = new URLSearchParams({ capability: capabilityId ?? '', namespace: namespaceId ?? '' });
  if (scenarioId) query.set('scenario', scenarioId);
  if (page) query.set('page', page);
  return `/circuit/explorer?${query.toString()}`;
}

async function sha256(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

// An external-provider digest reference: a `sha256:` string or an object that
// carries the digest. The shell records it as declared reference data; it never
// fetches or proxies the provider's bytes.
function digestReference(value) {
  if (typeof value === 'string' && value) return value.replace(/^sha256:/, '');
  if (value !== null && typeof value === 'object') {
    const nested = value.digest ?? value.value ?? value.hex;
    return typeof nested === 'string' && nested ? nested.replace(/^sha256:/, '') : null;
  }
  return null;
}

function figureIds(entry) {
  const base = entry?.sectionId ?? 'figure';
  return {
    eyebrow: `${base}-eyebrow`, headline: `${base}-headline`, lede: `${base}-lede`, actions: `${base}-actions`,
    figure: `${base}-figure`, label: `${base}-label`, caption: `${base}-caption`, link: `${base}-link`,
  };
}

function previewSelection(entry) {
  const input = entry?.bindings?.figure?.input ?? {};
  return { capabilityId: input.capabilityId ?? 'capability', namespaceId: input.namespaceId ?? '', page: input.page };
}

function previewSlide(value, page) {
  if (!value || typeof value !== 'object') return null;
  if (Array.isArray(value.slides)) return { scene: value, slide: value.slides.find(item => item?.id === page) ?? value.slides[0] ?? null };
  if (typeof value.svg === 'string') return { scene: null, slide: value };
  return null;
}

// site.js circuitPreview semantics: resolve the declared figure binding,
// refuse visibly on a digest mismatch, then show the database scene and link
// back to the Explorer selection.
// Resolves once a digest-verified figure is placed or its refusal is shown.
function mountPreview(nodes, entry, context) {
  const state = nodes.figure?.querySelector?.('.state') ?? null;
  const binding = entry?.bindings?.figure;
  const raw = binding != null ? bindingValue(context, entry, 'figure') : undefined;
  const found = previewSlide(raw, binding?.input?.page);
  if (!found) {
    if (raw !== undefined && raw !== null && state) state.textContent = SCENE_EMPTY;
    return;
  }
  const { scene, slide } = found;
  const selection = previewSelection(entry);
  if (!slide?.svg) {
    if (state) state.textContent = SCENE_EMPTY;
    setHref(nodes.link, context, circuitHref(selection.capabilityId, selection.namespaceId));
    return;
  }
  const expected = typeof slide.svgDigest === 'string' ? slide.svgDigest : null;
  const verify = expected ? sha256(slide.svg).then(digest => { if (digest !== expected) throw new Error(DIGEST_FAILURE); }) : Promise.resolve();
  return verify.then(() => {
    const image = document.createElement('img');
    image.alt = `${selection.capabilityId} scenario circuit, read from the database`;
    image.src = URL.createObjectURL(new Blob([slide.svg], { type: 'image/svg+xml' }));
    nodes.figure.replaceChildren(image);
    if (nodes.caption) {
      nodes.caption.textContent = selection.capabilityId;
      nodes.caption.title = `snapshot ${scene?.snapshotDigest ?? '(not reported)'}`;
    }
    setHref(nodes.link, context, circuitHref(selection.capabilityId, selection.namespaceId, scene?.scenarioId, slide.id));
  }).catch(error => {
    if (state) state.textContent = error.message;
    if (nodes.caption) nodes.caption.textContent = selection.capabilityId;
    setHref(nodes.link, context, circuitHref(selection.capabilityId, selection.namespaceId));
  });
}

function figureNodes(context, ids) {
  const label = h('p', { class: 'panel-label', id: ids.label, text: 'Circuit' });
  const figure = h('div', { class: 'circuit-figure', id: ids.figure }, [
    h('div', { class: 'state', text: SCENE_PENDING }),
  ]);
  const caption = h('span', { id: ids.caption });
  const link = linked(context, { id: ids.link, href: '/circuit/explorer' }, 'Open this circuit');
  const card = h('article', { class: 'circuit-card', 'aria-label': 'Database circuit' }, [
    h('header', {}, [label, h('span', { class: 'source', text: 'DATABASE SCENE' })]),
    figure,
    h('footer', {}, [caption, link]),
  ]);
  return { card, figure, caption, link, label };
}

function renderHero(container, entry, context) {
  const ids = figureIds(entry);
  const section = h('section', { class: 'hero art art-architecture', 'aria-labelledby': ids.headline });
  const grid = h('div', { class: 'wrap hero-grid' });
  const copy = h('div', {});
  const eyebrow = declared(context, entry, 'eyebrow');
  if (eyebrow !== undefined && eyebrow !== null && eyebrow !== '') copy.append(h('p', { class: 'eyebrow', id: ids.eyebrow, text: displayValue(eyebrow) }));
  copy.append(h('h1', { class: 'display', id: ids.headline, text: declaredText(context, entry, 'headline') }));
  const lede = declared(context, entry, 'lede');
  if (lede !== undefined && lede !== null && lede !== '') copy.append(h('p', { class: 'lede', id: ids.lede, text: displayValue(lede) }));
  const primaryActionId = declared(context, entry, 'primaryActionId');
  if (typeof primaryActionId === 'string' && primaryActionId) {
    copy.append(h('div', { class: 'actions', id: ids.actions }, [
      actionControl(context, entry, primaryActionId, { class: 'button primary' }, 'Open the Live Circuit'),
    ]));
  }
  grid.append(copy);
  const nodes = figureNodes(context, ids);
  grid.append(nodes.card);
  section.append(grid);
  container.append(section);
  if (entry?.bindings?.figure != null) return mountPreview(nodes, entry, context);
}

function appendSectionBody(container, body, context) {
  if (body === undefined || body === null || body === '') return;
  if (typeof body === 'string' || typeof body === 'number') { container.append(h('p', { class: 'note', text: String(body) })); return; }
  if (!Array.isArray(body)) return;
  for (const item of body) {
    if (item?.component?.kind) renderEntry(container, item, context);
    else if (typeof item === 'string') container.append(h('p', { class: 'note', text: item }));
  }
}

function renderSection(container, entry, context) {
  const section = h('section', { class: 'page-section' });
  const wrap = h('div', { class: 'wrap' });
  const heading = declared(context, entry, 'heading');
  if (heading !== undefined && heading !== null && heading !== '') wrap.append(h('h2', { class: 'section-title', text: declaredText(context, entry, 'heading') }));
  appendSectionBody(wrap, declared(context, entry, 'body'), context);
  const actions = declared(context, entry, 'actions');
  if (Array.isArray(actions) && actions.length) {
    const bar = h('div', { class: 'actions' });
    for (const ref of actions) {
      const actionId = typeof ref === 'string' ? ref : ref?.actionId;
      if (typeof actionId !== 'string' || !actionId || !actionFor(entry, actionId)) continue;
      bar.append(actionControl(context, entry, actionId, { class: 'button secondary' }, typeof ref === 'object' && ref?.label ? String(ref.label) : 'Continue'));
    }
    if (bar.hasChildNodes()) wrap.append(bar);
  }
  if (wrap.hasChildNodes()) section.append(wrap);
  container.append(section);
}

function renderText(container, entry, context) {
  const props = entry?.props ?? {};
  const role = typeof props.role === 'string' && TEXT_ROLES.has(props.role) ? props.role : 'note';
  container.append(h('p', { id: props.id, class: role, text: declaredText(context, entry, 'text') }));
}

function renderHeading(container, entry, context) {
  const props = entry?.props ?? {};
  const level = Math.min(6, Math.max(1, Number(props.level) || 2));
  const node = h(`h${level}`, { id: props.id, class: 'section-title', text: declaredText(context, entry, 'text') });
  const chips = declared(context, entry, 'chips');
  for (const chip of Array.isArray(chips) ? chips : []) node.append(' ', h('span', { class: 'chip', text: typeof chip === 'string' ? chip : chip?.text }));
  const badges = declared(context, entry, 'badges');
  for (const badge of Array.isArray(badges) ? badges : []) node.append(' ', h('span', { class: `badge ${badge?.kind ?? ''}`, text: typeof badge === 'string' ? badge : badge?.text }));
  container.append(node);
}

function catalogCapabilities(value) {
  if (Array.isArray(value)) return value;
  return Array.isArray(value?.capabilities) ? value.capabilities : null;
}

function renderStat(container, entry, context) {
  const props = entry?.props ?? {};
  const panel = h('div', { class: 'counts panel', id: props.id ?? entry?.sectionId, 'aria-label': 'Live estate count' });
  const count = h('div', { class: 'count' }, [
    h('div', { class: 'value', text: displayValue(declared(context, entry, 'value')) }),
    h('div', { class: 'label', text: declaredText(context, entry, 'label') }),
  ]);
  const sub = declared(context, entry, 'sub');
  if (sub !== undefined && sub !== null && sub !== '') count.append(h('div', { class: 'sub', text: displayValue(sub) }));
  panel.append(count);
  container.append(panel);
}

function cardIdentity(item) {
  if (typeof item?.capabilityId === 'string' && item.capabilityId) return { namespaceId: item.namespaceId ?? null, capabilityId: item.capabilityId };
  if (typeof item?.meta === 'string' && item.meta.includes('/')) {
    const [namespaceId, capabilityId] = item.meta.split('/');
    if (namespaceId && capabilityId) return { namespaceId, capabilityId };
  }
  return null;
}

function catalogMatch(catalogValue, item) {
  const capabilities = catalogCapabilities(catalogValue);
  const identity = cardIdentity(item);
  if (!capabilities || !identity) return { known: false, match: null };
  const match = capabilities.find(capability => capability?.capabilityId === identity.capabilityId
    && (identity.namespaceId == null || capability?.namespaceId === identity.namespaceId)) ?? null;
  return { known: true, match };
}

// The catalog for a card list: the declared `catalog` value, else the body of
// the declared source named by `catalogSourceId` in the runtime context. Both
// declaration paths resolve to the same capability list.
function catalogValue(context, entry) {
  const direct = declared(context, entry, 'catalog');
  if (direct !== undefined) return direct;
  const sourceId = declared(context, entry, 'catalogSourceId');
  if (typeof sourceId !== 'string' || !sourceId) return undefined;
  const record = context?.sources?.[sourceId];
  return record?.ok ? record.body : undefined;
}

function cardNode(context, entry, item) {
  const { known, match } = catalogMatch(catalogValue(context, entry), item);
  const missing = Boolean(known && !match);
  const card = h('article', { class: `card panel${missing ? ' missing' : ''}`, id: item?.id });
  card.append(h('h3', { text: item?.title ?? '' }));
  if (item?.body) card.append(h('p', { class: 'body', text: item.body }));
  if (item?.promise) card.append(h('p', { class: 'promise', text: item.promise }));
  const meta = h('div', { class: 'meta' });
  const metaText = missing ? item?.missing ?? 'Not in the current estate' : item?.meta ?? cardIdentity(item)?.capabilityId ?? '';
  if (metaText !== '') meta.append(h('span', { text: metaText }));
  if (typeof item?.link === 'string' && item.link) {
    const action = actionFor(entry, item.link);
    if (action) meta.append(actionControl(context, entry, item.link, { class: 'button secondary small' }, item.linkLabel ?? 'Open circuit'));
    else {
      const safe = safeHref(context, item.link);
      if (safe) meta.append(h('a', { href: safe, text: item.linkLabel ?? 'Open circuit' }));
    }
  }
  card.append(meta);
  return card;
}

function renderCard(container, entry, context) {
  const item = {};
  for (const role of ['title', 'body', 'promise', 'meta', 'link', 'missing']) item[role] = declared(context, entry, role);
  container.append(cardNode(context, entry, item));
}

function renderCardList(container, entry, context) {
  const props = entry?.props ?? {};
  const title = declared(context, entry, 'title');
  if (title !== undefined && title !== null && title !== '') {
    container.append(h('div', { class: 'cards-head' }, [h('h2', { class: 'section-title', text: declaredText(context, entry, 'title') })]));
  }
  const cards = h('div', { class: 'cards', id: props.id ?? entry?.sectionId });
  const items = declared(context, entry, 'cards');
  for (const item of Array.isArray(items) ? items : []) cards.append(cardNode(context, entry, item));
  container.append(cards);
}

function renderList(container, entry, context) {
  const props = entry?.props ?? {};
  const raw = declared(context, entry, 'items');
  const items = Array.isArray(raw) ? raw : Array.isArray(raw?.runs) ? raw.runs : [];
  const current = declared(context, entry, 'current');
  if (current !== undefined && current !== null && current !== '') container.append(h('p', { class: 'panel-label', text: declaredText(context, entry, 'current') }));
  const list = h('ul', { class: 'runs', id: props.id ?? entry?.sectionId });
  for (const run of items) {
    const name = h('strong');
    if (run?.capabilityId) name.append(linked(context, { href: circuitHref(run.capabilityId, run.namespaceId ?? 'sidefx:capabilities') }, run.capabilityId));
    else if (typeof run?.href === 'string' && run.href) name.append(linked(context, { href: run.href }, run.label ?? run.title ?? run.href));
    else name.textContent = `run ${String(run?.runId ?? '').slice(0, 8)}`;
    list.append(h('li', {}, [name, h('span', { text: run?.meta ?? `admitted ${formatTime(run?.admittedAt)}` })]));
  }
  container.append(list);
  const empty = declared(context, entry, 'empty');
  if (!items.length && empty !== undefined && empty !== null && empty !== '') container.append(h('p', { class: 'note', text: declaredText(context, entry, 'empty') }));
}

function renderMediaFigure(container, entry, context) {
  const props = entry?.props ?? {};
  const ids = figureIds(entry);
  const alt = declared(context, entry, 'alt');
  const caption = declared(context, entry, 'caption');
  const link = declared(context, entry, 'link');
  const digest = declared(context, entry, 'digest');
  const svg = declared(context, entry, 'svg');
  const src = declared(context, entry, 'src');
  const figure = h('figure', { class: 'circuit-card', id: props.id, 'aria-label': 'Declared media figure' });
  const media = h('div', { class: 'circuit-figure', id: ids.figure }, [h('div', { class: 'state', text: SCENE_PENDING })]);
  const state = media.querySelector?.('.state') ?? null;
  const captionNode = h('figcaption', { class: 'source', id: ids.caption, text: caption === undefined || caption === null ? '' : String(caption) });
  figure.append(media, captionNode);
  if (typeof link === 'string' && link) {
    const action = actionFor(entry, link);
    if (action) captionNode.append(' ', actionControl(context, entry, link, { class: 'button secondary small' }, 'Open'));
    else {
      const safe = safeHref(context, link);
      if (safe) captionNode.append(' ', h('a', { href: safe, text: 'Open' }));
    }
  }
  container.append(figure);
  const image = document.createElement('img');
  image.alt = alt === undefined || alt === null || alt === '' ? 'Declared media figure' : String(alt);
  if (typeof src === 'string' && src) {
    const safe = safeHref(context, src);
    if (safe) {
      const reference = digestReference(digest);
      if (reference) image.setAttribute('data-digest', reference);
      image.src = safe;
      media.replaceChildren(image);
    } else if (state) state.textContent = 'The declared source is not an admitted URL.';
    return;
  }
  if (typeof svg === 'string' && svg) {
    const expected = digestReference(digest);
    const verify = expected ? sha256(svg).then(hash => { if (hash !== expected) throw new Error(DIGEST_FAILURE); }) : Promise.resolve();
    // Resolves once the digest-verified figure is placed or its refusal is shown.
    return verify.then(() => {
      image.src = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
      media.replaceChildren(image);
    }).catch(error => { if (state) state.textContent = error.message; });
  }
  if (state) state.textContent = SCENE_EMPTY;
}

function renderNotice(container, entry, context) {
  const props = entry?.props ?? {};
  const tone = typeof props.tone === 'string' && NOTICE_TONES.has(props.tone) ? props.tone : 'info';
  const state = declared(context, entry, 'state');
  const node = h('div', {
    class: `notice panel ${tone}`,
    id: props.id ?? entry?.sectionId,
    role: tone === 'error' ? 'alert' : null,
    'data-state': state === undefined || state === null || state === '' ? null : String(state),
  });
  const title = declaredText(context, entry, 'title');
  if (title) node.append(h('strong', { class: 'notice-title', text: title }));
  const body = declaredText(context, entry, 'body');
  if (body) node.append(h('p', { class: 'notice-body', text: body }));
  const actionId = declared(context, entry, 'actionId') ?? declared(context, entry, 'action');
  if (typeof actionId === 'string' && actionId) {
    const action = actionFor(entry, actionId);
    if (action) node.append(' ', actionControl(context, entry, actionId, { class: 'button secondary small' }, 'Continue'));
    else node.append(' ', h('span', { text: actionId }));
  }
  container.append(node);
}

// A declared column is { key, label } or a plain string; the key addresses the
// row object and the label is the visible header text.
function tableColumns(value) {
  return (Array.isArray(value) ? value : []).map(column => typeof column === 'string'
    ? { key: column, label: column }
    : { key: column?.key ?? column?.name ?? column?.id ?? '', label: column?.label ?? column?.key ?? column?.name ?? '' });
}

// A cell value is rendered as text; a { label, state } object is a declared
// status chip and carries its state on data-state exactly as declared.
function tableCell(value) {
  if (value !== null && typeof value === 'object' && !Array.isArray(value) && ('label' in value || 'state' in value)) {
    const state = value.state;
    return h('span', { class: 'status-chip', 'data-state': state === undefined || state === null || state === '' ? null : String(state),
      text: displayValue(value.label ?? state) });
  }
  return displayValue(value);
}

function renderTable(container, entry, context) {
  const props = entry?.props ?? {};
  const columns = tableColumns(declared(context, entry, 'columns'));
  const rowsValue = declared(context, entry, 'rows');
  const rows = Array.isArray(rowsValue) ? rowsValue : Array.isArray(rowsValue?.rows) ? rowsValue.rows : [];
  const caption = declared(context, entry, 'caption');
  const table = h('table', { class: 'declared-table', id: props.id ?? entry?.sectionId });
  if (caption !== undefined && caption !== null && caption !== '') table.append(h('caption', { text: displayValue(caption) }));
  if (columns.length) {
    const headRow = h('tr', {});
    for (const column of columns) headRow.append(h('th', { scope: 'col', text: displayValue(column.label) }));
    table.append(h('thead', {}, [headRow]));
  }
  const body = h('tbody', {});
  for (const row of rows) {
    const bodyRow = h('tr', {});
    for (const column of columns) bodyRow.append(h('td', {}, [tableCell(row !== null && typeof row === 'object' ? row[column.key] : undefined)]));
    body.append(bodyRow);
  }
  table.append(body);
  container.append(table);
  if (!rows.length) container.append(h('p', { class: 'note', text: declaredText(context, entry, 'empty') || 'No rows are declared.' }));
}

// Declared fields are an array of { label, value } or a flat object.
function fieldEntries(value) {
  if (Array.isArray(value)) return value.filter(field => field !== null && typeof field === 'object' && !Array.isArray(field))
    .map(field => ({ label: field.label ?? field.name ?? field.key ?? '', value: field.value ?? field.text ?? field.body }));
  if (value !== null && typeof value === 'object') return Object.entries(value).map(([label, item]) => ({ label, value: item }));
  return [];
}

function renderFieldList(container, entry, context) {
  const props = entry?.props ?? {};
  const label = declared(context, entry, 'label');
  if (label !== undefined && label !== null && label !== '') container.append(h('p', { class: 'panel-label', text: displayValue(label) }));
  const list = h('dl', { class: 'field-list', id: props.id ?? entry?.sectionId });
  for (const field of fieldEntries(declared(context, entry, 'fields'))) {
    list.append(h('dt', { text: displayValue(field.label) }));
    list.append(h('dd', { text: displayValue(field.value) }));
  }
  container.append(list);
}

function renderDisclosure(container, entry, context) {
  const props = entry?.props ?? {};
  const details = h('details', { class: 'disclosure', id: props.id ?? entry?.sectionId });
  details.append(h('summary', { text: declaredText(context, entry, 'summary') }));
  appendSectionBody(details, declared(context, entry, 'body'), context);
  container.append(details);
}

function renderBadge(container, entry, context) {
  const props = entry?.props ?? {};
  const tone = declared(context, entry, 'tone');
  const classes = ['badge', typeof tone === 'string' ? tone : ''].filter(Boolean).join(' ');
  container.append(h('span', { class: classes, id: props.id ?? entry?.sectionId, text: declaredText(context, entry, 'label') }));
}

function renderStatusChip(container, entry, context) {
  const props = entry?.props ?? {};
  const state = declared(context, entry, 'state');
  container.append(h('span', { class: 'status-chip', id: props.id ?? entry?.sectionId,
    'data-state': state === undefined || state === null || state === '' ? null : String(state),
    text: declaredText(context, entry, 'label') }));
}

// A tab is a declared { id, label, badges?, panelId?, href? }. The declared
// selection carries aria-selected; a tab links to an admitted href or its panel
// and otherwise stays a labelled control.
function tabNode(context, tab, selectedId) {
  const id = tab?.id === undefined || tab?.id === null ? '' : String(tab.id);
  const active = selectedId !== '' && id === selectedId;
  const attrs = { class: active ? 'tab selected' : 'tab', role: 'tab',
    'aria-selected': active ? 'true' : 'false', tabindex: active ? '0' : '-1' };
  if (tab?.panelId !== undefined && tab?.panelId !== null && tab.panelId !== '') attrs['aria-controls'] = String(tab.panelId);
  const label = String(tab?.label ?? tab?.text ?? id);
  const declaredHref = typeof tab?.href === 'string' && tab.href ? tab.href : tab?.panelId ? `#${tab.panelId}` : null;
  const safe = declaredHref ? safeHref(context, declaredHref) : null;
  let node;
  if (safe) node = h('a', { ...attrs, href: safe, text: label });
  else if (declaredHref) node = h('span', { ...attrs, 'data-href-refused': 'true', text: label });
  else node = h('button', { ...attrs, type: 'button', text: label });
  for (const badge of Array.isArray(tab?.badges) ? tab.badges : []) {
    if (badge === null || badge === undefined) continue;
    node.append(' ', h('span', { class: `badge ${typeof badge === 'object' && badge?.kind ? badge.kind : ''}`.trim(),
      text: typeof badge === 'string' ? badge : badge?.text }));
  }
  return node;
}

function renderTabs(container, entry, context) {
  const props = entry?.props ?? {};
  const tabsValue = declared(context, entry, 'tabs');
  const tabs = Array.isArray(tabsValue) ? tabsValue : Array.isArray(tabsValue?.tabs) ? tabsValue.tabs : [];
  const selected = declared(context, entry, 'selected');
  const list = h('div', { class: 'tabs', id: props.id ?? entry?.sectionId, role: 'tablist' });
  for (const tab of tabs) if (tab !== null && typeof tab === 'object') list.append(tabNode(context, tab, selected === undefined || selected === null ? '' : String(selected)));
  container.append(list);
}

// A span is a declared { label, kind?, from?, to?, nodeId? }; duration,
// playhead and seek stay declared data on the wrapper and the seek control.
function timelineSpanNode(span) {
  const meta = [span?.from, span?.to].filter(value => value !== undefined && value !== null && value !== '').join('–');
  const node = h('li', { class: `timeline-span${span?.kind ? ` ${span.kind}` : ''}`,
    'data-kind': span?.kind == null || span.kind === '' ? null : String(span.kind),
    'data-from': span?.from == null || span.from === '' ? null : String(span.from),
    'data-to': span?.to == null || span.to === '' ? null : String(span.to),
    'data-node-id': span?.nodeId == null || span.nodeId === '' ? null : String(span.nodeId),
    text: String(span?.label ?? '') });
  if (meta) node.append(' ', h('span', { class: 'timeline-meta', text: meta }));
  return node;
}

function renderTimeline(container, entry, context) {
  const props = entry?.props ?? {};
  const duration = declared(context, entry, 'duration');
  const playhead = declared(context, entry, 'playhead');
  const seek = declared(context, entry, 'seek');
  const spans = declared(context, entry, 'spans');
  const wrap = h('div', { class: 'timeline-wrap', id: props.id ?? entry?.sectionId });
  if (duration !== undefined && duration !== null && duration !== '') {
    wrap.append(h('p', { class: 'panel-label timeline-duration', text: `duration ${displayValue(duration)}` }));
  }
  const list = h('ol', { class: 'timeline' });
  for (const span of Array.isArray(spans) ? spans : []) if (span !== null && typeof span === 'object') list.append(timelineSpanNode(span));
  wrap.append(list);
  const seekRecord = seek !== null && typeof seek === 'object' && !Array.isArray(seek) ? seek : null;
  const range = h('input', { type: 'range', class: 'timeline-seek',
    'data-duration': duration == null || duration === '' ? null : String(duration),
    'data-playhead': playhead == null || playhead === '' ? null : String(playhead) });
  const max = seekRecord?.max ?? duration;
  if (seekRecord?.min !== undefined && seekRecord.min !== null && seekRecord.min !== '') range.setAttribute('min', String(seekRecord.min));
  if (max !== undefined && max !== null && max !== '') range.setAttribute('max', String(max));
  const value = seekRecord ? seekRecord.value : seek;
  if (value !== undefined && value !== null && value !== '') range.setAttribute('value', String(value));
  wrap.append(range);
  container.append(wrap);
}

const FORM_FIELD_KINDS = new Set(['text', 'email', 'password', 'number', 'url', 'tel', 'search', 'date', 'textarea', 'select', 'checkbox']);

// Declared fields are an array of { name, label, kind, required, value, hint,
// options } or an object of the same keyed by name.
function formFieldEntries(value) {
  if (Array.isArray(value)) return value.filter(field => field !== null && typeof field === 'object' && !Array.isArray(field));
  if (value !== null && typeof value === 'object') return Object.entries(value).map(([name, field]) => field !== null && typeof field === 'object' && !Array.isArray(field)
    ? { name, ...field } : { name, label: name, value: field });
  return [];
}

function formFieldValue(field, values) {
  if (values !== null && typeof values === 'object' && !Array.isArray(values) && Object.prototype.hasOwnProperty.call(values, field.name)) return values[field.name];
  return field.value ?? field.default;
}

function formFieldNode(field, values, prefix) {
  const name = String(field.name ?? field.key ?? '');
  const kind = FORM_FIELD_KINDS.has(field.kind) ? field.kind : 'text';
  const id = String(field.id ?? `${prefix}-${name}`);
  const value = formFieldValue(field, values);
  const hint = field.hint ?? field.placeholder;
  let control;
  if (kind === 'textarea') {
    control = h('textarea', { id, name, required: field.required ? '' : null, placeholder: hint, text: value == null ? '' : String(value) });
  } else if (kind === 'select') {
    control = h('select', { id, name, required: field.required ? '' : null });
    for (const option of Array.isArray(field.options) ? field.options : []) {
      const optionValue = typeof option === 'object' && option !== null ? option.value ?? option.id ?? '' : option;
      const selected = optionValue !== undefined && optionValue !== null && value !== undefined && value !== null && String(optionValue) === String(value);
      control.append(h('option', { value: optionValue === undefined || optionValue === null ? '' : String(optionValue), selected: selected ? '' : null,
        text: typeof option === 'object' && option !== null ? String(option.label ?? option.text ?? optionValue ?? '') : String(option) }));
    }
  } else if (kind === 'checkbox') {
    control = h('input', { type: 'checkbox', id, name, value: value === undefined || value === null ? 'true' : String(value), checked: value ? '' : null });
  } else {
    control = h('input', { type: kind, id, name, required: field.required ? '' : null,
      value: value == null ? null : String(value), placeholder: hint });
  }
  const label = h('label', { class: 'form-field', for: id }, [
    h('span', { class: 'form-field-label', text: String(field.label ?? name) }),
    control,
  ]);
  if (hint !== undefined && hint !== null && hint !== '') label.append(h('span', { class: 'form-hint', text: String(hint) }));
  return label;
}

// The submit role is the form control's label; the declared section event
// (submit) resolves the action, so the adapter adds no dispatch path.
function renderForm(container, entry, context) {
  const props = entry?.props ?? {};
  const fields = formFieldEntries(declared(context, entry, 'fields'));
  const values = declared(context, entry, 'values');
  const submit = declared(context, entry, 'submit');
  const submitLabel = typeof submit === 'string' ? submit : submit !== null && typeof submit === 'object' ? submit.label ?? 'Submit' : 'Submit';
  const form = h('form', { class: 'declared-form', id: props.id ?? entry?.sectionId });
  for (const field of fields) form.append(formFieldNode(field, values, props.id ?? entry?.sectionId ?? 'form'));
  form.append(h('button', { type: 'submit', class: 'button primary', text: String(submitLabel) }));
  container.append(form);
}

// A gallery item is a declared external-provider media reference: the admitted
// URL renders as the image source and the digest stays attached as a reference.
function galleryItemNode(context, item) {
  const safe = safeHref(context, item?.src ?? item?.url);
  const node = h('figure', { class: 'gallery-entry' });
  if (safe) {
    const reference = digestReference(item?.digest);
    node.append(h('img', { class: 'gallery-item', src: safe, alt: String(item?.alt ?? ''),
      'data-digest': reference, 'data-provider': item?.provider == null || item.provider === '' ? null : String(item.provider) }));
  } else {
    node.append(h('p', { class: 'state', text: item?.src || item?.url ? 'The declared source is not an admitted URL.' : 'No source is declared.' }));
  }
  if (item?.caption !== undefined && item.caption !== null && item.caption !== '') node.append(h('figcaption', { text: String(item.caption) }));
  if (typeof item?.href === 'string' && item.href) node.append(h('p', {}, [linked(context, { href: item.href }, item.linkLabel ?? 'Open')]));
  return node;
}

function renderMediaGallery(container, entry, context) {
  const props = entry?.props ?? {};
  const itemsValue = declared(context, entry, 'items');
  const items = Array.isArray(itemsValue) ? itemsValue : Array.isArray(itemsValue?.items) ? itemsValue.items : [];
  const caption = declared(context, entry, 'caption');
  const figure = h('figure', { class: 'media-gallery', id: props.id ?? entry?.sectionId });
  const grid = h('div', { class: 'gallery-grid' });
  for (const item of items) if (item !== null && typeof item === 'object') grid.append(galleryItemNode(context, item));
  figure.append(grid);
  if (caption !== undefined && caption !== null && caption !== '') figure.append(h('figcaption', { class: 'gallery-caption', text: String(caption) }));
  if (!items.length) figure.append(h('p', { class: 'note', text: declaredText(context, entry, 'empty') || 'No media is declared.' }));
  container.append(figure);
}

function renderCode(container, entry, context) {
  const props = entry?.props ?? {};
  const text = declaredText(context, entry, 'text');
  const language = declared(context, entry, 'language');
  const caption = declared(context, entry, 'caption');
  const figure = h('figure', { class: 'declared-code', id: props.id ?? entry?.sectionId });
  const pre = h('pre', { class: 'code-block', 'data-language': language == null || language === '' ? null : String(language) });
  pre.append(h('code', { class: typeof language === 'string' && language ? `language-${language}` : null, text }));
  figure.append(pre);
  if (caption !== undefined && caption !== null && caption !== '') figure.append(h('figcaption', { text: displayValue(caption) }));
  if (!text) figure.append(h('p', { class: 'note', text: 'No code is declared.' }));
  container.append(figure);
}

function chartPoints(value) {
  if (Array.isArray(value)) return value;
  return Array.isArray(value?.series) ? value.series : [];
}

// A chart point is a declared { label, value, kind? }; maximum is the declared
// scale when present, else the largest declared value.
function renderChart(container, entry, context) {
  const props = entry?.props ?? {};
  const points = chartPoints(declared(context, entry, 'series'));
  const maximum = declared(context, entry, 'maximum');
  const caption = declared(context, entry, 'caption');
  const numbers = points.map(point => Number(point?.value)).filter(value => Number.isFinite(value));
  const declaredMax = Number(maximum);
  const max = Number.isFinite(declaredMax) && declaredMax > 0 ? declaredMax : numbers.length ? Math.max(...numbers, 1) : 1;
  const figure = h('figure', { class: 'declared-chart', id: props.id ?? entry?.sectionId, 'data-maximum': String(max) });
  const list = h('ol', { class: 'chart-series' });
  for (const point of points) {
    if (point === null || typeof point !== 'object') continue;
    const value = Number(point.value);
    list.append(h('li', { class: 'chart-point', 'data-kind': point.kind == null || point.kind === '' ? null : String(point.kind) }, [
      h('span', { class: 'chart-label', text: String(point.label ?? '') }),
      h('meter', { class: 'chart-meter', min: 0, max, value: Number.isFinite(value) ? value : 0 }),
      h('span', { class: 'chart-value', text: displayValue(point.value) }),
    ]));
  }
  figure.append(list);
  if (caption !== undefined && caption !== null && caption !== '') figure.append(h('figcaption', { text: String(caption) }));
  if (!points.length) figure.append(h('p', { class: 'note', text: declaredText(context, entry, 'empty') || 'No chart series is declared.' }));
  container.append(figure);
}

// Nested declared entries render through the same registry, so a section can
// group a list or copy without a second renderer.
function renderEntry(container, entry, context) {
  const kind = entry?.component?.kind;
  const adapter = UI_COMPONENTS[kind];
  if (!adapter) {
    container.append(h('p', { class: 'notice error', 'data-refusal': 'UI_COMPONENT_NOT_SUPPORTED', text: `The deployed shell does not support the declared component kind ${kind ?? '(missing)'}.` }));
    return;
  }
  adapter.render(container, entry, context);
}

// The single exported role table: one place per kind declares its role
// vocabulary. `roles` are the roles the adapter resolves through declared()
// (prop or binding), `props` are the remaining admitted controls, and `states`
// are the states the shell can render. UI_COMPONENTS derives from this table,
// so no adapter can admit a role it does not consume.
export const UI_COMPONENT_ROLES = {
  hero: {
    version: 1,
    roles: ['eyebrow', 'headline', 'lede', 'figure'],
    props: ['primaryActionId'],
    states: ['ready', 'empty', 'error', 'not-supported'],
  },
  section: {
    version: 1,
    roles: ['heading', 'body', 'actions'],
    props: [],
    states: ['ready', 'empty', 'error', 'not-supported'],
  },
  text: {
    version: 1,
    roles: ['eyebrow', 'display', 'lede', 'micro', 'section-title', 'paragraph', 'note', 'text'],
    props: ['role'],
    states: ['ready'],
  },
  heading: {
    version: 1,
    roles: ['text', 'chips', 'badges'],
    props: ['level'],
    states: ['ready'],
  },
  stat: {
    version: 1,
    roles: ['value', 'label', 'sub'],
    props: [],
    states: ['ready', 'empty', 'error', 'not-supported'],
  },
  card: {
    version: 1,
    roles: ['title', 'body', 'promise', 'meta', 'link', 'missing'],
    props: [],
    states: ['ready', 'empty', 'error', 'not-supported'],
  },
  'card-list': {
    version: 1,
    roles: ['cards', 'catalog', 'title', 'catalogSourceId'],
    props: [],
    states: ['ready', 'empty', 'error', 'not-supported'],
  },
  list: {
    version: 1,
    roles: ['items', 'current', 'empty'],
    props: [],
    states: ['ready', 'empty', 'error', 'not-supported'],
  },
  'media.figure': {
    version: 1,
    roles: ['svg', 'src', 'alt', 'caption', 'link', 'digest'],
    props: [],
    states: ['ready', 'empty', 'error', 'not-supported'],
  },
  notice: {
    version: 1,
    roles: ['title', 'body', 'action', 'state', 'actionId'],
    props: ['tone'],
    states: ['info', 'warning', 'error', 'empty'],
  },
  table: {
    version: 1,
    roles: ['columns', 'rows', 'caption', 'empty'],
    props: [],
    states: ['ready', 'empty', 'error', 'not-supported'],
  },
  'field-list': {
    version: 1,
    roles: ['fields', 'label'],
    props: [],
    states: ['ready', 'empty', 'error', 'not-supported'],
  },
  disclosure: {
    version: 1,
    roles: ['summary', 'body'],
    props: [],
    states: ['ready', 'empty', 'error', 'not-supported'],
  },
  badge: {
    version: 1,
    roles: ['label'],
    props: ['tone'],
    states: ['ready'],
  },
  'status-chip': {
    version: 1,
    roles: ['label', 'state'],
    props: [],
    states: ['mapped', 'partial', 'planned', 'unmapped'],
  },
  tabs: {
    version: 1,
    roles: ['tabs', 'selected'],
    props: [],
    states: ['ready', 'empty', 'error', 'not-supported'],
  },
  timeline: {
    version: 1,
    roles: ['spans', 'duration', 'playhead', 'seek'],
    props: [],
    states: ['ready', 'empty', 'error', 'not-supported'],
  },
  form: {
    version: 1,
    roles: ['fields', 'values', 'submit'],
    props: [],
    states: ['ready', 'empty', 'error', 'not-supported'],
  },
  'media.gallery': {
    version: 1,
    roles: ['items', 'caption', 'empty'],
    props: [],
    states: ['ready', 'empty', 'error', 'not-supported'],
  },
  code: {
    version: 1,
    roles: ['text', 'language', 'caption'],
    props: [],
    states: ['ready', 'empty', 'error', 'not-supported'],
  },
  chart: {
    version: 1,
    roles: ['series', 'maximum', 'caption', 'empty'],
    props: [],
    states: ['ready', 'empty', 'error', 'not-supported'],
  },
};

// The admitted role set of a kind is the union of its table entries, in table
// order, de-duplicated: supportedRoles is derived, never hand-kept.
function supportedRolesOf(kind) {
  const entry = UI_COMPONENT_ROLES[kind] ?? {};
  const names = [];
  for (const name of [...(entry.roles ?? []), ...(entry.props ?? [])]) if (!names.includes(name)) names.push(name);
  return names;
}

const UI_COMPONENT_RENDERERS = {
  hero: renderHero,
  section: renderSection,
  text: renderText,
  heading: renderHeading,
  stat: renderStat,
  card: renderCard,
  'card-list': renderCardList,
  list: renderList,
  'media.figure': renderMediaFigure,
  notice: renderNotice,
  table: renderTable,
  'field-list': renderFieldList,
  disclosure: renderDisclosure,
  badge: renderBadge,
  'status-chip': renderStatusChip,
  tabs: renderTabs,
  timeline: renderTimeline,
  form: renderForm,
  'media.gallery': renderMediaGallery,
  code: renderCode,
  chart: renderChart,
};

export const UI_COMPONENTS = Object.fromEntries(Object.keys(UI_COMPONENT_ROLES).map(kind => [kind, {
  version: UI_COMPONENT_ROLES[kind].version,
  supportedRoles: supportedRolesOf(kind),
  render: UI_COMPONENT_RENDERERS[kind],
}]));
