import { enabled } from '@/lib/workbench/server';
import { isCapabilityId, isViewId, lowerScene } from '@/lib/workbench/scene';

/* Serve one capability view as `circuit-scene.v1`.
 *
 * The topology products under public/ are what the website already renders. The
 * workbench needs the same graphs in its own contract, so the lowering happens
 * here: the browser receives a resolved scene rather than a product it would
 * have to interpret, and the screening that rejects scripts, inline handlers and
 * unapproved references runs before any of it reaches a page.
 *
 * A scene whose screening fails is refused outright. Returning the graph without
 * its artifact would leave a diagram that cannot be drawn, and returning the
 * artifact anyway would defeat the screening.
 *
 * No session is required. The compiled products this reads are already served
 * publicly under /media/library, so gating a lowering of them would not withhold
 * anything — it would only stop the workbench drawing a circuit before anyone
 * has invoked anything. Invocation is what carries a session, and that is on the
 * run routes, where the capability actually executes.
 */
export async function GET(request: Request, context: { params: Promise<{ capabilityId: string; viewId: string }> }) {
  if (!enabled()) return new Response(null, { status: 404 });
  const { capabilityId, viewId } = await context.params;
  if (!isCapabilityId(capabilityId) || !isViewId(viewId)) {
    return Response.json({ code: 'SCENE_IDENTITY_INVALID' }, { status: 400 });
  }

  try {
    const { scene, artifact } = await lowerScene(capabilityId, viewId);
    const refused = scene.findings.filter(f => f.severity === 'error');
    if (refused.length) {
      return Response.json({ code: 'SCENE_REFUSED', findings: refused }, { status: 422 });
    }
    return Response.json({ scene, artifact }, {
      headers: {
        'content-type': 'application/json',
        /* A compiled view is immutable for the snapshot that produced it, and
         * its identity is in the path, so it may be cached by the browser. */
        'cache-control': 'private, max-age=300',
      },
    });
  } catch (error) {
    const code = String((error as Error)?.message ?? '');
    if (code === 'VIEW_IDENTITY_MISMATCH') return Response.json({ code }, { status: 409 });
    if (code === 'VIEW_OUTSIDE_PRODUCTS') return Response.json({ code: 'SCENE_IDENTITY_INVALID' }, { status: 400 });
    return Response.json({ code: 'SCENE_UNAVAILABLE' }, { status: 404 });
  }
}
