// Server side of the declared-region mount. The shell loads the declared
// provider package for the requested region from an explicitly configured local
// directory (SFX_UI_PROVIDER_DIR), verifies the provider declares the
// ui.region.load READ_ONLY operation, and performs that operation on the
// browser's behalf. The directory may be the providers root (each package in
// its own <package>/<package>.mjs directory) or a single package directory (the
// flat layout); the region-to-package map below is the declared binding. No
// fallback: a missing provider, a module without the operation, or a refused
// load is a named finding the region runtime renders; provider code never
// reaches the browser.
import path from 'node:path';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const REGION_ROUTE = '/api/circuit/v1/region';
export const REGION_OPERATION = 'ui.region.load';
export const REGION_REQUEST_CONTRACT = 'ui-region-request.v1';

// The declared region-to-provider binding. Explorer regions are carried by the
// ui-explorer-region package; the shared shell footer by ui-shell-footer.
export const REGION_PROVIDERS = new Map([
  ['header', 'ui-explorer-region'],
  ['left-sidebar', 'ui-explorer-region'],
  ['middle', 'ui-explorer-region'],
  ['right-sidebar', 'ui-explorer-region'],
  ['footer', 'ui-shell-footer']
]);

const cache = new Map();

function unavailable(message) {
  return { providerId: null, toolId: REGION_OPERATION, providerExecution: 'unavailable', elapsedMs: 0, requestBytes: 0,
    disposition: 'HELD', candidate: null, shapeConforms: false,
    findings: [{ code: 'UI_REGION_PROVIDER_UNREADABLE', path: '$', message }] };
}

function packageModulePath(directory, regionId) {
  const packageName = REGION_PROVIDERS.get(regionId);
  if (!packageName) throw new Error(`The region ${regionId} has no declared provider package.`);
  const rooted = path.join(directory, packageName, `${packageName}.mjs`);
  if (existsSync(rooted)) return rooted;
  const flat = path.join(directory, `${packageName}.mjs`);
  if (existsSync(flat)) return flat;
  throw new Error(`The provider package ${packageName} is not present in ${directory}.`);
}

// A region outside the map (or a missing regionId) is validated by the
// Explorer package so the provider's own closed vocabulary answers
// UI_REGION_UNKNOWN / UI_REGION_REQUEST_INVALID; it never falls through to a
// different region's package.
function packageRegion(regionId) {
  return REGION_PROVIDERS.has(regionId) ? regionId : 'header';
}

async function loadProvider(regionId) {
  const directory = process.env.SFX_UI_PROVIDER_DIR ? path.resolve(process.env.SFX_UI_PROVIDER_DIR) : null;
  if (!directory) throw new Error('SFX_UI_PROVIDER_DIR is not configured on this host.');
  const modulePath = packageModulePath(directory, packageRegion(regionId));
  if (cache.has(modulePath)) return cache.get(modulePath);
  const module = await import(pathToFileURL(modulePath).href);
  const operation = (module.descriptor?.operations ?? []).find(entry => entry?.operationId === REGION_OPERATION);
  if (typeof module.invoke !== 'function' || !operation || operation.effect !== 'READ_ONLY'
    || operation.inputContractId !== REGION_REQUEST_CONTRACT || operation.outputContractId !== 'ui-region-content.v1')
    throw new Error('The configured module does not declare the ui.region.load READ_ONLY operation.');
  cache.set(modulePath, module);
  return module;
}

// Build the declared ui-region-request.v1 body from the URL selection and run
// the provider's operation. The provider owns validation, digests and refusals.
export async function readRegion(selection = {}) {
  const regionId = typeof selection.regionId === 'string' && selection.regionId ? selection.regionId : null;
  let provider;
  try { provider = await loadProvider(regionId); }
  catch (error) { return unavailable(error?.message ?? 'The region provider package is unavailable.'); }
  const request = { contractId: typeof selection.contractId === 'string' && selection.contractId ? selection.contractId : REGION_REQUEST_CONTRACT };
  if (regionId) request.regionId = regionId;
  try { return provider.invoke(request); }
  catch (error) { return unavailable(error?.message ?? 'The region provider refused to run its operation.'); }
}

export async function serveRegionApi(req, res, url) {
  if (url.pathname !== REGION_ROUTE) return false;
  if (req.method !== 'GET') {
    res.writeHead(405, { 'content-type': 'application/json; charset=utf-8', allow: 'GET', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ error: 'CIRCUIT_METHOD_NOT_ALLOWED' }));
    return true;
  }
  const body = await readRegion({ contractId: url.searchParams.get('contractId'), regionId: url.searchParams.get('regionId') });
  const code = Array.isArray(body.findings) && typeof body.findings[0]?.code === 'string' ? body.findings[0].code : null;
  const status = body.disposition === 'AUTHORED' ? 200
    : code === 'UI_REGION_REQUEST_INVALID' ? 400
      : code === 'UI_REGION_REQUEST_OVERSIZED' ? 413
        : code === 'UI_REGION_UNKNOWN' ? 404 : 503;
  const text = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(text), 'cache-control': 'no-store' });
  res.end(text);
  return true;
}
