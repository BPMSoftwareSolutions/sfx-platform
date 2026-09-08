import { renderTopologySvg } from '@/components/topology/render-topology';
import { getTopologyViews } from '@/lib/topology';

/**
 * On-demand topology rendering — ADR 0001.
 *
 * The capability page server-renders its primary view only; §12.4 requires large graphs to load at
 * capability/scenario scope with drill-down rather than shipping the whole estate. Additional
 * views are rendered here, per request, from the same validated bundle and the same component.
 *
 * This is the endpoint that makes "generated dynamically" true: the SVG is produced from graph
 * data at request time and is never stored.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ capabilityId: string; viewId: string }> },
) {
  const { capabilityId, viewId } = await params;

  const view = getTopologyViews(capabilityId).find((candidate) => candidate.id === viewId);
  if (!view) {
    return new Response('Unknown topology view', { status: 404 });
  }

  const svg = renderTopologySvg(view);

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      // The graph digest identifies the exact content, so the render is safely cacheable.
      ETag: `"${view.graphDigest}"`,
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  });
}
