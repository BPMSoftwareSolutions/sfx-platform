// Packaging conformance only: stand-in manifest, no Azure/database/service calls.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sfx-composite-package-'));
const packager = path.join(here, 'prepare-composite.mjs');
const digest = c => 'sha256:' + c.repeat(64);
const previous = { id: 'fixture-before', kernelDigest: digest('a'), kernelLanguage: 'fixture',
  retrieval: { executable: digest('b'), dal: digest('c') }, identity: { executable: digest('d'), dal: digest('e'), policy: digest('f') },
  circuit: { sourceCommit: 'fixture' } };
const sha = file => 'sha256:' + createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const previousFile = path.join(root, 'previous.json'), destination = path.join(root, 'candidate');
const components = 'example.invalid/fixture@sha256:' + '1'.repeat(64);
fs.writeFileSync(previousFile, JSON.stringify(previous));
const invoke = (out = destination, image = components, id = 'fixture-after', manifest = previousFile) => spawnSync(process.execPath,
  [packager, manifest, out, id, image], { encoding: 'utf8' });
try {
  const built = invoke(); assert.equal(built.status, 0, built.stderr);
  const runtime = path.join(destination, 'runtime');
  const next = JSON.parse(fs.readFileSync(path.join(runtime, 'release.json')));
  for (const key of ['kernelDigest', 'kernelLanguage', 'retrieval']) assert.deepEqual(next[key], previous[key]);
  assert.equal(next.identity.executable, previous.identity.executable); assert.equal(next.identity.dal, previous.identity.dal);
  assert.equal(next.identity.policy, next.circuit.files['host/identity-policy.json'], 'Identity policy is the placed repository file');
  const dockerfile = fs.readFileSync(path.join(here, 'Dockerfile.composite'), 'utf8').replaceAll('\r\n', '\n');
  assert.deepEqual(next.composite, { kind: 'composite', base: dockerfile.match(/^FROM (node:\S+@sha256:[a-f0-9]{64})$/m)[1],
    componentsImage: components, componentsRelease: previous.id, previousManifest: sha(previousFile), website: false });
  const actual = fs.readdirSync(runtime, { recursive: true, withFileTypes: true }).filter(entry => entry.isFile())
    .map(entry => path.relative(runtime, path.join(entry.parentPath, entry.name)).replaceAll('\\', '/')).sort();
  assert.deepEqual(actual, [...Object.keys(next.circuit.files), 'release.json'].sort(), 'Manifest must cover every placed file');
  const host = ['host/api.mjs', 'host/gateway.mjs', 'host/identity-policy.json', 'host/initialize.sh', 'host/retrieval-policy.json'];
  assert.deepEqual(actual.filter(name => name.startsWith('host/')), host);
  for (const [name, value] of Object.entries(next.circuit.files)) {
    assert(host.includes(name) || name.startsWith('estate/demo/') || name.startsWith('estate/ui-providers/'), 'Only host files, the circuit and UI providers are placed: ' + name);
    assert.equal(sha(path.join(runtime, name)), value);
  }
  for (const name of host) assert(!fs.readFileSync(path.join(runtime, name), 'utf8').includes('\r'), 'LF host file required: ' + name);
  // Installed components come from the exact components image, never this repository.
  for (const name of ['kernel', 'api', 'procedure-extract', 'identity', 'vault-bootstrap.tar.gz', 'estate/sfx.config.json'])
    assert(!fs.existsSync(path.join(runtime, name)), 'Component must not be placed: ' + name);
  assert.equal(fs.readFileSync(path.join(destination, 'Dockerfile'), 'utf8'), dockerfile);
  assert(!/\/app\b|server\.js|WEBSITE_IMAGE/.test(dockerfile.split('\n').filter(line => !line.startsWith('#') && !line.includes('WEBSITE_PRESENT')).join('\n')),
    'The composite build must not reference the website');
  assert(fs.existsSync(path.join(destination, 'component-fingerprint.sh')));
  const gateway = fs.readFileSync(path.join(runtime, 'host/gateway.mjs'), 'utf8');
  assert(!/'\/app'|server\.js|3001/.test(gateway), 'The gateway must not launch the website');
  const incomplete = path.join(root, 'incomplete.json');
  fs.writeFileSync(incomplete, JSON.stringify({ ...previous, identity: { executable: previous.identity.executable } }));
  assert.notEqual(invoke().status, 0, 'Existing destinations must be refused');
  assert.notEqual(invoke(path.join(root, 'mutable'), 'example.invalid/fixture:latest').status, 0);
  assert.notEqual(invoke(path.join(root, 'same'), components, previous.id).status, 0);
  assert.notEqual(invoke(path.join(root, 'incomplete'), components, 'fixture-after', incomplete).status, 0);
  const published = path.join(root, 'publish'); fs.mkdirSync(published);
  for (const name of ['sfx-identity-host', 'sfx-identity-host.dll', 'SFX.Identity.DAL.dll']) fs.writeFileSync(path.join(published, name), 'packaging fixture ' + name);
  const sources = { providers: '1'.repeat(40), dal: '2'.repeat(40) }, sourcesFile = path.join(root, 'sources.json');
  fs.writeFileSync(sourcesFile, JSON.stringify(sources));
  const uiProviders = path.join(root, 'ui-providers');
  for (const name of ['ui-explorer-region', 'ui-shell-footer']) {
    fs.mkdirSync(path.join(uiProviders, name, 'assets'), { recursive: true });
    fs.writeFileSync(path.join(uiProviders, name, `${name}.mjs`), `export const descriptor = { operations: [{ operationId: 'ui.region.load' }] };\n`);
    fs.writeFileSync(path.join(uiProviders, name, 'assets', 'region.css'), 'packaging fixture ' + name);
  }
  const identityOut = path.join(root, 'identity-candidate');
  const update = spawnSync(process.execPath, [packager, previousFile, identityOut, 'fixture-identity', components, published, sourcesFile, uiProviders], { encoding: 'utf8' });
  assert.equal(update.status, 0, update.stderr);
  const updated = JSON.parse(fs.readFileSync(path.join(identityOut, 'runtime/release.json')));
  assert.deepEqual(updated.identity.sources, sources); assert.deepEqual(updated.retrieval, previous.retrieval);
  assert.equal(updated.kernelDigest, previous.kernelDigest);
  assert.equal(updated.identity.executable, sha(path.join(published, 'sfx-identity-host.dll')));
  assert.equal(updated.identity.dal, sha(path.join(published, 'SFX.Identity.DAL.dll')));
  for (const name of ['ui-explorer-region/ui-explorer-region.mjs', 'ui-shell-footer/ui-shell-footer.mjs', 'ui-shell-footer/assets/region.css'])
    assert.equal(updated.circuit.files['estate/ui-providers/' + name], sha(path.join(uiProviders, name)), 'UI provider file must be inventoried: ' + name);
  const refused = (out, ...extra) => spawnSync(process.execPath, [packager, previousFile, path.join(root, out), 'fixture-' + out, components, published, sourcesFile, ...extra], { encoding: 'utf8' });
  assert.match(refused('no-providers').stderr, /UI_PROVIDERS_REQUIRED/);
  fs.rmSync(path.join(uiProviders, 'ui-shell-footer', 'assets'), { recursive: true });
  assert.match(refused('no-footer-assets', uiProviders).stderr, /UI_PROVIDER_PACKAGE_INCOMPLETE: ui-shell-footer/);
  fs.writeFileSync(sourcesFile, JSON.stringify({ ...sources, dal: 'main' }));
  assert.notEqual(spawnSync(process.execPath, [packager, previousFile, path.join(root, 'unpinned'), 'fixture-unpinned', components, published, sourcesFile, uiProviders]).status, 0);
  console.log(JSON.stringify({ scope: 'stand-in composite packaging conformance', files: actual.length, base: next.composite.base,
    preserved: ['kernel', 'api', 'retrieval', 'identity', 'installed delivery', 'vault bootstrap'], website: false, uiProviders: ['ui-explorer-region', 'ui-shell-footer'],
    rejected: ['existing destination', 'mutable components image', 'same release id', 'incomplete components release', 'missing UI providers', 'incomplete UI provider package'], manifestComplete: true }));
} finally {
  // Only the mkdtemp-owned directory, never the input estate or a supplied path.
  fs.rmSync(root, { recursive: true, force: true });
}
