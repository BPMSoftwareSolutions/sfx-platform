import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import test from 'node:test';

/**
 * SDA run API boundary — §13.1, interfaces/sda-api/sda-api-v1.authority.json.
 *
 * These check what the website is responsible for: that it reports honestly when it cannot reach
 * the run API, that an admission refusal keeps the estate's own code, that a real run is carried
 * through with its terminal state and lean output, and that a lost response never fabricates one.
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
  if (endpoint === undefined) delete process.env.SDA_API_ENDPOINT;
  else process.env.SDA_API_ENDPOINT = endpoint;
  process.env.SDA_POLL_INTERVAL_MS = '10';
  return import('../lib/sda-api.ts');
}

const runResource = (overrides: Record<string, unknown> = {}) => ({
  runId: 'run-fixture-0001',
  state: 'executing',
  capability: { object: 'capability', operation: 'observe', subject: 'say-hello-world' },
  createdAt: '2026-09-23T00:00:00.000Z',
  cursor: 0,
  output: { available: false, bytes: 0, byteCap: 1048576, overflow: false },
  ...overrides,
});

const event = (cursor: number, kind: string, payload: unknown) => ({ cursor, at: '2026-09-23T00:00:00.000Z', kind, payload });

const eventPage = (state: string, terminal: boolean, events: unknown[], hasMore = false) => ({
  runId: 'run-fixture-0001',
  state,
  terminal,
  events,
  nextCursor: events.length ? (events[events.length - 1] as { cursor: number }).cursor : 0,
  latestCursor: events.length ? (events[events.length - 1] as { cursor: number }).cursor : 0,
  hasMore,
});

test('with no endpoint configured the site executes nothing and says so', async () => {
  const { invokeCapabilityToView, sdaApiConfigured } = await clientWith(undefined);
  assert.equal(sdaApiConfigured(), false);
  const view = await invokeCapabilityToView('any-capability', {});
  assert.equal(view.status, 'UNAVAILABLE');
  if (view.status !== 'UNAVAILABLE') return;
  assert.equal(view.code, 'NOT_CONFIGURED');
});

test('an unreachable run API leaves execution unconfirmed', async () => {
  // Port 1 is not listening; the client must not invent a disposition for this.
  const { invokeCapabilityToView } = await clientWith('http://127.0.0.1:1');
  const view = await invokeCapabilityToView('any-capability', {});
  assert.equal(view.status, 'UNKNOWN');
  if (view.status !== 'UNKNOWN') return;
  assert.equal(view.code, 'UNREACHABLE');
});

test('an admission refusal keeps the run API code and is not flattened into a failure', async () => {
  const { server, origin } = await listen((_request, response) => {
    response.writeHead(400, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: { code: 'INVALID_REQUEST', message: 'V1 admits only object=capability, operation=observe.' } }));
  });
  try {
    const { invokeCapabilityToView } = await clientWith(origin);
    const view = await invokeCapabilityToView('unprepared-capability', {});
    assert.equal(view.status, 'REFUSED');
    if (view.status !== 'REFUSED') return;
    assert.equal(view.code, 'INVALID_REQUEST');
  } finally { server.close(); }
});

test('a real run is carried through with its terminal state, lane and lean output', async () => {
  const { server, origin } = await listen(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (request.method === 'POST' && url.pathname === '/v1/runs') {
      const body = await new Promise<string>(resolve => {
        const chunks: Buffer[] = [];
        request.on('data', chunk => chunks.push(chunk));
        request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      });
      const submission = JSON.parse(body);
      assert.equal(submission.object, 'capability');
      assert.equal(submission.operation, 'observe');
      assert.equal(submission.subject, 'say-hello-world');
      assert.deepEqual(submission.input, { contractId: 'hello-world-request.v1', payload: {} });
      assert.equal(request.headers.authorization, 'Bearer test-token');
      response.writeHead(202, { 'content-type': 'application/json' });
      response.end(JSON.stringify(runResource()));
      return;
    }
    if (url.pathname.endsWith('/events')) {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify(eventPage('completed', true, [
        event(1, 'run.admitted', { object: 'capability', operation: 'observe', subject: 'say-hello-world' }),
        event(2, 'run.started', { pid: 42 }),
        event(3, 'delivery-phase', { observationType: 'delivery-phase', phase: 'executeDeclaredGraph', status: 'completed' }),
        event(4, 'observation', { testimonyType: 'cell-execution-testimony.v1', cellAltitude: 'scenario', outcomeVariant: 'TERMINAL', disposition: 'completed' }),
        event(5, 'run.exited', { exitCode: 0, durationMs: 2600 }),
      ])));
      return;
    }
    if (url.pathname.endsWith('/output')) {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ contractId: 'hello-world-greeting.v1', payload: { message: 'Hello, World!' } }));
      return;
    }
    response.writeHead(404, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: { code: 'ROUTE_NOT_FOUND', message: 'No route.' } }));
  });
  const previous = process.env.SDA_API_TOKEN;
  process.env.SDA_API_TOKEN = 'test-token';
  try {
    const { invokeCapabilityToView } = await clientWith(origin);
    const view = await invokeCapabilityToView('say-hello-world', { contractId: 'hello-world-request.v1', payload: {} });
    assert.equal(view.status, 'EXECUTED');
    if (view.status !== 'EXECUTED') return;
    assert.equal(view.disposition, 'terminated');
    assert.equal(view.observationCount, 5);
    assert.deepEqual(view.outcome, { contractId: 'hello-world-greeting.v1', payload: { message: 'Hello, World!' } });
    // The lean endpoint carries no evidence inline; provenance stays referenced.
    assert.deepEqual(view.evidence, {});
    assert.equal(view.execution.observations.length, 5);
  } finally {
    if (previous === undefined) delete process.env.SDA_API_TOKEN;
    else process.env.SDA_API_TOKEN = previous;
    server.close();
  }
});

test('a terminal page that still has more drains the lane before the run is reported', async () => {
  // The host sets `terminal` from the run record alone, so a terminal page can still leave
  // undrained events behind. The lab path must keep reading until `hasMore` is false or its
  // observation count stops at the page bound and undercounts the run.
  const { server, origin } = await listen(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (request.method === 'POST') {
      response.writeHead(202, { 'content-type': 'application/json' });
      response.end(JSON.stringify(runResource()));
      return;
    }
    if (url.pathname.endsWith('/events')) {
      const after = Number(url.searchParams.get('after') ?? '0');
      response.writeHead(200, { 'content-type': 'application/json' });
      if (after < 2) {
        response.end(JSON.stringify(eventPage('completed', true, [
          event(1, 'run.admitted', {}),
          event(2, 'run.started', { pid: 42 }),
        ], true)));
      } else {
        response.end(JSON.stringify(eventPage('completed', true, [
          event(3, 'observation', { testimonyType: 'cell-execution-testimony.v1', cellId: 'cell:scenario:root', disposition: 'completed' }),
        ], false)));
      }
      return;
    }
    if (url.pathname.endsWith('/output')) {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ contractId: 'fixture.v1', payload: {} }));
      return;
    }
    response.writeHead(404, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: { code: 'ROUTE_NOT_FOUND', message: 'No route.' } }));
  });
  try {
    const { invokeCapabilityToView } = await clientWith(origin);
    const view = await invokeCapabilityToView('c', {});
    assert.equal(view.status, 'EXECUTED');
    if (view.status !== 'EXECUTED') return;
    assert.equal(view.observationCount, 3, 'the drained lane carries the union of both pages');
    const cursors = view.execution.observations.map((observation) => (observation as { cursor: number }).cursor);
    assert.deepEqual(cursors, [1, 2, 3]);
  } finally { server.close(); }
});

test('a failed terminal state is an execution, not a site failure', async () => {
  const { server, origin } = await listen(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (request.method === 'POST') {
      response.writeHead(202, { 'content-type': 'application/json' });
      response.end(JSON.stringify(runResource()));
      return;
    }
    if (url.pathname.endsWith('/events')) {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify(eventPage('failed', true, [
        event(1, 'run.admitted', {}),
        event(2, 'run.exited', { exitCode: 2, failure: { code: 'RUN_FAILED', message: 'CLI child exited with code 2.' } }),
      ])));
      return;
    }
    response.writeHead(409, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: { code: 'OUTPUT_UNAVAILABLE', message: 'The run produced no scenario output.' } }));
  });
  try {
    const { invokeCapabilityToView } = await clientWith(origin);
    const view = await invokeCapabilityToView('c', {});
    assert.equal(view.status, 'EXECUTED');
    if (view.status !== 'EXECUTED') return;
    assert.equal(view.disposition, 'failed');
  } finally { server.close(); }
});

test('losing the observation lane after admission establishes nothing about dispatch', async () => {
  const { server, origin } = await listen(async (request, response) => {
    if (request.method === 'POST') {
      response.writeHead(202, { 'content-type': 'application/json' });
      response.end(JSON.stringify(runResource()));
      return;
    }
    response.writeHead(500, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Unexpected host fault.' } }));
  });
  try {
    const { invokeCapabilityToView } = await clientWith(origin);
    const view = await invokeCapabilityToView('c', {});
    assert.equal(view.status, 'UNKNOWN');
    if (view.status !== 'UNKNOWN') return;
    assert.equal(view.code, 'INTERNAL_ERROR');
  } finally { server.close(); }
});

test('namespace is forwarded only when the run API can represent it', async () => {
  const bodies: Array<Record<string, unknown>> = [];
  const { server, origin } = await listen(async (request, response) => {
    if (request.method === 'POST' && new URL(request.url ?? '/', 'http://localhost').pathname === '/v1/runs') {
      const body = await new Promise<string>(resolve => {
        const chunks: Buffer[] = [];
        request.on('data', chunk => chunks.push(chunk));
        request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      });
      bodies.push(JSON.parse(body));
      response.writeHead(202, { 'content-type': 'application/json' });
      response.end(JSON.stringify(runResource()));
      return;
    }
    if (new URL(request.url ?? '/', 'http://localhost').pathname.endsWith('/events')) {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify(eventPage('completed', true, [event(1, 'run.exited', { exitCode: 0 })])));
      return;
    }
    response.writeHead(409, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: { code: 'OUTPUT_UNAVAILABLE', message: 'The run produced no scenario output.' } }));
  });
  try {
    const { invokeCapabilityToView } = await clientWith(origin);
    await invokeCapabilityToView('c', {}, 'sidefx:capabilities');
    await invokeCapabilityToView('c', {}, 'capabilities');
    assert.equal('namespace' in bodies[0], false);
    assert.equal(bodies[1].namespace, 'capabilities');
  } finally { server.close(); }
});

test('an unreadable admission response never becomes a fabricated result', async () => {
  const { server, origin } = await listen((_request, response) => {
    response.writeHead(202, { 'content-type': 'application/json' });
    response.end('{"unexpected":true}');
  });
  try {
    const { invokeCapabilityToView } = await clientWith(origin);
    const view = await invokeCapabilityToView('c', {});
    assert.equal(view.status, 'UNKNOWN');
    if (view.status !== 'UNKNOWN') return;
    assert.equal(view.code, 'BAD_RESPONSE');
  } finally { server.close(); }
});
