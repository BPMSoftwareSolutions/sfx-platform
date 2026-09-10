import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import invocation from '../lib/lab/invocation.ts';
const { bindInput } = invocation;
const endpoint = process.argv[2];
if (!endpoint || !process.env.SIDEFX_SERVICE_TOKEN) throw new Error('REMOTE_VERIFICATION_CONFIGURATION_REQUIRED');
const publication = JSON.parse(await fs.readFile('generated/lab-publication.json', 'utf8'));
const directory = path.resolve('artifacts/deployment/verification-' + new Date().toISOString().replaceAll(':', '-'));
await fs.mkdir(directory, { recursive: true });
const summary = { endpoint, publicationId: publication.publicationId, observedAt: new Date().toISOString(), checks: [] };
const post = async (body, token = process.env.SIDEFX_SERVICE_TOKEN) => {
  const response = await fetch(new URL('/commands', endpoint), { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token }, body: JSON.stringify(body), signal: AbortSignal.timeout(130000) });
  return { status: response.status, body: await response.json() };
};
for (const pilot of publication.pilots) {
  const values = Object.fromEntries(pilot.profile.inputs.filter(b => b.ownership === 'editable').map(b => [b.pointer, b.enum?.[0] ?? (b.pattern ? 'AAPL' : 'Zoë <script>') ]));
  const examples = pilot.examples.length ? pilot.examples : [{ id: undefined }];
  for (const example of examples) {
    const input = bindInput(pilot, values, example.id);
    const command = { object: 'capability', operation: 'invoke', subject: pilot.profile.subject, namespace: pilot.profile.namespace, input };
    const response = await post(command);
    const id = pilot.profile.subject + (example.id ? '-' + example.id : '');
    await fs.writeFile(path.join(directory, id + '.json'), JSON.stringify({ command, response }, null, 2));
    assert.equal(response.status, 200); assert(!response.body.error, JSON.stringify(response.body.error));
    const execution = response.body.result;
    assert.equal(execution.result.disposition, 'terminated');
    assert.deepEqual(execution.evidence.authorityIdentity, pilot.authority.identity);
    assert.equal(execution.evidence.snapshotId, pilot.authority.snapshotId);
    if (pilot.profile.outcome.externalProviderInvoked) {
      const outcome = execution.result.outcome;
      assert.equal(outcome.disposition, pilot.profile.outcome.resolvedDisposition);
      assert.equal(outcome.payload.symbol, values['/payload/symbol']);
      assert.equal(typeof outcome.payload.observedPrice, 'number');
      assert(outcome.payload.observedPrice > 0);
      assert.equal(typeof outcome.payload.currency, 'string');
    }
    summary.checks.push({ id, passed: true, disposition: execution.result.outcome.disposition ?? execution.result.disposition,
      ...(pilot.profile.outcome.externalProviderInvoked ? { price: execution.result.outcome.payload.observedPrice, currency: execution.result.outcome.payload.currency } : {}) });
    console.log(JSON.stringify(summary.checks.at(-1)));
    for (const [name, body, token, expected] of [
      ['invalid-token', command, 'invalid', 401],
      ['forged-input', { ...command, input: { ...input, credential: 'forged' } }, undefined, 403],
      ['unauthorized-subject', { ...command, subject: 'unpublished' }, undefined, 403]]) {
      const refused = await post(body, token); assert.equal(refused.status, expected); assert.equal(refused.body.executionState, 'NOT_STARTED');
      summary.checks.push({ id: id + ':' + name, passed: true });
    }
  }
}
await fs.writeFile(path.join(directory, 'summary.json'), JSON.stringify(summary, null, 2));
await fs.writeFile('artifacts/deployment/latest-verification.json', JSON.stringify({ directory, ...summary }, null, 2));
console.log(JSON.stringify({ directory, checks: summary.checks.length }));
