import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const origin = process.argv[2] ?? 'http://127.0.0.1:3010';
const service = process.argv[3];
const read = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const publication = await read('generated/lab-publication.json');
const pointer = await read('../sfx-embody/evidence/hugging-face-pilots/latest.json');
const qualification = await read(pointer.summary);
const output = path.join('artifacts/lab', 'verification-' + new Date().toISOString().replaceAll(':', '-'));
await fs.mkdir(output, { recursive: true });
const cases = [];
const post = async body => {
  const response = await fetch(origin + '/lab/commands', { method: 'POST', headers: { 'content-type': 'application/json', origin }, body: JSON.stringify(body) });
  assert.equal(response.status, 200); return response.json();
};
const at = (value, pointer) => pointer.slice(1).split('/').reduce((v, k) => v[k], value);
for (const pilot of publication.pilots) {
  const proof = qualification.pilots.find(p => p.capabilityId === pilot.profile.subject);
  for (const fixture of proof.cases.filter(f => f.provenance === 'SELECTED_FIXTURE_AUTHORITY')) {
    const expected = await read(path.join(pointer.directory, pilot.profile.subject, fixture.stdoutFile));
    const request = { publicationId: publication.publicationId, subject: pilot.profile.subject,
      values: Object.fromEntries(pilot.profile.inputs.filter(b => b.ownership === 'editable').map(b => [b.pointer, at(expected.result.input, b.pointer)])),
      ...(pilot.examples.length ? { exampleId: fixture.fixtureId } : {}) };
    const actual = await post(request);
    await fs.writeFile(path.join(output, fixture.fixtureId + '.json'), JSON.stringify({ request, actual }, null, 2));
    assert.equal(actual.status, 'EXECUTED', JSON.stringify(actual));
    assert.equal(actual.disposition, expected.result.disposition);
    assert.deepEqual(actual.outcome, expected.result.outcome);
    assert.deepEqual(actual.execution.result.input, expected.result.input);
    assert.deepEqual(actual.evidence.authorityIdentity, expected.evidence.authorityIdentity);
    cases.push({ id: fixture.fixtureId, status: 'PASSED', kind: 'live-native-execution', kernel: actual.disposition, domain: actual.outcome?.disposition ?? null });
    console.log('PASSED', fixture.fixtureId);
  }
}
const base = { publicationId: publication.publicationId, subject: publication.pilots[0].profile.subject, values: {} };
const greet = publication.pilots.find(p => p.profile.interaction === 'form');
const provider = publication.pilots.find(p => p.examples.length);
const negatives = [
  ['stale-publication', { ...base, publicationId: 'stale' }],
  ['unpublished-subject', { ...base, subject: 'not-published' }],
  ['forged-contract', { ...base, values: { '/contractId': 'forged' } }],
  ['forged-namespace', { ...base, namespace: 'forged' }],
  ['raw-envelope-bypass', { ...base, input: {} }],
  ['empty-name', { ...base, subject: greet.profile.subject, values: { '/payload/name': '' } }],
  ['oversized-name', { ...base, subject: greet.profile.subject, values: { '/payload/name': 'x'.repeat(101) } }],
  ['forged-inventory', { ...base, subject: provider.profile.subject, exampleId: provider.examples[0].id, values: { '/providerBindings': [] } }],
  ['unpublished-example', { ...base, subject: provider.profile.subject, exampleId: 'forged' }],
];
for (const [id, request] of negatives) {
  const actual = await post(request); assert.equal(actual.status, 'REFUSED');
  cases.push({ id, status: 'PASSED', kind: 'policy-refusal', code: actual.code });
}
if (service) {
  const input = structuredClone(provider.examples[0].input); input.providerBindings = [];
  const response = await fetch(service + '/commands', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ object: 'capability', operation: 'invoke', subject: provider.profile.subject, namespace: provider.profile.namespace, input }) });
  assert.equal(response.status, 403);
  const result = await response.json(); assert.equal(result.executionState, 'NOT_STARTED');
  cases.push({ id: 'direct-service-inventory-forgery', status: 'PASSED', kind: 'policy-refusal', code: result.error.code });
}
const summary = { observedAt: new Date().toISOString(), publicationId: publication.publicationId, passed: cases.length, cases };
await fs.writeFile(path.join(output, 'summary.json'), JSON.stringify(summary, null, 2));
await fs.writeFile('artifacts/lab/latest-verification.json', JSON.stringify({ directory: output, ...summary }, null, 2));
console.log(JSON.stringify({ passed: cases.length, output }));
