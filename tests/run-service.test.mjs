import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createServer } from 'node:http';
import { createRunService } from '../services/capability-api/run-service.mjs';

test('durable admission precedes completion; cursors, isolation, conflicts and restart reconciliation', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sidefx-run-test-'));
  t.after(() => { const resolved = path.resolve(dir); assert.ok(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep + 'sidefx-run-test-')); fs.rmSync(resolved, { recursive: true }); });
  let complete, calls = 0;
  const completion = new Promise(resolve => { complete = resolve; });
  const service = createRunService({ directory: dir, admit: raw => {
    if (raw.subject !== 'fixture') throw new Error('SUBJECT_NOT_PUBLISHED');
    return { subject: raw.subject, publicationId: raw.publicationId };
  }, execute: async (raw, emit) => { calls++; emit({ observationType: 'test', status: 'started' }); await completion;
    return { status: 'EXECUTED', capabilityId: raw.subject, outcome: { value: 42 } }; } });
  const server = createServer((req, res) => service.handle(req, res, { reserve: () => true, release: () => {} }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const base = 'http://127.0.0.1:' + server.address().port, owner = 'a'.repeat(64);
  const raw = { commandVersion: 'workbench-command.v1', requestId: 'request-1234', subject: 'fixture', publicationId: 'pin', editableValues: {} };
  const post = body => fetch(base + '/runs', { method: 'POST', headers: { 'x-workbench-session': owner }, body: JSON.stringify(body) });
  const accepted = await post(raw); assert.equal(accepted.status, 202);
  const admission = await accepted.json(); assert.ok(admission.runId);
  const observed = await fetch(base + '/runs/' + admission.runId, { headers: { 'x-workbench-session': owner } }).then(r => r.json());
  assert.equal(observed.state, 'EXECUTING'); assert.ok(observed.events.some(e => e.kind === 'execution.observation')); assert.equal(observed.result, undefined);
  assert.equal((await post(raw)).status, 200); assert.equal(calls, 1);
  assert.equal((await post({ ...raw, editableValues: { '/different': true } })).status, 409);
  assert.equal((await post({ ...raw, namespace: 'forged' })).status, 400);
  assert.equal((await fetch(base + '/runs/' + admission.runId, { headers: { 'x-workbench-session': 'b'.repeat(64) } })).status, 404);
  complete();
  for (let i = 0; i < 100 && service.snapshot(owner, admission.runId).state !== 'COMPLETED'; i++) await new Promise(r => setTimeout(r, 10));
  assert.equal(service.snapshot(owner, admission.runId).result.outcome.value, 42);
  const resumed = createRunService({ directory: dir, admit: () => { throw new Error('must not re-admit'); }, execute: () => { throw new Error('must not re-execute'); } });
  assert.equal(resumed.snapshot(owner, admission.runId).state, 'COMPLETED');
  assert.notEqual(resumed.snapshot(owner, admission.runId).serviceInstanceId, observed.serviceInstanceId);
  const after = await fetch(base + '/runs/' + admission.runId + '?after=' + observed.cursor, { headers: { 'x-workbench-session': owner } }).then(r => r.json());
  assert.ok(after.events.every(e => e.sequence > observed.cursor));
  assert.equal(new Set(after.events.map(e => e.eventId)).size, after.events.length);
});

test('inflight journal becomes unknown after restart and never re-executes', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sidefx-run-test-'));
  const file = path.join(dir, 'run-' + 'c'.repeat(64) + '.jsonl');
  fs.writeFileSync(file, JSON.stringify({ type: 'accepted', runId: 'run-' + 'c'.repeat(64), selection: { subject: 'fixture' }, ownerHash: 'owner', requestId: 'request', acceptedAt: 'then' }) + '\n');
  createRunService({ directory: dir, admit() {}, execute() { assert.fail('must never replay'); } });
  const records = fs.readFileSync(file, 'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(records.find(r => r.type === 'result').state, 'UNKNOWN');
  assert.equal(records.find(r => r.type === 'result').result.code, 'SERVICE_RESTARTED');
  assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir()) + path.sep + 'sidefx-run-test-'));
  fs.rmSync(dir, { recursive: true });
});
