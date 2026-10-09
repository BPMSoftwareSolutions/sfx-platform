import assert from 'node:assert/strict';
export function exactImage(image, registry, repository) {
  assert(image.startsWith(`${registry}/${repository}@sha256:`), 'Expected this staging repository by digest');
  assert(/@sha256:[a-f0-9]{64}$/.test(image), 'Mutable image references cannot deploy');
  return image;
}
export function composite(release) {
  for (const value of [release.kernelDigest, release.retrieval?.executable, release.retrieval?.dal, release.identity?.executable, release.identity?.dal])
    assert(/^sha256:[a-f0-9]{64}$/.test(value || ''), 'Complete installed runtime required');
  assert(release.id && release.kernelLanguage && release.circuit?.sourceCommit, 'Composite manifest required');
}
// A composite release copies the admitted binaries from the previous image: the
// kernel and the retrieval and identity executables and DALs must not change.
// Host policies are repository files and travel with the release.
export function unchangedRuntime(previous, next) {
  for (const key of ['kernelDigest', 'kernelLanguage']) assert.deepEqual(next[key], previous[key], `Release changed ${key}`);
  for (const service of ['retrieval', 'identity'])
    for (const key of ['executable', 'dal']) assert.equal(next[service]?.[key], previous[service]?.[key], `Release changed ${service}.${key}`);
}
// Identity transport may be rebuilt only from the two explicitly pinned inputs.
// The Docker build independently proves all other installed trees unchanged.
export function identityUpdate(previous, next, sources) {
  for (const value of Object.values(sources)) assert(/^[a-f0-9]{40}$/.test(value), 'Pinned identity source required');
  assert.deepEqual(Object.keys(sources).sort(), ['dal', 'providers']);
  assert.deepEqual(next.identity.sources, sources, 'Identity source pins must match release policy');
  unchangedRuntime(previous, { ...next, identity: previous.identity });
  for (const [key, file] of [['executable', 'sfx-identity-host.dll'], ['dal', 'SFX.Identity.DAL.dll']])
    assert.equal(next.identity[key], next.circuit.files['identity/' + file], 'Identity binary must be inventoried');
}
export function rollbackAllowed(state, current) {
  return Boolean(state.bindAttempted && state.candidateImage && current === state.candidateImage);
}
// Everything under deploy/sda-kernel/ and live-circuit/ is delivered by the
// composite build. Infrastructure changes are separate operations, except the
// two files the release itself reads.
export function releaseChanges(files) {
  const unsupported = files.filter(file => /^infra\//.test(file) && !/^infra\/(azure\.json|authorize-staging-release\.ps1)$/.test(file));
  assert.equal(unsupported.length, 0, 'Staging release cannot ship infrastructure changes: ' + unsupported.join(', '));
}
// Composite releases never carry the retired Next.js website and always name
// their pinned Node base.
export function websiteRetired(release) {
  assert.equal(release.composite?.kind, 'composite', 'Composite release manifest required');
  assert.equal(release.composite?.website, false, 'The Next.js website must not be part of the release');
  assert(/^node:[^\s@]+@sha256:[a-f0-9]{64}$/.test(release.composite?.base ?? ''), 'Pinned Node base required');
}
// The live Windows client gate runs when a release can change the installed CLI,
// its login input, or the identity contract it authenticates against. Other
// releases record that gate as out of scope rather than implying it ran.
const CLIENT_SCOPE = [/^tools\/sfx-api\/(?!verify-circuit-replay\.mjs$)/, /^deploy\/staging\/(identity-sources\.json|client-sources\.json|test-tools\/)/,
  /^deploy\/sda-kernel\/(gateway\.mjs|identity-policy\.json|initialize\.sh)$/, /^live-circuit\/circuit\/identity-session\.mjs$/,
  /^\.github\/workflows\/staging\.yml$/];
export function clientScope(files) {
  return files.filter(file => CLIENT_SCOPE.some(pattern => pattern.test(file)));
}
