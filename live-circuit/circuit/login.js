// Sign-in page: posts { identifier, password } to the same-origin session
// transport, which runs authenticate-ide-user through the identity host. The
// session bearer never reaches this script; it lives in an HttpOnly cookie.
const $ = id => document.getElementById(id);
const session = '/api/circuit/v1/session';
const messages = {
  AUTHENTICATION_REJECTED: 'The identifier or password was not accepted.',
  THROTTLED: 'Too many sign-in attempts. Wait a moment, then try again.',
  LOGIN_INPUT_INVALID: 'Enter an identifier and a password.',
  IDENTITY_NOT_CONFIGURED: 'Sign-in is not configured on this host.',
  IDENTITY_UNAVAILABLE: 'The identity service is unavailable. Try again shortly.',
  IDENTITY_RESPONSE_INVALID: 'The identity service returned an unexpected response. No session was kept.',
  SAME_ORIGIN_JSON_REQUIRED: 'The request was refused by the same-origin check.',
  SESSION_ENDED: 'Your session has ended. Sign in again.',
};
const signedOut = {
  REVOKED: 'Signed out. The session was revoked.',
  SESSION_ALREADY_ENDED: 'Signed out. The session had already ended.',
  NOT_SIGNED_IN: 'You are not signed in.',
  REVOCATION_UNCONFIRMED: 'Signed out of this browser, but the identity service did not confirm revocation.',
};

// Only same-origin circuit paths are accepted as a return target.
const target = (() => {
  const value = new URLSearchParams(location.search).get('return');
  return value && value.startsWith('/circuit') && !value.startsWith('//') && !value.includes('\\') ? value : '/circuit/';
})();

function status(text, kind = '') { $('status').textContent = text; $('status').className = kind; }

async function call(path, options = {}) {
  const response = await fetch(path, { credentials: 'same-origin', redirect: 'error', ...options,
    headers: { ...(options.body ? { 'content-type': 'application/json' } : {}), accept: 'application/json' } });
  let body = null;
  try { body = await response.json(); } catch { body = null; }
  return { ok: response.ok, status: response.status, body };
}

function render(state) {
  const signedIn = state?.authenticated === true || state?.disposition === 'AUTHENTICATED';
  $('sign-in').hidden = signedIn;
  $('signed-in').hidden = !signedIn;
  if (signedIn) {
    $('who').textContent = state.identifier ?? `principal ${state.principalId}`;
    const expires = new Date(state.expiresAt);
    $('session-detail').textContent = `Realm ${state.realm ?? '(not reported)'} · session ${state.sessionId.slice(0, 8)} · expires ${expires.toLocaleTimeString()}`;
  } else {
    $('identifier').focus();
  }
}

async function refresh() {
  const result = await call(session);
  if (!result.ok) { $('sign-in').hidden = false; status(messages[result.body?.disposition] ?? 'Session status is unavailable.', 'error'); return; }
  if (result.body?.disposition === 'SESSION_ENDED') status(messages.SESSION_ENDED);
  render(result.body);
}

$('sign-in').addEventListener('submit', async event => {
  event.preventDefault();
  const identifier = $('identifier').value.trim(), password = $('password').value;
  $('password').value = '';
  if (!identifier || !password) { status(messages.LOGIN_INPUT_INVALID, 'error'); return; }
  $('submit').disabled = true;
  status('Signing in. authenticate-ide-user is running…');
  try {
    const result = await call(session, { method: 'POST', body: JSON.stringify({ identifier, password }) });
    if (result.ok && result.body?.disposition === 'AUTHENTICATED') {
      status('Signed in.', 'ok');
      render(result.body);
      if (new URLSearchParams(location.search).has('return')) location.assign(target);
      return;
    }
    status(messages[result.body?.disposition] ?? `Sign-in failed (${result.status}).`, 'error');
    $('password').focus();
  } catch {
    status(messages.IDENTITY_UNAVAILABLE, 'error');
  } finally {
    $('submit').disabled = false;
  }
});

$('sign-out').addEventListener('click', async () => {
  $('sign-out').disabled = true;
  try {
    const result = await call(`${session}/logout`, { method: 'POST', body: '{}' });
    status(signedOut[result.body?.disposition] ?? 'Sign-out could not be confirmed.', result.body?.disposition === 'REVOCATION_UNCONFIRMED' ? 'error' : 'ok');
    render({ authenticated: false });
  } catch {
    status('Sign-out could not be completed. Try again.', 'error');
  } finally {
    $('sign-out').disabled = false;
  }
});

$('continue').addEventListener('click', () => location.assign(target));
refresh().catch(() => { $('sign-in').hidden = false; status('Session status is unavailable.', 'error'); });
