// Candidate replay qualification: the checked-out Explorer, served by a local
// fixture host, replays pinned retained evidence in a real browser. No staging
// slot, kernel, model or observer writes are involved.
//   node tools/live-circuit/verify-replay-candidate.mjs <evidence-dir> [scene.json capture.sse]
// Requires SFX_UI_PROVIDER_DIR (the release-pinned region providers) and
// SFX_BROWSER_TEST_MODULE (plus optional SFX_BROWSER_EXECUTABLE).
//
// Each delivery is a separate browser run of verify-circuit-replay.mjs:
//   prompt   the selected run arrives at once, as the observer's ring replay does;
//   delayed  the selected run trickles in over several seconds while the bare
//            live stream keeps disconnecting, so a pending live reconnect fires
//            mid-delivery. A replay that lets that reconnect close its stream
//            never receives run-end and fails as REPLAY_RUN_NOT_RECEIVED.
// SFX_CANDIDATE_CIRCUIT_DIR serves another circuit directory, for demonstrating
// that a known-faulty runtime fails this check.
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { newRun, applyRecord } from '../../live-circuit/circuit/deck-trace.js';
import { readRegion, serveRegionApi, REGION_PROVIDERS } from '../../live-circuit/circuit/region-host.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const [evidence, sceneArgument, captureArgument] = process.argv.slice(2);
assert(evidence, 'Supply an evidence directory');
assert(process.env.SFX_UI_PROVIDER_DIR, 'SFX_UI_PROVIDER_DIR_REQUIRED: use the release-pinned UI providers');
assert(process.env.SFX_BROWSER_TEST_MODULE, 'SFX_BROWSER_TEST_MODULE_REQUIRED');
for (const regionId of REGION_PROVIDERS.keys())
  assert.equal((await readRegion({ regionId })).disposition, 'AUTHORED', `Pinned region provider unreadable: ${regionId}`);
const sceneFile = path.resolve(sceneArgument ?? path.join(root, 'docs/replay-timing-fidelity/scene.json'));
const captureFile = path.resolve(captureArgument ?? path.join(root, 'docs/replay-timing-fidelity/capture.sse'));
const circuit = path.resolve(process.env.SFX_CANDIDATE_CIRCUIT_DIR ?? path.join(root, 'live-circuit/circuit'));
const deck = JSON.parse(await fs.readFile(sceneFile, 'utf8'));
const groups = []; let group;
for (const record of (await fs.readFile(captureFile, 'utf8')).split(/\r?\n/).filter(line => line.startsWith('data: ')).map(line => JSON.parse(line.slice(6)))) {
  if (record.kind === 'run-start') { group = { run: newRun(record), records: [] }; groups.push(group); }
  else if (group) applyRecord(group.run, record);
  group?.records.push(record);
}
const selected = groups.findLast(g => g.run.ended && g.run.graph?.graphId === 'graph:' + deck.capabilityId);
assert(selected, 'Capture must contain a completed execution of the selected capability');
const frames = selected.records.map(record => 'data: ' + JSON.stringify(record) + '\n\n');

let delivery = 'prompt';
const DELAYED_CHUNKS = 8, DELAYED_INTERVAL_MS = 500; // 4 s: more than two 1.5 s live reconnect periods.
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (await serveRegionApi(req, res, url)) return;
  const json = (body, status = 200) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
  if (url.pathname === '/events') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
    // The fixture has no live runs: a bare or `since` stream disconnects at once.
    if (url.searchParams.get('run') !== 'current') return res.end(': candidate host; no live records\n\n');
    if (delivery === 'prompt') return res.end(frames.join(''));
    const size = Math.ceil(frames.length / DELAYED_CHUNKS);
    for (let index = 0; index < frames.length && !res.destroyed; index += size) {
      res.write(frames.slice(index, index + size).join(''));
      await new Promise(resolve => setTimeout(resolve, DELAYED_INTERVAL_MS));
    }
    return res.end();
  }
  if (url.pathname === '/api/circuit/v1/scenario') return json(deck);
  if (url.pathname === '/api/circuit/v1/capability-details') return json({ error: 'Candidate fixture: navigation not included' }, 503);
  if (url.pathname === '/api/circuit/v1/session') return json({ authenticated: false, observeRequiresSession: true });
  if (url.pathname === '/api/circuit/v1/capabilities') return json({ capabilities: [{ capabilityId: deck.capabilityId, namespaceId: deck.namespaceId }] });
  if (url.pathname === '/api/circuit/v1/home') return json({ environment: 'CANDIDATE REPLAY' });
  if (url.pathname === '/api/circuit/v1/execution') return json({ configured: true });
  if (url.pathname === '/healthz' || url.pathname === '/health') return json({ ok: true });
  const name = url.pathname.slice('/circuit/'.length), file = name === 'explorer' ? 'explorer.html' : name;
  if (!url.pathname.startsWith('/circuit/') || !/^[\w.-]+$/.test(file)) return json({ error: 'Candidate fixture route unavailable' }, 404);
  try {
    const body = await fs.readFile(path.join(circuit, file));
    res.writeHead(200, { 'content-type': file.endsWith('.html') ? 'text/html' : file.endsWith('.css') ? 'text/css' : 'text/javascript' });
    res.end(body);
  } catch { json({ error: 'Candidate fixture file unavailable' }, 404); }
});
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const origin = `http://127.0.0.1:${server.address().port}`;

function replay(directory) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(root, 'tools/sfx-api/verify-circuit-replay.mjs'), origin, sceneFile, captureFile, directory, '--served-events'],
      { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stdout.resume(); child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', code => resolve({ code, failure: stderr.match(/^REPLAY_FAILED .*$/m)?.[0] ?? (code ? stderr.trim().split('\n').at(-1) : null) }));
  });
}
const results = [];
try {
  for (delivery of ['prompt', 'delayed']) {
    const startedAt = Date.now(), directory = path.join(path.resolve(evidence), delivery);
    const { code, failure } = await replay(directory);
    results.push({ delivery, passed: code === 0, durationMilliseconds: Date.now() - startedAt, failure, evidence: directory });
    console.log(`${code === 0 ? 'PASS' : 'FAIL'} ${delivery} replay${failure ? ' · ' + failure : ''}`);
  }
} finally { server.closeAllConnections(); server.close(); }
const receipt = { checkedAt: new Date().toISOString(), basis: 'Candidate Explorer from this checkout; pinned retained scene and capture; fixture host',
  circuit: path.relative(root, circuit) || '.', scene: path.relative(root, sceneFile), capture: path.relative(root, captureFile),
  runId: selected.run.id, records: frames.length, delayed: { chunks: DELAYED_CHUNKS, intervalMilliseconds: DELAYED_INTERVAL_MS }, results };
await fs.mkdir(path.resolve(evidence), { recursive: true });
await fs.writeFile(path.join(path.resolve(evidence), 'candidate-replay.json'), JSON.stringify(receipt, null, 2) + '\n');
assert(results.every(result => result.passed), 'Candidate replay qualification failed; see failed.json in each failing delivery directory');
