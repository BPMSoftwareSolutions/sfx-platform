// Browser session transport for the Live Circuit (cookie/CSRF contract:
// docs/live-circuit-browser-session.md). The observer is the browser's session
// holder: sign-in forwards { identifier, password } to the identity host's
// POST /auth/v1/login, which runs the declared authenticate-ide-user scenario.
// The returned bearer goes only into an HttpOnly, Secure, SameSite=Strict
// cookie; browser script never receives it. Session validation, logout and the
// Observe gate call the identity host with that bearer. Passwords and bearers
// are never logged, echoed, stored on disk or sent to the SDA API.
import { readFile } from 'node:fs/promises';
import { evidenceConfigured, evidenceRequest } from './evidence-store.mjs';

const policy = JSON.parse(await readFile(new URL('./circuit-host.json', import.meta.url), 'utf8')).identity;
const prefix = '/api/circuit/v1/session';
const cookieName = policy.cookie;
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const bearerShape = /^[A-Za-z0-9+/]{43}=$/;
// Display labels (the identifier typed at sign-in) by session; bounded, in memory.
const labels = new Map();
// Runs admitted through Observe, attributed to the signed-in principal; bounded, in memory.
const attributions = [];

const endpoint = () => (process.env.SFX_IDENTITY_ENDPOINT ?? '').replace(/\/+$/, '');
const send = (res, status, body, headers = {}) => {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers });
  res.end(JSON.stringify(body));
};
const expired = () => `${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;

export function sessionCookie(req) {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const at = part.indexOf('=');
    if (at > 0 && part.slice(0, at).trim() === cookieName) {
      const value = part.slice(at + 1).trim();
      return bearerShape.test(value) ? value : null;
    }
  }
  return null;
}

// Same-origin JSON: the CSRF half of the contract (the cookie is SameSite=Strict).
export function sameOriginJson(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  let originHost;
  try { originHost = new URL(req.headers.origin).host; } catch { /* Missing or invalid origins are refused. */ }
  return Boolean(originHost) && originHost === host && /^application\/json(?:;|$)/i.test(req.headers['content-type'] ?? '');
}

async function readJson(req, limit) {
  const chunks = []; let bytes = 0;
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    bytes += chunk.length;
    if (bytes > limit) return { tooLarge: true };
    chunks.push(chunk);
  }
  try { return { value: JSON.parse(Buffer.concat(chunks).toString('utf8')) }; } catch { return { invalid: true }; }
}

async function identity(route, { method = 'GET', bearer, body } = {}) {
  const base = endpoint();
  if (!base) return { status: 503, data: { disposition: 'IDENTITY_NOT_CONFIGURED' } };
  try {
    const response = await fetch(base + route, {
      method, redirect: 'error', signal: AbortSignal.timeout(policy.timeoutMilliseconds),
      headers: { ...(bearer ? { authorization: `Bearer ${bearer}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
      body
    });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    return { status: response.status, data, realm: response.headers.get('x-sfx-identity-realm') };
  } catch {
    return { status: 503, data: { disposition: 'IDENTITY_UNAVAILABLE' } };
  }
}

function remember(map, key, value, limit) {
  map.set(key, value);
  while (map.size > limit) map.delete(map.keys().next().value);
}

// Validate the request's session with the identity host. Returns the session
// metadata or a refusal; clears nothing (callers decide what to send).
export async function validateSession(req) {
  const bearer = sessionCookie(req);
  if (!bearer) return { refusal: { status: 401, disposition: 'SIGN_IN_REQUIRED' } };
  const result = await identity('/auth/v1/session', { bearer });
  if (result.status === 401) return { refusal: { status: 401, disposition: 'SESSION_ENDED', clear: true } };
  const data = result.data;
  if (result.status !== 200 || !uuid.test(data?.sessionId ?? '') || !uuid.test(data?.principalId ?? '') || !(Date.parse(data?.expiresAt) > Date.now()))
    return { refusal: { status: 503, disposition: result.data?.disposition === 'IDENTITY_NOT_CONFIGURED' ? 'IDENTITY_NOT_CONFIGURED' : 'IDENTITY_UNAVAILABLE' } };
  return { session: { sessionId: data.sessionId, principalId: data.principalId, expiresAt: data.expiresAt, realm: result.realm ?? null,
    identifier: labels.get(data.sessionId) ?? null } };
}

export const observeRequiresSession = () => policy.observeRequiresSession === true;

export function attributeRun(runId, session, subject = {}) {
  if (typeof runId !== 'string' || !runId) return false;
  const existing = attributions.find(a => a.runId === runId);
  if (existing) return existing.principalId === session.principalId;
  attributions.push({ runId, principalId: session.principalId, sessionId: session.sessionId, admittedAt: new Date().toISOString(),
    capabilityId: typeof subject.capabilityId === 'string' ? subject.capabilityId : null,
    namespaceId: typeof subject.namespaceId === 'string' ? subject.namespaceId : null });
  while (attributions.length > policy.maximumAttributedRuns) attributions.shift();
  return true;
}

export const ownsRun = (runId, principalId) => attributions.some(a => a.runId === runId && a.principalId === principalId);

export async function serveSessionApi(req, res, url) {
  if (url.pathname !== prefix && !url.pathname.startsWith(prefix + '/')) return false;
  const route = url.pathname.slice(prefix.length);

  if (req.method === 'GET' && route === '') {
    if (!sessionCookie(req)) { send(res, 200, { authenticated: false, observeRequiresSession: observeRequiresSession() }); return true; }
    const checked = await validateSession(req);
    if (checked.session) { send(res, 200, { authenticated: true, observeRequiresSession: observeRequiresSession(), ...checked.session }); return true; }
    const { status, disposition, clear } = checked.refusal;
    if (status === 401) send(res, 200, { authenticated: false, observeRequiresSession: observeRequiresSession(), disposition }, clear ? { 'set-cookie': expired() } : {});
    else send(res, status, { authenticated: false, disposition });
    return true;
  }

  if (req.method === 'GET' && route === '/runs') {
    const checked = await validateSession(req);
    if (!checked.session) { const r = checked.refusal; send(res, r.status, { disposition: r.disposition }, r.clear ? { 'set-cookie': expired() } : {}); return true; }
    if (evidenceConfigured()) {
      try {
        const stored = await evidenceRequest('/runs', { bearer: sessionCookie(req) });
        const combined = new Map(stored.runs.map(r => [r.runId, r]));
        for (const r of attributions.filter(a => a.principalId === checked.session.principalId))
          if (!combined.has(r.runId)) combined.set(r.runId, { runId: r.runId, admittedAt: r.admittedAt, capabilityId: r.capabilityId, namespaceId: r.namespaceId, captureStatus: 'unconfirmed' });
        send(res, 200, { principalId: checked.session.principalId, storage: 'durable', runs: [...combined.values()] });
      } catch { send(res, 503, { disposition: 'EVIDENCE_UNAVAILABLE' }); }
      return true;
    }
    send(res, 200, { principalId: checked.session.principalId,
      runs: attributions.filter(a => a.principalId === checked.session.principalId)
        .map(({ runId, admittedAt, sessionId, capabilityId, namespaceId }) => ({ runId, admittedAt, sessionId, capabilityId, namespaceId })) });
    return true;
  }

  if (req.method === 'POST' && route === '') {
    if (!sameOriginJson(req)) { send(res, 403, { disposition: 'SAME_ORIGIN_JSON_REQUIRED' }); return true; }
    const input = await readJson(req, policy.maximumBodyBytes);
    if (input.tooLarge) { send(res, 413, { disposition: 'LOGIN_INPUT_INVALID' }); return true; }
    const value = input.value;
    if (input.invalid || !value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== 2 ||
        typeof value.identifier !== 'string' || typeof value.password !== 'string' || !value.identifier || !value.password) {
      send(res, 400, { disposition: 'LOGIN_INPUT_INVALID' }); return true;
    }
    const prior = sessionCookie(req);
    const result = await identity('/auth/v1/login', { method: 'POST', body: JSON.stringify({ identifier: value.identifier, password: value.password }) });
    if (result.status !== 200) {
      const disposition = typeof result.data?.disposition === 'string' ? result.data.disposition : 'IDENTITY_UNAVAILABLE';
      send(res, [400, 401, 429, 503].includes(result.status) ? result.status : 502, { disposition }); return true;
    }
    const s = result.data;
    const expiresIn = Math.floor((Date.parse(s?.expiresAt) - Date.now()) / 1000);
    if (s?.tokenType !== 'Bearer' || !bearerShape.test(s?.token ?? '') || !uuid.test(s?.sessionId ?? '') || !uuid.test(s?.principalId ?? '') || !(expiresIn > 0)) {
      if (bearerShape.test(s?.token ?? '')) await identity('/auth/v1/logout', { method: 'POST', bearer: s.token });
      send(res, 502, { disposition: 'IDENTITY_RESPONSE_INVALID' }); return true;
    }
    // A new sign-in replaces the browser's previous session; revoke it server-side.
    if (prior && prior !== s.token) await identity('/auth/v1/logout', { method: 'POST', bearer: prior });
    remember(labels, s.sessionId, value.identifier.slice(0, 254), policy.maximumSessionLabels);
    send(res, 200, { disposition: 'AUTHENTICATED', sessionId: s.sessionId, principalId: s.principalId, expiresAt: s.expiresAt,
      realm: result.realm ?? null, identifier: labels.get(s.sessionId) },
      { 'set-cookie': `${cookieName}=${s.token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${expiresIn}` });
    return true;
  }

  if (req.method === 'POST' && route === '/logout') {
    if (!sameOriginJson(req)) { send(res, 403, { disposition: 'SAME_ORIGIN_JSON_REQUIRED' }); return true; }
    const bearer = sessionCookie(req);
    if (!bearer) { send(res, 200, { disposition: 'NOT_SIGNED_IN' }, { 'set-cookie': expired() }); return true; }
    const result = await identity('/auth/v1/logout', { method: 'POST', bearer });
    // Removing the cookie is not proof of server revocation; report which happened.
    const disposition = result.status === 200 && result.data?.disposition === 'REVOKED' ? 'REVOKED'
      : result.status === 401 ? 'SESSION_ALREADY_ENDED' : 'REVOCATION_UNCONFIRMED';
    send(res, disposition === 'REVOCATION_UNCONFIRMED' ? 503 : 200, { disposition }, { 'set-cookie': expired() });
    return true;
  }

  send(res, 405, { disposition: 'UNSUPPORTED_SESSION_OPERATION' });
  return true;
}
