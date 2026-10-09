// Platform transport only. The installed kernel reads declared authority; SQL
// returns all scenario semantics, geometry, SVG and observation bindings.
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { UI_COMPONENT_ROLES } from './ui-components.js';

// The estate directory holds the delivery configuration (sfx.config.json) that
// selects the installed kernel. The image places it two levels up; development
// names it explicitly with SDA_ESTATE_DIR, the variable the host already gives
// the SDA API and identity host.
const root = process.env.SDA_ESTATE_DIR ? path.resolve(process.env.SDA_ESTATE_DIR) : fileURLToPath(new URL('../../', import.meta.url));
const policy = JSON.parse(await readFile(new URL('./circuit-host.json', import.meta.url), 'utf8'));
const cache = new Map(), pending = new Map(), queue = [];
let active = 0, cacheBytes = 0;
export class CircuitReadError extends Error {
  constructor(code, status = 502) { super(code); this.code = code; this.status = status; }
}
const hash = value => createHash('sha256').update(value).digest('hex');
function release() { active--; queue.shift()?.(); }
async function capacity() {
  if (active < policy.maximumConcurrentReads) { active++; return; }
  if (queue.length >= policy.maximumQueuedReads) throw new CircuitReadError('CIRCUIT_READER_BUSY', 503);
  await new Promise(resolve => queue.push(() => { active++; resolve(); }));
}
// A resident delivery keeps one kernel process and exchanges one compact
// envelope line per request. The capacity gate above still admits deliveries;
// this chain serializes them through the single pipe, one line at a time, and
// settles each result line to its own caller. A timeout or an exit kills the
// child and the next delivery starts a fresh one.
let residentTransport = null;
function residentOutcome(result, reader) {
  const value = result.outcome?.result?.outcome;
  if (value?.code && !value.contractId) {
    const reported=/^[A-Z0-9_]+$/.test(value.message ?? '') ? value.message : value.code;
    const status=reported.endsWith('_NOT_FOUND') ? 404 : /_(NAMESPACE_REQUIRED|SNAPSHOT_CHANGED)$/.test(reported) ? 409 : 422;
    throw new CircuitReadError(/^[A-Z0-9_]+$/.test(reported) ? reported : 'CIRCUIT_DECLARATION_UNAVAILABLE',status);
  }
  if (value === undefined) {
    const errorCode = result.errorCode ?? result.error?.code ?? result.outcome?.result?.error?.code;
    throw new CircuitReadError(/^[A-Z0-9_]+$/.test(errorCode ?? '') ? errorCode : 'CIRCUIT_DECLARATION_UNAVAILABLE', 422);
  }
  if (reader.outputContractId && value.contractId !== reader.outputContractId) throw new CircuitReadError('CIRCUIT_READER_CONTRACT_MISMATCH');
  return value;
}
function residentReject(state, code, child = state.child) {
  if (child && state.child !== child) return;
  state.child = null; state.buffer = ''; state.bytes = 0;
  if (child?.exitCode === null) child.kill();
  const pending = state.pending; state.pending = null;
  if (pending) { clearTimeout(pending.timeout); pending.reject(new CircuitReadError(code)); }
}
function residentSettle(state, line) {
  const pending = state.pending;
  if (!pending) return;
  state.pending = null; clearTimeout(pending.timeout);
  let result;
  try { result = JSON.parse(line); }
  catch { return pending.reject(new CircuitReadError('CIRCUIT_READER_INVALID_JSON')); }
  try { pending.resolve(residentOutcome(result, pending.reader)); }
  catch (error) { pending.reject(error); }
}
function residentData(state, child, chunk) {
  if (state.child !== child) return;
  state.bytes += chunk.length;
  if (state.bytes > policy.maximumResponseBytes) return residentReject(state, 'CIRCUIT_RESPONSE_TOO_LARGE');
  state.buffer += chunk.toString('utf8');
  for (let index; (index = state.buffer.indexOf('\n')) >= 0;) {
    const line = state.buffer.slice(0, index); state.buffer = state.buffer.slice(index + 1);
    if (line.trim()) residentSettle(state, line);
  }
}
function residentClosed(state, child) {
  if (state.child !== child) return;
  state.child = null;
  const line = state.buffer; state.buffer = ''; state.bytes = 0;
  if (line.trim()) residentSettle(state, line);
  if (state.pending) residentReject(state, 'CIRCUIT_READER_INVALID_JSON');
}
function residentStart(state, delivery) {
  const env = { ...process.env }; delete env.SDA_API_TOKEN; delete env.SFX_API_TOKEN;
  delete env.SFX_EVIDENCE_SERVICE_KEY; delete env.SFX_EVIDENCE_CALLERS;
  const child = spawn(delivery.command, delivery.args, { env, cwd: path.resolve(root, delivery.cwd ?? '.'), windowsHide: true,
    shell: false, stdio: ['pipe', 'pipe', 'pipe'] });
  state.child = child;
  child.stdout.on('data', chunk => residentData(state, child, chunk));
  // Reader diagnostics stay off the observed subject's stream.
  child.stderr.resume();
  child.stdin.on('error', () => {});
  child.on('error', () => residentReject(state, 'INSTALLED_KERNEL_UNAVAILABLE', child));
  child.on('close', () => residentClosed(state, child));
}
function residentWrite(state, delivery, envelope, reader) {
  if (state.retired) return Promise.reject(new CircuitReadError('INSTALLED_KERNEL_UNAVAILABLE'));
  state.buffer = ''; state.bytes = 0;
  if (!state.child || state.child.exitCode !== null || state.child.signalCode !== null) state.child = null;
  if (!state.child) residentStart(state, delivery);
  const child = state.child;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => residentReject(state, 'CIRCUIT_READ_TIMEOUT'), policy.timeoutMilliseconds);
    state.pending = { resolve, reject, reader, timeout };
    child.stdin.write(JSON.stringify(envelope) + '\n', error => { if (error) residentReject(state, 'INSTALLED_KERNEL_UNAVAILABLE', child); });
  });
}
function deliverResident(delivery, envelope, reader) {
  const key = JSON.stringify([delivery.command, delivery.cwd ?? '.', delivery.args]);
  if (residentTransport && residentTransport.key !== key) {
    residentTransport.retired = true; residentReject(residentTransport, 'INSTALLED_KERNEL_UNAVAILABLE'); residentTransport = null;
  }
  residentTransport ??= { key, child: null, buffer: '', bytes: 0, pending: null, retired: false, queue: Promise.resolve() };
  const state = residentTransport;
  const exchange = state.queue.then(() => residentWrite(state, delivery, envelope, reader));
  state.queue = exchange.then(() => {}, () => {});
  return exchange;
}
async function deliver(reader, payload) {
  await capacity();
  try {
    const project = JSON.parse(await readFile(path.join(root, 'sfx.config.json'), 'utf8'));
    const delivery = project.deliveries?.[policy.delivery];
    const resident = delivery?.type === 'resident';
    if (!delivery?.command || !delivery.args?.includes(resident ? '--resident-envelopes' : '--stdin-envelope')) throw new CircuitReadError('INSTALLED_KERNEL_DELIVERY_REQUIRED');
    const request = { ...reader.request, ...(reader.inputContractId ? { input: { contractId: reader.inputContractId, payload } } : {}) };
    const envelope = { deliveryType: 'sfx-command-delivery.v1', operation: reader.operation, request };
    const output = await (resident ? deliverResident(delivery, envelope, reader) : new Promise((resolve, reject) => {
      const env = { ...process.env }; delete env.SDA_API_TOKEN; delete env.SFX_API_TOKEN;
      delete env.SFX_EVIDENCE_SERVICE_KEY; delete env.SFX_EVIDENCE_CALLERS;
      const child = spawn(delivery.command, delivery.args, { env, cwd: path.resolve(root, delivery.cwd ?? '.'), windowsHide: true,
        shell: false, stdio: ['pipe', 'pipe', 'pipe'] });
      let bytes = 0, chunks = [], failure = null;
      const stop = code => { failure ??= new CircuitReadError(code); child.kill(); };
      const timeout = setTimeout(() => stop('CIRCUIT_READ_TIMEOUT'), policy.timeoutMilliseconds);
      child.stdout.on('data', chunk => { bytes += chunk.length; if (bytes > policy.maximumResponseBytes) stop('CIRCUIT_RESPONSE_TOO_LARGE'); else chunks.push(chunk); });
      // Reader diagnostics stay off the observed subject's stream. They cannot
      // replace its latest run or interleave with a captured execution.
      child.stderr.resume();
      child.stdin.on('error', () => {});
      child.on('error', () => { clearTimeout(timeout); reject(new CircuitReadError('INSTALLED_KERNEL_UNAVAILABLE')); });
      child.on('close', code => {
        clearTimeout(timeout);
        if (failure) return reject(failure);
        let result;
        try { result = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
        catch { return reject(new CircuitReadError('CIRCUIT_READER_INVALID_JSON')); }
        const value = result.outcome?.result?.outcome;
        if (value?.code && !value.contractId) {
          const reported=/^[A-Z0-9_]+$/.test(value.message ?? '') ? value.message : value.code;
          const status=reported.endsWith('_NOT_FOUND') ? 404 : /_(NAMESPACE_REQUIRED|SNAPSHOT_CHANGED)$/.test(reported) ? 409 : 422;
          return reject(new CircuitReadError(/^[A-Z0-9_]+$/.test(reported) ? reported : 'CIRCUIT_DECLARATION_UNAVAILABLE',status));
        }
        if (code !== 0 || value === undefined) {
          const errorCode = result.errorCode ?? result.error?.code ?? result.outcome?.result?.error?.code;
          return reject(new CircuitReadError(/^[A-Z0-9_]+$/.test(errorCode ?? '') ? errorCode : 'CIRCUIT_DECLARATION_UNAVAILABLE', 422));
        }
        if (reader.outputContractId && value.contractId !== reader.outputContractId) return reject(new CircuitReadError('CIRCUIT_READER_CONTRACT_MISMATCH'));
        resolve(value);
      });
      child.stdin.end(JSON.stringify(envelope));
    }));
    return output;
  } finally { release(); }
}
async function read(name, payload, refresh) {
  const key = JSON.stringify([name, payload]);
  if (pending.has(key)) return pending.get(key);
  const hit = cache.get(key);
  if (!refresh && hit && hit.expires > Date.now()) {
    cache.delete(key); cache.set(key, hit); return hit.value;
  }
  const work = (async () => {
    const data = await deliver(policy.readers[name], payload);
    const value = { data, readAt: new Date().toISOString() };
    const bytes = Buffer.byteLength(JSON.stringify(value));
    const previous=cache.get(key);
    if (previous) { cache.delete(key); cacheBytes -= previous.bytes; }
    if (bytes <= policy.cache.maximumBytes) {
      while (cache.size && (cache.size >= policy.cache.maximumEntries || cacheBytes + bytes > policy.cache.maximumBytes)) {
        const oldest = cache.keys().next().value; cacheBytes -= cache.get(oldest).bytes; cache.delete(oldest);
      }
      cache.set(key, { value, bytes, expires: Date.now() + policy.cache.ttlMilliseconds }); cacheBytes += bytes;
    }
    return value;
  })();
  pending.set(key, work);
  try { return await work; } finally { pending.delete(key); }
}
export async function readCatalog(refresh = false) {
  const { data, readAt } = await read('catalog', {}, refresh);
  if (!Array.isArray(data)) throw new CircuitReadError('CIRCUIT_CATALOG_CONTRACT_MISMATCH');
  return { contractId: 'circuit-catalog.v1', count: data.length, readAt, capabilities: data };
}
export async function readScenario(selection, refresh = false) {
  const payload = {};
  for (const key of ['capabilityId', 'namespaceId', 'scenarioId', 'detailId', 'detailPointer', 'expectedSnapshotDigest']) {
    const value = selection[key];
    if (value == null || value === '') continue;
    if (typeof value !== 'string' || value.length > (key === 'detailPointer' ? 4000 : key === 'detailId' ? 1000 : 400) || /[\u0000-\u001f]/.test(value)) throw new CircuitReadError('INVALID_CIRCUIT_SELECTION', 400);
    if (key === 'expectedSnapshotDigest' && !/^[a-f0-9]{64}$/.test(value)) throw new CircuitReadError('INVALID_CIRCUIT_SNAPSHOT',400);
    payload[key] = value;
  }
  if (!payload.capabilityId) throw new CircuitReadError('CAPABILITY_REQUIRED', 400);
  const { data } = await read('scenario', payload, refresh);
  if (data.capabilityId !== payload.capabilityId || payload.namespaceId && data.namespaceId !== payload.namespaceId ||
      payload.scenarioId && data.scenarioId !== payload.scenarioId || data.observationMap?.snapshotDigest !== data.snapshotDigest ||
      payload.detailId && data.detail?.id !== payload.detailId)
    throw new CircuitReadError('CIRCUIT_SELECTION_MISMATCH');
  const scene=slide=>({...slide,svgDigest:hash(slide.svg),imageUrl:`data:image/svg+xml;base64,${Buffer.from(slide.svg).toString('base64')}`});
  return { ...data, source: 'database', slides:data.slides.map(scene),detailSlides:(data.detailSlides ?? []).map(scene) };
}
// The complete capability details reading (every set, navigation included) as
// one kernel-invoked document. Statuses other than READ carry no sets and are
// refused, never shown as an empty workspace.
const detailsRefusals = { NOT_FOUND: ['CAPABILITY_NOT_FOUND', 404], NOT_SELECTED: ['CAPABILITY_NOT_SELECTED', 404],
  NAMESPACE_MISMATCH: ['CAPABILITY_NAMESPACE_MISMATCH', 409] };
export async function readCapabilityDetails(selection, refresh = false) {
  const payload = {};
  for (const key of ['capabilityId', 'namespaceId']) {
    const value = selection[key];
    if (value == null || value === '') continue;
    if (typeof value !== 'string' || value.length > 400 || /[\u0000-\u001f]/.test(value)) throw new CircuitReadError('INVALID_CIRCUIT_SELECTION', 400);
    payload[key] = value;
  }
  if (!payload.capabilityId) throw new CircuitReadError('CAPABILITY_REQUIRED', 400);
  const { data } = await read('details', payload, refresh);
  if (data.capabilityId !== payload.capabilityId) throw new CircuitReadError('CIRCUIT_SELECTION_MISMATCH');
  if (detailsRefusals[data.status]) throw new CircuitReadError(...detailsRefusals[data.status]);
  if (data.status !== 'READ' || payload.namespaceId && data.namespaceId !== payload.namespaceId ||
      !data.sets || !Array.isArray(data.sets.capability_navigation))
    throw new CircuitReadError('CAPABILITY_DETAILS_CONTRACT_MISMATCH');
  return { ...data, source: 'database' };
}
// The complete declared-page reading (ui-page.v1), validated server-side against
// the deployed registry before it is served. An unknown component kind, action
// kind or source is a named refusal; a READ page with no sections is never
// served as an empty shell.
const pageRefusals = { NOT_FOUND: ['PAGE_NOT_FOUND', 404], NOT_DECLARED: ['PAGE_NOT_DECLARED', 404],
  SNAPSHOT_CHANGED: ['PAGE_SNAPSHOT_CHANGED', 409] };
const pageActions = new Set(['navigate', 'select', 'session', 'observe', 'objective', 'playback', 'view',
  'toggle', 'pane', 'copy/download', 'stage-change', 'refresh']);
const pageSources = new Set(['catalog', 'scenario', 'details', 'provider-inspection', 'session', 'release', 'crosswalk']);
function pageSourceNamed(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (typeof value.reader === 'string') return value.reader;
  return typeof value.source === 'string' ? value.source : null;
}
function validatePage(data) {
  if (data.status === 'READ' && (!Array.isArray(data.sections) || data.sections.length === 0))
    throw new CircuitReadError('UI_DECLARATION_INVALID', 422);
  const allowed = new Map((policy.ui?.components ?? []).map(component => [component.kind, component.version]));
  for (const section of data.sections ?? []) {
    if (allowed.get(section?.component?.kind) !== section?.component?.version)
      throw new CircuitReadError('UI_DECLARATION_INVALID', 422);
    for (const binding of Object.values(section.bindings ?? {})) {
      const source = pageSourceNamed(binding);
      if (source && !pageSources.has(source)) throw new CircuitReadError('UI_DECLARATION_INVALID', 422);
    }
    for (const action of section.actions ?? []) {
      if (!pageActions.has(action?.kind)) throw new CircuitReadError('UI_DECLARATION_INVALID', 422);
      for (const binding of Object.values(action.input ?? {})) {
        const source = pageSourceNamed(binding);
        if (source && !pageSources.has(source)) throw new CircuitReadError('UI_DECLARATION_INVALID', 422);
      }
    }
  }
}
export async function readPage(selection, refresh = false) {
  const payload = {};
  for (const key of ['path', 'expectedPageDigest', 'revision']) {
    const value = selection[key];
    if (value == null || value === '') continue;
    if (typeof value !== 'string' || value.length > 400 || /[\u0000-\u001f]/.test(value))
      throw new CircuitReadError(key === 'path' ? 'PAGE_REQUIRED' : 'INVALID_CIRCUIT_SELECTION', 400);
    payload[key] = value;
  }
  if (!payload.path) throw new CircuitReadError('PAGE_REQUIRED', 400);
  if (payload.expectedPageDigest && !/^[a-f0-9]{64}$/.test(payload.expectedPageDigest)) throw new CircuitReadError('INVALID_CIRCUIT_SELECTION', 400);
  if (payload.revision && !/^[0-9]+$/.test(payload.revision)) throw new CircuitReadError('INVALID_CIRCUIT_SELECTION', 400);
  const fixtureDirectory = process.env.SFX_PAGE_FIXTURE_DIR;
  if (fixtureDirectory) {
    const slug = payload.path.split('/').filter(Boolean).pop();
    if (!slug || /[\\/]/.test(slug)) throw new CircuitReadError('PAGE_NOT_FOUND', 404);
    let text;
    try { text = await readFile(path.join(path.resolve(fixtureDirectory), `${slug}.json`), 'utf8'); }
    catch { throw new CircuitReadError('PAGE_NOT_FOUND', 404); }
    const document = JSON.parse(text);
    if (typeof document?.error === 'string') {
      const status = document.error.includes('NOT_FOUND') || document.error.includes('NOT_DECLARED') ? 404
        : document.error.includes('SNAPSHOT_CHANGED') ? 409 : 422;
      throw new CircuitReadError(document.error, status);
    }
    return { ...document, source: 'fixture' };
  }
  const { data } = await read('page', payload, refresh);
  if (data.path !== payload.path) throw new CircuitReadError('CIRCUIT_SELECTION_MISMATCH');
  if (pageRefusals[data.status]) throw new CircuitReadError(...pageRefusals[data.status]);
  if (data.status !== 'READ' && data.status !== 'DEGRADED') throw new CircuitReadError('UI_DECLARATION_INVALID', 422);
  if (payload.expectedPageDigest && String(data.pageDigest ?? '').replace(/^sha256:/, '') !== payload.expectedPageDigest)
    throw new CircuitReadError('PAGE_SNAPSHOT_CHANGED', 409);
  validatePage(data);
  return { ...data, source: 'database' };
}
// The declared standards-crosswalk reading (standards-crosswalk.v1), the source
// behind the Phase-1 data-bound page section. One GET-only reader beside the
// page reader; a refusal is named and never served as an empty document.
const crosswalkRefusals = { NOT_FOUND: ['CROSSWALK_NOT_FOUND', 404], NOT_DECLARED: ['CROSSWALK_NOT_FOUND', 404] };
export async function readCrosswalk(selection, refresh = false) {
  const payload = {};
  for (const key of ['crosswalkId']) {
    const value = selection[key];
    if (value == null || value === '') continue;
    if (typeof value !== 'string' || value.length > 400 || /[\u0000-\u001f]/.test(value))
      throw new CircuitReadError('INVALID_CIRCUIT_SELECTION', 400);
    payload[key] = value;
  }
  if (!payload.crosswalkId) throw new CircuitReadError('CROSSWALK_REQUIRED', 400);
  const fixtureDirectory = process.env.SFX_PAGE_FIXTURE_DIR;
  if (fixtureDirectory) {
    if (/[\\/]/.test(payload.crosswalkId)) throw new CircuitReadError('CROSSWALK_NOT_FOUND', 404);
    // The crosswalk fixture set is `crosswalks/<id>.json` beside the page
    // fixture set, so verify-pages --fixtures stays dependency-free.
    const pageDirectory = path.resolve(fixtureDirectory);
    let text = null;
    for (const candidate of [
      path.join(pageDirectory, 'crosswalks', `${payload.crosswalkId}.json`),
      path.join(path.dirname(pageDirectory), 'crosswalks', `${payload.crosswalkId}.json`),
    ]) {
      try { text = await readFile(candidate, 'utf8'); break; } catch { /* try the next fixture location */ }
    }
    if (text === null) throw new CircuitReadError('CROSSWALK_NOT_FOUND', 404);
    const document = JSON.parse(text);
    if (typeof document?.error === 'string') throw new CircuitReadError(document.error, document.error.includes('NOT_FOUND') ? 404 : 422);
    if (document?.contractId !== 'standards-crosswalk.v1') throw new CircuitReadError('CIRCUIT_READER_CONTRACT_MISMATCH');
    return { ...document, source: 'fixture' };
  }
  const { data } = await read('crosswalk', payload, refresh);
  if (data.crosswalkId !== payload.crosswalkId) throw new CircuitReadError('CIRCUIT_SELECTION_MISMATCH');
  if (crosswalkRefusals[data.status]) throw new CircuitReadError(...crosswalkRefusals[data.status]);
  if (typeof data.status === 'string' && data.status.endsWith('_NOT_FOUND')) throw new CircuitReadError('CROSSWALK_NOT_FOUND', 404);
  if (data.status !== 'READ') throw new CircuitReadError('CROSSWALK_READING_INVALID', 422);
  if (data.contractId !== 'standards-crosswalk.v1') throw new CircuitReadError('CIRCUIT_READER_CONTRACT_MISMATCH');
  return { ...data, source: 'database' };
}
// The declared platform catalogs select the canonical reader; every other
// provider reads through the details reader.
export function providerReader(configured, providerId) {
  return configured.canonical && (configured.canonicalProviders ?? []).includes(providerId) ? configured.canonical : configured;
}
async function readProviderInspection(selection) {
  const endpoint = process.env.PROCEDURE_EXTRACT_ENDPOINT;
  if (!endpoint) throw new CircuitReadError('PROCEDURE_RETRIEVAL_NOT_CONFIGURED', 503);
  if (!selection.detailId || !selection.expectedSnapshotDigest) throw new CircuitReadError('CIRCUIT_SELECTION_REQUIRED', 400);
  const scene = await readScenario(selection, true);
  const providerId = scene.detail?.kind === 'provider' && scene.detail.status === 'DECLARED' ? scene.detail.body?.providerId : null;
  const identity = scene.navigation.items.find(item => item.id === selection.detailId);
  if (!providerId || !identity?.definitionDigest) throw new CircuitReadError('DECLARED_PROVIDER_REQUIRED', 422);
  await capacity();
  const configured = policy.retrieval.provider;
  async function readSets(reader) {
    const response = await fetch(`${endpoint.replace(/\/$/, '')}/json`, {
      method: 'POST', headers: { 'content-type': 'application/json',
        ...(process.env.SDA_API_TOKEN ? { authorization: `Bearer ${process.env.SDA_API_TOKEN}` } : {}) },
      body: JSON.stringify({ procedure: reader.procedure,
        parameters: { provider_id: providerId, estate_model_pk: Number(scene.identity.estateModelId) } }),
      signal: AbortSignal.timeout(policy.timeoutMilliseconds)
    });
    if (!response.ok) { await response.body?.cancel(); throw new CircuitReadError('PROCEDURE_RETRIEVAL_FAILED', 502); }
    let bytes = 0; const chunks = [];
    for await (const chunk of response.body) {
      bytes += chunk.length;
      if (bytes > policy.maximumResponseBytes) throw new CircuitReadError('CIRCUIT_RESPONSE_TOO_LARGE');
      chunks.push(chunk);
    }
    const resultSets = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!Array.isArray(resultSets) || resultSets.some(set => !Array.isArray(set.columns) || !Array.isArray(set.rows)))
      throw new CircuitReadError('PROCEDURE_RESULT_CONTRACT_MISMATCH');
    return resultSets;
  }
  try {
    // There is no reader fallback: a failed read is a named CircuitReadError,
    // never a canonical-only render.
    const reader = providerReader(configured, providerId);
    const resultSets = await readSets(reader);
    const declared = resultSets.find(set => set.name === reader.identityResultSet)?.rows;
    if (declared?.length !== 1 || declared[0].provider_id !== providerId || declared[0].definition_digest !== identity.definitionDigest)
      throw new CircuitReadError('PROVIDER_DEFINITION_CHANGED', 409);
    return { providerId, definitionDigest: identity.definitionDigest, snapshotDigest: scene.snapshotDigest, reader: reader.procedure,
      readAt: new Date().toISOString(), resultSets };
  } finally { release(); }
}
// The deployed shell registry the client validator and the publish gate consume.
// Kinds, actions, sources and routes change only with a shell deploy; component
// contract digests are deliberately absent because the shell does not know the
// estate's authored digests. Component roles/states are derived from the
// exported role table (K1) so the manifest cannot drift from the adapters;
// circuit-host.json `ui.components` stays the kind/version allowlist.
function componentRoles(kind) {
  const entry = UI_COMPONENT_ROLES[kind] ?? {};
  const names = [];
  for (const name of [...(entry.roles ?? []), ...(entry.props ?? [])]) if (!names.includes(name)) names.push(name);
  return names;
}
const uiComponents = (policy.ui?.components ?? []).map(component => ({
  kind: component.kind,
  version: component.version,
  roles: componentRoles(component.kind),
  states: [...(UI_COMPONENT_ROLES[component.kind]?.states ?? [])],
}));
const uiRegistry = { contractId: 'ui-registry.v1',
  shell: { routeHostVersion: '1', pageContractVersions: ['ui-page.v1', 'ui-page-definition.v1', 'ui-layout.v1', 'ui-component.v1'] },
  components: uiComponents,
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
  limits: { maximumSources: policy.ui?.maximumSources } };
export async function serveCircuitApi(req, res, url) {
  if (!url.pathname.startsWith('/api/circuit/v1/')) return false;
  if (req.method !== 'GET') {
    // The public gateway refuses every circuit method except GET and the
    // admitted POSTs (gateway.mjs:162-164); the host mirrors that law on its own
    // routes, and the session and run APIs are dispatched before this function.
    res.writeHead(405, { 'content-type': 'application/json; charset=utf-8', 'allow': 'GET', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ error: 'CIRCUIT_METHOD_NOT_ALLOWED' }));
    return true;
  }
  try {
    const refresh = url.searchParams.get('refresh') === '1';
    let data;
    if (url.pathname === '/api/circuit/v1/capabilities') data = await readCatalog(refresh);
    else if (url.pathname === '/api/circuit/v1/scenario') data = await readScenario(Object.fromEntries(['capabilityId', 'namespaceId', 'scenarioId', 'detailId', 'detailPointer', 'expectedSnapshotDigest'].map(k => [k, url.searchParams.get(k)])), refresh);
    else if (url.pathname === '/api/circuit/v1/capability-details') data = await readCapabilityDetails(Object.fromEntries(['capabilityId', 'namespaceId'].map(k => [k, url.searchParams.get(k)])), refresh);
    else if (url.pathname === '/api/circuit/v1/page') data = await readPage(Object.fromEntries(['path', 'expectedPageDigest', 'revision'].map(k => [k, url.searchParams.get(k)])), refresh);
    else if (url.pathname === '/api/circuit/v1/crosswalk') data = await readCrosswalk(Object.fromEntries(['crosswalkId'].map(k => [k, url.searchParams.get(k)])), refresh);
    else if (url.pathname === '/api/circuit/v1/ui-registry') data = uiRegistry;
    else if (url.pathname === '/api/circuit/v1/provider-inspection') data = await readProviderInspection(Object.fromEntries(['capabilityId', 'namespaceId', 'scenarioId', 'detailId', 'expectedSnapshotDigest'].map(k => [k, url.searchParams.get(k)])));
    else throw new CircuitReadError('CIRCUIT_RESOURCE_NOT_FOUND', 404);
    if (res.destroyed) return true;
    const body = JSON.stringify(data), etag = `"${hash(body)}"`;
    res.writeHead(req.headers['if-none-match'] === etag ? 304 : 200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-cache', etag });
    res.end(req.headers['if-none-match'] === etag ? undefined : body);
  } catch (error) {
    if (!res.destroyed) { res.writeHead(error.status ?? 502, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      res.end(JSON.stringify({ error: error instanceof CircuitReadError ? error.code : 'CIRCUIT_READER_UNAVAILABLE' })); }
  }
  return true;
}
