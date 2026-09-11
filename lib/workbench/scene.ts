/* Lower a compiled estate-topology product into `circuit-scene.v1`.
 *
 * The platform already serves every capability's topology under
 * `public/media/library/outputs/estate-topology/`. The workbench needs the same
 * graphs in its own scene contract, and lowering them here rather than in the
 * browser keeps two properties the workbench depends on:
 *
 *   * the browser receives a resolved scene, not a product it has to interpret
 *   * the screening that rejects scripts, inline handlers and unapproved
 *     references happens before the bytes reach a page, not after
 *
 * The rules mirror `adapters/topology/ingest_topology_view.py` in the workbench
 * repository: same node and route records, same hit-target extraction, same
 * separation of representation completeness from execution observability. A
 * product is read as data; nothing here executes it.
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export type Finding = { code: string; severity: 'error' | 'warning'; identity?: string; detail: string };

const PRODUCTS = path.join(process.cwd(), 'public/media/library/outputs/estate-topology');
const APPROVED_PREFIX = '/media/library/outputs/estate-topology/textures/';
const NON_TRAVERSABLE = 'provider-binding';
const PUBLIC = path.join(process.cwd(), 'public');

const digest = (bytes: Buffer | string) => crypto.createHash('sha256').update(bytes).digest('hex');

/* A compiled product and its textures are immutable for the snapshot that
 * produced them, so a reference's digest is computed once per process rather
 * than on every request that names it. */
const materialDigests = new Map<string, Promise<string | null>>();
function materialDigest(reference: string): Promise<string | null> {
  let pending = materialDigests.get(reference);
  if (!pending) {
    const file = path.join(PUBLIC, reference.replace(/^\//, ''));
    pending = path.resolve(file).startsWith(path.resolve(PUBLIC) + path.sep)
      ? fs.readFile(file).then(digest, () => null)
      : Promise.resolve(null);
    materialDigests.set(reference, pending);
  }
  return pending;
}

const SCRIPT = /<\s*script/i;
const HANDLER = /\son[a-z]+\s*=/i;
const HREF = /(?:xlink:)?href\s*=\s*"([^"]+)"/gi;
const GROUP = /<g\b[^>]*>/gi;
const ATTR = /([a-zA-Z_:][-\w:.]*)\s*=\s*"([^"]*)"/g;

/* A capability or view identifier reaches this module from a URL, so it is
 * constrained to the shape the compiler emits before it is ever joined to a
 * path. Anything else is refused rather than normalised. */
export const isCapabilityId = (value: string) => /^[a-z0-9][a-z0-9-]{0,127}$/.test(value);
export const isViewId = (value: string) => /^n-[0-9a-f]{24}$/.test(value);

/** Read a `window.X = {...};` product as data. It is never evaluated. */
function readPayload(text: string): Record<string, unknown> {
  const start = text.indexOf('=');
  if (start === -1) throw new Error('PRODUCT_MALFORMED');
  let body = text.slice(start + 1).trim();
  if (body.endsWith(';')) body = body.slice(0, -1);
  return JSON.parse(body);
}

function screen(svg: string, findings: Finding[], sceneId: string) {
  const scripts = SCRIPT.test(svg);
  const handlers = HANDLER.test(svg);
  if (scripts) findings.push({ code: 'SCENE_SCRIPT_REJECTED', severity: 'error', identity: sceneId, detail: 'script element in scene artifact' });
  if (handlers) findings.push({ code: 'SCENE_EVENT_HANDLER_REJECTED', severity: 'error', identity: sceneId, detail: 'inline event handler in scene artifact' });

  const references: string[] = [];
  let unapproved = false;
  for (const [, reference] of svg.matchAll(HREF)) {
    if (reference === undefined || reference.startsWith('#')) continue;
    if (reference.startsWith(APPROVED_PREFIX)) { references.push(reference); continue; }
    unapproved = true;
    findings.push({ code: 'SCENE_UNAPPROVED_REFERENCE', severity: 'error', identity: sceneId, detail: reference });
  }
  const screening = { scriptsRejected: !scripts, eventHandlersRejected: !handlers, unapprovedReferencesRejected: !unapproved, passed: !scripts && !handlers && !unapproved };
  // Sorted, so the material list does not depend on the order the artifact
  // happens to mention each texture.
  return { screening, references: [...new Set(references)].sort() };
}

/* Selection targets are lifted out of the artifact into the contract, so a
 * renderer change cannot quietly drop the selection and keyboard model with it. */
function hitTargets(svg: string, nodeIds: Set<string>, routeIds: Set<string>, findings: Finding[], sceneId: string) {
  const targets: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();
  for (const [tag] of svg.matchAll(GROUP)) {
    const attributes: Record<string, string> = {};
    for (const [, name, value] of tag.matchAll(ATTR)) if (name !== undefined) attributes[name] = value ?? '';
    const entityKind = 'data-entity' in attributes ? 'node' : 'data-route' in attributes ? 'route' : null;
    if (!entityKind) continue;
    const entityId = attributes[entityKind === 'node' ? 'data-entity' : 'data-route'] ?? '';
    const targetId = attributes.id ?? entityId;
    if (seen.has(targetId)) continue;
    seen.add(targetId);
    targets.push({ targetId, entityKind, entityId, accessibleName: attributes['aria-label'] ?? '', keyboardActivable: attributes.tabindex === '0' });
  }
  const covered = new Set(targets.map(t => t.entityId as string));
  for (const id of nodeIds) if (!covered.has(id)) findings.push({ code: 'SCENE_NODE_NOT_SELECTABLE', severity: 'error', identity: id, detail: 'node has no hit target in the scene artifact' });
  for (const id of routeIds) if (!covered.has(id)) findings.push({ code: 'SCENE_ROUTE_NOT_SELECTABLE', severity: 'error', identity: id, detail: 'route has no hit target in the scene artifact' });
  const unkeyed = targets.filter(t => !t.keyboardActivable).length;
  if (unkeyed) findings.push({ code: 'SCENE_TARGET_NOT_KEYBOARD_ACTIVABLE', severity: 'error', identity: sceneId, detail: `${unkeyed} hit targets are not keyboard activable` });
  return targets;
}

export async function lowerScene(capabilityId: string, viewId: string) {
  const file = path.join(PRODUCTS, capabilityId, viewId + '.js');
  /* The joined path must still sit inside the products directory; a traversal
   * attempt is refused rather than resolved. */
  if (!path.resolve(file).startsWith(path.resolve(PRODUCTS) + path.sep)) throw new Error('VIEW_OUTSIDE_PRODUCTS');

  const product = await fs.readFile(file);
  const payload = readPayload(product.toString('utf8')) as Record<string, any>;
  if (payload.id !== viewId) throw new Error('VIEW_IDENTITY_MISMATCH');

  const findings: Finding[] = [];
  const sceneId = `${capabilityId}/${payload.id}`;
  const analytics = payload.analytics ?? {};
  const layout = payload.layout ?? {};
  const svg: string = payload.svg ?? '';

  const nodeIds = new Set<string>((payload.nodes ?? []).map((n: any) => n.id));
  const routeIds = new Set<string>((payload.edges ?? []).map((e: any) => e.id));
  const { screening, references } = screen(svg, findings, sceneId);
  const targets = hitTargets(svg, nodeIds, routeIds, findings, sceneId);

  const nodes = (payload.nodes ?? []).map((node: any) => {
    if (!(node.id in (layout.boxes ?? {}))) findings.push({ code: 'SCENE_GEOMETRY_MISSING', severity: 'error', identity: node.id, detail: 'node has no layout box' });
    return { id: node.id, identity: node.identity, kind: node.kind, label: node.label, ...(node.detail === undefined ? {} : { detail: node.detail }), ...(node.source === undefined ? {} : { source: node.source }), ...(node.facts === undefined ? {} : { facts: node.facts }) };
  });

  const routes = (payload.edges ?? []).map((edge: any) => {
    for (const endpoint of ['source', 'target'] as const) {
      if (!nodeIds.has(edge[endpoint])) findings.push({ code: 'SCENE_ROUTE_ENDPOINT_UNRESOLVED', severity: 'error', identity: edge.id, detail: `${endpoint} ${edge[endpoint]} is not a node in this view` });
    }
    return { id: edge.id, identity: edge.identity, source: edge.source, target: edge.target, kind: edge.kind, traversable: edge.kind !== NON_TRAVERSABLE, ...(edge.label === undefined ? {} : { label: edge.label }), ...(edge.provenance === undefined ? {} : { provenance: edge.provenance }), ...(edge.facts === undefined ? {} : { facts: edge.facts }) };
  });

  if (nodes.length !== analytics.nodes || routes.length !== analytics.edges) {
    findings.push({ code: 'SCENE_COVERAGE_INCONSISTENT', severity: 'error', identity: sceneId, detail: `retained ${nodes.length}/${routes.length}, analytics ${analytics.nodes}/${analytics.edges}` });
  }

  const scene = {
    sceneVersion: 'circuit-scene.v1',
    sceneId,
    label: payload.label,
    identities: { capabilityId, viewId: payload.id, viewKind: payload.kind, sourceIdentity: payload.identity, scenarioId: payload.scenarioId ?? null },
    traceMode: 'ILLUSTRATIVE',
    graph: { nodes, routes },
    geometry: { width: layout.width, height: layout.height, engine: analytics.engine ?? 'unknown', boxes: layout.boxes ?? {}, overlaps: payload.geometry?.overlaps ?? 0 },
    /* The artifact keeps referencing the materials the platform already serves;
     * they are not copied, and the reference is the one that resolves here. */
    materials: await Promise.all(references.map(async reference => {
      const sha256 = await materialDigest(reference);
      if (sha256 === null) {
        findings.push({ code: 'SCENE_MATERIAL_UNRESOLVED', severity: 'error', identity: reference, detail: 'approved reference does not resolve to a served file' });
      }
      return { reference, sha256: sha256 ?? '' };
    })),
    hitTargets: targets,
    scene: { kind: 'svg', retained: null, source: `/media/library/outputs/estate-topology/${capabilityId}/${viewId}.js`, sha256: digest(Buffer.from(svg, 'utf8')), bytes: Buffer.byteLength(svg, 'utf8'), screening },
    coverage: {
      nodes: nodes.length, routes: routes.length,
      omittedSourceNodes: analytics.omittedSourceNodes ?? 0, omittedSourceEdges: analytics.omittedSourceEdges ?? 0,
      representationComplete: (analytics.omittedSourceNodes ?? 0) === 0 && (analytics.omittedSourceEdges ?? 0) === 0,
      nodeKinds: analytics.nodeKinds, routeKinds: analytics.routeKinds,
      observability: { instrumented: false, note: 'Declared topology only. No execution instrumentation exists for this view; representation completeness says nothing about observability.' },
    },
    topology: { roots: analytics.roots ?? [], leaves: analytics.leaves ?? [], weakComponents: analytics.weakComponents ?? 0, cyclicComponentCount: (analytics.cyclicComponents ?? []).length },
    provenance: {
      sourceAuthority: payload.source ?? {},
      ingestedFrom: { path: `estate-topology/${capabilityId}/${viewId}.js`, sha256: digest(product) },
      adapter: { name: 'lower-scene', version: '1.0.0' },
    },
    findings,
  };

  return { scene, artifact: screening.passed ? svg : '' };
}
