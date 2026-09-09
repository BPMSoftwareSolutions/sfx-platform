import { readFile } from 'node:fs/promises';
import { createSidefx, loadConfiguration } from 'sidefx-cli';
import { createCommandServer, restrictCommandMapping } from './http-server.mjs';

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? '127.0.0.1';
const project = process.env.SIDEFX_PROJECT_DIR ?? process.cwd();
const timeoutMs = Number(process.env.SIDEFX_COMMAND_TIMEOUT_MS ?? 600_000);
const configuration = await loadConfiguration(process.env.SIDEFX_PROJECT_CONFIG, project);
const policy = JSON.parse(await readFile(new URL('./web-commands.json', import.meta.url), 'utf8'));
const mapping = restrictCommandMapping(configuration.mapping, policy);
const sidefx = createSidefx({ mapping, deliveries: configuration.deliveries,
  estateRoot: process.env.SIDEFX_ESTATE || configuration.estateRoot, timeoutMs });
const server = createCommandServer({ mapping, execute: request => sidefx.execute(request), timeoutMs,
  maxConcurrent: Number(process.env.SIDEFX_MAX_CONCURRENT ?? 2),
  maxBodyBytes: Number(process.env.SIDEFX_MAX_BODY_BYTES ?? 1_048_576) });
server.listen(port, host, () => console.log(JSON.stringify({ status: 'listening', host,
  port: server.address().port, project,
  commands: Object.entries(mapping.commands).flatMap(([object, verbs]) => Object.keys(verbs).map(verb => `${object} ${verb}`)) })));
