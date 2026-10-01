// Package a verified installation and transport files; never compile capability
// meaning or copy the SDA checkout into the runtime image.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const [installed, estate, apiSource, destination] = process.argv.slice(2).map(value => path.resolve(value));
if (!destination || fs.existsSync(destination)) throw new Error('FRESH_RELEASE_DIRECTORY_REQUIRED');
const manifest = JSON.parse(fs.readFileSync(path.join(installed, 'kernel-install-manifest.json'), 'utf8'));
const digest = manifest.artifactDigest.replace(/^sha256:/, '');
const runtime = path.join(destination, 'runtime');
const installedTarget = '/opt/sfx/kernel/' + digest;
fs.mkdirSync(path.join(runtime, 'kernel'), { recursive: true });
const archived = spawnSync('tar', ['-czf', path.join(runtime, 'kernel.tar.gz'), '-C', path.dirname(installed), path.basename(installed)]);
if (archived.status !== 0) throw new Error('KERNEL_ARCHIVE_FAILED');
for (const relative of ['demo/circuit', 'demo/dispatch-pair/observe-server.mjs']) {
  fs.cpSync(path.join(estate, relative), path.join(runtime, 'estate', relative), { recursive: true });
}
const args = manifest.entryArgs.map(value => value.replaceAll('{installRoot}', installedTarget));
fs.writeFileSync(path.join(runtime, 'estate/sfx.config.json'), JSON.stringify({
  configurationType: 'sfx-project.v1', deliveries: { 'database-memory': {
    type: 'process', command: manifest.kernelLanguage === 'node' ? '/usr/local/bin/node' : installedTarget + '/' + manifest.entryPoint,
    cwd: installedTarget, args
  } }
}, null, 2));
for (const relative of ['services/sda-api/dist/src', 'services/sda-api/package.json',
  'interfaces/sda-api/sda-api-v1.authority.json', 'kernel/schemas/execution-graph-captured.v1.schema.json']) {
  fs.cpSync(path.join(apiSource, relative), path.join(runtime, 'api', relative), { recursive: true });
}
const here = path.dirname(fileURLToPath(import.meta.url));
for (const name of ['api.mjs', 'gateway.mjs', 'initialize.sh']) {
  fs.mkdirSync(path.join(runtime, 'host'), { recursive: true });
  fs.writeFileSync(path.join(runtime, 'host', name), fs.readFileSync(path.join(here, name), 'utf8').replaceAll('\r\n', '\n'));
}
fs.copyFileSync(path.join(here, 'Dockerfile'), path.join(destination, 'Dockerfile'));
fs.writeFileSync(path.join(runtime, 'release.json'), JSON.stringify({
  id: 'sda-' + digest.slice(0, 12), kernelDigest: manifest.artifactDigest,
  kernelLanguage: manifest.kernelLanguage, builtAt: new Date().toISOString()
}, null, 2));
console.log(JSON.stringify({ destination, kernelDigest: manifest.artifactDigest, kernelLanguage: manifest.kernelLanguage }));
