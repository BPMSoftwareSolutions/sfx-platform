import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import test from 'node:test';

/**
 * Capability invocation boundary — §8.3, §13.1.
 *
 * These check what the website is responsible for: that it reports honestly when it cannot
 * reach the estate, that an estate refusal keeps its own code rather than being flattened into
 * a generic failure, and that a real execution is carried through unchanged.
 *
 * The estate is stubbed deliberately. Whether a given capability executes is the estate's
 * answer, proven where it runs; this suite proves the site does not editorialise that answer.
 */

const listen = (handler: Parameters<typeof createServer>[1]): Promise<{ server: Server; origin: string }> =>
  new Promise(resolve => {
    const server = createServer(handler);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      resolve({ server, origin: `http://127.0.0.1:${port}` });
    });
  });

/** The client reads its endpoint per call, so a case only has to set the environment. */
async function clientWith(endpoint: string | undefined) {
  if (endpoint === undefined) delete process.env.SIDEFX_INVOCATION_ENDPOINT;
  else process.env.SIDEFX_INVOCATION_ENDPOINT = endpoint;
  return import('../lib/capability-api.ts');
}

test('with no endpoint configured the site executes nothing and says so', async () => {
  const { invokeCapability, invocationConfigured } = await clientWith(undefined);
  assert.equal(invocationConfigured(), false);
  const view = await invokeCapability('any-capability', {});
  assert.equal(view.status, 'UNAVAILABLE');
  if (view.status !== 'UNAVAILABLE') return;
  assert.equal(view.code, 'NOT_CONFIGURED');
});

test('an unreachable estate leaves execution unconfirmed', async () => {
  // Port 1 is not listening; the client must not invent a disposition for this.
  const { invokeCapability } = await clientWith('http://127.0.0.1:1');
  const view = await invokeCapability('any-capability', {});
  assert.equal(view.status, 'UNKNOWN');
  if (view.status !== 'UNKNOWN') return;
  assert.equal(view.code, 'UNREACHABLE');
});

test('an estate refusal keeps its own code and is not flattened into a failure', async () => {
  const { server, origin } = await listen((_request, response) => {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({
      error: { code: 'CAPABILITY_PREPARATION_REQUIRED', message: 'CAPABILITY_PREPARATION_REQUIRED' },
      durationMs: 12,
    }));
  });
  try {
    const { invokeCapability } = await clientWith(origin);
    const view = await invokeCapability('unprepared-capability', {});
    assert.equal(view.status, 'REFUSED');
    if (view.status !== 'REFUSED') return;
    assert.equal(view.code, 'CAPABILITY_PREPARATION_REQUIRED');
  } finally { server.close(); }
});

test('a real execution is carried through with its own disposition and testimony', async () => {
  const { server, origin } = await listen(async (request, response) => {
    // The envelope must stay entity-neutral: object/operation/subject are data.
    const body = await new Promise<string>(resolve => {
      const chunks: Buffer[] = [];
      request.on('data', c => chunks.push(c));
      request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });
    const envelope = JSON.parse(body);
    assert.equal(envelope.object, 'capability');
    assert.equal(envelope.operation, 'invoke');
    assert.equal(envelope.subject, 'resolve-sidefx-eligible-providers');
    assert.equal(envelope.namespace, 'sidefx');
    assert.deepEqual(envelope.input, { contractId: 'x' });
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({
      result: {
        capabilityId: 'resolve-sidefx-eligible-providers',
        scenarioId: 'resolve-sidefx-eligible-providers',
        result: { executionId: 'e1', scenarioId: 'resolve-sidefx-eligible-providers', disposition: 'terminated', outcome: { eligibleCount: 0 } },
        executions: [{}],
        observations: [{}, {}, {}, {}, {}],
        evidence: { authoritySource: 'DATABASE', bodyStorage: 'MEMORY_ONLY' },
      },
      durationMs: 2900,
    }));
  });
  try {
    const { invokeCapability } = await clientWith(origin);
    const view = await invokeCapability('resolve-sidefx-eligible-providers', { contractId: 'x' }, 'sidefx');
    assert.equal(view.status, 'EXECUTED');
    if (view.status !== 'EXECUTED') return;
    assert.equal(view.disposition, 'terminated');
    assert.equal(view.observationCount, 5);
    assert.equal(view.executionCount, 1);
    assert.deepEqual(view.outcome, { eligibleCount: 0 });
    // Provenance travels from the estate untouched.
    assert.equal(view.evidence.bodyStorage, 'MEMORY_ONLY');
    assert.equal(view.execution.observations.length, 5);
  } finally { server.close(); }
});

test('a domain rejection is an execution, not an error the site hides', async () => {
  const { server, origin } = await listen((_request, response) => {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({
      result: {
        capabilityId: 'c', scenarioId: 's',
        result: { executionId: 'e', scenarioId: 's', disposition: 'rejected', outcome: null },
        executions: [], observations: [{}], evidence: {},
      },
      durationMs: 3000,
    }));
  });
  try {
    const { invokeCapability } = await clientWith(origin);
    const view = await invokeCapability('c', { not: 'admissible' });
    assert.equal(view.status, 'EXECUTED');
    if (view.status !== 'EXECUTED') return;
    assert.equal(view.disposition, 'rejected');
  } finally { server.close(); }
});

test('an unreadable estate response never becomes a fabricated result', async () => {
  const { server, origin } = await listen((_request, response) => {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end('{"unexpected":true}');
  });
  try {
    const { invokeCapability } = await clientWith(origin);
    const view = await invokeCapability('c', {});
    assert.equal(view.status, 'UNKNOWN');
    if (view.status !== 'UNKNOWN') return;
    assert.equal(view.code, 'BAD_RESPONSE');
  } finally { server.close(); }
});

test('a failed kernel execution wrapped in an SDK error retains its full record', async () => {
  const execution = {
    capabilityId: 'c', scenarioId: 's',
    result: { executionId: 'e', scenarioId: 's', disposition: 'failed', outcome: null, error: { message: 'provider failed' } },
    executions: [{ executionId: 'e' }], observations: [{ sequence: 1, disposition: 'failed' }], evidence: { bodyStorage: 'MEMORY_ONLY' },
  };
  const { server, origin } = await listen((_request, response) => response.end(JSON.stringify({
    error: { code: 'CAPABILITY_EXECUTION_FAILED', message: 'failed', details: { result: { disposition: 'failed', outcome: execution } } },
    executionState: 'UNKNOWN', durationMs: 20,
  })));
  try {
    const { invokeCapability } = await clientWith(origin);
    const view = await invokeCapability('c', {});
    assert.equal(view.status, 'EXECUTED');
    if (view.status !== 'EXECUTED') return;
    assert.equal(view.disposition, 'failed');
    assert.deepEqual(view.execution, execution);
  } finally { server.close(); }
});

test('timing out after the service accepts a request does not claim that execution stopped', async t => {
  let accepted = false, finish!: () => void;
  const completed = new Promise<void>(resolve => { finish = resolve; });
  const { server, origin } = await listen(async (request, response) => {
    for await (const chunk of request) void chunk;
    accepted = true;
    setTimeout(() => { response.end('{}'); finish(); }, 150);
  });
  t.after(() => { server.closeAllConnections(); server.close(); });
  const previous = process.env.SIDEFX_INVOCATION_TIMEOUT_MS;
  try {
    process.env.SIDEFX_INVOCATION_TIMEOUT_MS = '100';
    const { invokeCapability } = await clientWith(origin);
    const view = await invokeCapability('c', {});
    assert.equal(accepted, true);
    assert.equal(view.status, 'UNKNOWN');
    await completed;
  } finally {
    if (previous === undefined) delete process.env.SIDEFX_INVOCATION_TIMEOUT_MS;
    else process.env.SIDEFX_INVOCATION_TIMEOUT_MS = previous;
  }
});

test('only explicit pre-dispatch errors or preparation refusals establish no execution', async () => {
  for (const [code, executionState, expected] of [
    ['COMMAND_CAPACITY_REACHED', 'NOT_STARTED', 'REFUSED'],
    ['DELIVERY_PROCESS_TIMEOUT', 'UNKNOWN', 'UNKNOWN'],
    ['COMMAND_FAILED', undefined, 'UNKNOWN'],
  ]) {
    const { server, origin } = await listen((_request, response) => response.end(JSON.stringify({ error: { code, message: code }, executionState })));
    try {
      const { invokeCapability } = await clientWith(origin);
      assert.equal((await invokeCapability('c', {})).status, expected);
    } finally { server.close(); }
  }
});
