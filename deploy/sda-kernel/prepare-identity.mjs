// Extend an installed release with a published identity host and observer assets.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { copyLiveCircuit, liveCircuitFile } from './live-circuit.mjs';

// The viewer and observer come from this repository's live-circuit/; the former
// estate-directory argument is retired and refused rather than ignored.
const [published, previousRelease, destination, id, retired] = process.argv.slice(2);
if (!published || !previousRelease || !destination || !id || retired !== undefined)
  throw new Error('Expected published-directory previous-release.json fresh-destination release-id');
if (fs.existsSync(destination)) throw new Error('FRESH_RELEASE_DIRECTORY_REQUIRED');
for (const name of ['sfx-identity-host', 'sfx-identity-host.dll', 'SFX.Identity.DAL.dll'])
  if (!fs.statSync(path.join(published, name)).isFile()) throw new Error('PUBLISHED_LINUX_IDENTITY_REQUIRED');
const runtime = path.join(destination, 'runtime'), here = path.dirname(fileURLToPath(import.meta.url));
fs.mkdirSync(path.join(runtime, 'host'), { recursive: true });
fs.cpSync(published, path.join(runtime, 'identity'), { recursive: true });
for (const name of ['gateway.mjs', 'identity-policy.json'])
  fs.writeFileSync(path.join(runtime, 'host', name), fs.readFileSync(path.join(here, name), 'utf8').replaceAll('\r\n', '\n'));
copyLiveCircuit(runtime);
const sha = file => 'sha256:' + createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const previous = JSON.parse(fs.readFileSync(previousRelease, 'utf8'));
const release = { ...previous, id, builtAt: new Date().toISOString(), identity: {
  executable: sha(path.join(published, 'sfx-identity-host.dll')),
  dal: sha(path.join(published, 'SFX.Identity.DAL.dll')),
  policy: sha(path.join(here, 'identity-policy.json')),
  traversal: sha(liveCircuitFile('traversal.js'))
} };
fs.writeFileSync(path.join(runtime, 'release.json'), JSON.stringify(release, null, 2) + '\n');
fs.copyFileSync(path.join(here, 'Dockerfile.identity'), path.join(destination, 'Dockerfile'));
console.log(JSON.stringify({ destination, ...release }));
