/**
 * Topology parity gate — ADR 0001 §5, step 2.
 *
 * Compares what the on-demand renderer produces against the SVG the compiler stored, for the same
 * view, before the stored copy is deleted. The bar is identity and geometry parity, not byte
 * equality: the renderer paints with the site's own design system, but it must draw exactly the
 * same components, in the same boxes, along the same routes.
 *
 *   npx tsx scripts/verify-topology-parity.ts [--limit N]
 *
 * Skips with a clear message once the stored artifacts are gone, so it stays runnable in CI
 * without pinning the repository to the very bytes this ADR removes.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { renderTopologySvg } from '../components/topology/render-topology';
import { TopologyBundle, type TopologyView } from '../contracts/topology';

const STORED = join(process.cwd(), 'public', 'media', 'library', 'outputs', 'estate-topology');
const BUNDLES = join(process.cwd(), 'generated', 'topology');

interface Failure {
  view: string;
  problem: string;
}

/** Ids carried by `data-entity` / `data-route` groups, in document order. */
function idsFrom(svg: string, attribute: 'data-entity' | 'data-route'): string[] {
  return [...svg.matchAll(new RegExp(`${attribute}="([^"]+)"`, 'g'))].map((m) => m[1] as string);
}

function routePaths(svg: string): Map<string, string> {
  const paths = new Map<string, string>();
  for (const [, id, body] of svg.matchAll(/<g\b[^>]*data-route="([^"]+)"[^>]*>([\s\S]*?)<\/g>/g)) {
    const d = /class="route-path"\s+d="([^"]+)"/.exec(body) ?? /d="([^"]+)"[^>]*class="route-path"/.exec(body);
    if (d?.[1]) paths.set(id, d[1]);
  }
  return paths;
}

function findStoredView(viewId: string): string | undefined {
  for (const capability of readdirSync(STORED, { withFileTypes: true })) {
    if (!capability.isDirectory()) continue;
    const file = join(STORED, capability.name, `${viewId}.js`);
    if (existsSync(file)) {
      const text = readFileSync(file, 'utf8');
      const raw = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
      return raw.svg as string | undefined;
    }
  }
  return undefined;
}

function compare(view: TopologyView, stored: string): Failure[] {
  const failures: Failure[] = [];
  const rendered = renderTopologySvg(view);

  const storedNodes = new Set(idsFrom(stored, 'data-entity'));
  const renderedNodes = new Set(idsFrom(rendered, 'data-entity'));
  for (const id of storedNodes) {
    if (!renderedNodes.has(id)) failures.push({ view: view.id, problem: `node ${id} is missing from the render` });
  }
  for (const id of renderedNodes) {
    if (!storedNodes.has(id)) failures.push({ view: view.id, problem: `node ${id} was invented by the render` });
  }

  const storedRoutes = routePaths(stored);
  const renderedRoutes = routePaths(rendered);
  for (const [id, d] of storedRoutes) {
    const ours = renderedRoutes.get(id);
    if (!ours) {
      failures.push({ view: view.id, problem: `route ${id} is missing from the render` });
    } else if (ours.replace(/\s+/g, ' ').trim() !== d.replace(/\s+/g, ' ').trim()) {
      failures.push({ view: view.id, problem: `route ${id} follows a different path` });
    }
  }
  for (const id of renderedRoutes.keys()) {
    if (!storedRoutes.has(id)) failures.push({ view: view.id, problem: `route ${id} was invented by the render` });
  }

  // Every node must sit in the box the layout measured for it. The material plate is the reliable
  // anchor: the compiler emits one per node at exactly the box origin, whereas the outline itself
  // is a <rect> for some shapes and a <path> for others.
  const storedBoxes = [...stored.matchAll(/<image[^>]*x="([-0-9.]+)"[^>]*y="([-0-9.]+)"/g)].map(
    (m) => `${Number(m[1]).toFixed(1)},${Number(m[2]).toFixed(1)}`,
  );
  for (const [id, box] of Object.entries(view.layout.boxes)) {
    const key = `${box[0].toFixed(1)},${box[1].toFixed(1)}`;
    if (!storedBoxes.includes(key)) {
      failures.push({ view: view.id, problem: `node ${id} box ${key} does not appear in the stored diagram` });
    }
  }

  return failures;
}

function main() {
  if (!existsSync(STORED)) {
    console.log('Stored topology artifacts are absent; parity was verified before their removal. Skipping.');
    return;
  }

  const limitArg = process.argv.indexOf('--limit');
  const limit = limitArg >= 0 ? Number(process.argv[limitArg + 1]) : Number.POSITIVE_INFINITY;

  const failures: Failure[] = [];
  let compared = 0;
  let missing = 0;

  for (const file of readdirSync(BUNDLES)) {
    if (compared >= limit) break;
    const parsed = TopologyBundle.safeParse(JSON.parse(readFileSync(join(BUNDLES, file), 'utf8')));
    if (!parsed.success) {
      failures.push({ view: file, problem: 'bundle does not satisfy the topology contract' });
      continue;
    }
    for (const view of parsed.data.views) {
      if (compared >= limit) break;
      const stored = findStoredView(view.id);
      if (!stored) {
        missing += 1;
        continue;
      }
      failures.push(...compare(view, stored));
      compared += 1;
    }
  }

  console.log(`Compared ${compared} views against their stored diagrams (${missing} had no stored copy).`);
  if (failures.length === 0) {
    console.log('Identity and geometry parity holds for every compared view.');
    return;
  }
  console.error(`\n${failures.length} parity failures:`);
  for (const failure of failures.slice(0, 20)) console.error(`  ${failure.view}: ${failure.problem}`);
  process.exit(1);
}

main();
