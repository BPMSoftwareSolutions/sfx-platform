// The declarative-page runtime for the Live Circuit shell.
//
// Adapter context contract (page-runtime -> ui-components, one shape for every
// UI_COMPONENTS entry):
//   { sources, document, resolve(binding), dispatch(actionId, scope), safeUrl, icon? }
//   sources   resolved source records keyed by sourceId: { ok, status, body, error }
//   document  the served ui-page.v1 declaration
//   resolve   a component binding (literal | read | session | release | route) to its value
//   dispatch  an action id and resolution scope; the runtime resolves the action's
//             input bindings and performs the admitted dispatch
//   safeUrl   admits a same-origin path or an http/https absolute URL, else null
//   icon      optional inline SVG helper; the shell does not provide one at v1
//
// A declaration never executes: text renders through textContent, URLs through
// safeUrl, and a local action never fetches. A failure renders content, never a
// blank section.
import { UI_COMPONENTS } from './ui-components.js';
import { json, signOut } from './site.js';

// The deployed shell registry (the client copy of the observer's uiRegistry
// manifest). Kinds, actions, sources and limits change only with a shell deploy.
const UI_REGISTRY = {
  contractId: 'ui-registry.v1',
  shell: { routeHostVersion: '1', pageContractVersions: ['ui-page.v1', 'ui-page-definition.v1', 'ui-layout.v1', 'ui-component.v1'] },
  components: [
    { kind: 'hero', version: 1 }, { kind: 'section', version: 1 }, { kind: 'text', version: 1 },
    { kind: 'heading', version: 1 }, { kind: 'stat', version: 1 }, { kind: 'card', version: 1 },
    { kind: 'card-list', version: 1 }, { kind: 'list', version: 1 }, { kind: 'media.figure', version: 1 },
    { kind: 'notice', version: 1 }, { kind: 'table', version: 1 }, { kind: 'field-list', version: 1 },
    { kind: 'disclosure', version: 1 }, { kind: 'badge', version: 1 }, { kind: 'status-chip', version: 1 }
  ],
  actions: [
    { kind: 'navigate', dispatchClass: 'local', inputs: [] },
    { kind: 'select', dispatchClass: 'local', inputs: [] },
    { kind: 'session', dispatchClass: 'session-post', inputs: ['intent', 'return'] },
    { kind: 'observe', dispatchClass: 'session-post', inputs: ['subject', 'namespace', 'input'] },
    { kind: 'objective', dispatchClass: 'session-post', inputs: ['objective'] },
    { kind: 'playback', dispatchClass: 'local', inputs: [] },
    { kind: 'view', dispatchClass: 'local', inputs: [] },
    { kind: 'toggle', dispatchClass: 'local', inputs: [] },
    { kind: 'pane', dispatchClass: 'local', inputs: [] },
    { kind: 'copy/download', dispatchClass: 'local', inputs: [] },
    { kind: 'stage-change', dispatchClass: 'local', inputs: [] },
    { kind: 'refresh', dispatchClass: 'read', inputs: [] }
  ],
  sources: [
    { sourceId: 'catalog', reader: 'catalog', route: '/api/circuit/v1/capabilities' },
    { sourceId: 'scenario', reader: 'scenario', route: '/api/circuit/v1/scenario' },
    { sourceId: 'details', reader: 'details', route: '/api/circuit/v1/capability-details' },
    { sourceId: 'provider-inspection', reader: 'provider-inspection', route: '/api/circuit/v1/provider-inspection' },
    { sourceId: 'session', reader: 'session', route: '/api/circuit/v1/session' },
    { sourceId: 'release', reader: 'release', route: '/healthz' },
    { sourceId: 'crosswalk', reader: 'crosswalk', route: '/api/circuit/v1/crosswalk' }
  ],
  limits: { maximumSources: 8 }
};

const COMPONENT_BINDINGS = new Set(['literal', 'read', 'session', 'release', 'route']);
const SCOPE_BINDINGS = new Set(['literal', 'route', 'event', 'form', 'row', 'source']);
const EVENT_NAMES = new Set(['load', 'click', 'submit', 'change', 'select', 'seek', 'toggle']);
const WHEN_STATES = new Set(['signed-in', 'signed-out', 'any']);
const LOCAL_KINDS = new Set(['navigate', 'select', 'playback', 'view', 'toggle', 'pane', 'copy/download', 'stage-change']);
const UNRESOLVED = Symbol('unresolved');

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// A binding is an object naming exactly one admitted scope or component kind; a
// plain value (or an object of literals) passes through untouched. An explicit
// `reader` without a kind is the read binding's authoring shorthand.
function declarationBinding(value) {
  if (!isRecord(value)) return null;
  if (typeof value.kind === 'string') return value.kind;
  const names = [];
  for (const key of Object.keys(value)) if (SCOPE_BINDINGS.has(key) || COMPONENT_BINDINGS.has(key)) names.push(key);
  if (typeof value.reader === 'string' && !names.length) names.push('read');
  return names.length === 1 ? names[0] : null;
}

// The rendering-safety URL gate: a same-origin relative path or an http/https
// absolute URL passes unchanged, everything else (javascript:, data:, any other
// scheme, protocol-relative or backslash paths, control characters) is refused.
export function safeUrl(value) {
  if (typeof value !== 'string') return null;
  const candidate = value.trim();
  if (!candidate || /[\u0000-\u001f\u007f]/.test(candidate)) return null;
  if (candidate.includes('\\') || candidate.startsWith('//')) return null;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(candidate)) {
    if (!/^https?:\/\//i.test(candidate)) return null;
    try {
      const url = new URL(candidate);
      if ((url.protocol !== 'http:' && url.protocol !== 'https:') || !url.hostname) return null;
      return candidate;
    } catch { return null; }
  }
  return candidate;
}

function pointerValue(value, pointer) {
  if (pointer == null || pointer === '') return { found: true, value };
  if (typeof pointer !== 'string' || !pointer.startsWith('/')) return { found: false };
  let current = value;
  for (const part of pointer.slice(1).split('/')) {
    const segment = part.replace(/~1/g, '/').replace(/~0/g, '~');
    if (Array.isArray(current)) {
      if (!/^(0|[1-9][0-9]*)$/.test(segment) || Number(segment) >= current.length) return { found: false };
      current = current[Number(segment)];
    } else if (isRecord(current) && Object.prototype.hasOwnProperty.call(current, segment)) {
      current = current[segment];
    } else return { found: false };
  }
  return { found: true, value: current };
}

function validateInputBindings(input, sectionId, sources, refuse) {
  if (input == null) return;
  if (!isRecord(input)) { refuse('UI_DECLARATION_INVALID', sectionId, 'action.input must be an object.'); return; }
  for (const [name, value] of Object.entries(input)) {
    if (!isRecord(value)) continue;
    const binding = declarationBinding(value);
    if (binding == null) continue;
    if (!SCOPE_BINDINGS.has(binding)) { refuse('UI_DECLARATION_INVALID', sectionId, `The ${name} binding names the undeclared scope ${binding}.`); continue; }
    if (binding === 'source' && (typeof value.source !== 'string' || !sources.has(value.source)))
      refuse('UI_SOURCE_NOT_SUPPORTED', sectionId, `The ${name} binding names the undeclared source ${value.source ?? '(missing)'}.`);
    if (binding === 'route' && typeof (value.name ?? value.param ?? value.key) !== 'string')
      refuse('UI_DECLARATION_INVALID', sectionId, `The ${name} route binding needs a param name.`);
    if (binding === 'form' && typeof value.form !== 'string')
      refuse('UI_DECLARATION_INVALID', sectionId, `The ${name} form binding needs a field name.`);
    if (binding === 'row' && typeof value.row !== 'string')
      refuse('UI_DECLARATION_INVALID', sectionId, `The ${name} row binding needs a field name.`);
    if (binding === 'event' && typeof value.event !== 'string')
      refuse('UI_DECLARATION_INVALID', sectionId, `The ${name} event binding needs a property name.`);
  }
}

function hasScopeInput(action) {
  return Object.values(action.input ?? {}).some(value => {
    const binding = declarationBinding(value);
    return binding === 'event' || binding === 'form' || binding === 'row';
  });
}

function validateRoles(section, sectionId, adapter, sources, readers, refuse) {
  if (section.props != null && !isRecord(section.props)) { refuse('UI_DECLARATION_INVALID', sectionId, 'section.props must be an object.'); return; }
  if (section.bindings != null && !isRecord(section.bindings)) { refuse('UI_DECLARATION_INVALID', sectionId, 'section.bindings must be an object.'); return; }
  const roles = Array.isArray(adapter.supportedRoles) ? new Set(adapter.supportedRoles) : null;
  for (const role of Object.keys(section.props ?? {})) {
    if (roles && role !== 'id' && !roles.has(role))
      refuse('UI_COMPONENT_ROLE_UNSUPPORTED', sectionId, `The ${section.component?.kind ?? 'declared'} component does not support the ${role} role.`);
  }
  for (const [role, binding] of Object.entries(section.bindings ?? {})) {
    if (roles && role !== 'id' && !roles.has(role)) {
      refuse('UI_COMPONENT_ROLE_UNSUPPORTED', sectionId, `The ${section.component?.kind ?? 'declared'} component does not support the ${role} role.`);
      continue;
    }
    const name = declarationBinding(binding);
    if (name == null) continue;
    if (!COMPONENT_BINDINGS.has(name)) { refuse('UI_DECLARATION_INVALID', sectionId, `The ${role} binding kind ${name} is not admitted.`); continue; }
    if (name === 'read') {
      const reader = binding.reader ?? binding.source;
      if (typeof reader !== 'string' || (!readers.has(reader) && !sources.has(reader)))
        refuse('UI_SOURCE_NOT_SUPPORTED', sectionId, `The ${role} binding names the undeclared reader ${reader ?? '(missing)'}.`);
      if (binding.pointer != null && typeof binding.pointer !== 'string')
        refuse('UI_DECLARATION_INVALID', sectionId, `The ${role} binding pointer must be a string.`);
    }
    if (name === 'route') {
      const param = binding.name ?? binding.param ?? binding.key;
      if (typeof param !== 'string' || !param) refuse('UI_DECLARATION_INVALID', sectionId, `The ${role} route binding needs a param name.`);
    }
  }
}
// Validate one served page declaration against the deployed registry. Refusals
// are named and section-scoped where possible; rendering continues around them.
export function validatePage(declared, registry = UI_REGISTRY) {
  const refusals = [];
  const refuse = (code, sectionId, detail) => {
    const refusal = { code, detail };
    if (sectionId) refusal.sectionId = sectionId;
    refusals.push(refusal);
  };
  const finish = () => ({ ok: refusals.length === 0, refusals });
  if (!isRecord(declared)) { refuse('UI_DECLARATION_INVALID', null, 'The page declaration must be an object.'); return finish(); }

  const components = new Map((registry?.components ?? []).map(component => [component?.kind, component?.version]));
  const actions = new Map((registry?.actions ?? []).map(action => [action?.kind, action?.dispatchClass]));
  const sources = new Map((registry?.sources ?? []).map(source => [source?.sourceId, source]));
  const readers = new Set((registry?.sources ?? []).map(source => source?.reader));
  const maximumSources = Number.isFinite(registry?.limits?.maximumSources) ? registry.limits.maximumSources : 8;

  if (declared.sources != null && !Array.isArray(declared.sources)) refuse('UI_DECLARATION_INVALID', null, 'sources must be an array.');
  const declaredSources = Array.isArray(declared.sources) ? declared.sources : [];
  if (declaredSources.length > maximumSources) refuse('UI_DECLARATION_INVALID', null, `The page declares ${declaredSources.length} sources; the maximum is ${maximumSources}.`);
  for (const source of declaredSources) {
    if (!isRecord(source) || typeof source.sourceId !== 'string' || !source.sourceId) { refuse('UI_DECLARATION_INVALID', null, 'Every source needs a sourceId.'); continue; }
    const reader = source.reader ?? source.source ?? source.sourceId;
    if (!sources.has(source.sourceId) || !readers.has(reader)) refuse('UI_SOURCE_NOT_SUPPORTED', null, `The source ${source.sourceId} names an undeclared reader.`);
  }

  if (declared.layout != null && !isRecord(declared.layout)) refuse('UI_DECLARATION_INVALID', null, 'layout must be an object.');
  const regions = declared.layout?.regions;
  if (regions != null && !Array.isArray(regions)) refuse('UI_DECLARATION_INVALID', null, 'layout.regions must be an array.');
  const regionIds = new Set((Array.isArray(regions) ? regions : []).map(region => isRecord(region) ? region.regionId : null).filter(Boolean));

  if (!Array.isArray(declared.sections)) { refuse('UI_DECLARATION_INVALID', null, 'The page declaration must carry a sections array.'); return finish(); }
  const sections = declared.sections;
  if (!sections.length && (declared.status === 'READ' || declared.status == null)) refuse('UI_DECLARATION_INVALID', null, 'A READ page must declare at least one section.');

  const actionsById = new Map();
  for (const section of sections) {
    if (!isRecord(section)) { refuse('UI_DECLARATION_INVALID', null, 'Every section must be an object.'); continue; }
    const sectionId = typeof section.sectionId === 'string' && section.sectionId ? section.sectionId : null;
    if (!sectionId) { refuse('UI_DECLARATION_INVALID', null, 'Every section needs a sectionId.'); continue; }
    if (section.actions != null && !Array.isArray(section.actions)) { refuse('UI_DECLARATION_INVALID', sectionId, 'section.actions must be an array.'); continue; }
    for (const action of section.actions ?? []) {
      if (!isRecord(action) || typeof action.actionId !== 'string' || !action.actionId) { refuse('UI_DECLARATION_INVALID', sectionId, 'Every action needs an actionId.'); continue; }
      if (actionsById.has(action.actionId)) { refuse('UI_DECLARATION_INVALID', sectionId, `The actionId ${action.actionId} is declared twice.`); continue; }
      const dispatchClass = actions.get(action.kind);
      if (!dispatchClass) refuse('UI_DECLARATION_INVALID', sectionId, `The action kind ${action.kind} is not deployed.`);
      else if (action.dispatchClass && action.dispatchClass !== dispatchClass) refuse('UI_DECLARATION_INVALID', sectionId, `The ${action.kind} action declares dispatchClass ${action.dispatchClass}; it must be ${dispatchClass}.`);
      validateInputBindings(action.input, sectionId, sources, refuse);
      actionsById.set(action.actionId, action);
    }
  }

  for (const section of sections) {
    if (!isRecord(section)) continue;
    const sectionId = typeof section.sectionId === 'string' && section.sectionId ? section.sectionId : null;
    if (!sectionId) continue;
    const kind = section.component?.kind;
    const deployedVersion = components.get(kind);
    const adapter = typeof kind === 'string' ? UI_COMPONENTS[kind] : null;
    if (typeof kind !== 'string' || deployedVersion == null || !adapter) {
      refuse('UI_COMPONENT_NOT_SUPPORTED', sectionId, `The component ${kind ?? '(missing)'} is not supported by the deployed shell.`);
    } else {
      if (section.component.version !== deployedVersion || (adapter.version != null && adapter.version !== deployedVersion))
        refuse('UI_COMPONENT_NOT_SUPPORTED', sectionId, `The component ${kind} declares version ${section.component.version}; the deployed version is ${deployedVersion}.`);
      validateRoles(section, sectionId, adapter, sources, readers, refuse);
    }
    if (section.when != null && (!isRecord(section.when) || (section.when.session != null && !WHEN_STATES.has(section.when.session))))
      refuse('UI_DECLARATION_INVALID', sectionId, 'when.session must be signed-in, signed-out or any.');
    if (section.regionId != null && (typeof section.regionId !== 'string' || (regionIds.size > 0 && !regionIds.has(section.regionId))))
      refuse('UI_DECLARATION_INVALID', sectionId, `The region ${section.regionId} is not declared by the layout.`);
    if (section.events != null && !Array.isArray(section.events)) { refuse('UI_DECLARATION_INVALID', sectionId, 'section.events must be an array.'); continue; }
    for (const event of section.events ?? []) {
      if (!isRecord(event) || !EVENT_NAMES.has(event.on)) { refuse('UI_DECLARATION_INVALID', sectionId, 'Every event needs an admitted on kind.'); continue; }
      const action = actionsById.get(event.actionId);
      if (!action) { refuse('UI_DECLARATION_INVALID', sectionId, `The event names the undeclared action ${event.actionId ?? '(missing)'}.`); continue; }
      if (event.on === 'load') {
        if (actions.get(action.kind) !== 'read') refuse('UI_DECLARATION_INVALID', sectionId, 'A load event may only emit a read action.');
        else if (hasScopeInput(action)) refuse('UI_ACTION_BINDING_UNRESOLVED', sectionId, `The load action ${action.actionId} reads a scope a load event never carries.`);
      }
    }
  }
  return finish();
}

function readRouteParams() {
  const params = new URLSearchParams();
  if (typeof location === 'undefined') return params;
  for (const [key, value] of new URLSearchParams(location.search ?? '')) params.set(key, value);
  const pathname = location.pathname ?? '';
  const segments = pathname.split('/').filter(Boolean);
  const slug = segments.length > 1 && segments[0] === 'circuit' ? segments[1] : segments[segments.length - 1];
  if (slug && !params.has('slug')) params.set('slug', slug);
  if (!params.has('path')) params.set('path', pathname);
  return params;
}

// Bind a page declaration to a root element. render() resolves the declared
// sources once (deduplicated, capped), paints regions and sections in order,
// attaches the declared events and fires load events once.
export async function createPageRuntime({ root, document: declared, navigate }) {
  const page = isRecord(declared) ? declared : {};
  const go = typeof navigate === 'function' ? navigate : url => { if (typeof location !== 'undefined') location.assign(url); };
  let records = new Map();
  let sectionElements = new Map();
  let actionsById = new Map();
  let loadFired = false;

  const context = {
    sources: {},
    document: page,
    resolve: binding => {
      const value = resolveComponentBinding(binding);
      return value === UNRESOLVED ? undefined : value;
    },
    dispatch: (actionId, scope) => dispatch(actionId, scope),
    safeUrl
  };

  const sectionsOf = () => (Array.isArray(page.sections) ? page.sections.filter(isRecord) : []);
  const orderValue = value => Number.isFinite(value?.order) ? value.order : 0;

  function stableInput(input) {
    if (input == null) return '';
    if (!isRecord(input)) return JSON.stringify(input);
    return JSON.stringify(Object.fromEntries(Object.keys(input).sort().map(key => [key, input[key]])));
  }

  function sourceUrl(route, input) {
    if (!isRecord(input)) return route;
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(input)) {
      if (value == null) continue;
      params.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
    }
    const query = params.toString();
    return query ? `${route}?${query}` : route;
  }

  function collectSourceRequests() {
    const plan = [];
    const byKey = new Map();
    const add = (sourceId, reader, input) => {
      const known = UI_REGISTRY.sources.find(source => source.sourceId === sourceId) ?? UI_REGISTRY.sources.find(source => source.sourceId === reader || source.reader === reader);
      if (!known) return null;
      const key = `${known.sourceId}\u0000${stableInput(input)}`;
      if (byKey.has(key)) return byKey.get(key);
      const request = { sourceId: known.sourceId, reader: known.reader, route: known.route, input: input ?? null, key };
      byKey.set(key, request);
      plan.push(request);
      return request;
    };
    const addBinding = binding => {
      const name = declarationBinding(binding);
      if (name === 'read' || name === 'source') add(binding.source ?? binding.reader, binding.reader ?? binding.source, binding.input ?? null);
      else if (name === 'session') add('session', 'session', null);
      else if (name === 'release') add('release', 'release', null);
    };
    for (const source of Array.isArray(page.sources) ? page.sources : []) {
      if (!isRecord(source)) continue;
      add(source.sourceId, source.reader ?? source.source ?? source.sourceId, source.input ?? null);
    }
    for (const section of sectionsOf()) {
      for (const binding of Object.values(isRecord(section.bindings) ? section.bindings : {})) addBinding(binding);
      for (const action of Array.isArray(section.actions) ? section.actions : []) {
        if (!isRecord(action)) continue;
        for (const binding of Object.values(isRecord(action.input) ? action.input : {})) addBinding(binding);
      }
    }
    if (sectionsOf().some(section => section.when?.session && section.when.session !== 'any')) add('session', 'session', null);
    return plan;
  }

  async function loadSources() {
    const plan = collectSourceRequests();
    const maximum = UI_REGISTRY.limits.maximumSources;
    records = new Map();
    await Promise.all(plan.slice(0, maximum).map(async request => {
      let record;
      try {
        const response = await json(sourceUrl(request.route, request.input));
        record = { ok: response.ok, status: response.status, body: response.body, error: response.ok ? null : `HTTP ${response.status}` };
      } catch (error) {
        record = { ok: false, status: 0, body: null, error: error?.message ?? 'The source could not be read.' };
      }
      records.set(request.key, { ...request, ...record });
    }));
    for (const request of plan.slice(maximum)) {
      records.set(request.key, { ...request, ok: false, status: 0, body: null, error: `The page declares more than ${maximum} sources.` });
    }
    context.sources = Object.fromEntries([...records.values()].map(record => [record.sourceId, { ok: record.ok, status: record.status, body: record.body, error: record.error }]));
  }

  function findRecord(binding) {
    const sourceId = binding?.source ?? binding?.reader ?? binding?.sourceId;
    if (typeof sourceId !== 'string' || !sourceId) return null;
    const wanted = stableInput(binding?.input ?? null);
    const candidates = [...records.values()].filter(record => record.sourceId === sourceId || record.reader === sourceId);
    return candidates.find(record => stableInput(record.input) === wanted) ?? candidates[0] ?? null;
  }

  function sessionState() {
    const candidates = [...records.values()].filter(record => record.sourceId === 'session');
    const record = candidates.find(candidate => candidate.ok) ?? candidates[0];
    return record?.ok ? record.body : null;
  }

  function resolveComponentBinding(binding) {
    if (!isRecord(binding)) return binding;
    const name = declarationBinding(binding);
    if (name == null) return binding;
    switch (name) {
      case 'literal': return 'value' in binding ? binding.value : binding.literal;
      case 'read': {
        const record = findRecord(binding);
        if (!record?.ok) return UNRESOLVED;
        if (binding.pointer == null) return record.body;
        const result = pointerValue(record.body, binding.pointer);
        return result.found ? result.value : UNRESOLVED;
      }
      case 'session': {
        const record = findRecord({ source: 'session' });
        return record?.ok ? record.body : UNRESOLVED;
      }
      case 'release': {
        const record = findRecord({ source: 'release' });
        return record?.ok ? record.body : UNRESOLVED;
      }
      case 'route': {
        const param = binding.name ?? binding.param ?? binding.key;
        const params = readRouteParams();
        return typeof param === 'string' && params.has(param) ? params.get(param) : UNRESOLVED;
      }
      default: return UNRESOLVED;
    }
  }
  function whenMatches(when, session) {
    if (!isRecord(when)) return true;
    const state = when.session ?? 'any';
    if (state === 'any') return true;
    if (state === 'signed-in') return session?.authenticated === true;
    if (state === 'signed-out') return session?.authenticated === false;
    return false;
  }

  function selectVariants(sections, session) {
    const groups = new Map();
    for (const section of sections) {
      if (typeof section.sectionId !== 'string' || !section.sectionId) continue;
      if (!groups.has(section.sectionId)) groups.set(section.sectionId, []);
      groups.get(section.sectionId).push(section);
    }
    const selected = [];
    for (const variants of groups.values()) {
      const match = variants.find(section => whenMatches(section.when, session));
      if (match) selected.push(match);
    }
    return selected;
  }

  function createRegions() {
    const declaredRegions = Array.isArray(page.layout?.regions) ? page.layout.regions.filter(isRecord) : [];
    const list = declaredRegions.length ? [...declaredRegions].sort((a, b) => orderValue(a) - orderValue(b)) : [{ regionId: 'main', order: 1 }];
    const containers = new Map();
    for (const region of list) {
      const regionId = typeof region.regionId === 'string' && region.regionId ? region.regionId : 'main';
      if (containers.has(regionId)) continue;
      const node = document.createElement('div');
      node.className = 'page-region';
      node.dataset.region = regionId;
      root.append(node);
      containers.set(regionId, { node, order: containers.size });
    }
    const fallback = containers.values().next().value?.node ?? root;
    return {
      containerFor: regionId => containers.get(regionId)?.node ?? fallback,
      orderOf: regionId => containers.get(regionId)?.order ?? 0
    };
  }

  function failedDependencies(section) {
    const failed = [];
    const seen = new Set();
    for (const binding of Object.values(isRecord(section.bindings) ? section.bindings : {})) {
      const name = declarationBinding(binding);
      if (name !== 'read' && name !== 'session' && name !== 'release') continue;
      const record = name === 'read' ? findRecord(binding) : findRecord({ source: name });
      const sourceId = record?.sourceId ?? binding.source ?? binding.reader ?? name;
      if (record?.ok || seen.has(sourceId)) continue;
      seen.add(sourceId);
      failed.push(record ?? { sourceId, status: 0, error: 'not read' });
    }
    return failed;
  }

  function refusalNotice(refusal) {
    const node = document.createElement('p');
    node.className = 'panel';
    node.dataset.refusal = refusal.code;
    node.textContent = refusal.detail || refusal.code;
    return node;
  }

  function stateNotice(state, text) {
    const node = document.createElement('p');
    node.className = 'panel';
    node.dataset.state = state;
    node.textContent = text;
    return node;
  }

  function sourceNotice(record) {
    return stateNotice('source-error', `The ${record.sourceId} source could not be read${record.status ? ` (HTTP ${record.status})` : ''}.`);
  }

  function eventScope(domEvent) {
    const target = domEvent?.target;
    const scope = { event: domEvent ?? null, value: target?.value, form: null, row: null };
    const form = target?.form ?? (typeof target?.closest === 'function' ? target.closest('form') : null);
    if (form && typeof FormData !== 'undefined') scope.form = new FormData(form);
    const rowNode = typeof target?.closest === 'function' ? target.closest('[data-row]') : null;
    if (rowNode?.dataset?.row) {
      try { scope.row = JSON.parse(rowNode.dataset.row); } catch { scope.row = rowNode.dataset.row; }
    }
    return scope;
  }

  function findById(scopeNode, id) {
    for (const node of scopeNode.querySelectorAll('[id]')) if (node.id === id) return node;
    return null;
  }

  function attachEvents(sections) {
    for (const section of sections) {
      const element = sectionElements.get(section.sectionId);
      if (!element) continue;
      for (const event of Array.isArray(section.events) ? section.events : []) {
        if (!isRecord(event) || event.on === 'load' || !EVENT_NAMES.has(event.on)) continue;
        const target = typeof event.target === 'string' ? findById(element, event.target) ?? element : element;
        target.addEventListener(event.on, domEvent => {
          if (event.on === 'submit' && typeof domEvent.preventDefault === 'function') domEvent.preventDefault();
          void dispatch(event.actionId, eventScope(domEvent));
        });
      }
    }
  }

  function fireLoadEvents(sections) {
    for (const section of sections) {
      for (const event of Array.isArray(section.events) ? section.events : []) {
        if (isRecord(event) && event.on === 'load') void dispatch(event.actionId, null);
      }
    }
  }

  function resolveScopeBinding(binding, scope) {
    if (!isRecord(binding)) return binding;
    const name = declarationBinding(binding);
    if (name == null) return binding;
    switch (name) {
      case 'literal': return 'value' in binding ? binding.value : binding.literal;
      case 'route': {
        const param = binding.name ?? binding.param ?? binding.key;
        const params = readRouteParams();
        return typeof param === 'string' && params.has(param) ? params.get(param) : UNRESOLVED;
      }
      case 'event': {
        const field = binding.event;
        const target = scope?.event?.target;
        if (scope?.value !== undefined) return scope.value;
        if (field === 'value' && target?.value !== undefined) return target.value;
        if (target && field && target[field] !== undefined) return target[field];
        if (field && scope?.event && scope.event[field] !== undefined) return scope.event[field];
        return UNRESOLVED;
      }
      case 'form': {
        const form = scope?.form;
        if (!form) return UNRESOLVED;
        const field = String(binding.form);
        if (typeof FormData !== 'undefined' && form instanceof FormData) return form.has(field) ? form.get(field) : UNRESOLVED;
        return Object.prototype.hasOwnProperty.call(form, field) ? form[field] : UNRESOLVED;
      }
      case 'row': {
        const row = scope?.row;
        if (!isRecord(row)) return UNRESOLVED;
        const field = String(binding.row);
        return Object.prototype.hasOwnProperty.call(row, field) ? row[field] : UNRESOLVED;
      }
      case 'source': {
        const record = findRecord(binding);
        if (!record?.ok) return UNRESOLVED;
        if (binding.pointer == null) return record.body;
        const result = pointerValue(record.body, binding.pointer);
        return result.found ? result.value : UNRESOLVED;
      }
      default: return UNRESOLVED;
    }
  }

  function resolveActionInputs(action, scope) {
    const inputs = {};
    for (const [name, value] of Object.entries(isRecord(action.input) ? action.input : {})) {
      const resolved = resolveScopeBinding(value, scope);
      if (resolved === UNRESOLVED) return UNRESOLVED;
      inputs[name] = resolved;
    }
    return inputs;
  }

  function currentPath() {
    if (typeof location === 'undefined') return '/circuit/home';
    return `${location.pathname ?? '/circuit/home'}${location.search ?? ''}`;
  }

  async function postRun(body, target) {
    try {
      const response = await fetch('/api/circuit/v1/runs', {
        method: 'POST',
        credentials: 'same-origin',
        redirect: 'error',
        headers: { 'content-type': 'application/json',
          'idempotency-key': typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) },
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        let detail = `The run was refused (HTTP ${response.status}).`;
        try { const parsed = await response.json(); if (typeof parsed?.error === 'string') detail = parsed.error; } catch { /* keep the status text */ }
        target.append(stateNotice('action-refused', detail));
      }
    } catch (error) {
      target.append(stateNotice('action-refused', error?.message ?? 'The run could not be submitted.'));
    }
  }

  function bindingRefusal(target, action, field) {
    target.append(refusalNotice({ code: 'UI_ACTION_BINDING_UNRESOLVED', detail: `The ${action.kind} action ${action.actionId ?? ''} cannot resolve its ${field} binding.` }));
  }

  async function dispatchAction(action, inputs, target) {
    const pick = key => inputs[key] !== undefined ? inputs[key] : action[key];
    if (action.kind === 'navigate') {
      const url = safeUrl(pick('to'));
      if (!url) { bindingRefusal(target, action, 'to'); return; }
      go(url);
      return;
    }
    if (action.kind === 'session') {
      const intent = typeof pick('intent') === 'string' ? pick('intent') : 'sign-in';
      if (intent === 'sign-out') {
        await signOut();
        if (typeof location !== 'undefined') location.reload();
        return;
      }
      if (intent === 'continue') {
        const url = safeUrl(pick('return'));
        if (!url) { bindingRefusal(target, action, 'return'); return; }
        go(url);
        return;
      }
      go(`/circuit/login?return=${encodeURIComponent(currentPath())}`);
      return;
    }
    if (action.kind === 'refresh') { await render(); return; }
    if (action.kind === 'observe') {
      const subject = pick('subject');
      if (typeof subject !== 'string' || !subject) { bindingRefusal(target, action, 'subject'); return; }
      const body = { object: 'capability', operation: 'observe', subject };
      if (pick('namespace') != null) body.namespace = pick('namespace');
      if (pick('input') != null) body.input = pick('input');
      await postRun(body, target);
      return;
    }
    if (action.kind === 'objective') {
      const objective = pick('objective');
      if (typeof objective !== 'string' || !objective.trim()) { bindingRefusal(target, action, 'objective'); return; }
      // The same admission body objective-run.js sends for the universal capability.
      await postRun({ object: 'capability', operation: 'observe', subject: 'request-capability-from-objective-v3',
        namespace: 'sidefx:capabilities', input: { contractId: 'agent-objective-request.v1', payload: { objective: objective.trim() } } }, target);
      return;
    }
    if (action.kind === 'copy/download') {
      const documentValue = pick('document');
      if (documentValue == null) { bindingRefusal(target, action, 'document'); return; }
      const text = typeof documentValue === 'string' ? documentValue : JSON.stringify(documentValue, null, 2);
      if (pick('intent') === 'copy' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text).catch(() => {});
        return;
      }
      if (typeof Blob === 'undefined' || typeof URL === 'undefined' || typeof document === 'undefined') return;
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = String(pick('filename') ?? 'document.json');
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return;
    }
    if (LOCAL_KINDS.has(action.kind) && typeof target.dispatchEvent === 'function' && typeof CustomEvent !== 'undefined') {
      target.dispatchEvent(new CustomEvent('page-action', { detail: { actionId: action.actionId, kind: action.kind, input: inputs }, bubbles: true }));
    }
  }
  async function dispatch(actionId, scope) {
    const found = actionsById.get(actionId);
    if (!found) { root.append(refusalNotice({ code: 'UI_ACTION_BINDING_UNRESOLVED', detail: `No action named ${actionId} is declared.` })); return; }
    const inputs = resolveActionInputs(found.action, isRecord(scope) ? scope : {});
    if (inputs === UNRESOLVED) {
      found.element.append(refusalNotice({ code: 'UI_ACTION_BINDING_UNRESOLVED', detail: `The action ${actionId} has an input binding that cannot resolve.` }));
      return;
    }
    await dispatchAction(found.action, inputs, found.element);
  }

  async function render() {
    if (!root) return;
    const { refusals } = validatePage(page, UI_REGISTRY);
    await loadSources();
    root.replaceChildren();
    sectionElements = new Map();
    actionsById = new Map();
    for (const refusal of refusals) if (!refusal.sectionId) root.append(refusalNotice(refusal));
    const regions = createRegions();
    const sectionRefusals = new Map();
    for (const refusal of refusals) {
      if (!refusal.sectionId) continue;
      if (!sectionRefusals.has(refusal.sectionId)) sectionRefusals.set(refusal.sectionId, []);
      sectionRefusals.get(refusal.sectionId).push(refusal);
    }
    const selected = selectVariants(sectionsOf(), sessionState());
    const order = new Map(selected.map((section, index) => [section, index]));
    const regionOrder = new Map(selected.map(section => [section, regions.orderOf(section.regionId)]));
    selected.sort((a, b) => regionOrder.get(a) - regionOrder.get(b) || order.get(a) - order.get(b));
    for (const section of selected) {
      const element = document.createElement('section');
      element.id = section.sectionId;
      element.dataset.component = section.component?.kind ?? '';
      element.dataset.region = section.regionId ?? '';
      regions.containerFor(section.regionId).append(element);
      sectionElements.set(section.sectionId, element);
      for (const action of Array.isArray(section.actions) ? section.actions : []) {
        if (isRecord(action) && typeof action.actionId === 'string' && action.actionId) actionsById.set(action.actionId, { action, section, element });
      }
      const failures = sectionRefusals.get(section.sectionId);
      if (failures?.length) { for (const refusal of failures) element.append(refusalNotice(refusal)); continue; }
      for (const dependency of failedDependencies(section)) element.append(sourceNotice(dependency));
      const adapter = UI_COMPONENTS[section.component?.kind];
      if (!adapter || typeof adapter.render !== 'function') {
        element.append(refusalNotice({ code: 'UI_COMPONENT_NOT_SUPPORTED', sectionId: section.sectionId, detail: `No adapter renders the ${section.component?.kind} component.` }));
        continue;
      }
      try { await adapter.render(element, section, context); }
      catch { element.append(stateNotice('adapter-error', `The ${section.component.kind} section could not be rendered.`)); }
      if (!element.hasChildNodes()) element.append(stateNotice('empty-state', 'This section has no content to show.'));
    }
    attachEvents(selected);
    if (!loadFired) { loadFired = true; fireLoadEvents(selected); }
  }

  return { render };
}


