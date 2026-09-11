/* Read the estate from the authoritative service, cached by snapshot.
 *
 * The workbench package carries no estate data. The catalogue and each
 * capability's circuits are derived by the estate service from the selected
 * database authority; this module calls that service and keeps the results
 * keyed by the snapshot they were derived from. A published snapshot is a new
 * key, so the cache never serves a circuit from a superseded authority.
 */
type Json = Record<string, unknown>;

async function callService(body: Json): Promise<Json> {
  const endpoint = process.env.SIDEFX_INVOCATION_ENDPOINT;
  const token = process.env.SIDEFX_SERVICE_TOKEN;
  if (!endpoint || !token) throw new Error('SERVICE_UNCONFIGURED');
  const response = await fetch(new URL('/commands', endpoint), {
    method: 'POST',
    headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
    body: JSON.stringify(body), cache: 'no-store', signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error('SERVICE_UNAVAILABLE');
  const payload = await response.json();
  if (payload.error) throw new Error(String(payload.error.code ?? 'SERVICE_REFUSED'));
  return payload.result as Json;
}

let catalogue: (Json & { snapshotId: string }) | null = null;
const circuits = new Map<string, Json>();

async function readCatalogue(): Promise<Json & { snapshotId: string }> {
  const result = await callService({ object: 'capability', operation: 'catalogue' });
  const next = result.catalogue as Json & { snapshotId: string };
  if (!catalogue || catalogue.snapshotId !== next.snapshotId) {
    // A new snapshot invalidates every circuit derived from the old one.
    circuits.clear();
    catalogue = next;
  }
  return catalogue;
}

export async function estateCatalogue() {
  const current = await readCatalogue();
  return { snapshotId: current.snapshotId, projectionDigest: current.projectionDigest, capabilities: current.capabilities };
}

export async function capabilityViews(capabilityId: string) {
  const current = await readCatalogue();
  const key = `${current.snapshotId}:${capabilityId}`;
  let record = circuits.get(key);
  if (!record) {
    const result = await callService({ object: 'capability', operation: 'circuit', subject: capabilityId });
    record = result.circuit as Json;
    circuits.set(key, record);
  }
  return record;
}

export async function capabilityScene(capabilityId: string, viewId: string) {
  const record = await capabilityViews(capabilityId);
  const views = (record.views ?? []) as Array<{ identities?: { viewId?: string } }>;
  return views.find(view => view.identities?.viewId === viewId) ?? null;
}
