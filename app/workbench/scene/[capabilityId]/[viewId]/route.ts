import { enabled } from '@/lib/workbench/server';
import { isCapabilityId, isViewId, lowerScene } from '@/lib/workbench/scene';

/* Serve one capability view as `circuit-scene.v1`.
 *
 * Preferred source: the selected database authority, derived by the estate
 * service through the same `capability circuit` operation invocation uses. The
 * circuit is a view of that authority, so no separately compiled product
 * participates.
 *
 * Transitional fallback: the estate's compiled topology under public/media,
 * for the legacy views whose catalogue identifiers were produced by that
 * compiler. It is removed when the workbench catalogue is derived from
 * authority (the two use different node-id schemes today).
 */
async function authorityCircuit(capabilityId: string) {
  const endpoint = process.env.SIDEFX_INVOCATION_ENDPOINT;
  const token = process.env.SIDEFX_SERVICE_TOKEN;
  if (!endpoint || !token) return null;
  try {
    const response = await fetch(new URL('/commands', endpoint), {
      method: 'POST',
      headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
      body: JSON.stringify({ object: 'capability', operation: 'circuit', subject: capabilityId }),
      cache: 'no-store', signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return null;
    return (await response.json())?.result?.circuit ?? null;
  } catch { return null; }
}

export async function GET(request: Request, context: { params: Promise<{ capabilityId: string; viewId: string }> }) {
  if (!enabled()) return new Response(null, { status: 404 });
  const { capabilityId, viewId } = await context.params;
  if (!isCapabilityId(capabilityId) || !isViewId(viewId)) {
    return Response.json({ code: 'SCENE_IDENTITY_INVALID' }, { status: 400 });
  }
  const headers = { 'content-type': 'application/json', 'cache-control': 'private, max-age=300' };

  const circuit = await authorityCircuit(capabilityId);
  if (circuit && circuit.identities?.viewId === viewId) {
    const refused = (circuit.findings ?? []).filter((f: { severity: string }) => f.severity === 'error');
    if (refused.length) return Response.json({ code: 'SCENE_REFUSED', findings: refused }, { status: 422 });
    return Response.json({ scene: circuit, artifact: '' }, { headers });
  }

  try {
    const { scene, artifact } = await lowerScene(capabilityId, viewId);
    const refused = scene.findings.filter(f => f.severity === 'error');
    if (refused.length) {
      return Response.json({ code: 'SCENE_REFUSED', findings: refused }, { status: 422 });
    }
    return Response.json({ scene, artifact }, { headers });
  } catch (error) {
    const code = String((error as Error)?.message ?? '');
    if (code === 'VIEW_IDENTITY_MISMATCH') return Response.json({ code }, { status: 409 });
    if (code === 'VIEW_OUTSIDE_PRODUCTS') return Response.json({ code: 'SCENE_IDENTITY_INVALID' }, { status: 400 });
    return Response.json({ code: 'SCENE_UNAVAILABLE' }, { status: 404 });
  }
}
