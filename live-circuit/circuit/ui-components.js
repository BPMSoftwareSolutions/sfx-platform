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
  verify.then(() => {
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
  if (entry?.bindings?.figure != null) mountPreview(nodes, entry, context);
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
    if (safe) { image.src = safe; media.replaceChildren(image); }
    else if (state) state.textContent = 'The declared source is not an admitted URL.';
    return;
  }
  if (typeof svg === 'string' && svg) {
    const expected = typeof digest === 'string' ? digest.replace(/^sha256:/, '') : null;
    const verify = expected ? sha256(svg).then(hash => { if (hash !== expected) throw new Error(DIGEST_FAILURE); }) : Promise.resolve();
    verify.then(() => {
      image.src = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
      media.replaceChildren(image);
    }).catch(error => { if (state) state.textContent = error.message; });
    return;
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
};

export const UI_COMPONENTS = Object.fromEntries(Object.keys(UI_COMPONENT_ROLES).map(kind => [kind, {
  version: UI_COMPONENT_ROLES[kind].version,
  supportedRoles: supportedRolesOf(kind),
  render: UI_COMPONENT_RENDERERS[kind],
}]));
