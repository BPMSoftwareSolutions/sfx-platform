import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

/**
 * Route and phase checks — §4 phase rule, §8.3.
 *
 * A P1 page may describe planned work as text, but it may never link to a destination that does
 * not exist. These read the registry as source text so no build step is required.
 */

const ROOT = join(import.meta.dirname, '..');
const registry = readFileSync(join(ROOT, 'lib', 'routes.ts'), 'utf8');

/** Parses the registry's `key: { href, phase, available, indexable }` entries. */
function parseRoutes() {
  const routes = new Map();
  const pattern =
    /(\w+):\s*\{\s*href:\s*'([^']+)',\s*label:\s*'[^']*',\s*phase:\s*'(P\d)',\s*available:\s*(true|false),\s*indexable:\s*(true|false)/g;
  let match;
  while ((match = pattern.exec(registry)) !== null) {
    routes.set(match[1], {
      href: match[2],
      phase: match[3],
      available: match[4] === 'true',
      indexable: match[5] === 'true',
    });
  }
  return routes;
}

const routes = parseRoutes();

test('the registry parses', () => {
  assert.ok(routes.size > 20, `expected the full route registry, found ${routes.size}`);
});

test('every available route has a page on disk', () => {
  for (const [key, route] of routes) {
    if (!route.available) continue;
    // The redirect-only path has no page by design.
    if (route.href === '/mcp') continue;
    const segments = route.href === '/' ? [] : route.href.slice(1).split('/');
    const file = join(ROOT, 'app', ...segments, 'page.tsx');
    assert.ok(existsSync(file), `${key} (${route.href}) is available but has no page at ${file}`);
  }
});

test('no unavailable route has a page that would silently work', () => {
  for (const [key, route] of routes) {
    if (route.available) continue;
    const segments = route.href.slice(1).split('/');
    const file = join(ROOT, 'app', ...segments, 'page.tsx');
    assert.ok(
      !existsSync(file),
      `${key} (${route.href}) is marked unavailable but a page exists; flip it to available`,
    );
  }
});

test('P2 and P3 routes are not marked available', () => {
  for (const [key, route] of routes) {
    if (route.phase !== 'P1') {
      assert.equal(route.available, false, `${key} is ${route.phase} but marked available`);
    }
  }
});

test('private routes are never indexable', () => {
  for (const [key, route] of routes) {
    if (/^\/(workspace|sign-in|auth)/.test(route.href)) {
      assert.equal(route.indexable, false, `${key} is a private route and must not be indexable`);
    }
  }
});

test('no page links to an unavailable route', () => {
  const unavailable = [...routes.values()].filter((r) => !r.available).map((r) => r.href);
  const pages = collectSourceFiles(join(ROOT, 'app')).concat(collectSourceFiles(join(ROOT, 'components')));
  for (const page of pages) {
    const source = readFileSync(page, 'utf8');
    for (const href of unavailable) {
      // A hard-coded href to an unavailable destination is a dead link.
      assert.ok(
        !source.includes(`href="${href}"`) && !source.includes(`href={'${href}'}`),
        `${page} links directly to unavailable route ${href}`,
      );
    }
  }
});

function collectSourceFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...collectSourceFiles(full));
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}
