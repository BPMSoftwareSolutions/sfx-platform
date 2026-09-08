import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { renderTopologySvg, wrapLabel } from '../components/topology/render-topology.ts';
import { NODE_GRAMMAR, routeHasArrow, routeIsDashed } from '../components/topology/grammar.ts';
import { TopologyBundle, TopologyNodeKind, type TopologyView } from '../contracts/topology.ts';

/**
 * On-demand topology rendering — ADR 0001.
 *
 * These guard the properties the retired iframe delivery could not be tested for: that every
 * published view satisfies the contract, that the renderer draws exactly the declared graph, and
 * that it never invents a component or a connection.
 */

const BUNDLES = join(process.cwd(), 'generated', 'topology');
const hasBundles = existsSync(BUNDLES);

/** A deterministic spread of bundles rather than the first few alphabetically. */
function sampleViews(count: number): TopologyView[] {
  const files = readdirSync(BUNDLES).sort();
  const step = Math.max(1, Math.floor(files.length / count));
  const views: TopologyView[] = [];
  for (let i = 0; i < files.length && views.length < count; i += step) {
    const parsed = TopologyBundle.safeParse(JSON.parse(readFileSync(join(BUNDLES, files[i] as string), 'utf8')));
    if (parsed.success && parsed.data.views[0]) views.push(parsed.data.views[0]);
  }
  return views;
}

test('every published topology bundle satisfies the contract', { skip: !hasBundles }, () => {
  let views = 0;
  for (const file of readdirSync(BUNDLES)) {
    const parsed = TopologyBundle.safeParse(JSON.parse(readFileSync(join(BUNDLES, file), 'utf8')));
    assert.ok(parsed.success, `${file} does not satisfy the topology contract`);
    views += parsed.data.views.length;
  }
  assert.ok(views > 0, 'a publication with no views is not a publication');
});

test('the renderer draws every declared component and route', { skip: !hasBundles }, () => {
  for (const view of sampleViews(25)) {
    const svg = renderTopologySvg(view);
    for (const node of view.nodes) {
      // A node without measured geometry is legitimately omitted; one with it must be drawn.
      if (view.layout.boxes[node.id]) {
        assert.ok(svg.includes(`data-entity="${node.id}"`), `${view.id}: node ${node.id} was not drawn`);
      }
    }
    for (const route of view.routes) {
      if (view.layout.routes[route.id]) {
        assert.ok(svg.includes(`data-route="${route.id}"`), `${view.id}: route ${route.id} was not drawn`);
      }
    }
  }
});

test('the renderer invents no component or connection', { skip: !hasBundles }, () => {
  for (const view of sampleViews(25)) {
    const svg = renderTopologySvg(view);
    const nodeIds = new Set(view.nodes.map((n) => n.id));
    const routeIds = new Set(view.routes.map((r) => r.id));
    for (const [, id] of svg.matchAll(/data-entity="([^"]+)"/g)) {
      assert.ok(nodeIds.has(id), `${view.id}: drew node ${id} which the graph does not declare`);
    }
    for (const [, id] of svg.matchAll(/data-route="([^"]+)"/g)) {
      assert.ok(routeIds.has(id), `${view.id}: drew route ${id} which the graph does not declare`);
    }
  }
});

test('a route with no measured geometry is omitted, never guessed', { skip: !hasBundles }, () => {
  const view = sampleViews(1)[0];
  assert.ok(view);
  const route = view.routes[0];
  assert.ok(route);
  const stripped: TopologyView = {
    ...view,
    layout: { ...view.layout, routes: Object.fromEntries(Object.entries(view.layout.routes).filter(([id]) => id !== route.id)) },
  };
  const svg = renderTopologySvg(stripped);
  assert.ok(!svg.includes(`data-route="${route.id}"`), 'a route without geometry must not be drawn');
});

test('every node carries a name and a keyboard-reachable role', { skip: !hasBundles }, () => {
  for (const view of sampleViews(10)) {
    const svg = renderTopologySvg(view);
    for (const [, group] of svg.matchAll(/<g ([^>]*data-entity="[^"]+"[^>]*)>/g)) {
      assert.match(group, /role="button"/, 'a component must expose a role');
      assert.match(group, /tabindex="0"/, 'a component must be keyboard reachable');
      assert.match(group, /aria-label="[^"]+"/, 'a component must carry an accessible name');
    }
  }
});

test('a support link is never drawn as execution flow', () => {
  // §12.3 — a provider binding is a relationship, not a route the capability proceeds along.
  assert.equal(routeHasArrow('provider-binding'), false);
  assert.equal(routeIsDashed('provider-binding'), true);
  assert.equal(routeHasArrow('operation-order'), true);
  assert.equal(routeIsDashed('operation-order'), false);
});

test('every node kind in the contract has a grammar entry', () => {
  for (const kind of TopologyNodeKind.options) {
    const grammar = NODE_GRAMMAR[kind];
    assert.ok(grammar, `${kind} has no grammar entry`);
    assert.ok(grammar.label.length > 0, `${kind} must carry a word, not only a color`);
    assert.match(grammar.texture, /^\/media\/[\w./-]+\.webp$/);
  }
});

test('an unresolved reference is labelled as itself, not as a rejection', () => {
  // §12.2 — an unresolved slot must never read as a declared outcome of any kind.
  assert.notEqual(NODE_GRAMMAR.unresolved.label, NODE_GRAMMAR.rejection.label);
  assert.match(NODE_GRAMMAR.unresolved.label, /unresolved/i);
});

test('label wrapping is deterministic and marks truncation', () => {
  const text = 'the requested company quote is retrieved and validated against its declared contract';
  assert.deepEqual(wrapLabel(text, 200, 17, 3), wrapLabel(text, 200, 17, 3));
  const clipped = wrapLabel(text, 90, 17, 1);
  assert.equal(clipped.length, 1);
  assert.match(clipped[0] as string, /…$/, 'a truncated label must say so');
});

test('rendered markup escapes text rather than trusting it', () => {
  const view = sampleViews(1)[0];
  assert.ok(view);
  const hostile: TopologyView = {
    ...view,
    label: '</title><script>alert(1)</script>',
    nodes: view.nodes.map((n) => ({ ...n, label: '"><script>alert(2)</script>' })),
  };
  const svg = renderTopologySvg(hostile);
  assert.ok(!svg.includes('<script>'), 'text content must be escaped before it reaches the page');
});
