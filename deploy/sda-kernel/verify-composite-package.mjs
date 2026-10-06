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
    assert(host.includes(name) || name.startsWith('estate/demo/'), 'Only host files and the circuit are placed: ' + name);
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
  console.log(JSON.stringify({ scope: 'stand-in composite packaging conformance', files: actual.length, base: next.composite.base,
    preserved: ['kernel', 'api', 'retrieval', 'identity', 'installed delivery', 'vault bootstrap'], website: false,
    rejected: ['existing destination', 'mutable components image', 'same release id', 'incomplete components release'], manifestComplete: true }));
} finally {
  // Only the mkdtemp-owned directory, never the input estate or a supplied path.
  fs.rmSync(root, { recursive: true, force: true });
}
