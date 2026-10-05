import test from 'node:test';
import assert from 'node:assert/strict';
import { exactImage, composite, unchangedRuntime, rollbackAllowed, overlayChanges } from './policy.mjs';
const digest = 'sha256:' + 'a'.repeat(64), image = 'registry/repository@' + digest;
const previous = { id: 'r15', kernelDigest: digest, kernelLanguage: 'csharp', retrieval: { executable: digest, dal: digest }, identity: { executable: digest, dal: digest }, circuit: { sourceCommit: 'abc' } };
test('website-only, mutable and foreign images cannot qualify', () => {
  assert.throws(() => composite({id: 'website'})); composite(previous);
  assert.equal(exactImage(image, 'registry', 'repository'), image);
  for (const bad of ['registry/repository:latest', 'other/repository@' + digest]) assert.throws(() => exactImage(bad, 'registry', 'repository'));
});
test('overlay retains every installed service identity', () => {
  unchangedRuntime(previous, { ...previous, id: 'new' });
  assert.throws(() => unchangedRuntime(previous, { ...previous, identity: { ...previous.identity, dal: 'changed' } }));
});
test('rollback must own the binding; uncertain PATCH can still recover', () => {
  const state = { bindAttempted: true, candidateImage: image };
  assert(rollbackAllowed(state, image)); assert(!rollbackAllowed(state, 'another-release'));
  assert(!rollbackAllowed({ ...state, bindAttempted: false }, image));
});
test('unsupported service edits fail before binding instead of silently shipping stale files', () => {
  overlayChanges(['live-circuit/circuit/app.js', 'deploy/sda-kernel/gateway.mjs']);
  assert.throws(() => overlayChanges(['deploy/sda-kernel/api.mjs']));
  assert.throws(() => overlayChanges(['deploy/sda-kernel/identity-policy.json']));
});
