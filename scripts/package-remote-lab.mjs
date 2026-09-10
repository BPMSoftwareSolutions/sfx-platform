import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const platform = process.cwd(), repos = path.dirname(platform);
const directory = path.join(platform, 'artifacts/deployment/backend');
await fs.mkdir(directory, { recursive: true });
const copy = async (source, dest) => { await fs.mkdir(path.dirname(dest), { recursive: true }); await fs.cp(source, dest, { recursive: true }); };
const select = async (name, entries, source = path.join(repos, name), target = path.join(directory, 'repos', name)) => {
  for (const entry of entries) await copy(path.join(source, entry), path.join(target, entry));
};
await select('sfx-embody', ['src', 'config', 'package.json', 'package-lock.json', 'sfx.config.json']);
await select('sidefx-database', ['src', 'config/harness.json', 'sql', 'package.json', 'package-lock.json'], path.resolve(repos, '../sidefx-database'), path.join(directory, 'sidefx-database'));
await select('sidefx-cli', ['src', 'bin', 'package.json', 'package-lock.json']);
await select('sfx-platform', ['lib/lab/compiler.ts', 'lib/lab/invocation.ts', 'lib/capability-api.ts', 'contracts/lab.ts', 'contracts/invocation.ts', 'tsconfig.json',
  'services/capability-api/http-server.mjs', 'services/capability-api/run-service.mjs', 'services/capability-api/web-commands.json', 'services/capability-api/package.json', 'services/capability-api/package-lock.json',
  'scripts/start-remote-lab.mjs', 'scripts/start-remote-container.sh', 'generated/lab-publication.json']);
const sda = path.join(directory, 'repos/scenario-driven-architecture');
try { await fs.access(path.join(sda, '.git')); }
catch { execFileSync('git', ['clone', '--no-hardlinks', path.join(repos, 'scenario-driven-architecture'), sda], { stdio: 'inherit', windowsHide: true }); }
await select('scenario-driven-architecture', ['tools/src', 'languages/typescript', 'package.json', 'artifacts/tools/dist', 'artifacts/tools/package.json'], path.join(repos, 'scenario-driven-architecture'), sda);
// Avoid carrying host-native dependency trees; Linux installs use the lockfiles.
for (const relative of ['node_modules', 'languages/typescript/node_modules']) {
  const target = path.resolve(sda, relative);
  if (!target.startsWith(path.resolve(directory) + path.sep)) throw new Error('PACKAGING_PATH_OUTSIDE_TARGET');
  await fs.rm(target, { recursive: true, force: true });
}
execFileSync('git', ['config', 'core.autocrlf', 'true'], { cwd: sda, windowsHide: true });
const publication = JSON.parse(await fs.readFile(path.join(platform, 'generated/lab-publication.json'), 'utf8'));
const configFile = path.join(directory, 'repos/sfx-embody/config/database-runtime.json');
const config = JSON.parse(await fs.readFile(configFile, 'utf8'));
config.invocationBindings = publication.pilots.map(p => ({ subject: p.profile.subject, namespace: p.profile.namespace, ...p.authority }));
await fs.writeFile(configFile, JSON.stringify(config, null, 2) + '\n');
const projectFile = path.join(directory, 'repos/sfx-embody/sfx.config.json');
const project = JSON.parse(await fs.readFile(projectFile, 'utf8'));
project.deliveries['database-memory'].args = project.deliveries['database-memory'].args.map(arg => arg === '--experimental-permission' ? '--permission' : arg);
await fs.writeFile(projectFile, JSON.stringify(project, null, 2) + '\n');
const databaseConfigFile = path.join(directory, 'sidefx-database/config/harness.json');
const databaseConfig = JSON.parse(await fs.readFile(databaseConfigFile, 'utf8'));
databaseConfig.connectionEnvironmentVariable = 'SIDEFX_SQL_CONNECTION_STRING';
await fs.writeFile(databaseConfigFile, JSON.stringify(databaseConfig, null, 2) + '\n');
const runtimePackage = { name: 'sidefx-remote-lab', private: true, dependencies: { ajv: '8.20.0', zod: '4.5.4', tsx: '4.23.13', typescript: '5.9.3' } };
await fs.writeFile(path.join(directory, 'repos/sfx-platform/package.json'), JSON.stringify(runtimePackage, null, 2) + '\n');
await copy(path.join(platform, 'services/capability-api/Dockerfile.lab'), path.join(directory, 'Dockerfile'));
console.log(JSON.stringify({ directory, publicationId: publication.publicationId }));
