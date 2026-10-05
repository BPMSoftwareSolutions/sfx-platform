// Same-origin API transport and input-contract guidance. The kernel owns execution.
export function payloadTemplate(schema, root = schema, depth = 0) {
  if (!schema || depth > 20) return null;
  if (schema.$ref?.startsWith('#/')) {
    const target = schema.$ref.slice(2).split('/').reduce((value, key) => value?.[key.replace(/~1/g, '/').replace(/~0/g, '~')], root);
    return payloadTemplate(target, root, depth + 1);
  }
  for (const key of ['const', 'default']) if (Object.hasOwn(schema, key)) return schema[key];
  if (schema.type === 'object' || schema.properties) return Object.fromEntries((schema.required ?? [])
    .map(key => [key, payloadTemplate(schema.properties?.[key], root, depth + 1)]));
  if (schema.type === 'array') return [];
  if (schema.type === 'string') return '';
  if (schema.type === 'boolean') return false;
  if (['number', 'integer'].includes(schema.type)) return schema.minimum ?? 0;
  return null;
}

export async function readEventStream(response, receive) {
  if (!response.ok) throw new Error(`Event stream unavailable (${response.status}).`);
  const reader = response.body.getReader(), decoder = new TextDecoder(); let pending = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      pending += decoder.decode(value, { stream: !done }).replace(/\r\n/g, '\n');
      let end;
      while ((end = pending.indexOf('\n\n')) >= 0) {
        const frame = pending.slice(0, end); pending = pending.slice(end + 2);
        const lines = frame.split('\n'), data = lines.filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
        if (data) await receive(lines.find(line => line.startsWith('event:'))?.slice(6).trim() ?? 'message', JSON.parse(data));
      }
      if (done) return;
    }
  } finally { reader.releaseLock(); }
}

export function apiRecord(event, graph) {
  if (event.kind === 'run.admitted') return null;
  const kind = event.kind === 'run.started' ? 'run-start' : event.kind === 'run.exited' ? 'run-end' : 'observation';
  return { kind, seq: event.cursor, observationKey: `sda-api:${event.eventId}`, receivedAt: event.at,
    payload: event.kind === 'graph.captured' ? graph : kind === 'run-start' ? { ...event.payload, at: event.at, processId: event.payload.pid }
      : kind === 'run-end' ? { ...event.payload, at: event.at } : event.payload };
}

export function createObservePanel(hooks) {
  const $ = id => document.getElementById(id), prefix = '/api/circuit/v1/runs';
  let key = '', serial = 0, schema, template, ready = false, busy = false, run = null, feed;
  const drafts = new Map();
  const status = (text, error = false) => { $('observe-status').textContent = text; $('observe-status').className = error ? 'error' : 'muted'; };
  const buttons = () => { $('observe').disabled = !ready || !key || busy; $('payload').disabled = busy; $('payload-template').disabled = busy || template === undefined; };
  async function request(path, options = {}) {
    const response = await fetch(path, options), text = await response.text();
    let body; try { body = JSON.parse(text); } catch { body = text; }
    if (!response.ok) throw new Error(body?.error?.message ?? body?.error ?? `API request failed (${response.status}).`);
    return body;
  }
  async function follow() {
    const selected = run;
    if (!selected) return;
    feed?.abort(); feed = new AbortController(); const signal = feed.signal;
    busy = true; buttons(); $('observe-resume').hidden = true;
    status(`Observing API run ${selected.id}`);
    let terminal = false;
    try {
      const response = await fetch(`${prefix}/${encodeURIComponent(selected.id)}/events/stream?after=${selected.cursor}`, { signal });
      await readEventStream(response, async (kind, event) => {
        if (run !== selected || signal.aborted) return;
        if (kind === 'gap') { selected.gap = true; hooks.gap(); return; }
        if (kind === 'end') { if(event.runId !== selected.id) throw new Error('Run completion identity is invalid.'); terminal = true; return; }
        if (!Number.isSafeInteger(event.cursor) || event.eventId !== `urn:sda-api:run-event:${selected.id}:${event.cursor}`) throw new Error('Run event identity is invalid.');
        if (event.cursor <= selected.cursor) return;
        if (event.truncated) { selected.gap = true; hooks.gap(); }
        const graph = event.kind === 'graph.captured' ? await request(`${prefix}/${encodeURIComponent(selected.id)}/graph`, { signal }) : undefined;
        const record = apiRecord(event, graph);
        if (record) hooks.record(record);
        selected.cursor = event.cursor;
      });
      if (signal.aborted || run !== selected) return;
      if (!terminal) throw new Error('Event connection ended before the run finished.');
      const result = await request(`${prefix}/${encodeURIComponent(selected.id)}`, { signal });
      status(`API run ${selected.id} · ${result.state}${result.failure ? ` · ${result.failure.message}` : ''}${selected.gap ? ' · Event gap: circuit evidence held' : ''}`, result.state === 'failed' || selected.gap);
      try {
        const output = await request(`${prefix}/${encodeURIComponent(selected.id)}/output`, { signal });
        $('observe-output').textContent = typeof output === 'string' ? output : JSON.stringify(output, null, 2);
        $('observe-result').hidden = false;
      } catch (error) { $('observe-output').textContent = error.message; $('observe-result').hidden = false; }
      selected.finished = true;
    } catch (error) {
      if (!signal.aborted && run === selected) { status(`${error.message} Run ${selected.id}; resume observation before submitting again.`, true); $('observe-resume').hidden = false; }
    } finally {
      if (run === selected && !signal.aborted) { busy = !selected.finished; buttons(); }
    }
  }
  $('observe').addEventListener('click', async () => {
    if (busy || !ready || !key) return;
    let input;
    try { input = JSON.parse($('payload').value); }
    catch (error) { status(`Invalid JSON: ${error.message}`, true); $('payload').focus(); return; }
    const selection = hooks.selection(), admissionKey = crypto.randomUUID(), selectedKey = key, generation = serial;
    busy = true; buttons(); $('observe-result').hidden = true; $('observe-resume').hidden = true;
    status('Opening the live scenario and submitting to the SDA API…');
    try {
      await hooks.prepare();
      if (key !== selectedKey || serial !== generation) return;
      const admitted = await request(prefix, { method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': admissionKey },
        body: JSON.stringify({ object: 'capability', operation: 'observe', subject: selection.capabilityId, namespace: selection.namespaceId, input }) });
      if (!admitted.runId) throw new Error('API admission did not return a run ID.');
      if (key !== selectedKey || serial !== generation) {
        status(`API run ${admitted.runId} was submitted for ${selection.capabilityId}; select that capability to inspect its execution.`, true); return;
      }
      run = { id: admitted.runId, cursor: 0 }; $('observe-external').hidden = false;
      hooks.admitted(run.id); await follow();
    } catch (error) {
      if (key !== selectedKey || serial !== generation) return;
      status(`${error.message} Admission key: ${admissionKey}. An interrupted response may already have admitted a run.`, true);
      busy = false; buttons();
    }
  });
  $('payload-template').addEventListener('click', () => { $('payload').value = JSON.stringify(template, null, 2); drafts.set(key, $('payload').value); });
  $('payload').addEventListener('input', () => drafts.set(key, $('payload').value));
  $('observe-resume').addEventListener('click', follow);
  function release() {
    feed?.abort(); run = null; busy = false; $('observe-resume').hidden = true; $('observe-external').hidden = true; hooks.release(); buttons();
  }
  $('observe-external').addEventListener('click', () => { release(); status('Following externally observed runs. A submitted API execution continues on the server.'); });
  request('/api/circuit/v1/execution').then(config => { ready = config.configured; if (!ready) status('Observe unavailable: configure the circuit host’s SDA API connection.', true); buttons(); }).catch(error => status(error.message, true));
  return {
    reset() {
      if (key) drafts.set(key, $('payload').value);
      ++serial; key = ''; template = undefined; release();
      $('payload').value = ''; $('payload-contract').textContent = 'Reading the selected capability…';
      $('payload-schema').textContent = ''; $('observe-result').hidden = true; status(''); buttons();
    },
    async select(deck) {
      const next = JSON.stringify([deck.capabilityId, deck.namespaceId]);
      if (key === next) return;
      if (key) drafts.set(key, $('payload').value);
      release(); key = next; schema = undefined; template = undefined; const generation = ++serial;
      $('payload').value = drafts.get(key) ?? ''; $('observe-result').hidden = true;
      $('payload-contract').textContent = 'Reading the capability input contract…'; $('payload-schema').textContent = ''; buttons();
      try {
        const query = new URLSearchParams({ capabilityId: deck.capabilityId, namespaceId: deck.namespaceId });
        const root = deck.scenarioId === deck.rootScenarioId ? deck : await request(`/api/circuit/v1/scenario?${query}`);
        const boundary = root.observationMap?.boundaries?.find(item => item.scenarioId === root.rootScenarioId);
        const link = root.navigation?.links?.find(item => item.sourceId === boundary?.inputNodeId && item.targetKind === 'detail' && root.navigation.items.some(target => target.id === item.targetId && target.kind === 'contract'));
        if (!link) throw new Error('No declared input contract link was returned. Enter the capability’s JSON input directly.');
        query.set('scenarioId', root.scenarioId); query.set('detailId', link.targetId); query.set('expectedSnapshotDigest', root.snapshotDigest);
        const detail = await request(`/api/circuit/v1/scenario?${query}`);
        if (generation !== serial) return;
        schema = detail.detail.body; template = payloadTemplate(schema);
        $('payload-contract').textContent = `Input contract · ${boundary.inputContractId} · Fill the required values before observing.`;
        $('payload-schema').textContent = JSON.stringify(schema, null, 2);
        if (!drafts.has(key)) $('payload').value = JSON.stringify(template, null, 2);
      } catch (error) { if (generation === serial) $('payload-contract').textContent = error.message; }
      if (generation === serial) buttons();
    }
  };
}
