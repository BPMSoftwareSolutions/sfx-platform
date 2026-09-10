import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { compilePublication, digest, verifyPublication, validatePilot } from '../lib/lab/compiler';
import { bindInput, runPublishedInput } from '../lib/lab/invocation';
import { PilotForm, LabOutcome } from '../components/lab/lab';
import type { LabPublication, LabResult } from '../contracts/lab';

const publication: LabPublication = JSON.parse(fs.readFileSync('generated/lab-publication.json', 'utf8'));
const [hello, greet, providers] = publication.pilots;
assert(hello && greet && providers);

test('finance uses declared symbol and region controls and refuses provider-owned fields', () => {
  const finance = publication.pilots.find(p => p.profile.subject === 'resolve-equity-market-price-evidence');
  assert(finance);
  const values = { '/payload/symbol': 'AAPL', '/payload/region': 'US' };
  assert.deepEqual(bindInput(finance, values), { contractId: 'live-equity-price-request.v1', payload: { symbol: 'AAPL', region: 'US' } });
  for (const changes of [{ '/payload/symbol': 'aapl' }, { '/payload/region': 'GB' }, { '/payload/symbol': 'AAPL&key=forged' }, { '/payload/nativeTestimony': {} }])
    assert.throws(() => bindInput(finance, { ...values, ...changes }));
  const changed = structuredClone(finance); changed.profile.inputs.find(b => b.pattern)!.pattern = '.*';
  assert.throws(() => validatePilot(changed), /PATTERN_SEMANTICS_CHANGED/);
  const html = renderToStaticMarkup(createElement(PilotForm, { pilot: finance, publicationId: publication.publicationId }));
  assert.equal((html.match(/<input/g) ?? []).length, 1); assert.equal((html.match(/<select/g) ?? []).length, 1);
  assert(!html.includes('name="/payload/nativeTestimony"'));
});

test('finance response binding checks the observed request', async () => {
  const finance = publication.pilots.find(p => p.profile.subject === 'resolve-equity-market-price-evidence')!;
  const input = bindInput(finance, { '/payload/symbol': 'AAPL', '/payload/region': 'US' });
  const base = { status: 'EXECUTED', capabilityId: finance.profile.subject, scenarioId: finance.authority.scenarioId,
    disposition: 'rejected', outcome: null, observationCount: 0, executionCount: 0, durationMs: 1,
    evidence: { authorityIdentity: finance.authority.identity, snapshotId: finance.authority.snapshotId, projectionDigest: finance.authority.projectionDigest },
    execution: { result: { input } } } as LabResult;
  const request = { publicationId: publication.publicationId, subject: finance.profile.subject, values: { '/payload/symbol': 'AAPL', '/payload/region': 'US' } };
  assert.equal((await runPublishedInput(publication, request, async () => base)).status, 'EXECUTED');
  const changed = structuredClone(base); assert(changed.status === 'EXECUTED');
  changed.execution.result.input = { contractId: 'live-equity-price-request.v1', payload: { symbol: 'MSFT', region: 'US' } };
  assert.equal((await runPublishedInput(publication, request, async () => changed)).status, 'UNKNOWN');
});

test('all three profiles compile from exact scoped schemas', () => {
  assert.deepEqual(verifyPublication(publication), publication);
  const changed = structuredClone(publication); changed.pilots[0]!.profile.label += '!';
  assert.throws(() => verifyPublication(changed), /PUBLICATION_DIGEST_CHANGED/);
  const renamed = structuredClone(providers); renamed.profile.subject = 'another-declared-root';
  assert.equal(compilePublication([renamed]).pilots[0]!.profile.subject, 'another-declared-root');
});
test('compiler holds altered, unresolved and ambiguous schema authority', () => {
  const altered = structuredClone(hello); altered.resources[0]!.text += ' ';
  assert.throws(() => validatePilot(altered), /SCHEMA_BYTES_CHANGED/);
  const missing = structuredClone(providers); missing.resources = missing.resources.filter(r => !r.sourcePath.endsWith('sidefx-semantic-common.schema.json'));
  assert.throws(() => validatePilot(missing), /resolve reference/);
  const ambiguous = structuredClone(hello), resource = structuredClone(ambiguous.resources[0]!);
  resource.text += ' '; resource.digest = digest(resource.text); ambiguous.resources.push(resource);
  assert.throws(() => validatePilot(ambiguous), /AMBIGUOUS_SCHEMA_ID/);
});
test('compiler holds missing ownership and changed fixed/constraint semantics', () => {
  const unmapped = structuredClone(greet); unmapped.profile.inputs.pop();
  assert.throws(() => validatePilot(unmapped), /INPUT_OWNERSHIP_MISSING/);
  const fixed = structuredClone(hello); fixed.profile.inputs[0]!.value = 'fabricated';
  assert.throws(() => validatePilot(fixed), /FIXED_CONSTANT_CHANGED/);
  const bounds = structuredClone(greet); bounds.profile.inputs[2]!.maxLength = 1000;
  assert.throws(() => validatePilot(bounds));
});
test('action serializes the exact constant envelope and offers no domain input', () => {
  assert.deepEqual(bindInput(hello, {}), { contractId: 'hello-world-request.v1', payload: {} });
  assert.throws(() => bindInput(hello, { '/payload': { name: 'invented' } }), /OWNERSHIP/);
  assert.throws(() => bindInput(hello, {}, 'fabricated'), /EXAMPLE_NOT_OFFERED/);
});
test('name boundaries preserve absent, empty, null, Unicode and markup meanings', () => {
  assert.throws(() => bindInput(greet, {}), /REQUIRED_INPUT_MISSING/);
  for (const invalid of ['', null, 12, 'x'.repeat(101)]) assert.throws(() => bindInput(greet, { '/payload/name': invalid }), /INPUT_CONTRACT_REFUSED/);
  for (const name of ['Sidney', 'Zoë', ' ', '<script>alert(1)</script>', '😀'.repeat(100)]) {
    assert.deepEqual(bindInput(greet, { '/payload/name': name }), { contractId: 'personal-greeting-request.v1', payload: { name } });
  }
  assert.throws(() => bindInput(greet, { '/contractId': 'bad', '/payload/name': 'Sidney' }), /OWNERSHIP/);
});
test('provider examples are server-bound copies of the four retained fixtures', () => {
  assert.equal(providers.examples.length, 4);
  for (const example of providers.examples) {
    const input = bindInput(providers, {}, example.id);
    assert.deepEqual(input, example.input); assert.notEqual(input, example.input);
  }
  assert.throws(() => bindInput(providers, {}, 'not-published'), /EXAMPLE_NOT_PUBLISHED/);
  assert.throws(() => bindInput(providers, { '/providerBindings': [] }, providers.examples[0]!.id), /OWNERSHIP/);
});
test('request policy refuses stale publications, unauthorized subjects and forged ownership before dispatch', async () => {
  let dispatches = 0;
  const invoke = async (): Promise<LabResult> => { dispatches++; return { status: 'REFUSED', capabilityId: '', code: 'TEST', message: 'Test transport' }; };
  const base = { publicationId: publication.publicationId, subject: hello.profile.subject, values: {} };
  for (const raw of [{ ...base, input: {} }, { ...base, namespace: 'other' }, { ...base, publicationId: 'old' },
    { ...base, subject: 'unpublished' }, { ...base, values: { '/contractId': 'forged' } }]) {
    assert.equal((await runPublishedInput(publication, raw, invoke)).status, 'REFUSED');
  }
  assert.equal(dispatches, 0);
  await runPublishedInput(publication, { ...base, subject: greet.profile.subject, values: { '/payload/name': 'Zoë' } }, async (subject, input, namespace) => {
    assert.equal(subject, greet.profile.subject); assert.equal(namespace, greet.profile.namespace);
    assert.deepEqual(input, { contractId: 'personal-greeting-request.v1', payload: { name: 'Zoë' } }); return invoke();
  });
  assert.equal(dispatches, 1);
});
test('shared renderer exposes only declared controls; greeting markup is escaped', () => {
  const render = (pilot: typeof hello) => renderToStaticMarkup(createElement(PilotForm, { pilot: { profile: pilot.profile, examples: pilot.examples.map(({ id, label }) => ({ id, label })) }, publicationId: publication.publicationId }));
  assert(!render(hello).includes('<input')); assert(!render(hello).includes('<textarea'));
  assert.equal((render(greet).match(/<input/g) ?? []).length, 1);
  assert(!render(providers).includes('<input')); assert(!render(providers).includes('<textarea'));
  assert.equal((render(providers).match(/<option/g) ?? []).length, 4);
  const view = { status: 'EXECUTED', capabilityId: greet.profile.subject, scenarioId: greet.profile.subject,
    disposition: 'terminated', outcome: { payload: { message: 'Hello, <script>alert(1)</script>!' } },
    observationCount: 6, executionCount: 1, durationMs: 1, evidence: {}, execution: { result: {} } } as LabResult;
  const markup = renderToStaticMarkup(createElement(LabOutcome, { profile: greet.profile, result: view }));
  assert(markup.includes('&lt;script&gt;alert(1)&lt;/script&gt;')); assert(!markup.includes('<script>'));
});
