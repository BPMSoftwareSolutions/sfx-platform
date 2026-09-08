#!/usr/bin/env node
/**
 * Topology ingest — ADR 0001.
 *
 * Reads the compiled `n-*.js` view artifacts, recovers the Graphviz route geometry that today
 * exists only inside the rendered SVG string, discards that SVG, and writes contract-shaped
 * per-capability bundles the website renders from.
 *
 *   node scripts/ingest-topology.mjs [--in <dir>] [--out <dir>] [--report]
 *
 * This step is transitional. Once the content lab's `estate_topology_render.py` persists route
 * splines into `layout` and stops emitting `svg`, the SVG parsing here can be deleted and the
 * bundles built straight from the compiler output.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const DEFAULT_IN = join(ROOT, 'public', 'media', 'library', 'outputs', 'estate-topology');
const DEFAULT_OUT = join(ROOT, 'generated', 'topology');

/** The compiler wraps each view as `window.ESTATE_TOPOLOGY_VIEW = {...};` */
function parseViewFile(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('view file carries no JSON object');
  return JSON.parse(text.slice(start, end + 1));
}

/**
 * Recovers per-route geometry from the rendered SVG.
 *
 * Each route is emitted as a `<g data-route=…>` wrapping a `<path class="route-path" d=…>` and,
 * where the layout placed one, a `<text>` label. Both are keyed by the route id so the mapping is
 * exact rather than positional.
 */
function extractRouteGeometry(svg) {
  const routes = {};
  const routeLabels = {};
  if (!svg) return { routes, routeLabels };

  // Each route group runs to the next <g or the end; non-greedy so groups never swallow siblings.
  const groupPattern = /<g\b[^>]*data-route="([^"]+)"[^>]*>([\s\S]*?)<\/g>/g;
  for (const [, routeId, body] of svg.matchAll(groupPattern)) {
    const path = /class="route-path"\s+d="([^"]+)"/.exec(body) ?? /d="([^"]+)"[^>]*class="route-path"/.exec(body);
    if (path?.[1]) routes[routeId] = path[1];
    const label = /<text\b[^>]*\bx="([-0-9.]+)"[^>]*\by="([-0-9.]+)"/.exec(body);
    if (label) routeLabels[routeId] = [Number(label[1]), Number(label[2])];
  }
  return { routes, routeLabels };
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

/** Stable digest over the graph and its geometry; key order cannot change the result. */
function graphDigest(nodes, routes, layout) {
  const canonical = (v) => {
    if (Array.isArray(v)) return v.map(canonical);
    if (v && typeof v === 'object') {
      return Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonical(v[k])]));
    }
    return v;
  };
  return sha256(JSON.stringify(canonical({ nodes, routes, layout })));
}

function walkViewFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkViewFiles(full));
    else if (/^n-[0-9a-f]+\.js$/.test(entry.name)) out.push(full);
  }
  return out;
}

function main() {
  const args = process.argv.slice(2);
  const inDir = args.includes('--in') ? args[args.indexOf('--in') + 1] : DEFAULT_IN;
  const outDir = args.includes('--out') ? args[args.indexOf('--out') + 1] : DEFAULT_OUT;
  const reportOnly = args.includes('--report');

  const files = walkViewFiles(inDir);
  if (files.length === 0) {
    console.error(`No topology view files found under ${inDir}`);
    process.exit(1);
  }

  const byCapability = new Map();
  const problems = [];
  let bytesIn = 0;
  let svgBytes = 0;
  let geometryBytes = 0;
  let missingRoutes = 0;

  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    bytesIn += Buffer.byteLength(text);

    let raw;
    try {
      raw = parseViewFile(text);
    } catch (error) {
      problems.push(`${file}: ${error.message}`);
      continue;
    }

    svgBytes += (raw.svg ?? '').length;
    const { routes, routeLabels } = extractRouteGeometry(raw.svg ?? '');
    geometryBytes += JSON.stringify({ routes, routeLabels }).length;

    const edges = raw.edges ?? [];
    const nodeIds = new Set((raw.nodes ?? []).map((n) => n.id));

    // A route whose geometry did not survive would silently render as a missing connection.
    for (const edge of edges) {
      if (!routes[edge.id]) {
        missingRoutes += 1;
        problems.push(`${file}: route ${edge.id} (${edge.kind}) has no recovered path geometry`);
      }
      if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
        problems.push(`${file}: route ${edge.id} references a node outside this view`);
      }
    }

    // The capability owning this view is the first path segment under the input directory.
    const relative = file.slice(inDir.length + 1).replace(/\\/g, '/');
    const capabilityId = relative.split('/')[0];

    const layout = {
      width: raw.layout?.width ?? 0,
      height: raw.layout?.height ?? 0,
      boxes: raw.layout?.boxes ?? {},
      routes,
      routeLabels,
    };

    const view = {
      version: raw.version,
      id: raw.id,
      identity: raw.identity,
      label: raw.label,
      kind: raw.kind,
      source: raw.source,
      nodes: raw.nodes ?? [],
      // The compiler calls them `edges`; the contract calls them routes, matching SCL vocabulary.
      routes: edges,
      layout,
      scenarioIds: raw.scenarioIds ?? [],
      findings: raw.findings ?? [],
      analytics: raw.analytics ?? {},
      graphDigest: graphDigest(raw.nodes ?? [], edges, layout),
    };

    if (!byCapability.has(capabilityId)) byCapability.set(capabilityId, []);
    byCapability.get(capabilityId).push(view);
  }

  const mb = (n) => (n / 1048576).toFixed(1);
  console.log(`Read ${files.length} view files from ${inDir}`);
  console.log(`  input                ${mb(bytesIn)} MB`);
  console.log(`  stored svg           ${mb(svgBytes)} MB`);
  console.log(`  recovered geometry   ${mb(geometryBytes)} MB`);
  console.log(`  markup discarded     ${mb(svgBytes - geometryBytes)} MB`);

  if (missingRoutes > 0) {
    console.error(`\n${missingRoutes} routes lost their geometry. Refusing to write bundles.`);
    for (const problem of problems.slice(0, 10)) console.error(`  ${problem}`);
    process.exit(1);
  }
  if (problems.length > 0) {
    console.error(`\n${problems.length} integrity problems. Refusing to write bundles.`);
    for (const problem of problems.slice(0, 10)) console.error(`  ${problem}`);
    process.exit(1);
  }

  if (reportOnly) {
    console.log('\n--report given; no bundles written.');
    return;
  }

  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  let bytesOut = 0;
  for (const [capabilityId, views] of [...byCapability].sort()) {
    views.sort((a, b) => a.id.localeCompare(b.id));
    const bundle = {
      version: 1,
      capabilityId,
      views,
      index: Object.fromEntries(views.map((v) => [v.id, v.scenarioIds])),
    };
    const target = join(outDir, `${capabilityId}.json`);
    const payload = JSON.stringify(bundle);
    writeFileSync(target, payload);
    bytesOut += Buffer.byteLength(payload);
  }

  console.log(`\nWrote ${byCapability.size} capability bundles to ${outDir}`);
  console.log(`  output               ${mb(bytesOut)} MB`);
  console.log(`  saved                ${mb(bytesIn - bytesOut)} MB (${((1 - bytesOut / bytesIn) * 100).toFixed(1)}%)`);
}

main();
