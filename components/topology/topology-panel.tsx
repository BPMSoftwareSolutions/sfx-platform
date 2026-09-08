import type { TopologyView } from '@/contracts/topology';

import { NODE_GRAMMAR, routeLabel } from './grammar';
import { renderTopologySvg } from './render-topology';
import type { TraceGraph } from './plan-trace';
import { TopologyWorkbench, type OutlineEntry, type WorkbenchPanel } from './topology-workbench';

/**
 * Server-side entry point for the topology workbench — ADR 0001.
 *
 * Renders each view's SVG here, on the server, and hands the workbench shell the inspector and
 * playback data it needs. The diagram is therefore in the page HTML, and the graph is sent once
 * as an outline rather than as a second full copy.
 */

/** Readable name per projection, matching the retired viewer's grouping. */
export const VIEW_KIND_NAMES: Record<TopologyView['kind'], string> = {
  blueprint: 'Blueprint authority',
  operations: 'Declared operation flow',
  native: 'Native execution graph',
  expression: 'Mechanic dependencies',
};

function outlineForNodes(view: TopologyView): OutlineEntry[] {
  return view.nodes.map((node) => ({
    id: node.id,
    kind: NODE_GRAMMAR[node.kind].label,
    label: node.label,
    // Some components declare a responsibility; it is the better caption when present.
    detail: (typeof node.facts.responsibility === 'string' ? node.facts.responsibility : node.detail) || '',
    identity: node.identity,
    sourceLabel: node.source.label,
    sourceKind: node.source.kind,
    sourceSha: node.source.sha256,
    sourcePointer: node.source.pointer,
    facts: JSON.stringify({ identity: node.identity, ...node.facts }, null, 2),
  }));
}

function outlineForRoutes(view: TopologyView): OutlineEntry[] {
  return view.routes.map((route) => ({
    id: route.id,
    kind: routeLabel(route.kind),
    label: route.label,
    detail: '',
    identity: route.identity,
    sourceLabel: route.provenance.label,
    sourceKind: route.provenance.kind,
    sourceSha: route.provenance.sha256,
    sourcePointer: route.provenance.pointer,
    facts: JSON.stringify({ identity: route.identity, ...route.facts }, null, 2),
    source: route.source,
    target: route.target,
  }));
}

/** Strips a view down to what playback needs, so labels and provenance stay on the server. */
function traceGraph(view: TopologyView): TraceGraph {
  return {
    kind: view.kind,
    nodes: view.nodes.map((n) => ({ id: n.id, kind: n.kind })),
    routes: view.routes.map((r) => ({ id: r.id, source: r.source, target: r.target, kind: r.kind })),
    boxes: view.layout.boxes,
    width: view.layout.width,
    height: view.layout.height,
  };
}

function coverageLine(view: TopologyView): string {
  const omitted = Number((view.analytics as Record<string, unknown>).omittedSourceNodes ?? 0);
  return `${view.nodes.length} components · ${view.routes.length} routes · ${omitted} source components omitted`;
}

function findingsLine(view: TopologyView): string {
  return view.findings
    .map((finding) => {
      const f = finding as Record<string, unknown>;
      return [f.code, f.identity].filter(Boolean).join(': ');
    })
    .filter(Boolean)
    .join(' · ');
}

export function TopologyPanel({
  views,
  label,
  capabilityId,
}: {
  views: TopologyView[];
  label: string;
  capabilityId: string;
}) {
  if (views.length === 0) return null;

  // Most detailed view first: it is the one server-rendered into the page, and the one a reader
  // without JavaScript gets. The rest render on demand (§12.4 drill-down).
  const ordered = [...views].sort(
    (a, b) => b.nodes.length - a.nodes.length || a.id.localeCompare(b.id),
  );

  const panels: WorkbenchPanel[] = ordered.map((view, index) => ({
    id: view.id,
    label: view.label,
    viewKind: view.kind,
    viewKindName: VIEW_KIND_NAMES[view.kind],
    sourceKind: view.source.kind,
    graphDigest: view.graphDigest,
    nodeCount: view.nodes.length,
    routeCount: view.routes.length,
    coverage: coverageLine(view),
    findings: findingsLine(view),
    width: view.layout.width,
    height: view.layout.height,
    outline: outlineForNodes(view),
    routes: outlineForRoutes(view),
    href: `/api/topology/${encodeURIComponent(capabilityId)}/${encodeURIComponent(view.id)}`,
    downloadName: `${capabilityId}-${view.id}.svg`,
    svg: index === 0 ? renderTopologySvg(view) : undefined,
    view: traceGraph(view),
  }));

  return <TopologyWorkbench panels={panels} label={label} />;
}
