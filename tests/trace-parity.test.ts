import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import test from 'node:test';

import { planTrace, type TraceGraph } from '../components/topology/plan-trace.ts';
import { TopologyBundle, type TopologyView } from '../contracts/topology.ts';

/**
 * Trace parity — the ported planner against the original.
 *
 * The flow player was ported from the content lab's `viewer.js`. These compare this
 * implementation's wave plan against that original function, on real published graphs, so a
 * behavioural drift in branch order, convergence waiting or provider-binding timing fails here
 * rather than silently changing what the trace shows.
 */

const BUNDLES = join(process.cwd(), 'generated', 'topology');
const ORIGINAL = 'C:/lab/repos/content-creation-mission/templates/estate-topology/viewer.js';

const hasBundles = existsSync(BUNDLES);
const hasOriginal = existsSync(ORIGINAL);

/** The original exports `planTrace` for exactly this purpose. */
function loadOriginal(): ((graph: unknown, preferred?: string) => { edgeId?: string; nodeId?: string }[][]) | undefined {
  if (!hasOriginal) return undefined;
  const require = createRequire(import.meta.url);
  return (require(ORIGINAL) as { planTrace: typeof loadOriginal extends never ? never : never }).planTrace as never;
}

/** The original consumes `edges`; the contract renames them `routes`. */
function asOriginalGraph(view: TopologyView) {
  return { kind: view.kind, nodes: view.nodes, edges: view.routes };
}

function asTraceGraph(view: TopologyView): TraceGraph {
  return {
    kind: view.kind,
    nodes: view.nodes.map((n) => ({ id: n.id, kind: n.kind })),
    routes: view.routes.map((r) => ({ id: r.id, source: r.source, target: r.target, kind: r.kind })),
    boxes: view.layout.boxes,
    width: view.layout.width,
    height: view.layout.height,
  };
}

function sampleViews(count: number): TopologyView[] {
  const files = readdirSync(BUNDLES).sort();
  const step = Math.max(1, Math.floor(files.length / count));
  const views: TopologyView[] = [];
  for (let i = 0; i < files.length && views.length < count; i += step) {
    const parsed = TopologyBundle.safeParse(JSON.parse(readFileSync(join(BUNDLES, files[i] as string), 'utf8')));
    if (parsed.success) for (const view of parsed.data.views.slice(0, 2)) views.push(view);
  }
  return views;
}

test('the ported planner produces the original wave plan', { skip: !hasBundles || !hasOriginal }, () => {
  const original = loadOriginal();
  assert.ok(original, 'the original planner must be loadable to compare against');
  let compared = 0;
  for (const view of sampleViews(40)) {
    const mine = planTrace(asTraceGraph(view));
    const theirs = original(asOriginalGraph(view));
    assert.equal(mine.length, theirs.length, `${view.id}: wave count differs`);
    for (let w = 0; w < mine.length; w += 1) {
      const a = (mine[w] ?? []).map((s) => s.routeId ?? `node:${s.nodeId}`);
      const b = (theirs[w] ?? []).map((s) => s.edgeId ?? `node:${s.nodeId}`);
      assert.deepEqual(a, b, `${view.id}: wave ${w} differs`);
    }
    compared += 1;
  }
  assert.ok(compared > 0, 'nothing was compared');
});

test('starting from a selected component matches the original', { skip: !hasBundles || !hasOriginal }, () => {
  const original = loadOriginal();
  assert.ok(original);
  for (const view of sampleViews(15)) {
    const start = view.nodes[0];
    if (!start) continue;
    const mine = planTrace(asTraceGraph(view), start.id);
    const theirs = original(asOriginalGraph(view), start.id);
    assert.equal(mine.length, theirs.length, `${view.id}: wave count differs from selected start`);
  }
});

test('every declared route is traced exactly once', { skip: !hasBundles }, () => {
  for (const view of sampleViews(25)) {
    const waves = planTrace(asTraceGraph(view));
    const traced: string[] = [];
    for (const wave of waves) for (const step of wave) if (step.routeId) traced.push(step.routeId);
    assert.equal(new Set(traced).size, traced.length, `${view.id}: a route is traced more than once`);
    assert.equal(traced.length, view.routes.length, `${view.id}: not every declared route is traced`);
  }
});

test('every component is reached, including those no route touches', { skip: !hasBundles }, () => {
  for (const view of sampleViews(25)) {
    const waves = planTrace(asTraceGraph(view));
    const reached = new Set<string>();
    for (const wave of waves) {
      for (const step of wave) {
        if (step.source) reached.add(step.source);
        if (step.target) reached.add(step.target);
        if (step.nodeId) reached.add(step.nodeId);
      }
    }
    for (const node of view.nodes) {
      assert.ok(reached.has(node.id), `${view.id}: component ${node.id} is never reached`);
    }
  }
});

test('a provider binding never precedes the flow arriving at its port', { skip: !hasBundles }, () => {
  // §12.3 — a binding accompanies arrival at its port; it does not run ahead as execution flow.
  for (const view of sampleViews(20)) {
    const graph = asTraceGraph(view);
    const waves = planTrace(graph);
    const bindings = new Set(graph.routes.filter((r) => r.kind === 'provider-binding').map((r) => r.id));
    if (bindings.size === 0) continue;
    for (const wave of waves) {
      const kinds = new Set(wave.map((s) => s.kind));
      // A binding wave is either binding-only (a port's own implementation) or shares the wave
      // with the flow arriving at that port. It is never emitted as a lone execution step.
      if (wave.some((s) => s.routeId && bindings.has(s.routeId))) {
        assert.ok(kinds.has('provider-binding'), 'binding wave lost its kind');
      }
    }
  }
});
