// Declarative page component adapters (ui-component.v1) for the Live Circuit
// shell. Every adapter renders declared data as elements and text: text roles
// reach the DOM through textContent, and every URL passes through
// context.safeUrl before it is written to an href. Declarations never supply
// markup, style or handler text that the shell evaluates.

const SCENE_PENDING = 'Reading the circuit from the database…';
const SCENE_EMPTY = 'The scene returned no circuit page.';
const DIGEST_FAILURE = 'The circuit failed its digest check and is not shown.';
const LANGUAGES = { csharp: 'C#', node: 'Node', python: 'Python' };
const TEXT_ROLES = new Set(['eyebrow', 'display', 'lede', 'micro', 'section-title', 'snapshot', 'note', 'paragraph', 'answer']);
const SUB_ROLES = new Set(['big', 'sub']);
const SECTION_VARIANTS = new Set(['signed-panels']);

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

function idsFor(entry, defaults) {
  return { ...defaults, ...(entry?.props?.ids ?? {}) };
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

function previewSelection(entry, props) {
  const input = entry?.bindings?.[props.binding ?? 'figure']?.input ?? {};
  return {
    capabilityId: props.capabilityId ?? input.capabilityId ?? 'capability',
    namespaceId: props.namespaceId ?? input.namespaceId ?? '',
    page: props.page ?? input.page,
  };
}

function previewSlide(value, props) {
  if (!value || typeof value !== 'object') return null;
  if (Array.isArray(value.slides)) return { scene: value, slide: value.slides.find(item => item?.id === props.page) ?? value.slides[0] ?? null };
  if (typeof value.svg === 'string') return { scene: null, slide: value };
  return null;
}

// site.js circuitPreview semantics: resolve the declared read binding, refuse
// visibly on a digest mismatch, then show the database scene and link back to
// the Explorer selection.
function mountPreview(nodes, entry, context, props) {
  if (nodes.label) nodes.label.textContent = props.label ?? 'Circuit';
  const state = nodes.figure?.querySelector?.('.state') ?? null;
  const raw = bindingValue(context, entry, props.binding ?? 'figure');
  const found = previewSlide(raw, props);
  if (!found) {
    if (raw !== undefined && raw !== null && state) state.textContent = SCENE_EMPTY;
    return;
  }
  const { scene, slide } = found;
  if (!slide?.svg) {
    if (state) state.textContent = SCENE_EMPTY;
    setHref(nodes.link, context, circuitHref(previewSelection(entry, props).capabilityId, previewSelection(entry, props).namespaceId));
    return;
  }
  const expected = typeof slide.svgDigest === 'string' ? slide.svgDigest : null;
  const verify = expected ? sha256(slide.svg).then(digest => { if (digest !== expected) throw new Error(DIGEST_FAILURE); }) : Promise.resolve();
  verify.then(() => {
    const selection = previewSelection(entry, props);
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
    const selection = previewSelection(entry, props);
    if (nodes.caption) nodes.caption.textContent = selection.capabilityId;
    setHref(nodes.link, context, circuitHref(selection.capabilityId, selection.namespaceId));
  });
}

function figureNodes(context, ids, props) {
  const label = h('p', { class: 'panel-label', id: ids.label, text: props.figureLabel ?? 'Circuit' });
  const figure = h('div', { class: 'circuit-figure', id: ids.figure }, [
    h('div', { class: 'state', text: props.pendingText ?? SCENE_PENDING }),
  ]);
  const caption = h('span', { id: ids.caption });
  const link = linked(context, { id: ids.link, href: '/circuit/explorer' }, props.linkLabel ?? 'Open this circuit');
  const card = h('article', { class: 'circuit-card', 'aria-label': 'Database circuit' }, [
    h('header', {}, [label, h('span', { class: 'source', text: 'DATABASE SCENE' })]),
    figure,
    h('footer', {}, [caption, link]),
  ]);
  return { card, figure, caption, link, label };
}

function renderHero(container, entry, context) {
  const props = entry?.props ?? {};
  const ids = idsFor(entry, {
    eyebrow: 'eyebrow', headline: 'headline', lede: 'lede', actions: 'actions',
    signIn: 'sign-in-cta', micro: 'micro', figure: 'circuit-figure',
    label: 'circuit-label', caption: 'circuit-caption', link: 'circuit-link',
  });
  const section = h('section', { class: 'hero art art-architecture', 'aria-labelledby': ids.headline });
  const grid = h('div', { class: 'wrap hero-grid' });
  const copy = h('div', {}, [
    h('p', { class: 'eyebrow', id: ids.eyebrow, text: props.eyebrow }),
    h('h1', { class: 'display', id: ids.headline, text: props.headline }),
    h('p', { class: 'lede', id: ids.lede, text: props.lede }),
  ]);
  const actions = h('div', { class: 'actions', id: ids.actions });
  if (props.primaryActionId) actions.append(actionControl(context, entry, props.primaryActionId, { class: 'button primary' }, props.primaryLabel ?? 'Open the Live Circuit'));
  if (props.secondaryActionId) actions.append(actionControl(context, entry, props.secondaryActionId, { class: 'button secondary', id: ids.signIn }, props.secondaryLabel ?? 'Sign in to observe'));
  copy.append(actions);
  if (props.micro) copy.append(h('p', { class: 'micro', id: ids.micro, text: props.micro }));
  grid.append(copy);
  const nodes = figureNodes(context, ids, props);
  grid.append(nodes.card);
  section.append(grid);
  container.append(section);
  mountPreview(nodes, entry, context, props);
}

function renderSection(container, entry, context) {
  const props = entry?.props ?? {};
  const tag = props.as === 'div' ? 'div' : props.as === 'article' ? 'article' : 'section';
  const classes = [];
  if (props.panel) classes.push('panel');
  if (SECTION_VARIANTS.has(props.variant)) classes.push(props.variant);
  const section = h(tag, { id: props.id, class: classes.join(' ') || null, 'aria-label': props.ariaLabel });
  if (props.label) section.append(h('p', { class: 'panel-label', text: props.label }));
  if (props.title) section.append(h('h2', { class: 'section-title', text: props.title }));
  for (const item of props.items ?? []) {
    if (item?.component?.kind) renderEntry(section, item, context);
    else if (typeof item === 'string') section.append(h('p', { class: 'note', text: item }));
  }
  container.append(section);
}

const TEXT_FORMATS = {
  'session.identifier': value => value?.identifier ?? (value?.principalId ? `principal ${String(value.principalId).slice(0, 8)}` : 'Signed in'),
  'session.detail': value => `${value?.realm ?? 'realm not reported'} / expires ${formatTime(value?.expiresAt)}`,
  'catalog.snapshot': value => value?.readAt
    ? `Estate read ${new Date(value.readAt).toISOString().slice(0, 16).replace('T', ' ')} UTC / counts refresh from the database`
    : 'Counts refresh from the database',
  'runs.head': value => {
    const runs = Array.isArray(value) ? value : Array.isArray(value?.runs) ? value.runs : [];
    return runs.length ? `${runs.length} run${runs.length === 1 ? '' : 's'} in this session` : 'No runs started in this session';
  },
  'runs.sub': value => (Array.isArray(value) || Array.isArray(value?.runs)
    ? 'Held by this host in memory; a restart clears the list.'
    : 'Your observed runs appear here after you start them in the Live Circuit.'),
};

function renderText(container, entry, context) {
  const props = entry?.props ?? {};
  const value = props.binding ? bindingValue(context, entry, props.binding) : undefined;
  const formatter = props.format ? TEXT_FORMATS[props.format] : null;
  const message = formatter ? formatter(value)
    : typeof value === 'string' || typeof value === 'number' ? String(value)
      : props.text ?? '';
  const role = props.as === 'paragraph' || !TEXT_ROLES.has(props.as) ? (SUB_ROLES.has(props.as) ? props.as : 'note') : props.as;
  const node = h('p', { id: props.id, class: role, text: message });
  if (props.link?.href) node.append(' ', linked(context, { href: props.link.href }, props.link.label ?? props.link.href));
  container.append(node);
}

function renderHeading(container, entry, context) {
  const props = entry?.props ?? {};
  const level = Math.min(6, Math.max(1, Number(props.level) || 2));
  const node = h(`h${level}`, { id: props.id, class: props.role === 'section-title' ? 'section-title' : null, text: props.text });
  for (const chip of props.chips ?? []) node.append(' ', h('span', { class: 'chip', text: typeof chip === 'string' ? chip : chip?.text }));
  for (const badge of props.badges ?? []) node.append(' ', h('span', { class: `badge ${badge?.kind ?? ''}`, text: badge?.text }));
  container.append(node);
}

function catalogCapabilities(value) {
  if (Array.isArray(value)) return value;
  return Array.isArray(value?.capabilities) ? value.capabilities : null;
}

function metricResult(metric, value, item) {
  switch (metric) {
    case 'catalog.total': {
      const capabilities = catalogCapabilities(value);
      if (!capabilities) return { value: item.value ?? '–', sub: item.unavailable ?? 'The catalog could not be read' };
      const domain = capabilities.filter(capability => capability?.namespaceId === 'sidefx:capabilities').length;
      return { value: capabilities.length.toLocaleString('en-US'), sub: `${domain} domain / ${capabilities.length - domain} platform` };
    }
    case 'catalog.scenarios': {
      const capabilities = catalogCapabilities(value);
      if (!capabilities) return { value: item.value ?? '–', sub: item.sub };
      const scenarios = capabilities.reduce((total, capability) => total + (Number(capability?.scenarioCount) || 0), 0);
      return { value: scenarios.toLocaleString('en-US'), sub: item.sub };
    }
    case 'catalog.multi': {
      const capabilities = catalogCapabilities(value);
      if (!capabilities) return { value: item.value ?? '–', sub: item.sub };
      return { value: capabilities.filter(capability => (Number(capability?.scenarioCount) || 0) > 1).length.toLocaleString('en-US'), sub: item.sub };
    }
    case 'kernel.language':
      return { value: value ? LANGUAGES[value.kernelLanguage] ?? 'Installed' : item.value ?? '–', sub: item.sub };
    case 'kernel.release':
      return { value: value?.release ? `${String(value.release).split('-').pop()} / sha256 ${String(value.kernelDigest ?? '').split(':').pop().slice(0, 8)}` : item.sub, sub: item.sub };
    default:
      return { value: item.value ?? '–', sub: item.sub };
  }
}

function renderStat(container, entry, context) {
  const props = entry?.props ?? {};
  const panel = h('div', { class: 'counts panel', id: props.id ?? 'counts', 'aria-label': props.ariaLabel ?? 'Live estate counts' });
  for (const item of props.items ?? []) {
    const value = item.binding ? bindingValue(context, entry, item.binding) : undefined;
    const primary = item.metric ? metricResult(item.metric, value, item) : { value: item.value, sub: item.sub };
    const sub = item.subMetric ? metricResult(item.subMetric, value, item).value : primary.sub ?? item.sub;
    const count = h('div', { class: 'count' }, [
      h('div', { class: 'value', id: item.valueId, text: primary.value ?? '–' }),
      h('div', { class: 'label', text: item.label }),
    ]);
    if (item.subId || sub) count.append(h('div', { class: 'sub', id: item.subId, text: sub ?? '' }));
    panel.append(count);
  }
  container.append(panel);
}

function catalogMatch(catalogValue, item) {
  const capabilities = catalogCapabilities(catalogValue);
  if (!capabilities) return { known: false, match: null };
  const match = capabilities.find(capability => capability?.capabilityId === item?.capabilityId
    && (item?.namespaceId == null || capability?.namespaceId === item.namespaceId)) ?? null;
  return { known: true, match };
}

function cardNode(context, item, catalogValue) {
  const { known, match } = catalogMatch(catalogValue, item);
  const card = h('article', { class: `card panel${known && !match ? ' missing' : ''}` });
  card.append(
    h('h3', { text: item.title }),
    h('p', { class: 'body', text: item.body }),
    h('p', { class: 'promise', text: item.promise }),
  );
  const meta = h('div', { class: 'meta' });
  const count = match?.scenarioCount;
  const metaText = match ? `${count ?? 0} scenario${count === 1 ? '' : 's'}`
    : known ? 'Not in the current estate'
      : item.capabilityId ?? item.meta ?? '';
  meta.append(h('span', { text: metaText }));
  if (item.capabilityId) meta.append(linked(context, { href: circuitHref(item.capabilityId, item.namespaceId, match?.declaredRootScenarioId), 'aria-label': `Open the ${item.capabilityId} circuit` }, item.linkLabel ?? 'Open circuit'));
  card.append(meta);
  return card;
}

function renderCard(container, entry, context) {
  const props = entry?.props ?? {};
  const item = props.item ?? props;
  const catalogValue = props.binding ? bindingValue(context, entry, props.binding) : undefined;
  container.append(cardNode(context, item, catalogValue));
}

function renderCardList(container, entry, context) {
  const props = entry?.props ?? {};
  const catalogValue = props.binding ? bindingValue(context, entry, props.binding) : undefined;
  if (props.heading) container.append(h('div', { class: 'cards-head' }, [h('h2', { class: 'section-title', text: props.heading })]));
  const cards = h('div', { class: 'cards', id: props.id });
  for (const item of props.items ?? []) cards.append(cardNode(context, item, catalogValue));
  container.append(cards);
}

function renderList(container, entry, context) {
  const props = entry?.props ?? {};
  const value = props.binding ? bindingValue(context, entry, props.binding) : props.items;
  const runs = Array.isArray(value) ? value : Array.isArray(value?.runs) ? value.runs : null;
  const list = h('ul', { class: 'runs', id: props.id });
  if (runs) {
    const limit = Number(props.limit) > 0 ? Number(props.limit) : null;
    const rows = limit ? runs.slice(-limit).reverse() : runs;
    for (const run of rows) {
      const name = h('strong');
      if (run?.capabilityId) name.append(linked(context, { href: circuitHref(run.capabilityId, run.namespaceId ?? 'sidefx:capabilities') }, run.capabilityId));
      else name.textContent = `run ${String(run?.runId ?? '').slice(0, 8)}`;
      list.append(h('li', {}, [name, h('span', { text: `admitted ${formatTime(run?.admittedAt)}` })]));
    }
  }
  container.append(list);
}

function renderMediaFigure(container, entry, context) {
  const props = entry?.props ?? {};
  const ids = idsFor(entry, { figure: 'circuit-figure', label: 'circuit-label', caption: 'circuit-caption', link: 'circuit-link' });
  const nodes = figureNodes(context, ids, props);
  container.append(nodes.card);
  mountPreview(nodes, entry, context, props);
}

function renderNotice(container, entry, context) {
  const props = entry?.props ?? {};
  const kind = ['info', 'error', 'warning', 'empty'].includes(props.kind) ? props.kind : 'info';
  const refusal = props.refusal ?? props.code ?? null;
  const node = h('p', {
    class: `notice ${kind === 'info' ? 'note' : kind}`,
    id: props.id,
    role: kind === 'error' ? 'alert' : null,
    'data-refusal': refusal,
    text: props.text,
  });
  if (props.actionId) node.append(' ', actionControl(context, entry, props.actionId, { class: 'button secondary small' }, props.actionLabel ?? 'Continue'));
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

export const UI_COMPONENTS = {
  hero: {
    version: 1,
    supportedRoles: ['eyebrow', 'headline', 'lede', 'micro', 'primaryActionId', 'primaryLabel', 'secondaryActionId', 'secondaryLabel', 'figureLabel', 'linkLabel', 'pendingText', 'binding', 'figure', 'page', 'capabilityId', 'namespaceId', 'ids'],
    render: renderHero,
  },
  section: {
    version: 1,
    supportedRoles: ['id', 'as', 'panel', 'variant', 'label', 'title', 'ariaLabel', 'items', 'session'],
    render: renderSection,
  },
  text: {
    version: 1,
    supportedRoles: ['id', 'as', 'text', 'binding', 'format', 'link'],
    render: renderText,
  },
  heading: {
    version: 1,
    supportedRoles: ['id', 'level', 'text', 'role', 'chips', 'badges'],
    render: renderHeading,
  },
  stat: {
    version: 1,
    supportedRoles: ['id', 'ariaLabel', 'items', 'catalog', 'release'],
    render: renderStat,
  },
  card: {
    version: 1,
    supportedRoles: ['item', 'title', 'body', 'promise', 'meta', 'capabilityId', 'namespaceId', 'linkLabel', 'binding', 'catalog'],
    render: renderCard,
  },
  'card-list': {
    version: 1,
    supportedRoles: ['id', 'heading', 'items', 'binding', 'catalog'],
    render: renderCardList,
  },
  list: {
    version: 1,
    supportedRoles: ['id', 'items', 'binding', 'limit', 'runs'],
    render: renderList,
  },
  'media.figure': {
    version: 1,
    supportedRoles: ['figureLabel', 'linkLabel', 'pendingText', 'binding', 'figure', 'page', 'capabilityId', 'namespaceId', 'ids'],
    render: renderMediaFigure,
  },
  notice: {
    version: 1,
    supportedRoles: ['id', 'kind', 'text', 'refusal', 'code', 'actionId', 'actionLabel'],
    render: renderNotice,
  },
};
