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
export function unchangedRuntime(previous, next) {
  for (const key of ['kernelDigest', 'kernelLanguage', 'retrieval', 'identity']) assert.deepEqual(next[key], previous[key], `Overlay changed ${key}`);
}
export function rollbackAllowed(state, current) {
  return Boolean(state.bindAttempted && state.candidateImage && current === state.candidateImage);
}
export function overlayChanges(files) {
  const unsupported = files.filter(file => /^(deploy\/sda-kernel\/|infra\/)/.test(file)
    && !/^(deploy\/sda-kernel\/(gateway\.mjs|prepare-circuit\.mjs|Dockerfile\.circuit|live-circuit\.mjs|verify-circuit-package\.mjs|.*\.md|.*acceptance.*\.json)|infra\/(azure\.json|authorize-staging-release\.ps1))$/.test(file));
  assert.equal(unsupported.length, 0, 'Circuit overlay cannot ship installed-service/config changes: ' + unsupported.join(', '));
}
