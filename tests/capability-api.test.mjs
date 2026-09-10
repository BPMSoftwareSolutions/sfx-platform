import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { request } from 'node:http';
import test from 'node:test';
import { createCommandServer, restrictCommandMapping } from '../services/capability-api/http-server.mjs';

const policy = JSON.parse(readFileSync(new URL('../services/capability-api/web-commands.json', import.meta.url)));
const mapping = restrictCommandMapping({ commands: {
  capability: { invoke: { input: true, namespace: true }, prepare: {} },
  estate: { publish: {} },
} }, policy);
const envelope = { object: 'capability', operation: 'invoke', subject: 'c', input: { unchanged: ['x', null] }, namespace: 'n' };

async function service(t, execute, options = {}) {
  const server = createCommandServer({ mapping, execute, ...options });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  return { server, origin, post: async (body = envelope) => {
    const response = await fetch(`${origin}/commands`, { method: 'POST', body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  } };
}

test('configured input authorization fails closed before dispatch', async t => {
  let calls = 0;
  for (const authorize of [() => false, () => { throw new Error('policy unavailable'); }, () => Promise.resolve(true)]) {
    const { post } = await service(t, async () => { calls++; }, { authorize });
    const response = await post();
    assert.equal(response.status, 403); assert.equal(response.body.executionState, 'NOT_STARTED');
  }
  const { post } = await service(t, async () => { calls++; return {}; }, { authorize: request => request.subject === 'c' });
  assert.equal((await post()).status, 200); assert.equal(calls, 1);
});

test('web policy hides and blocks preparation and every unoffered command before dispatch', async t => {
  let calls = 0;
  const { origin, post } = await service(t, async () => { calls++; return {}; });
  const advertised = await (await fetch(`${origin}/commands`)).json();
  assert.deepEqual(advertised.commands.map(({ object, operation }) => [object, operation]), [['capability', 'invoke']]);
  assert.deepEqual(Object.keys(mapping.commands.capability), ['invoke']);
  for (const [object, operation] of [['capability', 'prepare'], ['estate', 'publish'], ['toString', 'invoke'], ['capability', 'constructor']]) {
    const response = await post({ ...envelope, object, operation });
    assert.equal(response.status, 403);
    assert.equal(response.body.executionState, 'NOT_STARTED');
  }
  assert.equal(calls, 0);
});

test('the HTTP envelope preserves namespace and canonical input and rejects extra control fields', async t => {
  const calls = [];
  const { post } = await service(t, async value => { calls.push(value); return { answer: 1 }; });
  assert.equal((await post({ ...envelope, provider: 'override' })).status, 400);
  assert.equal(calls.length, 0);
  assert.equal((await post()).status, 200);
  assert.deepEqual(calls, [{ object: 'capability', verb: 'invoke', subject: 'c', namespace: 'n', input: envelope.input }]);
});

test('overlapping slow body uploads cannot overrun the command capacity', { timeout: 5000 }, async t => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let active = 0, peak = 0;
  const { origin, post, server } = await service(t, async () => {
    active++; peak = Math.max(peak, active);
    try { await gate; return {}; } finally { active--; }
  }, { maxConcurrent: 1 });
  t.after(() => release());
  const body = JSON.stringify(envelope);
  let uploads = 0;
  const allStarted = new Promise(resolve => server.on('request', () => { if (++uploads === 3) resolve(); }));
  let refused = 0, sawRefusals;
  const bothRefused = new Promise(resolve => { sawRefusals = resolve; });
  const pending = Array.from({ length: 3 }, () => {
    let req;
    const result = new Promise((resolve, reject) => {
      req = request(`${origin}/commands`, { method: 'POST', headers: { 'content-length': Buffer.byteLength(body) } }, response => {
        response.resume();
        response.on('end', () => {
          if (response.statusCode === 503 && ++refused === 2) sawRefusals();
          resolve(response.statusCode);
        });
      });
      req.on('error', reject);
      req.write(body.slice(0, 1));
    });
    return { result, finish: () => req.end(body.slice(1)) };
  });
  await allStarted;
  pending.forEach(item => item.finish());
  await bothRefused;
  release();
  assert.deepEqual((await Promise.all(pending.map(item => item.result))).sort(), [200, 503, 503]);
  assert.equal(peak, 1);
  assert.equal((await post()).status, 200, 'capacity released after completion');
});

test('SDK failure details survive HTTP and capacity is released after a throw', async t => {
  const details = { result: { outcome: { result: { disposition: 'failed', error: { message: 'fixture' } } } } };
  let calls = 0;
  const { post } = await service(t, async () => {
    if (++calls === 1) throw Object.assign(new Error('failed'), { code: 'CAPABILITY_EXECUTION_FAILED', details });
    return {};
  }, { maxConcurrent: 1 });
  const failed = await post();
  assert.deepEqual(failed.body.error.details, details);
  assert.equal(failed.body.executionState, 'UNKNOWN');
  assert.equal((await post()).status, 200);
});

test('oversized bodies are refused without dispatch', async t => {
  let calls = 0;
  const { post } = await service(t, async () => { calls++; }, { maxBodyBytes: 10 });
  assert.equal((await post()).status, 413);
  assert.equal(calls, 0);
});
