// Private identity-host transport. SQL credentials never enter this process.
import { createHash } from 'node:crypto';
import { brotliCompressSync, brotliDecompressSync, constants } from 'node:zlib';

const tasks = new Map(), status = new Map();
export const evidenceConfigured = () => Boolean(process.env.SFX_IDENTITY_ENDPOINT && process.env.SFX_EVIDENCE_SERVICE_KEY);
export async function evidenceRequest(path, { method = 'GET', body, bearer } = {}) {
  if (!evidenceConfigured()) throw new Error('EVIDENCE_NOT_CONFIGURED');
  const response = await fetch(process.env.SFX_IDENTITY_ENDPOINT.replace(/\/+$/, '') + '/evidence/v1' + path, {
    method, redirect: 'error', signal: AbortSignal.timeout(10000),
    headers: { authorization: `Bearer ${process.env.SFX_EVIDENCE_SERVICE_KEY}`, ...(bearer ? { 'x-sfx-session': bearer } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!response.ok) { const error = new Error(`EVIDENCE_HTTP_${response.status}`); error.status = response.status; throw error; }
  return response.json();
}
export const captureStatus = runId => status.get(runId) ?? 'unconfirmed';
const mark = (id, value) => { status.set(id, value); while (status.size > 2000) status.delete(status.keys().next().value); };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
export function traceChunk(events) {
  if (!events.length || events.some((e, i) => !Number.isSafeInteger(e.cursor) || e.cursor !== events[0].cursor + i)) throw new Error('EVIDENCE_CURSOR_GAP');
  const content = brotliCompressSync(Buffer.from(JSON.stringify(events)), { params: { [constants.BROTLI_PARAM_QUALITY]: 4 } });
  if (content.length > 1048576) throw new Error('EVIDENCE_CHUNK_TOO_LARGE');
  return { firstCursor: events[0].cursor, lastCursor: events.at(-1).cursor, recordCount: events.length,
    sha256: createHash('sha256').update(content).digest('hex'), content: content.toString('base64') };
}
export function decodeChunks(chunks, runId) {
  let through = 0; const events = [];
  for (const c of chunks) {
    const compressed = Buffer.from(c.content, 'base64');
    if (createHash('sha256').update(compressed).digest('hex') !== c.sha256) throw new Error('EVIDENCE_DIGEST_MISMATCH');
    const batch = JSON.parse(brotliDecompressSync(compressed, { maxOutputLength: 8 * 1024 * 1024 }).toString('utf8'));
    if (!Array.isArray(batch) || batch.length !== c.recordCount || batch[0]?.cursor !== c.firstCursor || batch.at(-1)?.cursor !== c.lastCursor || c.firstCursor !== through + 1) throw new Error('EVIDENCE_CURSOR_GAP');
    for (const e of batch) {
      if (e.cursor !== ++through || e.eventId !== `urn:sda-api:run-event:${runId}:${through}`) throw new Error('EVIDENCE_EVENT_IDENTITY');
      events.push(e);
    }
  }
  return events;
}

// Capture is independent of browser connection lifetime. Every completed write
// advances its cursor; retry resends the exact chunk and SQL enforces idempotence.
export function captureRun(runId, subject, bearer, api) {
  if (!evidenceConfigured() || tasks.has(runId)) return;
  if (tasks.size >= 32) { mark(runId, 'unconfirmed'); return; }
  mark(runId, 'capturing');
  const task = (async () => {
    let cursor = 0, failures = 0, registered = false, pending = null, completion = null;
    const deadline = Date.now() + 30 * 60 * 1000;
    const read = async suffix => {
      const r = await fetch(api.endpoint.replace(/\/+$/, '') + '/v1/runs/' + encodeURIComponent(runId) + suffix,
        { headers: { authorization: `Bearer ${api.token}` }, redirect: 'error', signal: AbortSignal.timeout(10000) });
      if (!r.ok) throw new Error(`RUN_HTTP_${r.status}`); return r.json();
    };
    while (Date.now() < deadline && failures < 12) {
      try {
        if (!registered) {
          await evidenceRequest('/runs', { method: 'POST', bearer, body: { runId, ...subject } });
          const retained = await evidenceRequest(`/runs/${runId}/chunks`, { bearer });
          cursor = retained.chunks.at(-1)?.lastCursor ?? 0;
          registered = true; bearer = undefined;
        }
        if (pending) { await evidenceRequest(`/runs/${runId}/chunks`, { method: 'POST', body: pending }); cursor = pending.lastCursor; pending = null; }
        if (completion) {
          const saved = await evidenceRequest(`/runs/${runId}/complete`, { method: 'POST', body: completion });
          mark(runId, saved.traceComplete ? 'complete' : 'incomplete'); return;
        }
        const page = await read(`/events?after=${cursor}&limit=128`);
        const events = page.events ?? [];
        // An evicted prefix is never relabelled complete. Persist any retained
        // suffix and let the store count the missing interval at completion.
        if (events.length) {
          pending = traceChunk(events);
          await evidenceRequest(`/runs/${runId}/chunks`, { method: 'POST', body: pending }); cursor = pending.lastCursor; pending = null;
          failures = 0; continue;
        }
        const run = await read('');
        if (['completed', 'failed', 'cancelled', 'timed-out', 'timed_out'].includes(run.state)) {
          if (cursor < (run.cursor ?? page.latestCursor ?? 0) && !page.gap) throw new Error('RUN_EVENTS_PENDING');
          // Retry transient reads before sealing immutable material. A refused
          // or failed run can legitimately have no graph/output (404/409).
          const material = suffix => read(suffix).catch(e => {
            if (/RUN_HTTP_(404|409)$/.test(e.message)) return null; throw e;
          });
          const [graph, output] = await Promise.all([material('/graph'), material('/output')]);
          completion = { run, graph, output, latestCursor: run.cursor ?? page.latestCursor ?? cursor };
          continue;
        }
        failures = 0; await delay(500);
      } catch { mark(runId, 'unconfirmed'); failures++; await delay(Math.min(5000, failures * 500)); }
    }
    mark(runId, 'unconfirmed');
  })().catch(() => mark(runId, 'unconfirmed')).finally(() => tasks.delete(runId));
  tasks.set(runId, task);
}

export async function storedRun(runId, bearer) {
  try { return await evidenceRequest(`/runs/${encodeURIComponent(runId)}`, { bearer }); }
  catch (e) { if (e.status === 404) return null; throw e; }
}
export async function serveStoredRun(res, suffix, url, stored, bearer) {
  if (stored.captureStatus === 'capturing') return false;
  const route = suffix.split('/').slice(2).join('/');
  const json = (value, code = 200) => { res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(value)); };
  if (!route) { json({ ...stored.run, persistence: stored.captureStatus, trust: stored.trust }); return true; }
  if (route === 'graph' || route === 'output') { json(stored[route] ?? { error: 'Captured material unavailable.' }, stored[route] === null ? 409 : 200); return true; }
  if (route === 'events' || route === 'events/stream') {
    if (!stored.traceComplete) { json({ error: 'Retained trace is incomplete; replay is held.' }, 409); return true; }
    const after = Number(url.searchParams.get('after') ?? 0);
    if (!Number.isSafeInteger(after) || after < 0) { json({ error: 'Invalid cursor.' }, 400); return true; }
    const content = await evidenceRequest(`/runs/${stored.runId}/chunks`, { bearer });
    const events = decodeChunks(content.chunks, stored.runId);
    if (events.length !== stored.latestCursor) throw new Error('EVIDENCE_COUNT_MISMATCH');
    if (route === 'events') json({ runId: stored.runId, events: events.filter(e => e.cursor > after).slice(0, 128), latestCursor: stored.latestCursor, retainedFrom: 1, gap: null });
    else {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', 'x-accel-buffering': 'no' });
      for (const e of events) if (e.cursor > after) res.write(`event: ${e.kind}\ndata: ${JSON.stringify(e)}\n\n`);
      res.end(`event: end\ndata: ${JSON.stringify({ runId: stored.runId, state: stored.run.state, cursor: stored.latestCursor })}\n\n`);
    }
    return true;
  }
  return false;
}
