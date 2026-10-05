// Automatic staging only. No production route, swap, credential rotation or DB migration.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { azure, config, root, evidence, az, rest, run, read, write, token, json, sleep } from './common.mjs';
import { exactImage, composite, unchangedRuntime, rollbackAllowed, overlayChanges } from './policy.mjs';
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
  await rest('patch', '/config/web', { properties: { linuxFxVersion: 'DOCKER|' + state.previousImage } });
  await restart(); await ready(state.previousRelease.id);
  write('rollback.json', { restoredAt: new Date().toISOString(), image: state.previousImage, release: state.previousRelease.id });
  console.log('Rollback restored the previous exact image.');
}
async function deploy() {
  assert.equal(process.env.GITHUB_REF, 'refs/heads/main', 'Only main can bind staging');
  const commit = (await run('git', ['rev-parse', 'HEAD'])).trim();
  assert.equal(commit, process.env.GITHUB_SHA);
  const previousImage = validate(await binding());
  console.log('Reading installed composite manifest from its exact image.');
  await az(['acr', 'login', '-n', azure.registryName]);
  await run('docker', ['pull', previousImage]);
  const container = (await run('docker', ['create', previousImage])).trim();
  fs.mkdirSync(evidence, { recursive: true });
  try { await run('docker', ['cp', container + ':/opt/sfx/release.json', path.join(evidence, 'previous-release.json')]); }
  finally { await run('docker', ['rm', container]); }
  const previous = read('previous-release.json'); composite(previous);
  console.log('Checking current readiness and overlay scope.');
  const baseline = await json(config.origin + '/healthz');
  assert.equal(baseline.release, previous.id); assert.equal(baseline.kernelDigest, previous.kernelDigest);
  const changed = (await run('git', ['diff', '--name-only', previous.circuit.sourceCommit, commit])).trim().split(/\r?\n/).filter(Boolean);
  overlayChanges(changed);
  const bearer = await token();
  console.log('Fingerprinting existing encrypted vault.');
  const vault = baseline.bootId ? (await privateRead(bearer)).vault : await oldVault();
  const state = { sourceCommit: commit, previousImage, previousRelease: previous, vaultBefore: vault, bindAttempted: false, startedAt: new Date().toISOString() };
  write('state.json', state);
  await lock(previousImage);
  const id = `circuit-${commit.slice(0, 12)}-${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT}`;
  const context = path.join(path.dirname(evidence), 'staging-context');
  await run(process.execPath, ['deploy/sda-kernel/prepare-circuit.mjs', path.join(evidence, 'previous-release.json'), context, id, previousImage]);
  const next = JSON.parse(fs.readFileSync(path.join(context, 'runtime/release.json'))); composite(next); unchangedRuntime(previous, next);
  write('release.json', next);
  console.log('Building complete image overlay ' + id);
  await az(['acr', 'build', '-r', azure.registryName, '-t', azure.imageRepository + ':' + id, '--platform', 'linux/amd64', '--build-arg', 'STAGING_IMAGE=' + previousImage, '--no-logs', context]);
  const metadata = await az(['acr', 'repository', 'show', '-n', azure.registryName, '--image', azure.imageRepository + ':' + id]);
  state.candidateImage = validate(azure.registryServer + '/' + azure.imageRepository + '@' + metadata.digest);
  state.candidateRelease = id; write('state.json', state);
  await lock(azure.registryServer + '/' + azure.imageRepository + ':' + id);
  await lock(state.candidateImage);
  assert.equal(await binding(), previousImage, 'Slot changed while image built; do not overwrite another release');
  // Persist before PATCH: an uncertain HTTP response may still have applied it.
  state.bindAttempted = true; write('state.json', state);
  await rest('patch', '/config/web', { properties: { linuxFxVersion: 'DOCKER|' + state.candidateImage } });
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
  if (mode === 'deploy') await deploy();
  else if (mode === 'rollback') await rollback();
  else if (mode === 'restart-check') await verifyRestart();
  else throw new Error('Expected deploy, restart-check or rollback');
} catch (error) {
  console.error(error.message + (error.cause?.code ? ` (${error.cause.code})` : '')); process.exitCode = 1;
}
