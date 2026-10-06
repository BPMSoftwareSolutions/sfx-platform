// Build only the declared private identity transport, never the SDA kernel.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { root, run } from './common.mjs';
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
console.log('Published identity transport from pinned provider and generated DAL commits.');
