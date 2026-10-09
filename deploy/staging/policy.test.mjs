import test from 'node:test';
import assert from 'node:assert/strict';
import { exactImage, composite, unchangedRuntime, identityUpdate, rollbackAllowed, releaseChanges, websiteRetired, clientScope } from './policy.mjs';
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
test('identity update requires pinned sources and inventoried binaries; kernel and retrieval stay unchanged', () => {
  const sources = { providers: '1'.repeat(40), dal: '2'.repeat(40) };
  const next = { ...previous, identity: { executable: digest, dal: digest, sources },
    circuit: { files: { 'identity/sfx-identity-host.dll': digest, 'identity/SFX.Identity.DAL.dll': digest } } };
  identityUpdate(previous, next, sources);
  assert.throws(() => identityUpdate(previous, next, { ...sources, dal: 'main' }));
  assert.throws(() => identityUpdate(previous, { ...next, kernelDigest: 'changed' }, sources));
  assert.throws(() => identityUpdate(previous, { ...next, retrieval: { ...next.retrieval, dal: 'changed' } }, sources));
  assert.throws(() => identityUpdate(previous, { ...next, circuit: { files: {} } }, sources));
});
test('host and circuit files ship; infrastructure changes do not', () => {
  releaseChanges(['live-circuit/circuit/explorer.js', 'deploy/sda-kernel/gateway.mjs', 'deploy/sda-kernel/api.mjs',
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
test('the live Windows client gate is scoped to client and identity changes', () => {
  assert.deepEqual(clientScope(['live-circuit/circuit/explorer.js', 'live-circuit/circuit/site.css', 'tools/sfx-api/verify-circuit-replay.mjs', 'deploy/staging/accept.mjs']), []);
  for (const file of ['tools/sfx-api/auth.mjs', 'tools/sfx-api/login-input/LoginInput.csproj', 'deploy/staging/identity-sources.json', 'deploy/staging/client-sources.json',
    'deploy/sda-kernel/gateway.mjs', 'deploy/sda-kernel/identity-policy.json', 'live-circuit/circuit/identity-session.mjs', '.github/workflows/staging.yml'])
    assert.deepEqual(clientScope(['live-circuit/circuit/explorer.js', file]), [file], file);
});
test('a downloaded identity publish must match its build manifest and this commit\'s pins', async () => {
  const { identityPublishManifest, verifyIdentityPublish } = await import('./identity-publish.mjs');
  const fs = await import('node:fs'), os = await import('node:os'), path = await import('node:path');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'identity-publish-'));
  try {
    fs.mkdirSync(path.join(directory, 'runtimes'));
    fs.writeFileSync(path.join(directory, 'sfx-identity-host.dll'), 'host'); fs.writeFileSync(path.join(directory, 'runtimes', 'native.so'), 'native');
    const sources = { providers: '1'.repeat(40), dal: '2'.repeat(40) }, manifest = identityPublishManifest(directory, sources);
    verifyIdentityPublish(directory, manifest, sources);
    assert.throws(() => verifyIdentityPublish(directory, manifest, { ...sources, dal: '3'.repeat(40) }));
    fs.writeFileSync(path.join(directory, 'runtimes', 'native.so'), 'changed');
    assert.throws(() => verifyIdentityPublish(directory, manifest, sources));
    fs.writeFileSync(path.join(directory, 'runtimes', 'native.so'), 'native'); fs.writeFileSync(path.join(directory, 'extra.dll'), 'added');
    assert.throws(() => verifyIdentityPublish(directory, manifest, sources));
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
