// Package the published retrieval executable beside the existing installation.
// No source checkout or credentials are copied into the runtime image.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const [published, previousRelease, destination, id, estate] = process.argv.slice(2);
if (!published || !previousRelease || !destination || !id) throw new Error('Expected published-directory previous-release.json fresh-destination release-id [estate-directory]');
if (fs.existsSync(destination)) throw new Error('FRESH_RELEASE_DIRECTORY_REQUIRED');
for (const name of ['procedure-extract', 'procedure-extract.dll', 'SFX.DAL.dll'])
  if (!fs.statSync(path.join(published, name)).isFile()) throw new Error('PUBLISHED_LINUX_RETRIEVAL_REQUIRED');
const runtime = path.join(destination, 'runtime'), here = path.dirname(fileURLToPath(import.meta.url));
fs.mkdirSync(path.join(runtime, 'host'), { recursive: true });
fs.cpSync(published, path.join(runtime, 'procedure-extract'), { recursive: true });
for (const name of ['gateway.mjs', 'retrieval-policy.json'])
  fs.writeFileSync(path.join(runtime, 'host', name), fs.readFileSync(path.join(here, name), 'utf8').replaceAll('\r\n', '\n'));
if (estate) for (const name of ['app.js', 'live-store.mjs', 'circuit-host.json']) {
  const to = path.join(runtime, 'estate/demo/circuit', name);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(path.join(estate, 'demo/circuit', name), to);
}
const sha = file => 'sha256:' + createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const previous = JSON.parse(fs.readFileSync(previousRelease, 'utf8'));
const release = { ...previous, id, builtAt: new Date().toISOString(), retrieval: {
  executable: sha(path.join(published, 'procedure-extract.dll')),
  dal: sha(path.join(published, 'SFX.DAL.dll')), circuitWired: Boolean(estate)
} };
fs.writeFileSync(path.join(runtime, 'release.json'), JSON.stringify(release, null, 2) + '\n');
fs.copyFileSync(path.join(here, 'Dockerfile.retrieval'), path.join(destination, 'Dockerfile'));
console.log(JSON.stringify({ destination, ...release }));
