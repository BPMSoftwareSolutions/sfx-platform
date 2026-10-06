// Platform transport only. The installed kernel reads declared authority; SQL
// returns all scenario semantics, geometry, SVG and observation bindings.
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
async function deliver(reader, payload) {
  await capacity();
  try {
    const project = JSON.parse(await readFile(path.join(root, 'sfx.config.json'), 'utf8'));
    const delivery = project.deliveries?.[policy.delivery];
    if (!delivery?.command || !delivery.args?.includes('--stdin-envelope')) throw new CircuitReadError('INSTALLED_KERNEL_DELIVERY_REQUIRED');
    const request = { ...reader.request, ...(reader.inputContractId ? { input: { contractId: reader.inputContractId, payload } } : {}) };
    const envelope = { deliveryType: 'sfx-command-delivery.v1', operation: reader.operation, request };
    const output = await new Promise((resolve, reject) => {
      const env = { ...process.env }; delete env.SDA_API_TOKEN; delete env.SFX_API_TOKEN;
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
    });
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
async function readProviderInspection(selection) {
  const endpoint = process.env.PROCEDURE_EXTRACT_ENDPOINT;
  if (!endpoint) throw new CircuitReadError('PROCEDURE_RETRIEVAL_NOT_CONFIGURED', 503);
  if (!selection.detailId || !selection.expectedSnapshotDigest) throw new CircuitReadError('CIRCUIT_SELECTION_REQUIRED', 400);
  const scene = await readScenario(selection, true);
  const providerId = scene.detail?.kind === 'provider' && scene.detail.status === 'DECLARED' ? scene.detail.body?.providerId : null;
  const identity = scene.navigation.items.find(item => item.id === selection.detailId);
  if (!providerId || !identity?.definitionDigest) throw new CircuitReadError('DECLARED_PROVIDER_REQUIRED', 422);
  await capacity();
  try {
    const response = await fetch(`${endpoint.replace(/\/$/, '')}/json`, {
      method: 'POST', headers: { 'content-type': 'application/json',
        ...(process.env.SDA_API_TOKEN ? { authorization: `Bearer ${process.env.SDA_API_TOKEN}` } : {}) },
      body: JSON.stringify({ procedure: policy.retrieval.provider.procedure,
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
    const declared = resultSets.find(set => set.name === policy.retrieval.provider.identityResultSet)?.rows;
    if (declared?.length !== 1 || declared[0].provider_id !== providerId || declared[0].definition_digest !== identity.definitionDigest)
      throw new CircuitReadError('PROVIDER_DEFINITION_CHANGED', 409);
    return { providerId, definitionDigest: identity.definitionDigest, snapshotDigest: scene.snapshotDigest,
      readAt: new Date().toISOString(), resultSets };
  } finally { release(); }
}
export async function serveCircuitApi(req, res, url) {
  if (req.method !== 'GET' || !url.pathname.startsWith('/api/circuit/v1/')) return false;
  try {
    const refresh = url.searchParams.get('refresh') === '1';
    let data;
    if (url.pathname === '/api/circuit/v1/capabilities') data = await readCatalog(refresh);
    else if (url.pathname === '/api/circuit/v1/scenario') data = await readScenario(Object.fromEntries(['capabilityId', 'namespaceId', 'scenarioId', 'detailId', 'detailPointer', 'expectedSnapshotDigest'].map(k => [k, url.searchParams.get(k)])), refresh);
    else if (url.pathname === '/api/circuit/v1/capability-details') data = await readCapabilityDetails(Object.fromEntries(['capabilityId', 'namespaceId'].map(k => [k, url.searchParams.get(k)])), refresh);
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
