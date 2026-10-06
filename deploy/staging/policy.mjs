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
