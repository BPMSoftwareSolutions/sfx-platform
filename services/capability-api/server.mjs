import { createServer } from 'node:http';
import { createSidefx, loadCommandMapping, loadConfiguration, SidefxError } from 'sidefx-cli';

/**
 * Capability command API — §7, §8.7, §13.3.
 *
 * An HTTP transport over the existing `sfx` SDK. It runs *beside* the web process and owns the
 * database boundary, so the website keeps its §11.1 invariant: the web process never opens a
 * database connection and never embeds a runtime.
 *
 * Entity neutrality (sidefx-cli's architecture invariant) is preserved literally: there is one
 * route, and `object`/`operation`/`subject` are data on the request envelope. No capability,
 * verb or vendor appears in a path, a branch or a dispatch table here. Adding a capability to
 * the estate adds nothing to this file.
 *
 * The request envelope is forwarded unchanged; canonical input is never rewritten. Estate
 * results — including a domain rejection — are returned as the estate reported them.
 */

const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? '0.0.0.0';
/** Project whose sfx.config.json declares the process bindings (the sfx-embody workspace). */
const PROJECT_DIR = process.env.SIDEFX_PROJECT_DIR ?? process.cwd();
const CONFIG_PATH = process.env.SIDEFX_PROJECT_CONFIG;
const TIMEOUT_MS = Number(process.env.SIDEFX_COMMAND_TIMEOUT_MS ?? 600_000);
const MAX_BODY_BYTES = Number(process.env.SIDEFX_MAX_BODY_BYTES ?? 1_048_576);
/** One estate command at a time by default: each holds a database connection and a runtime. */
const MAX_CONCURRENT = Number(process.env.SIDEFX_MAX_CONCURRENT ?? 2);

const configuration = await loadConfiguration(CONFIG_PATH, PROJECT_DIR);
const mapping = configuration.mapping ?? (await loadCommandMapping(configuration));
const sidefx = createSidefx({
  mapping,
  deliveries: configuration.deliveries,
  estateRoot: process.env.SIDEFX_ESTATE || configuration.estateRoot,
  timeoutMs: TIMEOUT_MS,
});

let active = 0;

const send = (response, status, body) => {
  const text = JSON.stringify(body);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(text),
    'cache-control': 'no-store',
  });
  response.end(text);
};

const readBody = request => new Promise((resolve, reject) => {
  const chunks = [];
  let size = 0;
  request.on('data', chunk => {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) { reject(new Error('REQUEST_TOO_LARGE')); request.destroy(); return; }
    chunks.push(chunk);
  });
  request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  request.on('error', reject);
});

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);

  if (request.method === 'GET' && url.pathname === '/healthz') {
    return send(response, 200, { status: 'ok' });
  }

  /** The offered command surface, read from the mapping rather than restated here. */
  if (request.method === 'GET' && url.pathname === '/commands') {
    return send(response, 200, {
      commands: Object.entries(mapping.commands ?? {}).flatMap(([object, verbs]) =>
        Object.entries(verbs).map(([operation, spec]) => ({
          object, operation, input: Boolean(spec.input), namespace: Boolean(spec.namespace),
          description: spec.description ?? null,
        }))),
    });
  }

  if (request.method !== 'POST' || url.pathname !== '/commands') {
    return send(response, 404, { error: { code: 'NOT_FOUND', message: 'POST /commands is the only command surface.' } });
  }

  if (active >= MAX_CONCURRENT) {
    return send(response, 503, {
      error: { code: 'COMMAND_CAPACITY_REACHED', message: 'Another estate command is running. Retry shortly.' },
    });
  }

  let envelope;
  try {
    envelope = JSON.parse(await readBody(request));
  } catch (error) {
    const tooLarge = error instanceof Error && error.message === 'REQUEST_TOO_LARGE';
    return send(response, tooLarge ? 413 : 400, {
      error: { code: tooLarge ? 'REQUEST_TOO_LARGE' : 'INVALID_JSON', message: 'The request body must be JSON.' },
    });
  }

  const { object, operation, subject, namespace, input } = envelope ?? {};
  if (typeof object !== 'string' || typeof operation !== 'string' || typeof subject !== 'string') {
    return send(response, 400, {
      error: { code: 'INVALID_REQUEST', message: 'object, operation and subject are required strings.' },
    });
  }

  active += 1;
  const started = Date.now();
  try {
    // The SDK validates the request against the mapping and owns delivery. A command the
    // estate does not offer fails as exactly that; nothing is substituted here.
    const result = await sidefx.execute({
      object, verb: operation, subject,
      ...(namespace === undefined ? {} : { namespace }),
      ...(input === undefined ? {} : { input }),
    });
    return send(response, 200, { result, durationMs: Date.now() - started });
  } catch (error) {
    if (error instanceof SidefxError || error?.code) {
      // Estate refusals keep their own code and details — CAPABILITY_PREPARATION_REQUIRED,
      // CAPABILITY_PREPARATION_STALE and CAPABILITY_NOT_FOUND all reach the caller intact.
      return send(response, 200, {
        error: { code: error.code, message: error.message, details: error.details ?? null },
        durationMs: Date.now() - started,
      });
    }
    return send(response, 500, {
      error: { code: 'COMMAND_FAILED', message: 'The command did not complete.' },
      durationMs: Date.now() - started,
    });
  } finally {
    active -= 1;
  }
});

server.headersTimeout = TIMEOUT_MS + 30_000;
server.requestTimeout = TIMEOUT_MS + 30_000;
server.listen(PORT, HOST, () => {
  console.log(JSON.stringify({
    status: 'listening', host: HOST, port: PORT, project: PROJECT_DIR,
    commands: Object.entries(mapping.commands ?? {}).flatMap(([o, v]) => Object.keys(v).map(x => `${o} ${x}`)),
  }));
});
