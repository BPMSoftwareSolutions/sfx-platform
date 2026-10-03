import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { parseArgs } from 'node:util';
import { sessionStore } from './session-store.mjs';

export const authCommands = new Set(['login', 'whoami', 'logout']);
export const authHelp = `Usage: sfx login [--endpoint <HTTPS URL>] [--username <identifier>] [--json]
       sfx whoami [--endpoint <HTTPS URL>] [--json]
       sfx logout [--endpoint <HTTPS URL>] [--json]
Passwords are entered only at the hidden interactive prompt.
Session credentials use the OS secure store. No admin-token fallback.
`;
export function parseAuth(argv) {
  let parsed;
  try { parsed = parseArgs({ args: argv, allowPositionals: true, options: {
    endpoint: { type: 'string' }, username: { type: 'string' }, json: { type: 'boolean' }, help: { type: 'boolean', short: 'h' }
  } }); } catch { throw new Error('LOGIN_ARGUMENT_INVALID: Use sfx login --help. Password flags and --input are not accepted.'); }
  const { values, positionals } = parsed;
  if (positionals.length !== 1 || !authCommands.has(positionals[0]) || (positionals[0] !== 'login' && values.username !== undefined))
    throw new Error('LOGIN_ARGUMENT_INVALID');
  return { ...values, command: positionals[0] };
}
export function authEndpoint(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('HTTPS_ENDPOINT_REQUIRED'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('HTTPS_ENDPOINT_REQUIRED');
  return url.href.replace(/\/+$/, '');
}
export async function privateLogin(endpoint, username) {
  if (!process.stdin.isTTY || !process.stderr.isTTY) throw new Error('INTERACTIVE_LOGIN_REQUIRED');
  const binary = fileURLToPath(new URL(`./login-input/sfx-login-input${process.platform === 'win32' ? '.exe' : ''}`, import.meta.url));
  const environment = { ...process.env };
  for (const name of Object.keys(environment)) if (/TOKEN|PASSWORD|CONNECTION_STRING|SERVICE_KEY|SFX_API_ARGV/i.test(name)) delete environment[name];
  return new Promise((resolve, reject) => {
    const child = spawn(binary, [endpoint, ...(username === undefined ? [] : [username])], { env: environment, stdio: ['inherit', 'pipe', 'inherit'], windowsHide: true });
    const chunks = []; let size = 0;
    child.stdout.on('data', chunk => { size += chunk.length; if (size > 8192) child.kill(); else chunks.push(chunk); });
    child.on('error', () => reject(new Error('LOGIN_INPUT_PROVIDER_UNAVAILABLE: Install the published login input provider.')));
    child.on('close', code => {
      const bytes = Buffer.concat(chunks);
      try {
        if (code !== 0 || size > 8192) throw new Error(code === 130 ? 'LOGIN_CANCELLED' : 'LOGIN_NOT_COMPLETED');
        resolve(JSON.parse(bytes.toString('utf8')));
      } catch (error) { reject(new Error(error.message === 'LOGIN_CANCELLED' ? error.message : 'LOGIN_NOT_COMPLETED')); }
      finally { bytes.fill(0); for (const chunk of chunks) chunk.fill(0); }
    });
  });
}
export async function privateRequest(endpoint, route, token, method = 'GET', request = fetch) {
  let response;
  try { response = await request(endpoint + route, { method, redirect: 'error', signal: AbortSignal.timeout(15000), headers: { authorization: `Bearer ${token}` } }); }
  catch { throw new Error('IDENTITY_UNAVAILABLE'); }
  if (response.status === 401) throw new Error('SESSION_REJECTED');
  if (!response.ok) throw new Error('IDENTITY_UNAVAILABLE');
  let data;
  try { data = await response.json(); } catch { throw new Error('IDENTITY_RESPONSE_INVALID'); }
  return { data, realm: response.headers.get('x-sfx-identity-realm') };
}
export async function authenticate(options, endpointValue, dependencies = {}) {
  const store = dependencies.store || sessionStore();
  const endpoint = authEndpoint(endpointValue);
  const release = options.command === 'whoami' ? () => {} : store.lock(endpoint);
  try { return await performAuthentication(options, endpoint, { ...dependencies, store }); }
  finally { release(); }
}
async function performAuthentication(options, endpointValue, { store, acquire = privateLogin, request = fetch }) {
  const endpoint = authEndpoint(endpointValue);
  const remote = (route, token, method) => privateRequest(endpoint, route, token, method, request);
  if (options.command === 'login') {
    // A deliberate user login selects user authentication even if it fails.
    // A configured machine token never rescues an invalid user session.
    store.select(endpoint);
    const result = await acquire(endpoint, options.username);
    const session = result?.session, realm = result?.realm;
    const tokenValid = typeof session?.token === 'string' && /^[A-Za-z0-9+/]{43}=$/.test(session.token) && Buffer.from(session.token, 'base64').toString('base64') === session.token;
    let saved = false;
    try {
      if (!tokenValid || session.tokenType !== 'Bearer' || typeof realm !== 'string' || !realm || realm.length > 254 || /[\x00-\x1f]/.test(realm) ||
          ![session.sessionId, session.principalId].every(id => typeof id === 'string' && /^[a-f0-9-]{36}$/i.test(id)) || !(Date.parse(session.expiresAt) > Date.now()))
        throw new Error('IDENTITY_RESPONSE_INVALID');
      if (store.profile(endpoint)?.state === 'active') {
        const prior = store.read(endpoint, true);
        try { await remote('/auth/v1/logout', prior.token, 'POST'); } catch (error) { if (error.message !== 'SESSION_REJECTED') throw error; }
        store.clear(endpoint);
      }
      const metadata = store.save(endpoint, realm, session);
      saved = true;
      return { disposition: 'AUTHENTICATED', ...metadata };
    } finally {
      if (!saved && tokenValid) {
        try { await remote('/auth/v1/logout', session.token, 'POST'); }
        catch { throw new Error('LOGIN_INCOMPLETE: Session could not be stored; server revocation is unconfirmed.'); }
      }
    }
  }
  if (options.command === 'logout') {
    store.select(endpoint);
    let confirmed = false;
    if (store.profile(endpoint)?.state !== 'active') return { disposition: 'SIGNED_OUT', endpoint };
    try {
      const session = store.read(endpoint, true);
      await remote('/auth/v1/logout', session.token, 'POST'); confirmed = true;
    } catch { /* Local removal still happens; no false remote revocation claim. */ }
    store.clear(endpoint);
    return { disposition: confirmed ? 'REVOKED' : 'LOCAL_SESSION_REMOVED', endpoint, remoteRevocationConfirmed: confirmed };
  }
  const session = store.read(endpoint);
  const { data, realm } = await remote('/auth/v1/session', session.token);
  if (realm !== session.realm || data.sessionId !== session.sessionId || data.principalId !== session.principalId || !(Date.parse(data.expiresAt) > Date.now()))
    throw new Error('SESSION_SCOPE_INVALID');
  return { disposition: 'AUTHENTICATED', endpoint, realm, sessionId: data.sessionId, principalId: data.principalId, expiresAt: data.expiresAt };
}
