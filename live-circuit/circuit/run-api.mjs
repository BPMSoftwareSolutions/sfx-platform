// HTTP transport for the host's configured SDA API. No local capability execution.
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { validateSession, observeRequiresSession, attributeRun, ownsRun, sessionCookie } from './identity-session.mjs';
import { evidenceConfigured, captureRun, captureStatus, storedRun, serveStoredRun } from './evidence-store.mjs';

const policy = JSON.parse(await readFile(new URL('./circuit-host.json', import.meta.url), 'utf8')).api;
const prefix = '/api/circuit/v1/runs';
const send = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(body)); };

export async function serveRunApi(req, res, url, configuration = {}) {
  const endpoint = configuration.endpoint ?? process.env.SDA_API_ENDPOINT;
  const token = configuration.token ?? process.env.SDA_API_TOKEN;
  const defaultNamespace = configuration.defaultNamespace ?? policy.defaultNamespace;
  const requireSession = configuration.observeRequiresSession ?? observeRequiresSession();
  if (url.pathname === '/api/circuit/v1/execution' && req.method === 'GET') {
    send(res, 200, { configured: Boolean(endpoint && token), defaultNamespace, observeRequiresSession: requireSession }); return true;
  }
  if (url.pathname !== prefix && !url.pathname.startsWith(prefix + '/')) return false;
  const suffix = url.pathname.slice(prefix.length);
  const read = /^\/[a-zA-Z0-9-]+(?:\/(?:events(?:\/stream)?|graph|output))?$/.test(suffix);
  if (!(req.method === 'POST' && suffix === '' || req.method === 'GET' && read)) { send(res, 405, { error: 'Unsupported run operation.' }); return true; }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), policy.timeoutMilliseconds);
  res.on('close', () => controller.abort());
  let session = null, subject = {};
  try {
    let body;
    if (req.method === 'GET' && requireSession) {
      const checked = await validateSession(req);
      if (!checked.session) { send(res, checked.refusal.status, { disposition: checked.refusal.disposition, error: 'Sign in to read your runs.' }); return true; }
      const runId = suffix.split('/')[1];
      let stored = null;
      if (evidenceConfigured()) {
        try { stored = await storedRun(runId, sessionCookie(req)); }
        catch (error) { if (!ownsRun(runId, checked.session.principalId)) throw error; }
        if (stored && await serveStoredRun(res, suffix, url, stored, sessionCookie(req))) return true;
        if (stored?.captureStatus === 'capturing' && endpoint && token) captureRun(runId, { capabilityId: stored.capabilityId, namespaceId: stored.namespaceId }, sessionCookie(req), { endpoint, token });
      }
      if (!stored && !ownsRun(runId, checked.session.principalId)) { send(res, 404, { error: 'Run not found.' }); return true; }
    }
    if (!endpoint || !token) { send(res, 503, { error: 'The circuit host has no SDA API connection configured.' }); return true; }
    if (req.method === 'POST') {
      const origin = req.headers.origin;
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      let originHost;
      try { originHost = new URL(origin).host; } catch { /* Invalid origins are refused. */ }
      if (!originHost || originHost !== host || !/^application\/json(?:;|$)/i.test(req.headers['content-type'] ?? '')) {
        send(res, 403, { error: 'Observe requires a same-origin JSON request.' }); return true;
      }
      const chunks = []; let bytes = 0;
      for await (const chunk of req.iterator({ destroyOnReturn: false })) {
        bytes += chunk.length;
        if (bytes > policy.maximumBodyBytes) { send(res, 413, { error: 'Payload exceeds the configured request limit.' }); return true; }
        chunks.push(chunk);
      }
      let submission;
      try { submission = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
      catch { send(res, 400, { error: 'Payload must be valid JSON.' }); return true; }
      if (submission?.object !== 'capability' || submission?.operation !== 'observe' || typeof submission?.subject !== 'string') {
        send(res, 400, { error: 'A capability observe request is required.' }); return true;
      }
      // The API's default namespace is host data. Other identities pass through
      // unchanged to API admission; no selected namespace is silently guessed.
      subject = { capabilityId: submission.subject, namespaceId: submission.namespace ?? defaultNamespace };
      if (submission.namespace === defaultNamespace) delete submission.namespace;
      // Observe is tied to a signed-in identity: the browser's session cookie is
      // validated with the identity host before anything reaches the SDA API.
      // The API still receives only the host's machine credential.
      if (requireSession) {
        const checked = await validateSession(req);
        if (!checked.session) {
          const { status, disposition, clear } = checked.refusal;
          res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store',
            ...(clear ? { 'set-cookie': '__Host-sfx-session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0' } : {}) });
          res.end(JSON.stringify({ disposition, error: status === 401 ? 'Sign in to observe: open /circuit/login.' : 'Sign-in is unavailable, so Observe is refused.' }));
          return true;
        }
        session = checked.session;
      }
      body = JSON.stringify(submission);
    }
    const upstream = await fetch(endpoint.replace(/\/+$/, '') + '/v1/runs' + suffix + url.search, {
      method: req.method, body, redirect: 'error', signal: controller.signal,
      headers: { authorization: `Bearer ${token}`, ...(body ? { 'content-type': 'application/json' } : {}),
        // The SDA API authenticates the host, not the browser principal. Scope
        // browser retry keys here so two principals cannot recover one run.
        ...(req.headers['idempotency-key'] ? { 'idempotency-key': session
          ? createHash('sha256').update(JSON.stringify([session.principalId, req.headers['idempotency-key']])).digest('hex')
          : req.headers['idempotency-key'] } : {}) }
    });
    if (session && req.method === 'POST') {
      // Admission responses are small JSON; read it to attribute the run to the principal.
      const text = await upstream.text();
      if (upstream.ok) {
        let attributed = false;
        try { attributed = attributeRun(JSON.parse(text)?.runId, session, subject); } catch { /* Refuse an unattributable admission body. */ }
        if (!attributed) { send(res, 502, { error: 'Run attribution unavailable. Check your runs before submitting again.' }); return true; }
        const runId = JSON.parse(text).runId;
        captureRun(runId, subject, sessionCookie(req), { endpoint, token });
        send(res, upstream.status, { ...JSON.parse(text), evidencePersistence: evidenceConfigured() ? captureStatus(runId) : 'not-configured' });
        return true;
      }
      res.writeHead(upstream.status, { 'content-type': upstream.headers.get('content-type') || 'application/json', 'cache-control': 'no-store' });
      res.end(text);
      return true;
    }
    if (req.method === 'GET' && /^\/[a-zA-Z0-9-]+$/.test(suffix) && upstream.ok) {
      const body = await upstream.json();
      send(res, upstream.status, { ...body, evidencePersistence: evidenceConfigured() ? captureStatus(suffix.slice(1)) : 'not-configured' }); return true;
    }
    res.writeHead(upstream.status, { 'content-type': upstream.headers.get('content-type') || 'application/json',
      'cache-control': 'no-store', 'x-accel-buffering': 'no' });
    if (upstream.body) await pipeline(Readable.fromWeb(upstream.body), res); else res.end();
  } catch {
    if (!res.destroyed) {
      if (!res.headersSent) send(res, 502, { error: 'SDA API connection interrupted. Check the run before submitting again.' });
      else res.destroy();
    }
  } finally { clearTimeout(timeout); }
  return true;
}
