// Transport conformance only; live execution acceptance uses the real SDA API.
// The identity gate is switched off here and covered by verify-identity-session.mjs;
// one case below confirms the default policy refuses an anonymous Observe.
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { serveRunApi } from './run-api.mjs';
import { apiRecord, payloadTemplate, readEventStream } from './observe-panel.js';
import { newRun, applyRecord } from './deck-trace.js';
import { buildTraversal, traversalState } from './traversal.js';

const received = [];
const upstream = http.createServer(async (req, res) => {
  let body = ''; for await (const chunk of req) body += chunk;
  received.push({ path:req.url, method:req.method, headers:req.headers, body:body && JSON.parse(body) });
  res.writeHead(200, { 'content-type':'application/json' }); res.end('{"runId":"transport-test"}');
});
upstream.listen(0, '127.0.0.1'); await once(upstream, 'listening');
const proxy = http.createServer((req, res) => serveRunApi(req,res,new URL(req.url,'http://localhost'), {
  endpoint:`http://127.0.0.1:${upstream.address().port}`, token:'test-host-credential', defaultNamespace:'test:namespace',
  observeRequiresSession:false
}));
proxy.listen(0,'127.0.0.1'); await once(proxy,'listening');
const base=`http://127.0.0.1:${proxy.address().port}`;
const gated = http.createServer((req, res) => serveRunApi(req,res,new URL(req.url,'http://localhost'), {
  endpoint:`http://127.0.0.1:${upstream.address().port}`, token:'test-host-credential', defaultNamespace:'test:namespace'
}));
gated.listen(0,'127.0.0.1'); await once(gated,'listening');
const gatedBase=`http://127.0.0.1:${gated.address().port}`;
const body=JSON.stringify({object:'capability',operation:'observe',subject:'test-capability',namespace:'test:namespace',input:{payload:false}});
try {
  assert.equal((await fetch(base+'/api/circuit/v1/execution').then(r=>r.json())).configured,true);
  for(const origin of [undefined,'https://unrelated.invalid','not-an-origin']) {
    const response=await fetch(base+'/api/circuit/v1/runs',{method:'POST',headers:{'content-type':'application/json',...(origin?{origin}:{})},body});
    assert.equal(response.status,403);
  }
  assert.equal(received.length,0);
  const anonymous=await fetch(gatedBase+'/api/circuit/v1/runs',{method:'POST',headers:{origin:gatedBase,'content-type':'application/json'},body});
  assert.equal(anonymous.status,401); assert.equal((await anonymous.json()).disposition,'SIGN_IN_REQUIRED'); assert.equal(received.length,0);
  assert.equal((await fetch(base+'/api/circuit/v1/runs',{method:'POST',headers:{origin:base,'content-type':'application/json'},body:'{'})).status,400);
  assert.equal((await fetch(base+'/api/circuit/v1/runs',{method:'POST',headers:{origin:base,'content-type':'application/json'},body:' '.repeat(1048577)})).status,413);
  const response=await fetch(base+'/api/circuit/v1/runs',{method:'POST',headers:{origin:base,'content-type':'application/json',authorization:'Bearer browser-value','idempotency-key':'admission-1'},body});
  assert.equal(response.status,200); assert.equal(received.length,1);
  assert.equal(received[0].headers.authorization,'Bearer test-host-credential');
  assert.equal(received[0].headers['idempotency-key'],'admission-1');
  assert.deepEqual(received[0].body,{object:'capability',operation:'observe',subject:'test-capability',input:{payload:false}});
  assert.equal((await fetch(base+'/api/circuit/v1/runs/id/events/stream?after=12')).status,200);
  assert.equal(received[1].path,'/v1/runs/id/events/stream?after=12');
  assert.equal((await fetch(base+'/api/circuit/v1/runs/id',{method:'DELETE'})).status,405);
  assert.equal((await fetch(base+'/api/circuit/v1/runs/id/unknown')).status,405);
  const record=apiRecord({eventId:'urn:sda-api:run-event:example:7',cursor:7,kind:'cell-execution-testimony.v1',at:'2026-10-01T12:00:00Z',payload:{testimonyType:'cell-execution-testimony.v1',durationNs:12345}});
  assert.equal(record.receivedAt,'2026-10-01T12:00:00Z');assert.equal(record.payload.durationNs,12345);
  assert.equal(apiRecord({eventId:'end',cursor:8,kind:'run.exited',at:'2026-10-01T12:00:01Z',payload:{exitCode:0}}).payload.at,'2026-10-01T12:00:01Z');
  const frames=[];
  const stream=new ReadableStream({start(controller){for(const text of [': heartbeat\n\n','id: 7\nevent: cell','\ndata: {"cursor":7}\n','\nevent: end\ndata: {"state":"completed"}\n\n'])controller.enqueue(new TextEncoder().encode(text));controller.close();}});
  await readEventStream(new Response(stream),async(kind,event)=>frames.push([kind,event]));
  assert.deepEqual(frames,[['cell',{cursor:7}],['end',{state:'completed'}]]);
  assert.deepEqual(payloadTemplate({type:'object',required:['contractId','payload'],properties:{contractId:{const:'example.v1'},payload:{type:'object',required:['question'],properties:{question:{type:'string'}}}}}),{contractId:'example.v1',payload:{question:''}});
  console.log('PASS: origin/body/method boundaries, host credential custody, admission forwarding, cursor routing, testimony preservation and fragmented SSE.');
} finally { proxy.closeAllConnections();gated.closeAllConnections();upstream.closeAllConnections();await Promise.all([new Promise(r=>proxy.close(r)),new Promise(r=>gated.close(r)),new Promise(r=>upstream.close(r))]); }

// Optional regression against an actual database scene with omitted variant lists.
// node live-circuit/circuit/verify-run-api.mjs <scene.json> <capture.sse>
if (process.argv[2] || process.argv[3]) {
  const scene = JSON.parse(await readFile(process.argv[2], 'utf8'));
  assert(scene.observationMap.boundaries.some(boundary => !Array.isArray(boundary.variants)), 'Use a scene with an omitted variant list');
  const records = (await readFile(process.argv[3], 'utf8')).split(/\r?\n/).filter(line => line.startsWith('data: ')).map(line => JSON.parse(line.slice(6)));
  let run, checked = 0, view;
  for (const record of records) {
    if (record.kind === 'run-start') run = newRun(record);
    else if (run) applyRecord(run, record);
    if (!run?.graph) continue;
    view = traversalState(buildTraversal(scene, run)); checked++;
  }
  assert(run?.ended && checked > 0, 'A complete real capture is required');
  assert.equal(view.terminal?.kind, 'defect', 'Absent declared variants cannot fabricate a matching outcome');
  console.log(JSON.stringify({ omittedVariants: 'handled without inventing an outcome', checkedPrefixes: checked, runId: run.id }));
}
