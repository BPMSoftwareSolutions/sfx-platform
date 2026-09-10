// Local integration host. The same renderer is used by the Next application;
// the native database delivery remains a separate restricted process.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import { createCommandServer, restrictCommandMapping } from '../services/capability-api/http-server.mjs';
import compiler from '../lib/lab/compiler.ts';
import invocation from '../lib/lab/invocation.ts';
const { verifyPublication, at } = compiler;
const { bindInput } = invocation;

const root = process.cwd();
const embody = path.resolve(process.argv[2] ?? '../sfx-embody');
const read = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const publication = verifyPublication(await read(path.join(root, 'generated/lab-publication.json')));
const original = await read(path.join(embody, 'sfx.config.json'));
const delivery = original.deliveries['database-memory'];
const runtimeFile = path.resolve(embody, delivery.args.at(-1));
const runtime = await read(runtimeFile);
for (const key of ['databaseRoot', 'sdaRoot']) runtime[key] = path.resolve(path.dirname(runtimeFile), runtime[key]);
runtime.invocationBindings = publication.pilots.map(p => ({ subject: p.profile.subject, namespace: p.profile.namespace, ...p.authority }));
const directory = path.join(root, 'artifacts/lab');
await fs.mkdir(directory, { recursive: true });
const boundRuntime = path.join(directory, 'runtime.json');
await fs.writeFile(boundRuntime, JSON.stringify(runtime, null, 2));
const config = structuredClone(original);
config.commands = path.resolve(embody, config.commands);
config.deliveries['database-memory'].cwd = embody;
config.deliveries['database-memory'].args = [...delivery.args.slice(0, -2), '--allow-fs-read=' + boundRuntime, delivery.args.at(-2), boundRuntime];
const configPath = path.join(directory, 'sfx.config.json');
await fs.writeFile(configPath, JSON.stringify(config, null, 2));
const require = createRequire(new URL('../services/capability-api/package.json', import.meta.url));
const { createSidefx, loadConfiguration } = await import(pathToFileURL(require.resolve('sidefx-cli')));
const configuration = await loadConfiguration(configPath, embody);
const policy = await read(new URL('../services/capability-api/web-commands.json', import.meta.url));
const mapping = restrictCommandMapping(configuration.mapping, policy);
const sidefx = createSidefx({ mapping, deliveries: configuration.deliveries, estateRoot: configuration.estateRoot, timeoutMs: 120_000 });
const server = createCommandServer({ mapping, maxConcurrent: 2, timeoutMs: 120_000,
  authorize(envelope) {
    const pilot = publication.pilots.find(p => p.profile.subject === envelope.subject && p.profile.namespace === envelope.namespace);
    if (!pilot) return false;
    try {
      if (pilot.examples.length) return pilot.examples.some(e => isDeepStrictEqual(e.input, envelope.input));
      const values = Object.fromEntries(pilot.profile.inputs.filter(b => b.ownership === 'editable').map(b => [b.pointer, at(envelope.input, b.pointer)]));
      return isDeepStrictEqual(bindInput(pilot, values), envelope.input);
    } catch { return false; }
  },
  execute: request => sidefx.execute(request) });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const endpoint = 'http://127.0.0.1:' + server.address().port;
const port = process.env.SIDEFX_LAB_PORT ?? '3010';
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', port], {
  cwd: root, windowsHide: true, stdio: 'inherit', env: { ...process.env, SIDEFX_LAB_ENABLED: '1',
    SIDEFX_INVOCATION_ENDPOINT: endpoint, SIDEFX_INVOCATION_TIMEOUT_MS: '130000' } });
console.log(JSON.stringify({ lab: `http://127.0.0.1:${port}/lab`, endpoint, publicationId: publication.publicationId, runtime: boundRuntime }));
const stop = () => { child.kill(); server.close(); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
child.on('exit', code => { server.close(); process.exitCode = code ?? 0; });
