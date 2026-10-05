// Packaging conformance only: stand-in manifest, no Azure/database/service calls.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sfx-circuit-package-'));
const packager = fileURLToPath(new URL('./prepare-circuit.mjs', import.meta.url));
const previous = { id: 'fixture-before', kernelDigest: 'sha256:' + 'a'.repeat(64), kernelLanguage: 'fixture',
  identity: { unchanged: true }, retrieval: { unchanged: true } };
const previousFile = path.join(root, 'previous.json'), destination = path.join(root, 'candidate');
const base = 'example.invalid/fixture@sha256:' + 'b'.repeat(64);
fs.writeFileSync(previousFile, JSON.stringify(previous));
const invoke = (out = destination, image = base) => spawnSync(process.execPath,
  [packager, previousFile, out, 'fixture-after', image], { encoding: 'utf8' });
try {
  const built = invoke(); assert.equal(built.status, 0, built.stderr);
  const runtime = path.join(destination, 'runtime');
  const next = JSON.parse(fs.readFileSync(path.join(runtime, 'release.json')));
  for (const key of ['identity', 'retrieval', 'kernelDigest', 'kernelLanguage']) assert.deepEqual(next[key], previous[key]);
  const actual = fs.readdirSync(runtime, { recursive: true, withFileTypes: true }).filter(entry => entry.isFile())
    .map(entry => path.relative(runtime, path.join(entry.parentPath, entry.name)).replaceAll('\\', '/')).sort();
  assert.deepEqual(actual, [...Object.keys(next.circuit.files), 'release.json'].sort(), 'Manifest must cover every placed file');
  for (const [name, digest] of Object.entries(next.circuit.files)) {
    assert(name === 'host/gateway.mjs' || name.startsWith('estate/demo/'), 'Only circuit and gateway may be overlaid');
    assert.equal('sha256:' + createHash('sha256').update(fs.readFileSync(path.join(runtime, name))).digest('hex'), digest);
  }
  assert(!fs.existsSync(path.join(runtime, 'estate/sfx.config.json')));
  assert(!fs.existsSync(path.join(runtime, 'kernel')));
  assert.equal(next.overlay.baseImage, base);
  assert.equal(next.overlay.previousRelease, previous.id);
  assert.notEqual(invoke().status, 0, 'Existing destinations must be refused');
  assert.notEqual(invoke(path.join(root, 'mutable'), 'example.invalid/fixture:latest').status, 0);
  console.log(JSON.stringify({ scope: 'stand-in packaging conformance', files: actual.length,
    preserved: ['kernel', 'identity', 'retrieval', 'installed delivery'],
    rejected: ['existing destination', 'mutable base tag'], manifestComplete: true }));
} finally {
  // Only the mkdtemp-owned directory, never the input estate or a supplied path.
  fs.rmSync(root, { recursive: true, force: true });
}
