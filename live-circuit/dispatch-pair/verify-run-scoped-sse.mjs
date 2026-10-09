#!/usr/bin/env node
// Verifies the run-scoped observation server contract against a captured
// observation stream:
//   * a bare `GET /events` is live-only and never replays the ring;
//   * `GET /events?since=<seq>` replays only records after the named sequence;
//   * `GET /events?run=<current|next|n>` scopes a capture to one
//     run-start..run-end window so per-run attribution is exact.
// The script starts observe-server.mjs on a spare port, replays the capture
// through POST /events, and exercises each endpoint with an SSE reader.
// Ordering is explicit: the server is ready when /health answers, and a stream
// is subscribed (with any requested replay fully written) when its
// `: replay-complete` comment arrives. No assertion depends on a quiet period.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { observeRecord } from '../circuit/deck-trace.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const capturePath = process.argv[2] ?? path.join(here, 'observation-capture.v1.txt');
const serverPath = path.join(here, 'observe-server.mjs');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sparePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

function parseCapture(text) {
  const events = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith('data: ')) continue;
    events.push(JSON.parse(line.slice(6)));
  }
  return events;
}

async function post(base, records) {
  // Replay the admitted frames as the capture wrote them: run boundaries keep
  // their payload, observations keep theirs.
  const body = records.map((record) => ({
    ...(record.kind === 'observation' ? { kind: 'observation', payload: record.payload }
      : { ...(record.payload ?? record), kind: record.kind }),
    ...(record.runId ? { runId: record.runId } : {})
  }));
  const response = await fetch(`${base}/events`, { method: 'POST', body: JSON.stringify(body) });
  assert(response.ok, `POST /events failed: ${response.status}`);
  return response.json();
}

function openStream(base, query) {
  const controller = new AbortController();
  const received = [];
  const waiters = [];
  let streamError = null, subscribed = false;
  const done = (async () => {
    const response = await fetch(`${base}/events${query}`, { signal: controller.signal });
    assert(response.ok, `GET /events${query} failed: ${response.status}`);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let index;
      while ((index = buffer.indexOf('\n\n')) >= 0) {
        const frame = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        for (const line of frame.split('\n')) {
          if (line === ': replay-complete') subscribed = true;
          else if (line.startsWith('data: ')) received.push(JSON.parse(line.slice(6)));
          else continue;
          for (const waiter of waiters.splice(0)) waiter();
        }
      }
    }
  })().catch((error) => {
    if (error.name !== 'AbortError') streamError = error;
  });
  // The deadline bounds a broken server; it is never an ordering assumption.
  async function until(condition, describe, timeoutMs = 5000) {
    const deadline = Date.now() + timeoutMs;
    while (!condition()) {
      if (streamError !== null) throw streamError;
      if (Date.now() > deadline) {
        throw new Error(`stream ${query} ${describe}; received ${received.length} records: ` +
          received.map((record) => `${record.kind}:${record.seq}`).join(','));
      }
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, 50);
        waiters.push(() => { clearTimeout(timer); resolve(); });
      });
    }
  }
  return {
    received,
    // Resolves once the stream is registered and its replay (if any) is complete.
    async subscribed() {
      await until(() => subscribed, 'never reported replay-complete');
      return received.slice();
    },
    async waitFor(count, timeoutMs = 5000) {
      await until(() => received.length >= count, `expected ${count} records`, timeoutMs);
      return received.slice(0, count);
    },
    async waitUntil(predicate, describe, timeoutMs = 5000) {
      await until(() => received.some(predicate), describe, timeoutMs);
      return received.slice();
    },
    close() {
      controller.abort();
      return done;
    },
  };
}

const observerPort = await sparePort();
const server = spawn(process.execPath, [serverPath], {
  env: { ...process.env, OBSERVER_PORT: String(observerPort) },
  stdio: ['ignore', 'pipe', 'pipe'],
});
const base = `http://localhost:${observerPort}`;
server.stdout.on('data', (chunk) => process.stdout.write(`[server] ${chunk}`));
server.stderr.on('data', (chunk) => process.stderr.write(`[server] ${chunk}`));
let stopping = false;
const stop = async () => {
  if (stopping) return;
  stopping = true;
  server.kill('SIGTERM');
};
process.on('exit', () => { if (!stopping) server.kill('SIGTERM'); });
process.on('SIGINT', () => { void stop().then(() => process.exit(130)); });

async function serverReady(timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`observe-server exited early with code ${server.exitCode}`);
    try { if ((await fetch(`${base}/health`, { signal: AbortSignal.timeout(2000) })).ok) return; } catch { /* not listening yet */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`observe-server did not answer /health within ${timeoutMs} ms`);
}

try {
  await serverReady();
  const capture = parseCapture(fs.readFileSync(capturePath, 'utf8'));
  const runStarts = capture.filter((record) => record.kind === 'run-start').length;
  const runEnds = capture.filter((record) => record.kind === 'run-end').length;
  assert(runStarts === 2 && runEnds === 2, `capture must hold exactly two complete runs (${runStarts}/${runEnds})`);

  const first = await post(base, capture);
  const afterCapture = first.sequence;
  assert(afterCapture === capture.length, `server admitted ${afterCapture} of ${capture.length} captured records`);

  // A bare SSE client is live-only: it receives no replay, and when the next
  // run is posted it sees only that run.
  const bare = openStream(base, '');
  assert((await bare.subscribed()).length === 0, `bare /events replayed ${bare.received.length} ring records`);
  const thirdRun = [
    { kind: 'run-start', at: new Date().toISOString(), processId: 1, nativeProcessId: 11 },
    { kind: 'observation', payload: { observationType: 'delivery-phase', phase: 'run-3', status: 'completed' } },
    { kind: 'run-end', at: new Date().toISOString(), processId: 1, exitCode: 0 },
  ];
  await post(base, thirdRun);
  await bare.waitFor(3);
  assert(bare.received.every((record) => record.seq > afterCapture), 'bare /events replayed a captured record');
  assert(bare.received.every((record) =>
    typeof record.observationKey === 'string' && record.observationKey.endsWith(`:${record.seq}`)),
  'live observer records have no stable observation key');
  assert(new Set(bare.received.map((record) => record.observationKey)).size === bare.received.length,
    'observer reused an observation key');
  assert(bare.received[0].kind === 'run-start' && bare.received[2].kind === 'run-end', 'bare /events missed the live run window');
  const afterThirdRun = bare.received[2].seq;
  await bare.close();

  // `since` replays exactly the records after the named sequence.
  const sinceStream = openStream(base, `?since=${afterThirdRun}`);
  assert((await sinceStream.subscribed()).length === 0, `since=${afterThirdRun} replayed older records`);
  const fourthRecord = { kind: 'observation', payload: { observationType: 'delivery-phase', phase: 'after-since', status: 'completed' } };
  const fourth = await post(base, [fourthRecord]);
  await sinceStream.waitFor(1);
  assert(sinceStream.received[0].seq === fourth.sequence, 'since did not deliver the new record');
  await sinceStream.close();

  // Per-run filtering: run 1 and run 2 replay only their own windows.
  const runOne = openStream(base, '?run=1');
  const runOneRecords = await runOne.subscribed();
  assert(runOneRecords.length === 3, `run=1 replayed ${runOneRecords.length} records, expected its 3-record window`);
  assert(runOneRecords.every((record) => typeof record.observationKey === 'string'),
    'replayed observer records lost their observation keys');
  assert(runOneRecords[0].kind === 'run-start' && runOneRecords[2].kind === 'run-end', 'run=1 window is not run-start..run-end');
  assert(runOneRecords[1].payload.testimonyType === 'cell-execution-testimony.v1', 'run=1 event does not belong to the captured run');
  await runOne.close();

  const runTwo = openStream(base, '?run=2');
  const runTwoRecords = await runTwo.subscribed();
  assert(runTwoRecords.length === 3, `run=2 replayed ${runTwoRecords.length} records, expected its 3-record window`);
  assert(runTwoRecords[1].payload.observationType === 'provider-exchange-shape.v1', 'run=2 event does not belong to the captured run');
  await runTwo.close();

  // `run=current` selects the most recent run, and `run=next` waits for the
  // next run-start and then scopes to it.
  const current = openStream(base, '?run=current');
  const currentRecords = await current.subscribed();
  assert(currentRecords.length === 3, `run=current replayed ${currentRecords.length} records`);
  assert(currentRecords[0].payload.phase === 'run-3' || currentRecords[0].kind === 'run-start', 'run=current did not select the third run');
  const currentSeqs = currentRecords.map((record) => record.seq);
  await current.close();

  const next = openStream(base, '?run=next');
  assert((await next.subscribed()).length === 0, 'run=next replayed an existing run');
  const fifthRun = [
    { kind: 'run-start', at: new Date().toISOString(), processId: 2, nativeProcessId: 22 },
    { kind: 'observation', payload: { observationType: 'delivery-phase', phase: 'run-5', status: 'completed' } },
    { kind: 'run-end', at: new Date().toISOString(), processId: 2, exitCode: 0 },
  ];
  await post(base, fifthRun);
  const nextRecords = await next.waitFor(3);
  assert(nextRecords[0].kind === 'run-start' && nextRecords[2].kind === 'run-end', 'run=next did not open on the next run-start');
  assert(nextRecords[1].payload.phase === 'run-5', 'run=next captured the wrong run');
  assert(nextRecords[0].seq > Math.max(...currentSeqs), 'run=next replayed a previous run');
  await next.close();

  // `run=current&graphId=` selects the most recent run that captured that graph,
  // so a later run of another graph (a reader's own invocation) cannot displace it.
  const graphRun = (graphId, phase) => [
    { kind: 'run-start', at: new Date().toISOString(), processId: 3, nativeProcessId: 33 },
    { kind: 'observation', payload: { observationType: 'execution-graph-captured.v1', graphId, cells: [], edges: [] } },
    { kind: 'observation', payload: { observationType: 'delivery-phase', phase, status: 'completed' } },
    { kind: 'run-end', at: new Date().toISOString(), processId: 3, exitCode: 0 },
  ];
  await post(base, graphRun('graph:transport-subject', 'subject-run'));
  await post(base, graphRun('graph:transport-reader', 'reader-run'));
  const byGraph = openStream(base, `?run=current&graphId=${encodeURIComponent('graph:transport-subject')}`);
  const byGraphRecords = await byGraph.subscribed();
  assert(byGraphRecords.length === 4, `graphId replayed ${byGraphRecords.length} records, expected its 4-record run`);
  assert(byGraphRecords[2].payload.phase === 'subject-run', 'graphId did not select the latest run of that graph');
  await byGraph.close();
  const latest = openStream(base, '?run=current');
  assert((await latest.subscribed())[2].payload.phase === 'reader-run', 'run=current without graphId must stay the latest run');
  await latest.close();

  // Two instances of the SAME graph, plus an unattributed native run, overlap.
  // Identity must survive normalization, live delivery and scoped replay; neither
  // graph identity, sequence windows nor a different run's end may attribute it.
  const tagged = id => graphRun('graph:concurrent-subject', id).map(record => ({ ...record, runId: id }));
  const a = tagged('sda-api:a'), b = tagged('sda-api:b'), native = graphRun('graph:native-reader', 'native');
  const concurrentNext = openStream(base, '?run=next');
  const concurrentLive = openStream(base, '');
  await Promise.all([concurrentNext.subscribed(), concurrentLive.subscribed()]);
  // a's run-end closes the batch: on one ordered stream nothing from this batch
  // can still be in flight once it has arrived.
  const batch = [a[0], a[1], native[0], b[0], b[1], native[1], a[2], b[2], b[3], native[2], native[3], a[3]];
  await post(base, batch);
  await concurrentLive.waitFor(12);
  await concurrentNext.waitUntil(r => r.kind === 'run-end' && r.runId === a[0].runId, 'never received the selected run-end');
  assert(concurrentNext.received.length === 4 && concurrentNext.received.every(r => r.runId === a[0].runId),
    'run=next mixed concurrent executions');
  assert(concurrentNext.received.at(-1).kind === 'run-end', 'Other run-end truncated the selected execution');
  const collected = [];
  for (const record of concurrentLive.received) observeRecord(collected, record);
  assert(collected.length === 3 && collected.every(run => run.ended && !run.ambiguous), 'Viewer must separate attributed and legacy runs');
  for (const id of ['sda-api:a', 'sda-api:b']) {
    const run = collected.find(run => run.id === id);
    assert(run.events.length === 3 && run.events.every(e => e.record.runId === id), 'Viewer mixed receipts between executions');
  }
  const concurrentReplay = openStream(base, '?run=current&graphId=graph:concurrent-subject');
  await concurrentReplay.subscribed();
  assert(concurrentReplay.received.length === 4 && concurrentReplay.received.every(r => r.runId === b[0].runId),
    'Graph replay must select the latest invocation, excluding other runs');
  const orphan = { kind: 'observation', runId: 'sda-api:missing', payload: a[1].payload };
  assert(observeRecord(collected, orphan) === undefined, 'Missing run-start must not be attributed to another run');
  observeRecord(collected, concurrentLive.received[0]);
  assert(collected[0].ambiguous, 'Duplicate run identity must be held');
  const untagged = [];
  for (const record of [{ kind: 'run-start', observationKey: 'u1' }, { kind: 'run-start', observationKey: 'u2' },
    { kind: 'run-end', payload: { exitCode: 0 } }]) observeRecord(untagged, record);
  assert(untagged.every(run => run.ambiguous), 'Unattributed overlap must remain held');
  await Promise.all([concurrentNext.close(), concurrentLive.close(), concurrentReplay.close()]);

  console.log(`RUN_SCOPED_SSE_OK capture=${capturePath} runs=${runStarts} admitted=${afterCapture} ` +
    `currentRunStart=${currentSeqs[0]} nextRunStart=${nextRecords[0].seq} graphSelected=${byGraphRecords[0].seq} concurrentRuns=3`);
  await stop();
  process.exit(0);
} catch (error) {
  console.error(`RUN_SCOPED_SSE_FAIL ${error instanceof Error ? error.message : String(error)}`);
  await stop();
  process.exit(1);
}
