import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { timingSafeEqual } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { createCommandServer, restrictCommandMapping } from '../services/capability-api/http-server.mjs';
import { createRunService } from '../services/capability-api/run-service.mjs';
import { commandResponseView } from '../lib/capability-api.ts';
import compiler from '../lib/lab/compiler.ts';
import invocation from '../lib/lab/invocation.ts';
const { verifyPublication, at } = compiler;
const { bindInput, runPublishedInput } = invocation;
const root = process.cwd();
const embody = path.resolve(process.env.SIDEFX_PROJECT_DIR ?? '../sfx-embody');
const read = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const publication = verifyPublication(await read(path.join(root, 'generated/lab-publication.json')));
const token = process.env.SIDEFX_SERVICE_TOKEN;
if (!token || token.length < 32) throw new Error('SERVICE_CREDENTIAL_REQUIRED');
const require = createRequire(new URL('../services/capability-api/package.json', import.meta.url));
const { createSidefx, loadConfiguration } = await import(pathToFileURL(require.resolve('sidefx-cli')));
const configuration = await loadConfiguration(process.env.SIDEFX_PROJECT_CONFIG ?? path.join(embody, 'sfx.config.json'), embody);
const mapping = restrictCommandMapping(configuration.mapping, await read(new URL('../services/capability-api/web-commands.json', import.meta.url)));
const sidefx = createSidefx({ mapping, deliveries: configuration.deliveries, estateRoot: configuration.estateRoot, timeoutMs: 120000 });
let windowStarted = Date.now(), calls = 0;
const runService = process.env.SIDEFX_RUN_DIRECTORY ? createRunService({
  directory: process.env.SIDEFX_RUN_DIRECTORY,
  admit(raw) {
    if (raw.publicationId !== publication.publicationId) throw new Error('PUBLICATION_STALE');
    const pilot = publication.pilots.find(p => p.profile.subject === raw.subject);
    if (!pilot) throw new Error('SUBJECT_NOT_PUBLISHED');
    bindInput(pilot, raw.editableValues ?? {}, raw.exampleSelection);
    if (Date.now() - windowStarted >= 60000) { windowStarted = Date.now(); calls = 0; }
    if (calls >= 20) throw new Error('RATE_LIMITED');
    calls++;
    return { subject: raw.subject, namespace: pilot.profile.namespace, scenarioId: pilot.authority.scenarioId,
      publicationId: publication.publicationId, authorityPins: pilot.authority.identity };
  },
  execute(raw, onObservation) {
    return runPublishedInput(publication, { publicationId: raw.publicationId, subject: raw.subject,
      values: raw.editableValues ?? {}, ...(raw.exampleSelection === undefined ? {} : { exampleId: raw.exampleSelection }) },
    async (subject, input, namespace) => {
      const started = Date.now();
      try {
        const result = await sidefx.execute({ object: 'capability', verb: 'invoke', subject, namespace, input }, { onObservation });
        return commandResponseView(subject, { result, durationMs: Date.now() - started });
      } catch (error) {
        return commandResponseView(subject, { error: { code: error.code ?? 'COMMAND_FAILED',
          message: error.code ? error.message : 'The command did not complete.', details: error.details ?? null },
        executionState: 'UNKNOWN', durationMs: Date.now() - started });
      }
    });
  },
}) : null;
const server = createCommandServer({ mapping, maxConcurrent: 2, maxBodyBytes: 65536, timeoutMs: 120000,
  handleRunRequest: runService?.handle,
  authenticate(request) {
    const supplied = Buffer.from(request.headers.authorization ?? ''), expected = Buffer.from('Bearer ' + token);
    return supplied.length === expected.length && timingSafeEqual(supplied, expected);
  },
  authorize(envelope) {
    const pilot = publication.pilots.find(p => p.profile.subject === envelope.subject && p.profile.namespace === envelope.namespace);
    if (!pilot) return false;
    if (Date.now() - windowStarted >= 60000) { windowStarted = Date.now(); calls = 0; }
    if (calls >= 20) return false;
    try {
      const valid = pilot.examples.length ? pilot.examples.some(e => isDeepStrictEqual(e.input, envelope.input))
        : isDeepStrictEqual(bindInput(pilot, Object.fromEntries(pilot.profile.inputs.filter(b => b.ownership === 'editable').map(b => [b.pointer, at(envelope.input, b.pointer)]))), envelope.input);
      if (valid) calls++;
      return valid;
    } catch { return false; }
  },
  execute: request => sidefx.execute(request)
});
server.listen(Number(process.env.PORT ?? 8080), '0.0.0.0', () => console.log(JSON.stringify({ status: 'listening', publicationId: publication.publicationId, pilots: publication.pilots.length })));
process.on('SIGTERM', () => server.close());
