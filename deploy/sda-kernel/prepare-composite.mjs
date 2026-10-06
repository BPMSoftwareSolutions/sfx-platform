// Stage one composite image (revamp P2): this repository's host files and
// live-circuit/, plus a manifest naming the admitted components image they are
// combined with. The installed kernel, SDA API, retrieval and identity hosts and
// the vault bootstrap are copied from that exact image by Dockerfile.composite.
// node prepare-composite.mjs <previous-release.json> <fresh-destination> <release-id> <components-image@sha256>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyLiveCircuit } from './live-circuit.mjs';

const [previousFile, destination, id, componentsImage, extra] = process.argv.slice(2);
if (!previousFile || !destination || !id || !componentsImage || extra !== undefined)
  throw new Error('Expected previous-release.json fresh-destination release-id exact-components-image');
if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(id)) throw new Error('INVALID_RELEASE_ID');
if (!/^[^\s@]+@sha256:[a-f0-9]{64}$/.test(componentsImage)) throw new Error('EXACT_COMPONENTS_IMAGE_REQUIRED');
if (fs.existsSync(destination)) throw new Error('FRESH_RELEASE_DIRECTORY_REQUIRED');
const previous = JSON.parse(fs.readFileSync(previousFile, 'utf8'));
for (const value of [previous.kernelDigest, previous.retrieval?.executable, previous.retrieval?.dal, previous.identity?.executable, previous.identity?.dal])
  if (!/^sha256:[a-f0-9]{64}$/.test(value ?? '')) throw new Error('PREVIOUS_COMPOSITE_RELEASE_REQUIRED');
if (!previous.id || previous.id === id || !previous.kernelLanguage) throw new Error('PREVIOUS_RELEASE_REQUIRED');

const here = path.dirname(fileURLToPath(import.meta.url));
const dockerfile = fs.readFileSync(path.join(here, 'Dockerfile.composite'), 'utf8').replaceAll('\r\n', '\n');
const base = dockerfile.match(/^FROM (node:[^\s@]+@sha256:[a-f0-9]{64})\s*$/m)?.[1];
if (!base) throw new Error('PINNED_NODE_BASE_REQUIRED');
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: here, encoding: 'utf8' }).trim();
const runtime = path.join(destination, 'runtime');
fs.mkdirSync(path.join(runtime, 'host'), { recursive: true });
for (const name of ['gateway.mjs', 'api.mjs', 'initialize.sh', 'identity-policy.json', 'retrieval-policy.json'])
  fs.writeFileSync(path.join(runtime, 'host', name), fs.readFileSync(path.join(here, name), 'utf8').replaceAll('\r\n', '\n'));
copyLiveCircuit(runtime);

const sha = file => 'sha256:' + createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const files = {};
(function inventory(directory, relative = '') {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    const key = relative ? `${relative}/${entry.name}` : entry.name;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) inventory(file, key);
    else if (entry.isFile()) files[key] = sha(file);
    else throw new Error(`UNSUPPORTED_RELEASE_ENTRY: ${key}`);
  }
})(runtime);

const release = {
  id, builtAt: new Date().toISOString(),
  kernelDigest: previous.kernelDigest, kernelLanguage: previous.kernelLanguage,
  retrieval: previous.retrieval,
  // Binaries come from the components image; the placed policy is this repository's.
  identity: { ...previous.identity, policy: files['host/identity-policy.json'] },
  circuit: { app: files['estate/demo/circuit/app.js'], traversal: files['estate/demo/circuit/traversal.js'], sourceCommit, files },
  composite: { kind: 'composite', base, componentsImage, componentsRelease: previous.id, previousManifest: sha(previousFile), website: false }
};
fs.writeFileSync(path.join(runtime, 'release.json'), JSON.stringify(release, null, 2) + '\n');
fs.writeFileSync(path.join(destination, 'Dockerfile'), dockerfile);
fs.writeFileSync(path.join(destination, 'component-fingerprint.sh'),
  fs.readFileSync(path.join(here, 'component-fingerprint.sh'), 'utf8').replaceAll('\r\n', '\n'));
console.log(JSON.stringify({ destination, id, base, componentsImage, componentsRelease: previous.id, sourceCommit,
  placedFiles: Object.keys(files).length, kernelDigest: release.kernelDigest }));
