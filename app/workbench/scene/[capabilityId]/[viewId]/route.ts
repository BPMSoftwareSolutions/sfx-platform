import { enabled } from '@/lib/workbench/server';
import { isCapabilityId, isViewId } from '@/lib/workbench/scene';
import { capabilityScene } from '@/lib/workbench/estate';

/* Serve one capability view as `circuit-scene.v1`, derived from selected
 * database authority by the estate service. The database is the only source;
 * there is no fallback to a compiled product. */
export async function GET(_request: Request, context: { params: Promise<{ capabilityId: string; viewId: string }> }) {
  if (!enabled()) return new Response(null, { status: 404 });
  const { capabilityId, viewId } = await context.params;
  if (!isCapabilityId(capabilityId) || !isViewId(viewId)) {
    return Response.json({ code: 'SCENE_IDENTITY_INVALID' }, { status: 400 });
  }
  try {
    const scene = await capabilityScene(capabilityId, viewId);
    if (!scene) return Response.json({ code: 'VIEW_IDENTITY_MISMATCH' }, { status: 409 });
    const refused = ((scene as { findings?: Array<{ severity: string }> }).findings ?? [])
      .filter(finding => finding.severity === 'error');
    if (refused.length) return Response.json({ code: 'SCENE_REFUSED', findings: refused }, { status: 422 });
    return Response.json({ scene, artifact: '' }, {
      headers: { 'content-type': 'application/json', 'cache-control': 'private, max-age=300' },
    });
  } catch (error) {
    const code = String((error as Error)?.message ?? '');
    if (code === 'SERVICE_UNCONFIGURED' || code === 'SERVICE_UNAVAILABLE') return Response.json({ code: 'SCENE_UNAVAILABLE' }, { status: 503 });
    return Response.json({ code: 'SCENE_UNAVAILABLE' }, { status: 404 });
  }
}
