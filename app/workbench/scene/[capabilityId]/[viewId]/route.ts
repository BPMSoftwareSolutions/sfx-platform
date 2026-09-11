import { enabled } from '@/lib/workbench/server';
import { isCapabilityId, isViewId } from '@/lib/workbench/scene';

/* Serve one capability view as `circuit-scene.v1`.
 *
 * The circuit is derived from the selected database authority by the estate
 * service, through the same `capability circuit` operation invocation uses. The
 * database is the only source: no separately compiled product participates, and
 * there is no fallback to one.
 */
async function authorityCircuit(capabilityId: string, viewId: string) {
  const endpoint = process.env.SIDEFX_INVOCATION_ENDPOINT;
  const token = process.env.SIDEFX_SERVICE_TOKEN;
  if (!endpoint || !token) return { response: Response.json({ code: 'SCENE_UNAVAILABLE' }, { status: 503 }) };
  try {
    const response = await fetch(new URL('/commands', endpoint), {
      method: 'POST',
      headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
      body: JSON.stringify({ object: 'capability', operation: 'circuit', subject: capabilityId }),
      cache: 'no-store', signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return { response: Response.json({ code: 'SCENE_UNAVAILABLE' }, { status: 404 }) };
    const circuit = (await response.json())?.result?.circuit;
    if (!circuit || circuit.identities?.viewId !== viewId) {
      return { response: Response.json({ code: 'VIEW_IDENTITY_MISMATCH' }, { status: 409 }) };
    }
    const refused = (circuit.findings ?? []).filter((finding: { severity: string }) => finding.severity === 'error');
    if (refused.length) return { response: Response.json({ code: 'SCENE_REFUSED', findings: refused }, { status: 422 }) };
    return { circuit };
  } catch {
    return { response: Response.json({ code: 'SCENE_UNAVAILABLE' }, { status: 503 }) };
  }
}

export async function GET(_request: Request, context: { params: Promise<{ capabilityId: string; viewId: string }> }) {
  if (!enabled()) return new Response(null, { status: 404 });
  const { capabilityId, viewId } = await context.params;
  if (!isCapabilityId(capabilityId) || !isViewId(viewId)) {
    return Response.json({ code: 'SCENE_IDENTITY_INVALID' }, { status: 400 });
  }
  const result = await authorityCircuit(capabilityId, viewId);
  if (result.response) return result.response;
  return Response.json({ scene: result.circuit, artifact: '' }, {
    headers: { 'content-type': 'application/json', 'cache-control': 'private, max-age=300' },
  });
}
