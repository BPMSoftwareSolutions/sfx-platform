// Overlay platform transport files only; inherit installed services and vault.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyLiveCircuit } from './live-circuit.mjs';

const [previousFile, destination, id, baseImage, extra] = process.argv.slice(2);
if (!previousFile || !destination || !id || !baseImage || extra !== undefined)
  throw new Error('Expected previous-release.json fresh-destination release-id exact-base-image');
if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(id)) throw new Error('INVALID_RELEASE_ID');
if (!/^[^\s@]+@sha256:[a-f0-9]{64}$/.test(baseImage)) throw new Error('EXACT_BASE_IMAGE_REQUIRED');
if (fs.existsSync(destination)) throw new Error('FRESH_RELEASE_DIRECTORY_REQUIRED');
const previous = JSON.parse(fs.readFileSync(previousFile, 'utf8'));
if (!previous.id || previous.id === id || !/^sha256:[a-f0-9]{64}$/.test(previous.kernelDigest ?? '') || !previous.kernelLanguage)
  throw new Error('PREVIOUS_RELEASE_REQUIRED');
const here = path.dirname(fileURLToPath(import.meta.url));
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: here, encoding: 'utf8' }).trim();
const runtime = path.join(destination, 'runtime');
fs.mkdirSync(path.join(runtime, 'host'), { recursive: true });
fs.writeFileSync(path.join(runtime, 'host/gateway.mjs'), fs.readFileSync(path.join(here, 'gateway.mjs'), 'utf8').replaceAll('\r\n', '\n'));
copyLiveCircuit(runtime);
const sha = file => 'sha256:' + createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const files = {};
function inventory(directory, relative = '') {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    const key = relative ? `${relative}/${entry.name}` : entry.name;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) inventory(file, key);
    else if (entry.isFile()) files[key] = sha(file);
    else throw new Error(`UNSUPPORTED_RELEASE_ENTRY: ${key}`);
  }
}
inventory(runtime);
const release = {
  ...previous, id, builtAt: new Date().toISOString(),
  circuit: {
    app: files['estate/demo/circuit/app.js'], traversal: files['estate/demo/circuit/traversal.js'],
    sourceCommit, files
  },
  overlay: { kind: 'circuit', previousRelease: previous.id, baseImage, previousManifest: sha(previousFile) }
};
fs.writeFileSync(path.join(runtime, 'release.json'), JSON.stringify(release, null, 2) + '\n');
fs.copyFileSync(path.join(here, 'Dockerfile.circuit'), path.join(destination, 'Dockerfile'));
console.log(JSON.stringify({ destination, id, baseImage, sourceCommit, placedFiles: Object.keys(files).length, kernelDigest: release.kernelDigest }));
