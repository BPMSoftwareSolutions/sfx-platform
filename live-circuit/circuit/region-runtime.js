// The declared-region host for the Explorer shell (first region mount, header).
//
// A region is a ui-region-content.v1 candidate loaded through the region
// provider's ui.region.load contract. The candidate carries declared CSS, HTML
// and SVG assets with per-asset and whole-candidate sha256 digests; the shell
// validates the contract, re-checks every digest, refuses any construct that
// could execute or fetch, and projects the declared structure into the named
// slots. The shell keeps the projector, validator, routing and safety seams;
// the region supplies content only.
//
// There is no fallback chrome: a region that cannot be read, validated or
// projected renders its named failure state (data-region-failure), never the
// hand-authored header it replaced.
import { safeUrl } from './page-runtime.js';

export const REGION_OPERATION = 'ui.region.load';
export const REGION_REQUEST_CONTRACT = 'ui-region-request.v1';
export const REGION_CONTENT_CONTRACT = 'ui-region-content.v1';
export const REGION_ROUTE = '/api/circuit/v1/region';
export const HEADER_REGION_ID = 'header';
export const HEADER_SLOTS = ['brand', 'primary-navigation', 'environment-label', 'identity-session-mount'];
export const FOOTER_REGION_ID = 'footer';
export const FOOTER_SLOTS = ['footer-brand', 'footer-credit', 'footer-navigation', 'release-label'];

const ASSET_KINDS = new Map([
  ['css', { mediaType: 'text/css', role: 'style' }],
  ['html', { mediaType: 'text/html', role: 'structure' }],
  ['svg', { mediaType: 'image/svg+xml', role: 'figure' }]
]);
const ASSET_ID = /^[a-z-]+\.(css|html|svg)$/;
const ASSET_PATH = /^assets\/[a-z-]+\.(css|html|svg)$/;
const SHA256 = /^sha256:[0-9a-f]{64}$/;
const CSS_UNSAFE = /@import|url\s*\(|expression\s*\(|javascript\s*:|vbscript\s*:|behavior\s*:|-moz-binding|<|\\/i;
const HTML_ELEMENTS = new Set(['header', 'footer', 'nav', 'main', 'aside', 'section', 'div', 'span', 'a', 'img', 'p', 'strong', 'em', 'small', 'ul', 'ol', 'li', 'hr']);
const HTML_ATTRIBUTES = new Set(['class', 'id', 'role', 'href', 'src', 'alt', 'title', 'width', 'height', 'loading', 'tabindex']);
const HTML_NAMESPACE = 'http://www.w3.org/1999/xhtml';
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const SVG_ELEMENTS = new Set(['svg', 'g', 'rect', 'line', 'circle', 'ellipse', 'path', 'polygon', 'polyline', 'title', 'desc']);
const SVG_ATTRIBUTES = new Set(['xmlns', 'viewbox', 'width', 'height', 'role', 'class', 'id', 'x', 'y', 'x1', 'y1', 'x2', 'y2',
  'cx', 'cy', 'r', 'rx', 'ry', 'd', 'points', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'transform']);

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function attributeAllowed(name) {
  return name === 'style' || name.startsWith('on') ? false
    : name.startsWith('data-') || name.startsWith('aria-') || HTML_ATTRIBUTES.has(name) || SVG_ATTRIBUTES.has(name);
}

export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

// Read the region through the host route. The browser never imports provider
// code; the host performs the provider's ui.region.load on the shell's behalf.
export async function readRegion(regionId = HEADER_REGION_ID) {
  const query = new URLSearchParams({ contractId: REGION_REQUEST_CONTRACT, regionId });
  try {
    const response = await fetch(`${REGION_ROUTE}?${query}`, { credentials: 'same-origin', redirect: 'error', headers: { accept: 'application/json' } });
    let body = null;
    try { body = await response.json(); } catch { body = null; }
    return { ok: response.ok, status: response.status, body };
  } catch (error) {
    return { ok: false, status: 0, body: null, error: error?.message ?? 'The region route could not be read.' };
  }
}

// The provider's closed refusal vocabulary and the host mapping: a read is a
// success only when the disposition is AUTHORED with a candidate and no finding.
export function readingFailure(reading) {
  const body = reading?.body;
  const findings = Array.isArray(body?.findings) ? body.findings : [];
  const named = findings.find(finding => typeof finding?.code === 'string' && finding.code);
  if (reading?.ok && body?.disposition === 'AUTHORED' && isRecord(body.candidate) && !named) return null;
  if (named) return { code: named.code, detail: typeof named.message === 'string' && named.message ? named.message : `The provider held the region (${named.code}).` };
  if (reading?.status === 0) return { code: 'UI_REGION_PROVIDER_UNREADABLE', detail: reading?.error ?? 'The region provider route could not be reached.' };
  return { code: 'UI_REGION_CONTENT_INVALID', detail: `The region read returned HTTP ${reading?.status ?? 0} without a usable candidate.` };
}

// Shape validation against the declared ui-region-content.v1 candidate: closed
// contract id, identity members, exactly the three declared asset kinds with
// their media types, roles, paths, byte counts and digest shapes.
export function validateRegionContent(candidate, expectedRegionId) {
  const refusals = [];
  const refuse = (code, detail) => refusals.push({ code, detail });
  if (!isRecord(candidate)) { refuse('UI_REGION_CONTENT_INVALID', 'The region candidate must be an object.'); return { ok: false, refusals }; }
  if (candidate.contractId !== REGION_CONTENT_CONTRACT) refuse('UI_REGION_CONTENT_INVALID', `The candidate contract must be ${REGION_CONTENT_CONTRACT}.`);
  for (const field of ['providerId', 'regionProviderId', 'regionId', 'role', 'basis'])
    if (typeof candidate[field] !== 'string' || !candidate[field]) refuse('UI_REGION_CONTENT_INVALID', `The candidate ${field} must be a non-empty string.`);
  if (typeof expectedRegionId === 'string' && candidate.regionId !== expectedRegionId)
    refuse('UI_REGION_CONTENT_INVALID', `The candidate regionId ${candidate.regionId ?? '(missing)'} does not match the requested ${expectedRegionId}.`);
  // The region provider identity is the package's declared provider for this
  // region; the shell only checks it is a provider id naming the region.
  if (typeof candidate.regionProviderId !== 'string' || !candidate.regionProviderId.endsWith(`-${candidate.regionId}`))
    refuse('UI_REGION_CONTENT_INVALID', 'The regionProviderId does not name the requested region provider.');
  if (!Number.isInteger(candidate.place) || candidate.place < 1 || candidate.place > 8) refuse('UI_REGION_CONTENT_INVALID', 'The candidate place must be 1-8.');
  if (!SHA256.test(candidate.digest ?? '')) refuse('UI_REGION_CONTENT_INVALID', 'The candidate digest must be a sha256 digest.');
  const assets = Array.isArray(candidate.assets) ? candidate.assets : null;
  if (!assets || assets.length !== ASSET_KINDS.size) { refuse('UI_REGION_CONTENT_INVALID', `The candidate must carry exactly the ${ASSET_KINDS.size} declared assets.`); return { ok: false, refusals }; }
  const kinds = new Set();
  for (const asset of assets) {
    if (!isRecord(asset)) { refuse('UI_REGION_CONTENT_INVALID', 'Every asset must be an object.'); continue; }
    const spec = ASSET_KINDS.get(asset.kind);
    if (!spec) { refuse('UI_REGION_CONTENT_INVALID', `The asset kind ${asset.kind ?? '(missing)'} is not declared.`); continue; }
    if (kinds.has(asset.kind)) refuse('UI_REGION_CONTENT_INVALID', `The ${asset.kind} asset is declared twice.`);
    kinds.add(asset.kind);
    if (typeof asset.assetId !== 'string' || !ASSET_ID.test(asset.assetId) || !asset.assetId.endsWith(`.${asset.kind}`))
      refuse('UI_REGION_CONTENT_INVALID', `The ${asset.kind} assetId must be <region>.${asset.kind}.`);
    if (typeof asset.path !== 'string' || !ASSET_PATH.test(asset.path) || asset.path !== `assets/${asset.assetId}`)
      refuse('UI_REGION_CONTENT_INVALID', `The ${asset.assetId ?? '(missing)'} path must be assets/<assetId>.`);
    if (asset.mediaType !== spec.mediaType || asset.role !== spec.role)
      refuse('UI_REGION_CONTENT_INVALID', `The ${asset.assetId ?? '(missing)'} mediaType/role must be ${spec.mediaType}/${spec.role}.`);
    if (typeof asset.content !== 'string' || !asset.content) refuse('UI_REGION_CONTENT_INVALID', `The ${asset.assetId ?? '(missing)'} content must be non-empty.`);
    else if (new TextEncoder().encode(asset.content).length !== asset.bytes)
      refuse('UI_REGION_CONTENT_INVALID', `The ${asset.assetId} declares ${asset.bytes} bytes; the content is ${new TextEncoder().encode(asset.content).length}.`);
    if (!SHA256.test(asset.digest ?? '')) refuse('UI_REGION_CONTENT_INVALID', `The ${asset.assetId ?? '(missing)'} digest must be a sha256 digest.`);
  }
  for (const kind of ASSET_KINDS.keys()) if (!kinds.has(kind)) refuse('UI_REGION_CONTENT_INVALID', `The ${kind} asset is missing.`);
  return { ok: refusals.length === 0, refusals };
}

// The declared bytes are the only trusted content. Every digest is recomputed:
// per asset (over its UTF-8 content) and for the candidate (over the exact
// declared body the provider digested).
export async function verifyRegionDigests(candidate) {
  const refusals = [];
  for (const asset of candidate.assets ?? []) {
    const actual = `sha256:${await sha256Hex(asset.content)}`;
    if (actual !== asset.digest) refusals.push({ code: 'UI_REGION_ASSET_DIGEST_MISMATCH', detail: `${asset.assetId} hashes to ${actual}, not the declared ${asset.digest}.` });
  }
  const body = { contractId: candidate.contractId, providerId: candidate.providerId, regionProviderId: candidate.regionProviderId,
    regionId: candidate.regionId, role: candidate.role, place: candidate.place, basis: candidate.basis,
    assets: (candidate.assets ?? []).map(asset => ({ assetId: asset.assetId, kind: asset.kind, mediaType: asset.mediaType, role: asset.role,
      path: asset.path, bytes: asset.bytes, digest: asset.digest, content: asset.content })) };
  const actual = `sha256:${await sha256Hex(JSON.stringify(body))}`;
  if (actual !== candidate.digest) refusals.push({ code: 'UI_REGION_CONTENT_DIGEST_MISMATCH', detail: `The candidate hashes to ${actual}, not the declared ${candidate.digest}.` });
  return { ok: refusals.length === 0, refusals };
}

// Rebuild declared nodes from an allowlist; unknown elements, attributes,
// handlers, styles and unsafe URLs refuse by name rather than being dropped.
function sanitizeNode(source, namespace, elements, refusals, assetId) {
  if (source.nodeType === 3) return document.createTextNode(source.textContent ?? '');
  if (source.nodeType !== 1) return null;
  const tag = String(source.tagName ?? '').toLowerCase();
  if (!elements.has(tag)) {
    refusals.push({ code: 'UI_REGION_ASSET_UNSAFE', detail: `${assetId} declares the element <${tag || 'unknown'}> outside the admitted set.` });
    return null;
  }
  const node = document.createElementNS(namespace, tag);
  for (const attribute of [...source.attributes]) {
    const name = attribute.name.toLowerCase();
    if (!attributeAllowed(name)) {
      refusals.push({ code: 'UI_REGION_ASSET_UNSAFE', detail: `${assetId} declares the ${attribute.name} attribute on <${tag}>; the shell refuses it.` });
      return null;
    }
    if ((name === 'href' || name === 'src') && safeUrl(attribute.value) === null) {
      refusals.push({ code: 'UI_REGION_ASSET_UNSAFE', detail: `${assetId} declares the ${name} target ${attribute.value} an admitted URL profile refuses.` });
      return null;
    }
    node.setAttribute(attribute.name, attribute.value);
  }
  for (const child of [...source.childNodes]) {
    if (child.nodeType === 1) {
      const clean = sanitizeNode(child, namespace, elements, refusals, assetId);
      if (clean === null) return null;
      node.append(clean);
    } else if (child.nodeType === 3) node.append(document.createTextNode(child.textContent ?? ''));
  }
  return node;
}

function parseAsset(asset, mimeType, elements, refusals) {
  let parsed;
  try { parsed = new DOMParser().parseFromString(asset.content, mimeType); }
  catch { refusals.push({ code: 'UI_REGION_ASSET_UNSAFE', detail: `${asset.assetId} could not be parsed.` }); return null; }
  if (!parsed || parsed.querySelector('parsererror')) { refusals.push({ code: 'UI_REGION_ASSET_UNSAFE', detail: `${asset.assetId} is not well-formed.` }); return null; }
  const root = mimeType === 'text/html' ? parsed.body.firstElementChild : parsed.documentElement;
  if (!root) { refusals.push({ code: 'UI_REGION_ASSET_UNSAFE', detail: `${asset.assetId} declares no root element.` }); return null; }
  if (mimeType === 'text/html' && parsed.body.children.length !== 1) {
    refusals.push({ code: 'UI_REGION_ASSET_UNSAFE', detail: `${asset.assetId} must declare exactly one root element.` });
    return null;
  }
  const namespace = root.tagName.toLowerCase() === 'svg' || mimeType !== 'text/html' ? SVG_NAMESPACE : HTML_NAMESPACE;
  if (namespace === SVG_NAMESPACE && root.tagName.toLowerCase() !== 'svg') {
    refusals.push({ code: 'UI_REGION_ASSET_UNSAFE', detail: `${asset.assetId} must declare an svg root.` });
    return null;
  }
  return sanitizeNode(root, namespace, elements, refusals, asset.assetId);
}

// CSS is text, never a URL; HTML and SVG are rebuilt from the allowlist.
export function sanitizeRegionAssets(candidate) {
  const refusals = [];
  const assets = { css: null, html: null, svg: null };
  for (const asset of candidate.assets ?? []) {
    if (asset.kind === 'css') {
      if (typeof asset.content !== 'string' || CSS_UNSAFE.test(asset.content))
        refusals.push({ code: 'UI_REGION_ASSET_UNSAFE', detail: `${asset.assetId} declares a style construct the shell refuses.` });
      else assets.css = asset;
    } else {
      const clean = parseAsset(asset, asset.mediaType, asset.kind === 'html' ? HTML_ELEMENTS : SVG_ELEMENTS, refusals);
      if (clean) assets[asset.kind] = { asset, node: clean };
    }
  }
  return { ok: refusals.length === 0, refusals, assets };
}

// Project the sanitized assets: the declared style, the declared structure with
// every named slot filled by the shell, and the declared figure as the region's
// decorative boundary frame. An unfillable or unknown slot refuses by name.
export function projectRegion(root, candidate, sanitized, slots = {}) {
  const refusals = [];
  const region = sanitized.assets.html?.node ?? null;
  const figure = sanitized.assets.svg?.node ?? null;
  if (!region) refusals.push({ code: 'UI_REGION_CONTENT_INVALID', detail: 'The region declares no HTML structure.' });
  else {
    const slotNodes = [...region.querySelectorAll('[data-slot]')];
    for (const name of Object.keys(slots))
      if (!slotNodes.some(node => node.dataset.slot === name)) refusals.push({ code: 'UI_REGION_SLOT_MISSING', detail: `The region declares no ${name} slot.` });
    for (const node of slotNodes) {
      const name = node.dataset.slot;
      if (typeof slots[name] !== 'function') refusals.push({ code: 'UI_REGION_SLOT_UNSUPPORTED', detail: `The region declares the ${name} slot; the shell does not fill it.` });
    }
  }
  if (refusals.length) return { ok: false, refusals };

  const slotElements = new Map();
  for (const node of region.querySelectorAll('[data-slot]')) {
    const name = node.dataset.slot;
    try { node.replaceChildren(...[slots[name]()].flat(3).filter(child => child !== null && child !== undefined && child !== false)); }
    catch { refusals.push({ code: 'UI_REGION_SLOT_UNFILLED', detail: `The shell could not fill the ${name} slot.` }); }
    slotElements.set(name, node);
  }
  if (refusals.length) return { ok: false, refusals };

  const style = document.createElement('style');
  style.setAttribute('data-region-asset', sanitized.assets.css.assetId);
  style.setAttribute('data-region-digest', sanitized.assets.css.digest);
  style.textContent = sanitized.assets.css.content;
  // The declared figure frames the region boundary, never the page: the region
  // element becomes the figure's containing block (the provider CSS declares no
  // position of its own; the shell owns this placement seam). It is the
  // blueprint boundary schematic, so it stays in the DOM, digest-verified and
  // clamped to the region, but is not painted over the working UI.
  region.style.position = 'relative';
  figure.setAttribute('data-region-asset', sanitized.assets.svg.asset.assetId);
  figure.setAttribute('data-region-digest', sanitized.assets.svg.asset.digest);
  figure.setAttribute('style', 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;visibility:hidden;');
  region.prepend(figure);
  root.replaceChildren(style, region);
  root.dataset.region = candidate.regionId;
  root.dataset.regionSource = 'declared';
  delete root.dataset.regionFailure;
  return { ok: true, refusals: [], region, figure, slotElements, slot: name => slotElements.get(name) ?? null };
}

// The named failure state. It replaces the region mount entirely; the shell
// renders no fallback chrome around it.
export function renderRegionFailure(root, regionId, code, detail) {
  if (!root) return null;
  const element = document.createElement('section');
  element.className = 'notice error';
  element.setAttribute('role', 'alert');
  element.setAttribute('data-region', regionId);
  element.setAttribute('data-region-failure', code);
  const name = document.createElement('strong');
  name.textContent = code;
  const message = document.createElement('p');
  message.textContent = detail || `The ${regionId} region could not be rendered from its declared content.`;
  element.append(name, message);
  root.replaceChildren(element);
  root.dataset.region = regionId;
  root.dataset.regionFailure = code;
  return element;
}

// Mount the region end to end: read, validate, digest, sanitize, project. Every
// refusal renders its named state and returns it; nothing falls through to a
// hand-authored chrome.
export async function createRegionRuntime({ root, regionId = HEADER_REGION_ID, slots = {} }) {
  const fail = (code, detail) => { renderRegionFailure(root, regionId, code, detail); return { ok: false, code, detail, slot: () => null }; };
  const reading = await readRegion(regionId);
  const failure = readingFailure(reading);
  if (failure) return fail(failure.code, failure.detail);
  const candidate = reading.body.candidate;
  const shape = validateRegionContent(candidate, regionId);
  if (!shape.ok) return fail(shape.refusals[0].code, shape.refusals.map(refusal => refusal.detail).join(' '));
  const digests = await verifyRegionDigests(candidate);
  if (!digests.ok) return fail(digests.refusals[0].code, digests.refusals.map(refusal => refusal.detail).join(' '));
  const sanitized = sanitizeRegionAssets(candidate);
  if (!sanitized.ok) return fail(sanitized.refusals[0].code, sanitized.refusals.map(refusal => refusal.detail).join(' '));
  const projected = projectRegion(root, candidate, sanitized, slots);
  if (!projected.ok) return fail(projected.refusals[0].code, projected.refusals.map(refusal => refusal.detail).join(' '));
  return { ok: true, regionId, candidate, region: projected.region, figure: projected.figure, slot: projected.slot };
}
