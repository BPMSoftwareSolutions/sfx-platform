// The generic declared-view host for Explorer drill-downs (shell lane).
//
// A view is a ui-view.v1 document: the same page-shaped members as ui-page.v1
// (layout, sources, sections, actions, events) with the view's own identity
// (viewId, viewDigest). It is read through the deployed page reader
// (`/api/circuit/v1/page?path=/circuit/views/<viewId>`), so a view is published
// data, not a deploy; and it is projected by the same createPageRuntime
// projector and the same 21 ui-component.v1 adapters as a declared page.
//
// The subject is chosen from the URL (the Explorer's capability/namespace/
// scenario/detail selection and snapshot digest; viewId on the standalone host)
// and is bound into the view's declared source inputs, so a declaration names no
// concrete provider. The Explorer drill-down reads a view only through this host:
// a view that is absent or unreadable is a named visible state, never a fallback
// render.
import { createPageRuntime, validatePage } from './page-runtime.js';
import { json } from './site.js';

export const VIEW_CONTRACT = 'ui-view.v1';
export const DEFAULT_VIEW_ID = 'provider-profile';
const VIEW_PATH_PREFIX = '/circuit/views/';

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

// The view selection is the URL. The Explorer carries capability, namespace,
// scenario, detail (the provider detail id) and the circuit snapshot digest; a
// standalone host may name the provider directly.
export function viewSelection(params) {
  const search = params ?? (typeof location === 'undefined' ? new URLSearchParams() : new URLSearchParams(location.search));
  const pick = (...names) => {
    for (const name of names) {
      const value = search.get(name);
      if (value !== null && value !== '') return value;
    }
    return null;
  };
  return {
    viewId: pick('viewId') ?? DEFAULT_VIEW_ID,
    providerId: pick('provider', 'providerId', 'detail', 'detailId'),
    capabilityId: pick('capability', 'capabilityId'),
    namespaceId: pick('namespace', 'namespaceId'),
    scenarioId: pick('scenario', 'scenarioId'),
    detailId: pick('detail', 'detailId'),
    expectedSnapshotDigest: pick('expectedSnapshotDigest', 'snapshotDigest')
  };
}

export function viewPath(viewId = DEFAULT_VIEW_ID) {
  return `${VIEW_PATH_PREFIX}${viewId}`;
}

// The URL selection becomes the declared sources' input. The viewId never does.
// The host selection wins over the declaration's input: a declaration may carry
// the captured read's identity as a default (a standalone /circuit/view open
// uses it), but an Explorer selection must address the provider being opened.
// Every read/source binding resolves to the same input as its declared source,
// so the runtime issues one fetch per source, never a bare second request.
export function bindViewSelection(declared, selection = viewSelection()) {
  if (!isRecord(declared)) return declared;
  const picked = {};
  for (const [key, value] of Object.entries(selection ?? {})) if (key !== 'viewId' && value !== null && value !== undefined && value !== '') picked[key] = value;
  const sources = Array.isArray(declared.sources) ? declared.sources.map(source => isRecord(source)
    ? { ...source, input: { ...(isRecord(source.input) ? source.input : {}), ...picked } }
    : source) : declared.sources;
  const boundSources = Array.isArray(sources) ? sources.filter(isRecord) : [];
  const sourceInput = binding => {
    const id = binding.sourceId ?? binding.reader ?? binding.source;
    const match = boundSources.find(source => source.sourceId === id || source.reader === id);
    return isRecord(match?.input) ? match.input : null;
  };
  const bindReadInput = binding => {
    if (!isRecord(binding)) return binding;
    const read = binding.kind === 'read' || binding.kind === 'source'
      || (binding.kind === undefined && typeof binding.reader === 'string');
    if (!read) return binding;
    const base = sourceInput(binding) ?? (isRecord(binding.input) ? binding.input : {});
    return { ...binding, input: { ...base, ...(isRecord(binding.input) ? binding.input : {}), ...picked } };
  };
  const sections = Array.isArray(declared.sections) ? declared.sections.map(section => {
    if (!isRecord(section)) return section;
    const bindings = isRecord(section.bindings)
      ? Object.fromEntries(Object.entries(section.bindings).map(([role, binding]) => [role, bindReadInput(binding)]))
      : section.bindings;
    const actions = Array.isArray(section.actions) ? section.actions.map(action => isRecord(action) && isRecord(action.input)
      ? { ...action, input: Object.fromEntries(Object.entries(action.input).map(([name, binding]) => [name, bindReadInput(binding)])) }
      : action) : section.actions;
    return { ...section, bindings, actions };
  }) : declared.sections;
  return { ...declared, sources, sections };
}

// A view declaration is validated by the page validator over its bound document:
// the view inherits the page vocabulary, refusals and limits.
export function validateView(declared, selection) {
  return validatePage(bindViewSelection(declared, selection));
}

// Read the declared view through the deployed page reader. The disposition is
// returned unchanged; the caller decides whether to render it or name a refusal.
// This never synthesizes a view document or renders one.
export async function readView({ viewId = DEFAULT_VIEW_ID, selection } = {}) {
  const chosen = selection ?? viewSelection();
  const query = new URLSearchParams({ path: viewPath(viewId) });
  const response = await json(`/api/circuit/v1/page?${query}`);
  return { ...response, viewId, selection: chosen };
}

// Mount a declared view. The runtime is the page projector over the bound view
// document: the same adapters, bindings, actions, events and refusals apply.
// createPageRuntime is async, so this resolves to the projector before render.
export async function createViewRuntime({ root, document: declared, selection, navigate }) {
  return createPageRuntime({ root, document: bindViewSelection(declared, selection), navigate });
}
