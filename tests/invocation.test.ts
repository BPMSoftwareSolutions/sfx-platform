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

test('an unreachable estate is reported as unreachable, never as a failed capability', async () => {
  // Port 1 is not listening; the client must not invent a disposition for this.
  const { invokeCapability } = await clientWith('http://127.0.0.1:1');
  const view = await invokeCapability('any-capability', {});
  assert.equal(view.status, 'UNAVAILABLE');
  if (view.status !== 'UNAVAILABLE') return;
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
    const view = await invokeCapability('resolve-sidefx-eligible-providers', { contractId: 'x' });
    assert.equal(view.status, 'EXECUTED');
    if (view.status !== 'EXECUTED') return;
    assert.equal(view.disposition, 'terminated');
    assert.equal(view.observationCount, 5);
    assert.equal(view.executionCount, 1);
    assert.deepEqual(view.outcome, { eligibleCount: 0 });
    // Provenance travels from the estate untouched.
    assert.equal(view.evidence.bodyStorage, 'MEMORY_ONLY');
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
    assert.equal(view.status, 'UNAVAILABLE');
    if (view.status !== 'UNAVAILABLE') return;
    assert.equal(view.code, 'BAD_RESPONSE');
  } finally { server.close(); }
});
