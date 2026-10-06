// Integration checks for the capability details reading against a running
// circuit host. Reads only; supply capability identities as test inputs.
//   node verify-capability-details.mjs <base-url> <evidence-output> <capabilityId>... [--failing <capabilityId>]
// A --failing capability is one whose reading is known to fail in the estate; it
// must be refused visibly (an error code), never served as an empty document.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
const args = process.argv.slice(2), failingAt = args.indexOf('--failing');
const failing = failingAt >= 0 ? args.splice(failingAt, 2)[1] : null;
const [base, output, ...capabilities] = args;
assert(base && output && capabilities.length, 'Supply base URL, evidence output, and capability IDs');
async function request(path, headers = {}) {
  const started = Date.now(), response = await fetch(new URL(path, base), { headers });
  const text = response.status === 304 ? '' : await response.text();
  return { response, body: text ? JSON.parse(text) : null, ms: Date.now() - started, bytes: Buffer.byteLength(text) };
}
const evidence = { base, readings: [], refusals: [] };
for (const capabilityId of capabilities) {
  const path = `/api/circuit/v1/capability-details?${new URLSearchParams({ capabilityId, namespaceId: 'sidefx:capabilities' })}`;
  const { response, body, ms, bytes } = await request(path);
  assert.equal(response.status, 200, `${capabilityId}: ${JSON.stringify(body)}`);
  assert.equal(body.contractId, 'capability-details.v1'); assert.equal(body.status, 'READ');
  assert.equal(body.capabilityId, capabilityId); assert.equal(body.source, 'database');
  assert.match(body.readingDefinitionSha256, /^[a-f0-9]{64}$/);
  const sets = Object.keys(body.sets), navigation = body.sets.capability_navigation;
  assert.equal(sets.at(-1), 'capability_navigation', 'Navigation is the last set of the reading');
  const policy = navigation.find(row => row.row_kind === 'POLICY');
  assert.equal(policy?.state, 'RESOLVED', 'The declared navigation policy must resolve');
  const coverage = navigation.filter(row => row.row_kind === 'COVERAGE');
  assert.equal(coverage.length, 0, `Coverage violations: ${coverage.map(row => row.check_key).join(', ')}`);
  // Each navigated set's census count must equal the rows the document carries.
  for (const node of navigation.filter(row => row.row_kind === 'NODE' && row.rows_emitted != null && body.sets[row.source_result_set]))
    assert.equal(body.sets[node.source_result_set].length, node.rows_emitted, `${node.node} count`);
  const etag = response.headers.get('etag'); assert(etag);
  const cached = await request(path, { 'if-none-match': etag }); assert.equal(cached.response.status, 304);
  evidence.readings.push({ capabilityId, sets: sets.length, navigationRows: navigation.length,
    nodes: navigation.filter(row => row.row_kind === 'NODE').length, scenarios: navigation.filter(row => row.row_kind === 'SCENARIO').length,
    readingDefinitionSha256: body.readingDefinitionSha256, capabilityVersionPk: body.capabilityVersionPk, bytes, ms });
}
for (const [query, status, code] of [
  [{ capabilityId: 'no-such-capability-for-details' }, 404, 'CAPABILITY_NOT_FOUND'],
  [{ capabilityId: capabilities[0], namespaceId: 'sidefx:not-this-namespace' }, 409, 'CAPABILITY_NAMESPACE_MISMATCH'],
  [{}, 400, 'CAPABILITY_REQUIRED'],
  ...(failing ? [[{ capabilityId: failing }, 422, null]] : [])
]) {
  const { response, body } = await request(`/api/circuit/v1/capability-details?${new URLSearchParams(query)}`);
  assert.equal(response.status, status, JSON.stringify({ query, body }));
  assert.match(body.error ?? '', /^[A-Z0-9_]+$/); if (code) assert.equal(body.error, code);
  assert(!('sets' in body), 'A refusal never carries sets');
  evidence.refusals.push({ query, status: response.status, error: body.error });
}
await writeFile(output, JSON.stringify({ checkedAt: new Date().toISOString(), ...evidence }, null, 2) + '\n');
console.log(JSON.stringify(evidence));
