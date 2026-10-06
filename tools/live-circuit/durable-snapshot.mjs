import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export async function durableSnapshot(origin, runId, cookie) {
  const base = origin + '/api/circuit/v1/runs/' + encodeURIComponent(runId);
  const get = async suffix => {
    const response = await fetch(base + suffix, { headers: { cookie }, redirect: 'error', signal: AbortSignal.timeout(90000) });
    assert.equal(response.status, 200, 'Retained run read: ' + suffix); return response;
  };
  let run;
  const deadline = Date.now() + 90000;
  do {
    run = await (await get('')).json();
    if (run.persistence === 'complete') break;
    await new Promise(resolve => setTimeout(resolve, 1000));
  } while (Date.now() < deadline);
  assert.equal(run.persistence, 'complete', 'Release requires a complete SQL capture before restarting');
  const [graph, output, stream] = await Promise.all([
    get('/graph').then(r => r.json()), get('/output').then(r => r.json()), get('/events/stream').then(r => r.text())
  ]);
  const events = []; let end;
  for (const block of stream.replaceAll('\r\n', '\n').split('\n\n')) {
    const kind = block.match(/^event: (.+)$/m)?.[1];
    const data = block.match(/^data: (.+)$/m)?.[1];
    if (!data) continue;
    const value = JSON.parse(data);
    if (kind === 'end') end = value; else events.push(value);
  }
  assert(events.length > 0); assert.equal(end?.cursor, events.length); assert.equal(end.runId, runId);
  for (const [i, event] of events.entries()) {
    assert.equal(event.cursor, i + 1);
    assert.equal(event.eventId, `urn:sda-api:run-event:${runId}:${i + 1}`);
  }
  return { runId, state: run.state, persistence: run.persistence, trust: run.trust, outcome: output.disposition,
    events: events.length, eventsSha256: digest(events), graphSha256: digest(graph), outputSha256: digest(output) };
}
