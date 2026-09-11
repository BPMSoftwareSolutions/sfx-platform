import { enabled } from '@/lib/workbench/server';
import { isCapabilityId } from '@/lib/workbench/scene';
import { capabilityViews } from '@/lib/workbench/estate';

/* A capability's circuits, derived from selected database authority. Every
 * declared scenario in its closure becomes a view carrying a full
 * `circuit-scene.v1`, so the workbench needs one request per capability and no
 * packaged scene. */
export async function GET(_request: Request, context: { params: Promise<{ capabilityId: string }> }) {
  if (!enabled()) return new Response(null, { status: 404 });
  const { capabilityId } = await context.params;
  if (!isCapabilityId(capabilityId)) return Response.json({ code: 'SCENE_IDENTITY_INVALID' }, { status: 400 });
  try {
    const record = await capabilityViews(capabilityId);
    return Response.json({ snapshotId: record.snapshotId, capabilityId, views: record.views }, {
      headers: { 'content-type': 'application/json', 'cache-control': 'private, max-age=300' },
    });
  } catch (error) {
    const code = String((error as Error)?.message ?? '');
    if (code === 'SERVICE_UNCONFIGURED' || code === 'SERVICE_UNAVAILABLE') return Response.json({ code: 'SCENE_UNAVAILABLE' }, { status: 503 });
    return Response.json({ code: 'SCENE_UNAVAILABLE' }, { status: 404 });
  }
}
