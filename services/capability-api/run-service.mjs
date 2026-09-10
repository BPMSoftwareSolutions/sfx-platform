import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

const hash = value => createHash('sha256').update(value).digest('hex');
const terminal = new Set(['COMPLETED', 'FAILED', 'UNKNOWN']);
const json = (res, status, value) => {
  if (res.destroyed || res.writableEnded) return;
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(value));
};
const canonical = value => JSON.stringify(value, function (key, item) {
  return item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(k => [k, item[k]])) : item;
});

/** Single service process, persistent volume. Every accepted request and event
 * is fsynced before acknowledgement. A restart never replays an uncertain effect.
 * The deployment must stay at one worker until a shared transactional store exists.
 */
export function createRunService({ directory, admit, execute }) {
  if (!directory || !path.isAbsolute(directory)) throw new Error('ABSOLUTE_RUN_DIRECTORY_REQUIRED');
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const runs = new Map();
  const serviceInstanceId = randomUUID();
  function append(run, record) {
    const fd = fs.openSync(run.file, 'a', 0o600);
    try { fs.writeFileSync(fd, JSON.stringify(record) + '\n'); fs.fsyncSync(fd); }
    finally { fs.closeSync(fd); }
  }
  function event(run, kind, observation) {
    const record = { type: 'event', eventId: `${run.runId}:${run.events.length + 1}`,
      sequence: run.events.length + 1, kind, observedAt: new Date().toISOString(), ...(observation ? { observation } : {}) };
    append(run, record); run.events.push(record);
  }
  function finish(run, state, result) {
    const record = { type: 'result', state, result, completedAt: new Date().toISOString() };
    append(run, record); Object.assign(run, record);
    event(run, 'run.terminal');
  }
  for (const fileName of fs.readdirSync(directory).filter(n => /^run-[0-9a-f]{64}\.jsonl$/.test(n))) {
    const file = path.join(directory, fileName), raw = fs.readFileSync(file, 'utf8');
    const lines = raw.split('\n');
    // Truncated final writes are not acknowledgement; remove only that fragment
    // before appending the explicit restart uncertainty record.
    if (lines.at(-1) !== '') fs.truncateSync(file, Buffer.byteLength(raw.slice(0, raw.lastIndexOf('\n') + 1)));
    const records = lines.slice(0, -1).filter(Boolean).map(line => JSON.parse(line));
    if (!records.length) throw new Error('RUN_JOURNAL_HEADER_MISSING');
    const run = { ...records[0], file, events: records.filter(r => r.type === 'event'), state: 'ADMITTED' };
    const completed = records.findLast(r => r.type === 'result');
    if (completed) Object.assign(run, completed);
    runs.set(run.runId, run);
    if (!terminal.has(run.state)) finish(run, 'UNKNOWN', { status: 'UNKNOWN', capabilityId: run.selection.subject,
      code: 'SERVICE_RESTARTED', message: 'The service restarted before retaining a terminal outcome. Effects may have occurred; this request will not execute again.' });
  }
  const snapshot = (run, cursor) => ({ runVersion: 'workbench-run.v1', serviceInstanceId, runId: run.runId, requestId: run.requestId,
    state: run.state, acceptedAt: run.acceptedAt, selection: run.selection, cursor: run.events.length,
    events: run.events.filter(e => e.sequence > cursor), ...(run.result ? { result: run.result, completedAt: run.completedAt } : {}) });

  async function handle(request, response, capacity) {
    const url = new URL(request.url, 'http://localhost');
    const owner = request.headers['x-workbench-session'];
    if (typeof owner !== 'string' || !/^[a-f0-9]{64}$/.test(owner)) return json(response, 403, { code: 'SESSION_REQUIRED' });
    const ownerHash = hash(owner);
    if (request.method === 'GET' && /^\/runs\/run-[0-9a-f]{64}$/.test(url.pathname)) {
      const run = runs.get(url.pathname.slice(6)), cursor = Number(url.searchParams.get('after') ?? 0);
      if (!run || run.ownerHash !== ownerHash) return json(response, 404, { code: 'RUN_NOT_FOUND' });
      if (!Number.isSafeInteger(cursor) || cursor < 0 || cursor > run.events.length) return json(response, 400, { code: 'CURSOR_INVALID' });
      return json(response, 200, snapshot(run, cursor));
    }
    if (request.method !== 'POST' || url.pathname !== '/runs') return json(response, 404, { code: 'NOT_FOUND' });
    let raw;
    try {
      const chunks = []; let size = 0;
      for await (const chunk of request) {
        size += chunk.length;
        if (size > 8192) return json(response, 413, { code: 'REQUEST_TOO_LARGE' });
        chunks.push(chunk);
      }
      raw = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch { return json(response, 400, { code: 'INVALID_JSON' }); }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)
      || !Object.keys(raw).every(k => ['commandVersion', 'requestId', 'publicationId', 'subject', 'editableValues', 'exampleSelection'].includes(k))
      || raw.commandVersion !== 'workbench-command.v1' || typeof raw.subject !== 'string'
      || typeof raw.requestId !== 'string' || !/^[A-Za-z0-9_-]{8,128}$/.test(raw.requestId)) {
      return json(response, 400, { disposition: 'REFUSED', code: 'COMMAND_INVALID' });
    }
    const runId = 'run-' + hash(ownerHash + ':' + raw.requestId), requestDigest = hash(canonical(raw));
    const prior = runs.get(runId);
    if (prior && prior.requestDigest !== requestDigest) return json(response, 409, { disposition: 'REFUSED', code: 'REQUEST_ID_CONFLICT' });
    if (prior) return json(response, 200, { acceptanceVersion: 'run-acceptance.v1', disposition: 'ADMITTED',
      requestId: raw.requestId, runId, acceptedAt: prior.acceptedAt, selection: prior.selection, deduplicated: true });
    let selection;
    try { selection = admit(raw); }
    catch (error) { return json(response, 422, { disposition: 'REFUSED', code: error.code ?? 'INPUT_INADMISSIBLE', message: error.message }); }
    if (!capacity.reserve()) return json(response, 503, { disposition: 'REFUSED', code: 'COMMAND_CAPACITY_REACHED' });
    const run = { type: 'accepted', runId, requestId: raw.requestId, requestDigest, ownerHash, selection,
      acceptedAt: new Date().toISOString(), state: 'ADMITTED', events: [], file: path.join(directory, runId + '.jsonl') };
    try {
      const fd = fs.openSync(run.file, 'wx', 0o600);
      try { fs.writeFileSync(fd, JSON.stringify({ ...run, file: undefined, events: undefined }) + '\n'); fs.fsyncSync(fd); }
      finally { fs.closeSync(fd); }
      runs.set(runId, run); event(run, 'run.accepted');
    } catch (error) { capacity.release(); throw error; }
    json(response, 202, { acceptanceVersion: 'run-acceptance.v1', disposition: 'ADMITTED', requestId: raw.requestId,
      runId, acceptedAt: run.acceptedAt, selection, deduplicated: false });
    setImmediate(async () => {
      try {
        run.state = 'EXECUTING'; event(run, 'run.executing');
        const result = await execute(raw, observation => {
          if (run.events.length >= 5000) {
            if (!run.telemetryLimited) { run.telemetryLimited = true; event(run, 'execution.observation-limit'); }
            return;
          }
          event(run, 'execution.observation', observation);
        });
        finish(run, result.status === 'EXECUTED' ? 'COMPLETED' : result.status === 'UNKNOWN' ? 'UNKNOWN' : 'FAILED', result);
      } catch {
        finish(run, 'UNKNOWN', { status: 'UNKNOWN', capabilityId: raw.subject, code: 'DELIVERY_UNCERTAIN',
          message: 'A terminal outcome was not established. Reconcile this run before starting another.' });
      } finally { capacity.release(); }
    });
  }
  return { handle, snapshot: (owner, id) => {
    const run = runs.get(id); return run?.ownerHash === hash(owner) ? snapshot(run, 0) : null;
  } };
}
