// Called by the identity evidence integration harness over a private stdin pipe.
// Uses the live identity database, and explicit retained-event API fixtures.
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { evidenceRequest, captureRun, captureStatus, decodeChunks, traceChunk } from './evidence-store.mjs';
import { serveRunApi } from './run-api.mjs';
import { newRun, applyRecord } from './deck-trace.js';
import { apiRecord } from './observe-panel.js';
import { evidenceModel } from './run-evidence.mjs';
let input = ''; for await (const chunk of process.stdin) input += chunk;
const { endpoint, serviceKey, bearer } = JSON.parse(input); input = '';
const deck = JSON.parse(await readFile(new URL('../../docs/replay-timing-fidelity/scene.json', import.meta.url), 'utf8'));
const lines = (await readFile(new URL('../../docs/replay-timing-fidelity/capture.sse', import.meta.url), 'utf8')).split(/\r?\n/).filter(l => l.startsWith('data: ')).map(l => JSON.parse(l.slice(6)));
const groups = []; let selected;
for (const r of lines) { if (r.kind === 'run-start') { selected = []; groups.push(selected); } selected?.push(r); }
const records = groups.findLast(g => g.some(r => r.payload?.graphId === 'graph:' + deck.capabilityId));
records.splice(records.findIndex(r => r.kind === 'run-end') + 1);
const runId = 'fixture-' + randomUUID();
const graph = records.find(r => r.payload?.observationType === 'execution-graph-captured.v1').payload;
const events = records.map((r,i) => ({ cursor: i + 1, eventId: `urn:sda-api:run-event:${runId}:${i + 1}`, runId,
  at: r.payload?.at ?? r.receivedAt, kind: r.kind === 'run-start' ? 'run.started' : r.kind === 'run-end' ? 'run.exited' : r.payload?.observationType === 'execution-graph-captured.v1' ? 'graph.captured' : 'observation', payload: r.payload }));
const run = { runId, state: 'completed', partial: false, cursor: events.length, startedAt: events[0].at, endedAt: events.at(-1).at, exitCode: 0 };
const output = { fixture: 'Retained-capture transport validation; no fresh execution' };
const send = (res, status, data) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(data)); };
let outage = true, lostAck = true;
const identity = http.createServer(async (req,res) => {
  let body = ''; for await (const chunk of req) body += chunk;
  if (req.method === 'POST' && req.url.endsWith('/chunks') && outage) { outage = false; return send(res, 503, {}); }
  const upstream = await fetch(endpoint + req.url, { method: req.method, body: body || undefined, headers: {
    authorization: req.headers.authorization, ...(req.headers['x-sfx-session'] ? { 'x-sfx-session': req.headers['x-sfx-session'] } : {}), ...(body ? { 'content-type': 'application/json' } : {}) } });
  const text = await upstream.text();
  if (req.method === 'POST' && req.url.endsWith('/complete') && lostAck && upstream.ok) { lostAck = false; return send(res, 503, {}); }
  res.writeHead(upstream.status, { 'content-type': 'application/json' }); res.end(text);
});
const api = http.createServer((req,res) => {
  const url = new URL(req.url,'http://localhost');
  if (url.pathname.endsWith('/events')) { const after = Number(url.searchParams.get('after') ?? 0); return send(res, 200, { events: events.filter(e => e.cursor > after).slice(0,128), latestCursor: events.length, gap: null }); }
  if (url.pathname.endsWith('/graph')) return send(res, 200, graph);
  if (url.pathname.endsWith('/output')) return send(res, 200, output);
  send(res, 200, run);
});
for (const server of [identity,api]) { server.listen(0,'127.0.0.1'); await once(server,'listening'); }
process.env.SFX_IDENTITY_ENDPOINT = `http://127.0.0.1:${identity.address().port}`; process.env.SFX_EVIDENCE_SERVICE_KEY = serviceKey;
let storedServer;
try {
  captureRun(runId, { capabilityId: deck.capabilityId, namespaceId: deck.namespaceId }, bearer, { endpoint: `http://127.0.0.1:${api.address().port}`, token: 'fixture-api-key' });
  const deadline = Date.now() + 90000;
  while (captureStatus(runId) !== 'complete' && Date.now() < deadline) await new Promise(r => setTimeout(r,250));
  assert.equal(captureStatus(runId),'complete'); assert.equal(outage,false); assert.equal(lostAck,false);
  const stored = await evidenceRequest(`/runs/${runId}`,{bearer});
  const chunks = await evidenceRequest(`/runs/${runId}/chunks`,{bearer});
  assert.deepEqual(decodeChunks(chunks.chunks,runId),events);
  const corrupt = structuredClone(chunks.chunks); corrupt[0].sha256 = '0'.repeat(64);
  assert.throws(() => decodeChunks(corrupt,runId),/DIGEST/);
  assert.throws(() => traceChunk([events[0],events[2]]),/CURSOR_GAP/);
  const captured = newRun(apiRecord(events[0]));
  for (const e of events.slice(1)) applyRecord(captured,apiRecord(e,e.kind==='graph.captured'?graph:undefined));
  assert.equal(evidenceModel(deck,captured).operations.length,11);
  api.closeAllConnections(); await new Promise(r=>api.close(r));
  storedServer=http.createServer(async(req,res)=>{const url=new URL(req.url,'http://localhost');await serveRunApi(req,res,url,{ endpoint:'',token:'',observeRequiresSession:true });});
  storedServer.listen(0,'127.0.0.1');await once(storedServer,'listening');
  const base=`http://127.0.0.1:${storedServer.address().port}/api/circuit/v1/runs/${runId}`;
  const headers = { cookie: `__Host-sfx-session=${bearer}` };
  assert.equal((await fetch(base+'/output')).status,401);
  assert.deepEqual(await fetch(base+'/output',{headers}).then(r=>r.json()),output);
  const stream=await fetch(base+'/events/stream',{headers}).then(r=>r.text());
  assert.equal(stream.split('event: ').length-1,events.length+1);
  console.log(JSON.stringify({ status:'PASS', basis:'Live identity SQL + retained execution capture in fixture API; upstream stopped before replay',
    records:events.length,chunks:chunks.chunks.length,checks:['outage retry','lost completion acknowledgement','exact stored events','digest refusal','gap refusal','stored output','authenticated replay with no execution configuration','no trust claim'] }));
} finally {
  for(const server of [identity,api,storedServer].filter(Boolean)){server.closeAllConnections();if(server.listening)await new Promise(r=>server.close(r));}
  delete process.env.SFX_EVIDENCE_SERVICE_KEY;
}
