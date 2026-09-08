

/**
 * Trace planning — ported from the retired `templates/estate-topology/viewer.js`.
 *
 * A finite inspection of every declared route, including all branch alternatives. Each route is
 * visited once; cycles are illustrated once, never executed. The semantics are preserved exactly
 * as the content lab wrote them, including the provider-binding timing fix:
 *
 *  - a root or selected port needs its implementation binding before it continues;
 *  - incoming flow and the corresponding provider binding arrive at the port together;
 *  - a binding does not activate other ports that happen to share the same provider.
 *
 * This is illustrative flow (§12.4). It shows declared order; it is not observed execution and it
 * invokes no provider.
 */

/**
 * The minimum the planner and player need. Deliberately excludes labels, provenance and facts:
 * the largest view carries 1,493 components, and sending the whole graph to the client for
 * playback would undo the payload discipline the on-demand renderer exists for.
 */
export interface TraceGraph {
  kind: string;
  nodes: { id: string; kind: string }[];
  routes: { id: string; source: string; target: string; kind: string }[];
  boxes: Record<string, [number, number, number, number]>;
  width: number;
  height: number;
}

export interface TraceStep {
  /** Set when this step travels a route. */
  routeId?: string;
  source?: string;
  target?: string;
  kind?: string;
  /** Set instead when this step reveals a component no route reaches. */
  nodeId?: string;
}

/** Each wave is a set of steps that animate simultaneously. */
export type TraceWave = TraceStep[];

export function planTrace(view: TraceGraph, preferred?: string): TraceWave[] {
  const visited = new Set<string>();
  const reached = new Set<string>();
  const waves: TraceWave[] = [];

  const flow = view.routes.filter((r) => r.kind !== 'provider-binding');
  const bindings = view.routes.filter((r) => r.kind === 'provider-binding');

  const byPort = new Map<string, typeof bindings>();
  for (const route of bindings) {
    if (!byPort.has(route.target)) byPort.set(route.target, []);
    byPort.get(route.target)?.push(route);
  }
  const portBindings = (ids: string[]) =>
    [...new Set(ids)].flatMap((id) => (byPort.get(id) ?? []).filter((r) => !visited.has(r.id)));

  const appendWave = (routes: typeof flow) => {
    if (!routes.length) return;
    for (const route of routes) {
      visited.add(route.id);
      reached.add(route.source);
      reached.add(route.target);
    }
    waves.push(routes.map((r) => ({ routeId: r.id, source: r.source, target: r.target, kind: r.kind })));
  };

  const nodes = new Map(view.nodes.map((n) => [n.id, n]));
  const out = new Map<string, typeof flow>();
  const required = new Map<string, typeof flow>();
  const targets = new Set<string>();

  for (const route of flow) {
    if (!out.has(route.source)) out.set(route.source, []);
    out.get(route.source)?.push(route);
    targets.add(route.target);
    const isRequirement =
      route.kind === 'CONVERGENCE_REQUIREMENT' ||
      (view.kind === 'expression' && ['argument-dependency', 'conditional-argument'].includes(route.kind));
    if (isRequirement) {
      if (!required.has(route.target)) required.set(route.target, []);
      required.get(route.target)?.push(route);
    }
  }

  const outgoing = (id: string) => (out.get(id) ?? []).filter((r) => !visited.has(r.id));

  /** A convergence waits for the arrivals its policy requires (§12.3). */
  const eligible = (id: string) => {
    const node = nodes.get(id);
    const requirements = required.get(id) ?? [];
    return (
      (node?.kind !== 'convergence' && view.kind !== 'expression') ||
      requirements.every((r) => visited.has(r.id))
    );
  };

  const activate = (id: string, next: typeof flow) => {
    if (!eligible(id)) return;
    for (const route of outgoing(id)) if (!next.some((r) => r.id === route.id)) next.push(route);
  };

  const roots = view.nodes.filter((n) => !targets.has(n.id));
  const start = preferred ?? roots.find((n) => outgoing(n.id).length)?.id ?? view.nodes[0]?.id;

  let frontier: typeof flow = [];
  if (preferred && start) activate(start, frontier);
  else for (const root of roots) activate(root.id, frontier);

  let remainingFlow = flow.length;
  while (remainingFlow) {
    if (!frontier.length) {
      const next =
        flow.find((r) => !visited.has(r.id) && eligible(r.source) && reached.has(r.source)) ??
        flow.find((r) => !visited.has(r.id) && eligible(r.source)) ??
        flow.find((r) => !visited.has(r.id));
      if (!next) break;
      activate(next.source, frontier);
      if (!frontier.length) frontier.push(next);
    }
    const batch = frontier.filter((r) => !visited.has(r.id));
    frontier = [];
    if (!batch.length) continue;

    // A root or selected port needs its implementation binding before it continues.
    appendWave(portBindings(batch.map((r) => r.source)));
    // Incoming flow and the corresponding provider binding arrive at the port together.
    appendWave([...batch, ...portBindings(batch.map((r) => r.target))]);

    remainingFlow -= batch.length;
    for (const route of batch) activate(route.target, frontier);
  }

  // Binding-only components have no flow arrival to accompany.
  appendWave(bindings.filter((r) => !visited.has(r.id)));
  // A component no route reaches is still shown, so the trace covers the whole graph.
  for (const node of view.nodes) if (!reached.has(node.id)) waves.push([{ nodeId: node.id }]);

  return waves;
}

/** Total routes and components a plan will visit, for the status line. */
export function traceCoverage(waves: TraceWave[]) {
  const routes = new Set<string>();
  const nodes = new Set<string>();
  for (const wave of waves) {
    for (const step of wave) {
      if (step.routeId) {
        routes.add(step.routeId);
        if (step.source) nodes.add(step.source);
        if (step.target) nodes.add(step.target);
      } else if (step.nodeId) nodes.add(step.nodeId);
    }
  }
  return { routes: routes.size, nodes: nodes.size };
}
