// Build only the declared private identity transport, never the SDA kernel.
// Runs outside the staging lock (Live Circuit checks). The manifest written
// beside the publish names the pinned sources and every file's SHA-256; the
// release verifies the downloaded artifact against it before packaging.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { root, run } from './common.mjs';
import { identityPublishManifest } from './identity-publish.mjs';
const sources = JSON.parse(fs.readFileSync(new URL('./identity-sources.json', import.meta.url)));
const directory = path.join(root, '.release-sources');
for (const [key, repository] of [['providers', 'sfx-providers'], ['dal', 'sfx-dal']]) {
  const checkout = path.join(directory, repository);
  assert.equal((await run('git', ['-C', checkout, 'rev-parse', 'HEAD'])).trim(), sources[key], 'Pinned source required');
  assert.equal((await run('git', ['-C', checkout, 'status', '--porcelain', '--untracked-files=no'])).trim(), '', 'Clean input required');
}
const published = path.join(root, 'artifacts/identity-publish');
assert(!fs.existsSync(published), 'Fresh identity publish directory required');
await run('dotnet', ['publish', path.join(directory, 'sfx-providers/providers/cli-login/host/LoginHost.csproj'),
  '-c', 'Release', '-r', 'linux-x64', '--self-contained', 'true', '-p:RestoreLockedMode=true', '-p:ContinuousIntegrationBuild=true', '-o', published],
  { publicDiagnostic: 'identity-build.json' });
fs.writeFileSync(path.join(root, 'artifacts/identity-publish.json'), JSON.stringify(identityPublishManifest(published, sources), null, 2) + '\n');
console.log('Published identity transport from pinned provider and generated DAL commits.');
