// The identity publish travels from the checks workflow to the release as an
// artifact. Its manifest names the pinned sources and every file's digest.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
function files(directory, prefix = '') {
  return fs.readdirSync(path.join(directory, prefix), { withFileTypes: true }).flatMap(entry => {
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    return entry.isDirectory() ? files(directory, name) : [name];
  }).sort();
}
export function identityPublishManifest(directory, sources) {
  return { sources, files: Object.fromEntries(files(directory).map(name =>
    [name, 'sha256:' + createHash('sha256').update(fs.readFileSync(path.join(directory, name))).digest('hex')])) };
}
// The downloaded publish must be exactly the inventoried bytes built from the
// sources this release commit pins: nothing added, removed or changed.
export function verifyIdentityPublish(directory, manifest, sources) {
  assert.deepEqual(manifest.sources, sources, 'Identity publish was built from different pinned sources');
  assert.deepEqual(identityPublishManifest(directory, sources).files, manifest.files, 'Identity publish bytes differ from their build manifest');
}
