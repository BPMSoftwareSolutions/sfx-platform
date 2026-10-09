// Automatic staging only. No production route, swap, credential rotation or DB migration.
// Runs inside the release transaction (staging.yml), which holds the staging lock
// from binding through acceptance or rollback. SFX_RELEASE_COMMIT is the commit
// the Live Circuit checks run qualified; the identity publish arrives from that
// run as an artifact and is verified against its manifest before packaging.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { azure, config, root, evidence, az, rest, run, read, write, token, json, sleep, gate, classified } from './common.mjs';
import { exactImage, composite, identityUpdate, rollbackAllowed, releaseChanges, websiteRetired, clientScope } from './policy.mjs';
import { verifyIdentityPublish } from './identity-publish.mjs';
import { desiredEvidenceSettings, evidenceSettings, applyEvidenceSettings } from './evidence-settings.mjs';
const mode = process.argv[2];
const binding = async () => (await rest('get', '/config/web')).properties.linuxFxVersion.replace(/^DOCKER\|/, '');
const validate = image => exactImage(image, azure.registryServer, azure.imageRepository);
const privateRead = bearer => json(config.origin + '/internal/deployment', { headers: { authorization: 'Bearer ' + bearer } });
const restart = () => az(['webapp', 'restart', '-g', azure.resourceGroup, '-n', azure.appName, '--slot', azure.stagingSlot]);
async function ready(id, previousBoot) {
  const deadline = Date.now() + 600000;
  while (Date.now() < deadline) {
    try {
      const h = await json(config.origin + '/healthz');
      if (h.ready && h.release === id && (!previousBoot || (h.bootId && h.bootId !== previousBoot))) return h;
    } catch {}
    await sleep(5000);
  }
  throw new Error('NEW_RELEASE_READINESS_TIMEOUT');
}
async function lock(image) {
  const reference = image.replace(azure.registryServer + '/', '');
  await az(['acr', 'repository', 'update', '-n', azure.registryName, '--image', reference, '--write-enabled', 'false', '--delete-enabled', 'false']);
  const metadata = await az(['acr', 'repository', 'show', '-n', azure.registryName, '--image', reference]);
  assert.equal(metadata.changeableAttributes.writeEnabled, false);
  assert.equal(metadata.changeableAttributes.deleteEnabled, false);
}
async function oldVault() {
  // r15 predates the private metadata route. Read ciphertext once through Kudu;
  // publishing credentials and ciphertext stay in memory and are never artifacts.
  const credentials = await rest('post', '/config/publishingcredentials/list');
  const c = credentials.properties;
  const resource = await rest('get', '');
  const scmHost = resource.properties.enabledHostNames.find(host => host.includes('.scm.'));
  assert(scmHost?.endsWith('.azurewebsites.net'), 'Declared SCM hostname required');
  const scm = 'https://' + scmHost;
  const response = await fetch(scm + config.vaultVfs, { redirect: 'error', signal: AbortSignal.timeout(90000), headers: {
    authorization: 'Basic ' + Buffer.from(c.publishingUserName + ':' + c.publishingPassword).toString('base64') } });
  assert.equal(response.status, 200, 'Existing encrypted vault must be readable for fingerprinting');
  const bytes = Buffer.from(await response.arrayBuffer());
  return { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
}
async function rollback() {
  const state = read('state.json'), current = await binding();
  if (current === state.previousImage) { write('rollback.json', { alreadyAtPrevious: true, image: current }); return; }
  if (!rollbackAllowed(state, current)) throw new Error('ROLLBACK_REFUSED: another deployment owns the slot');
  validate(state.previousImage);
  if (state.settingsAttempted) {
    const settings = await evidenceSettings();
    if (JSON.stringify(settings) !== JSON.stringify(state.evidenceSettingsBefore)) {
      assert.deepEqual(settings, desiredEvidenceSettings(), 'Another operation changed evidence settings; preserve them');
      await applyEvidenceSettings(state.evidenceSettingsBefore);
    }
  }
  await rest('patch', '/config/web', { properties: { linuxFxVersion: 'DOCKER|' + state.previousImage } });
  await restart(); await ready(state.previousRelease.id);
  write('rollback.json', { restoredAt: new Date().toISOString(), image: state.previousImage, release: state.previousRelease.id });
  console.log('Rollback restored the previous exact image.');
}
async function deploy() {
  assert.equal(process.env.GITHUB_REF, 'refs/heads/main', 'Only main can bind staging');
  const commit = (await run('git', ['rev-parse', 'HEAD'])).trim();
  assert.equal(commit, process.env.SFX_RELEASE_COMMIT || process.env.GITHUB_SHA, 'Checked-out commit must be the qualified release commit');
  verifyIdentityPublish(path.join(root, 'artifacts/identity-publish'), JSON.parse(fs.readFileSync(path.join(root, 'artifacts/identity-publish.json'))),
    JSON.parse(fs.readFileSync(path.join(root, 'deploy/staging/identity-sources.json'))));
  const previousImage = validate(await binding());
  console.log('Reading installed composite manifest from its exact image.');
  await az(['acr', 'login', '-n', azure.registryName]);
  await run('docker', ['pull', previousImage]);
  const container = (await run('docker', ['create', previousImage])).trim();
  fs.mkdirSync(evidence, { recursive: true });
  try { await run('docker', ['cp', container + ':/opt/sfx/release.json', path.join(evidence, 'previous-release.json')]); }
  finally { await run('docker', ['rm', container]); }
  const previous = read('previous-release.json'); composite(previous);
  console.log('Checking current readiness and release scope.');
  const baseline = await json(config.origin + '/healthz');
  assert.equal(baseline.release, previous.id); assert.equal(baseline.kernelDigest, previous.kernelDigest);
  // Checks runs can finish out of order; never replace a release with an older commit.
  try { await run('git', ['merge-base', '--is-ancestor', previous.circuit.sourceCommit, commit]); }
  catch { throw classified('changed-input', 'RELEASE_OUT_OF_ORDER', `${commit} does not descend from the installed source ${previous.circuit.sourceCommit}`); }
  const changed = (await run('git', ['diff', '--name-only', previous.circuit.sourceCommit, commit])).trim().split(/\r?\n/).filter(Boolean);
  releaseChanges(changed);
  // The live Windows client gate is required only when this release can change
  // the installed CLI or the identity contract it authenticates against.
  const client = clientScope(changed);
  write('scope.json', { previousSource: previous.circuit.sourceCommit, changedFiles: changed.length, clientGateRequired: client.length > 0, clientChanges: client });
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `client-gate=${client.length > 0}\n`);
  const bearer = await token();
  console.log('Fingerprinting existing encrypted vault.');
  const vault = baseline.bootId ? (await privateRead(bearer)).vault : await oldVault();
  const state = { sourceCommit: commit, previousImage, previousRelease: previous, vaultBefore: vault,
    evidenceSettingsBefore: await evidenceSettings(), bindAttempted: false, startedAt: new Date().toISOString() };
  write('state.json', state);
  await lock(previousImage);
  const id = `composite-${commit.slice(0, 12)}-${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT}`;
  const context = path.join(path.dirname(evidence), 'staging-context');
  // One image from the pinned Node base: the previous exact image supplies only its
  // admitted components (kernel, API, retrieval, delivery config, vault bootstrap).
  // Identity comes from the pinned publish; host and circuit come from this commit.
  const sourcesFile = path.join(root, 'deploy/staging/identity-sources.json');
  // The declared UI region packages come from the same pinned provider checkout.
  const providersCheckout = path.join(root, '.release-sources/sfx-providers/providers');
  assert(fs.existsSync(path.join(providersCheckout, 'ui-shell-footer', 'ui-shell-footer.mjs')), 'Pinned provider checkout required for the region packages');
  await run(process.execPath, ['deploy/sda-kernel/prepare-composite.mjs', path.join(evidence, 'previous-release.json'), context, id, previousImage,
    path.join(root, 'artifacts/identity-publish'), sourcesFile, providersCheckout]);
  const next = JSON.parse(fs.readFileSync(path.join(context, 'runtime/release.json')));
  composite(next); websiteRetired(next); identityUpdate(previous, next, JSON.parse(fs.readFileSync(sourcesFile)));
  write('release.json', next);
  console.log('Building composite image ' + id);
  await az(['acr', 'build', '-r', azure.registryName, '-t', azure.imageRepository + ':' + id, '--platform', 'linux/amd64', '--build-arg', 'COMPONENTS_IMAGE=' + previousImage, '--no-logs', context]);
  const metadata = await az(['acr', 'repository', 'show', '-n', azure.registryName, '--image', azure.imageRepository + ':' + id]);
  state.candidateImage = validate(azure.registryServer + '/' + azure.imageRepository + '@' + metadata.digest);
  state.candidateRelease = id; write('state.json', state);
  await lock(azure.registryServer + '/' + azure.imageRepository + ':' + id);
  await lock(state.candidateImage);
  assert.equal(await binding(), previousImage, 'Slot changed while image built; do not overwrite another release');
  // Persist before PATCH: an uncertain HTTP response may still have applied it.
  state.bindAttempted = true; write('state.json', state);
  await rest('patch', '/config/web', { properties: { linuxFxVersion: 'DOCKER|' + state.candidateImage } });
  if (JSON.stringify(state.evidenceSettingsBefore) !== JSON.stringify(desiredEvidenceSettings())) {
    state.settingsAttempted = true; write('state.json', state);
    await applyEvidenceSettings(desiredEvidenceSettings());
  }
  await restart(); await ready(id, baseline.bootId);
  const installed = await privateRead(bearer);
  assert.deepEqual(installed.release, next, 'Running manifest must equal the packaged manifest');
  assert.deepEqual(installed.vault, vault, 'Deployment must preserve encrypted vault');
  write('deployed.json', { ...installed, image: state.candidateImage, checkedAt: new Date().toISOString() });
  console.log('Bound and verified ' + id);
}
async function verifyRestart() {
  const state = read('state.json'), bearer = await token();
  assert.equal(await binding(), state.candidateImage);
  const before = await privateRead(bearer);
  await restart(); await ready(state.candidateRelease, before.bootId);
  const after = await privateRead(bearer);
  assert.notEqual(after.bootId, before.bootId);
  assert.deepEqual(after.vault, state.vaultBefore);
  assert.deepEqual(after.release, read('release.json'));
  write('restart.json', { checkedAt: new Date().toISOString(), previousBoot: before.bootId, bootId: after.bootId, vault: after.vault });
  console.log('New process confirmed; vault fingerprint preserved.');
}
try {
  if (mode === 'deploy') await gate('deploy', deploy);
  else if (mode === 'rollback') await rollback();
  else if (mode === 'restart-check') await gate('restart', verifyRestart);
  else throw new Error('Expected deploy, restart-check or rollback');
} catch (error) {
  console.error(error.message + (error.cause?.code ? ` (${error.cause.code})` : '')); process.exitCode = 1;
}
