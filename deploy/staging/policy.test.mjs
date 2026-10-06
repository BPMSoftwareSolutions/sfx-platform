import test from 'node:test';
import assert from 'node:assert/strict';
import { exactImage, composite, unchangedRuntime, rollbackAllowed, releaseChanges, websiteRetired } from './policy.mjs';
const digest = 'sha256:' + 'a'.repeat(64), image = 'registry/repository@' + digest;
const previous = { id: 'r15', kernelDigest: digest, kernelLanguage: 'csharp', retrieval: { executable: digest, dal: digest }, identity: { executable: digest, dal: digest, policy: digest }, circuit: { sourceCommit: 'abc' } };
test('website-only, mutable and foreign images cannot qualify', () => {
  assert.throws(() => composite({id: 'website'})); composite(previous);
  assert.equal(exactImage(image, 'registry', 'repository'), image);
  for (const bad of ['registry/repository:latest', 'other/repository@' + digest]) assert.throws(() => exactImage(bad, 'registry', 'repository'));
});
test('a release keeps every admitted binary; host policies may travel with it', () => {
  unchangedRuntime(previous, { ...previous, id: 'new' });
  unchangedRuntime(previous, { ...previous, identity: { ...previous.identity, policy: 'sha256:' + 'b'.repeat(64) } });
  assert.throws(() => unchangedRuntime(previous, { ...previous, identity: { ...previous.identity, dal: 'changed' } }));
  assert.throws(() => unchangedRuntime(previous, { ...previous, kernelDigest: 'sha256:' + 'c'.repeat(64) }));
});
test('rollback must own the binding; uncertain PATCH can still recover', () => {
  const state = { bindAttempted: true, candidateImage: image };
  assert(rollbackAllowed(state, image)); assert(!rollbackAllowed(state, 'another-release'));
  assert(!rollbackAllowed({ ...state, bindAttempted: false }, image));
});
test('host and circuit files ship; infrastructure changes do not', () => {
  releaseChanges(['live-circuit/circuit/app.js', 'deploy/sda-kernel/gateway.mjs', 'deploy/sda-kernel/api.mjs',
    'deploy/sda-kernel/identity-policy.json', 'infra/azure.json']);
  assert.throws(() => releaseChanges(['infra/main.bicep']));
});
test('composite releases are website-free with a pinned base', () => {
  const release = { composite: { kind: 'composite', website: false, base: 'node:24.20.0-bookworm-slim@sha256:' + 'd'.repeat(64) } };
  websiteRetired(release);
  assert.throws(() => websiteRetired({ composite: { ...release.composite, website: true } }));
  assert.throws(() => websiteRetired({ composite: { ...release.composite, base: 'node:24' } }));
  assert.throws(() => websiteRetired(previous));
});
