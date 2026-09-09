import { createServer } from 'node:http';

// Policy selects entity types/operations; instance identities remain data.
export function restrictCommandMapping(mapping, policy) {
  if (policy?.policyType !== 'sidefx-web-commands.v1' || !Array.isArray(policy.commands)) throw new Error('WEB_COMMAND_POLICY_REQUIRED');
  const commands = Object.create(null);
  for (const entry of policy.commands) {
    if (typeof entry.object !== 'string' || typeof entry.operation !== 'string') throw new Error('WEB_COMMAND_POLICY_INVALID');
    const verbs = Object.hasOwn(mapping.commands ?? {}, entry.object) ? mapping.commands[entry.object] : {};
    if (Object.hasOwn(verbs, entry.operation)) {
      commands[entry.object] ??= Object.create(null);
      commands[entry.object][entry.operation] = verbs[entry.operation];
    }
  }
  return { ...mapping, commands };
}

const send = (response, status, body) => {
  if (response.destroyed || response.writableEnded) return;
  const text = JSON.stringify(body);
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(text), 'cache-control': 'no-store' });
  response.end(text);
};

function readBody(request, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0, exceeded = false;
    request.on('data', chunk => {
      if (exceeded) return;
      size += chunk.length;
      if (size > maxBytes) { exceeded = true; chunks.length = 0; reject(new Error('REQUEST_TOO_LARGE')); return; }
      chunks.push(chunk);
    });
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.on('aborted', () => reject(new Error('REQUEST_ABORTED')));
    request.on('error', reject);
  });
}

export function createCommandServer({ mapping, execute, maxConcurrent = 2, maxBodyBytes = 1_048_576, timeoutMs = 600_000 }) {
  if (![maxConcurrent, maxBodyBytes, timeoutMs].every(n => Number.isSafeInteger(n) && n > 0)) throw new Error('INVALID_COMMAND_LIMIT');
  let active = 0;
  const refuse = (response, status, code, message) => send(response, status, { error: { code, message }, executionState: 'NOT_STARTED' });
  const server = createServer(async (request, response) => {
    let url;
    try { url = new URL(request.url ?? '/', 'http://localhost'); }
    catch { return refuse(response, 400, 'INVALID_REQUEST', 'Invalid request URL.'); }
    if (request.method === 'GET' && url.pathname === '/healthz') return send(response, 200, { status: 'ok' });
    if (request.method === 'GET' && url.pathname === '/commands') {
      return send(response, 200, { commands: Object.entries(mapping.commands).flatMap(([object, verbs]) =>
        Object.entries(verbs).map(([operation, spec]) => ({ object, operation, input: Boolean(spec.input), namespace: Boolean(spec.namespace), description: spec.description ?? null }))) });
    }
    if (request.method !== 'POST' || url.pathname !== '/commands') return refuse(response, 404, 'NOT_FOUND', 'POST /commands is the only command surface.');
    let envelope;
    try { envelope = JSON.parse(await readBody(request, maxBodyBytes)); }
    catch (error) {
      const tooLarge = error.message === 'REQUEST_TOO_LARGE';
      return refuse(response, tooLarge ? 413 : 400, tooLarge ? 'REQUEST_TOO_LARGE' : 'INVALID_JSON', 'The request body must be bounded JSON.');
    }
    if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)
      || !Object.keys(envelope).every(key => ['object', 'operation', 'subject', 'namespace', 'input'].includes(key))
      || !['object', 'operation', 'subject'].every(key => typeof envelope[key] === 'string' && envelope[key].length)
      || (envelope.namespace !== undefined && (typeof envelope.namespace !== 'string' || !envelope.namespace.length))) {
      return refuse(response, 400, 'INVALID_REQUEST', 'Expected object, operation, subject and optional namespace/input.');
    }
    const { object, operation, subject, namespace, input } = envelope;
    if (!Object.hasOwn(mapping.commands, object) || !Object.hasOwn(mapping.commands[object], operation)) {
      return refuse(response, 403, 'COMMAND_NOT_PERMITTED', 'This command is not offered by the website.');
    }
    if (request.aborted || response.destroyed) return;
    // Reserve without yielding. Pending body reads cannot pass an earlier check
    // together and overrun the execution bound.
    if (active >= maxConcurrent) return refuse(response, 503, 'COMMAND_CAPACITY_REACHED', 'Another estate command is running. Retry shortly.');
    active += 1;
    const started = Date.now();
    try {
      const result = await execute({ object, verb: operation, subject,
        ...(namespace === undefined ? {} : { namespace }), ...(input === undefined ? {} : { input }) });
      send(response, 200, { result, durationMs: Date.now() - started });
    } catch (error) {
      // SDK errors can contain a failed kernel execution. Preserve the details;
      // an error alone cannot establish that execution never started.
      send(response, error?.code ? 200 : 500, {
        error: { code: error?.code ?? 'COMMAND_FAILED', message: error?.code ? error.message : 'The command did not complete.', details: error?.details ?? null },
        executionState: 'UNKNOWN', durationMs: Date.now() - started,
      });
    } finally { active -= 1; }
  });
  server.headersTimeout = timeoutMs + 30_000;
  server.requestTimeout = timeoutMs + 30_000;
  return server;
}
