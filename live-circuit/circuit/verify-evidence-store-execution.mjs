// Real staging execution + real SQL through the candidate private identity host.
// The parent creates/revokes disposable principals; credentials use stdin/env.
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import { serveRunApi } from './run-api.mjs';
import { evidenceRequest, captureStatus, decodeChunks } from './evidence-store.mjs';
import { apiRecord } from './observe-panel.js';
import { newRun, applyRecord } from './deck-trace.js';
import { evidenceModel } from './run-evidence.mjs';

let input = ''; for await (const chunk of process.stdin) input += chunk;
const identity = JSON.parse(input); input = '';
const endpoint = process.env.SDA_API_ENDPOINT, token = process.env.SDA_API_TOKEN;
assert(endpoint && token && process.env.SFX_EVIDENCE_EXECUTION_REQUEST, 'Explicit execution configuration required');
const request = JSON.parse(await readFile(process.env.SFX_EVIDENCE_EXECUTION_REQUEST, 'utf8'));
assert.equal(request.object, 'capability'); assert.equal(request.operation, 'observe');
process.env.SFX_IDENTITY_ENDPOINT = identity.endpoint;
process.env.SFX_EVIDENCE_SERVICE_KEY = identity.serviceKey;
let archiveOnly = false, server;
const checks = [];
const check = name => checks.push(name);
async function api(path) {
  const r = await fetch(endpoint.replace(/\/+$/, '') + path, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(90000) });
  assert.equal(r.status, 200, `Source status for ${path}`); return r.json();
}
try {
  server = http.createServer((req,res) => {
    serveRunApi(req,res,new URL(req.url,'http://localhost'),{ endpoint: archiveOnly ? '' : endpoint, token: archiveOnly ? '' : token, observeRequiresSession: true });
  });
  server.listen(0,'127.0.0.1'); await once(server,'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  const headers = { cookie: `__Host-sfx-session=${identity.bearer}` };
  const admitted = await fetch(origin+'/api/circuit/v1/runs',{ method:'POST', headers:{ ...headers, origin, 'content-type':'application/json','idempotency-key':randomUUID() }, body:JSON.stringify(request) });
  assert.equal(admitted.status,202); const admission = await admitted.json(); const id = admission.runId;
  assert(id); check('Fresh Observe admitted through candidate circuit host with validated principal');
  const deadline = Date.now()+180000;
  while (captureStatus(id)!=='complete' && Date.now()<deadline) await new Promise(r=>setTimeout(r,500));
  assert.equal(captureStatus(id),'complete','Durable capture must finish within three minutes');
  const run = await api('/v1/runs/'+id);
  assert.equal(run.state,'completed'); assert.equal(run.partial,false);
  const events = []; let cursor = 0;
  while (cursor<run.cursor) {
    const page = await api(`/v1/runs/${id}/events?after=${cursor}&limit=128`);
    assert(page.events.length); events.push(...page.events); cursor=events.at(-1).cursor;
  }
  const [graph,output,stored,chunks] = await Promise.all([
    api(`/v1/runs/${id}/graph`), api(`/v1/runs/${id}/output`),
    evidenceRequest(`/runs/${id}`,{bearer:identity.bearer}), evidenceRequest(`/runs/${id}/chunks`,{bearer:identity.bearer})
  ]);
  const retained = decodeChunks(chunks.chunks,id);
  assert.deepEqual(retained,events); assert.equal(retained.length,run.cursor);
  assert.deepEqual(stored.graph,graph); assert.deepEqual(stored.output,output);
  check('Every source event, graph and output matches durable SQL material');
  assert.equal(stored.trust,'NOT_EVALUATED');
  check('Missing executor attribution does not become a trust disposition');
  const sceneUrl = new URL('/api/circuit/v1/scenario',endpoint);
  sceneUrl.searchParams.set('capabilityId',request.subject); sceneUrl.searchParams.set('namespaceId',request.namespace);
  const sceneResponse = await fetch(sceneUrl,{signal:AbortSignal.timeout(90000)}); assert.equal(sceneResponse.status,200);
  const scene = await sceneResponse.json();
  function model(records) {
    const start = records.find(e=>e.kind==='run.started'); assert(start);
    const replay = newRun(apiRecord(start));
    for (const e of records.filter(e=>e.cursor>start.cursor)) {
      const record=apiRecord(e,e.kind==='graph.captured'?graph:undefined); if(record)applyRecord(replay,record);
    }
    assert.equal(replay.id,id);
    return evidenceModel(scene,replay,run);
  }
  const original=model(events), archive=model(retained);
  assert(original.timeline,original.held); assert.deepEqual(archive,original);
  check('Source and stored traces produce the identical circuit timeline, providers and terminal variant');
  archiveOnly=true;
  for (const [suffix,expected] of [['/output',output],['/graph',graph]]) {
    const r=await fetch(origin+`/api/circuit/v1/runs/${id}${suffix}`,{headers});assert.equal(r.status,200);assert.deepEqual(await r.json(),expected);
  }
  const stream=await fetch(origin+`/api/circuit/v1/runs/${id}/events/stream`,{headers}).then(r=>r.text());
  const frames=stream.split('\n\n').filter(Boolean);
  assert.equal(frames.length,events.length+1);
  const replayEvents=frames.slice(0,-1).map(frame=>JSON.parse(frame.split('\n').find(l=>l.startsWith('data: ')).slice(6)));
  assert.deepEqual(replayEvents,events);
  check('Authenticated archive routes replay the full fresh run with execution connection removed');
  console.log(JSON.stringify({ status:'PASS',capturedAt:new Date().toISOString(),
    basis:'Fresh staging capability execution; candidate circuit/identity hosts on loopback; live sfx-identity SQL. Candidate services are not deployed to staging.',
    runId:id,capability:request.subject,records:events.length,chunks:chunks.chunks.length,
    eventsDigest:createHash('sha256').update(JSON.stringify(events)).digest('hex'),
    outcome:original.terminal,durationMs:original.duration,scenarioMs:original.timeline.duration,
    operations:original.operations.length,providers:original.providers.length,trust:stored.trust,checks }));
} finally {
  server?.closeAllConnections(); if(server?.listening)await new Promise(r=>server.close(r));
  delete process.env.SFX_EVIDENCE_SERVICE_KEY;
}
