import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const hash = value => createHash('sha256').update(value).digest('hex');
export function sessionRoot(env = process.env) {
  return env.SFX_SESSION_HOME || path.join(env.LOCALAPPDATA || path.join(os.homedir(), '.local/share'), 'sfx', 'user-sessions');
}
function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw new Error('SESSION_PROFILE_INVALID'); }
}
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.${randomUUID()}.tmp`;
  try { fs.writeFileSync(temporary, JSON.stringify(value) + '\n', { mode: 0o600, flag: 'wx' }); fs.renameSync(temporary, file); }
  finally { fs.rmSync(temporary, { force: true }); }
}
export function nativeStore(root, platform = process.platform, run = execFileSync) {
  function invoke(operation, key, secret) {
    if (!/^[a-f0-9]{64}$/.test(key)) throw new Error('SESSION_SCOPE_INVALID');
    try {
      if (platform === 'win32') return run('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File',
        fileURLToPath(new URL('./session-store.ps1', import.meta.url)), '-Operation', operation, '-Path', path.join(root, key + '.dpapi.xml')],
        { input: secret, encoding: 'utf8', timeout: 15000, windowsHide: true, env: { ...process.env, PSModulePath: undefined }, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
      if (platform === 'darwin') {
        if (operation === 'write') {
          // security's interactive command channel keeps the secret out of argv.
          // Base64 is the complete allowed alphabet: no shell/command quoting.
          const encoded = Buffer.from(secret).toString('base64');
          run('/usr/bin/security', ['-i'], { input: `add-generic-password -U -s sfx-cli-user-session -a ${key} -w ${encoded}\n`,
            encoding: 'utf8', timeout: 30000, stdio: ['pipe', 'pipe', 'pipe'] });
          // Interactive security can exit zero after a command error. Read-back
          // is mandatory before announcing durable login.
          if (invoke('read', key) !== secret) throw new Error();
          return;
        }
        const verb = operation === 'read' ? 'find-generic-password' : 'delete-generic-password';
        const value = run('/usr/bin/security', [verb, '-s', 'sfx-cli-user-session', '-a', key, ...(operation === 'read' ? ['-w'] : [])],
          { encoding: 'utf8', timeout: 30000, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
        return operation === 'read' ? Buffer.from(value, 'base64').toString('utf8') : undefined;
      }
      throw new Error('SECURE_SESSION_STORE_UNSUPPORTED');
    } catch (error) {
      if (error.message === 'SECURE_SESSION_STORE_UNSUPPORTED') throw error;
      // Never attach captured helper output: it can contain a private value.
      throw new Error('SECURE_SESSION_STORE_UNAVAILABLE');
    }
  }
  return { read: key => invoke('read', key), write: (key, value) => invoke('write', key, value), delete: key => invoke('delete', key),
    check: () => { if (!['win32', 'darwin'].includes(platform)) throw new Error('SECURE_SESSION_STORE_UNSUPPORTED'); } };
}
export function sessionStore(root = sessionRoot(), secure = nativeStore(root)) {
  const selection = path.join(root, 'selected.json');
  const profilePath = endpoint => path.join(root, hash(endpoint) + '.json');
  const api = {
    selected: () => readJson(selection),
    profile: endpoint => readJson(profilePath(endpoint)),
    lock(endpoint) {
      fs.mkdirSync(root, { recursive: true, mode: 0o700 });
      const file = profilePath(endpoint) + '.lock';
      let fd;
      try { fd = fs.openSync(file, 'wx', 0o600); }
      catch { throw new Error('LOGIN_OPERATION_IN_PROGRESS: Another login/logout owns this endpoint; if it was interrupted, remove its stale .lock file from the session profile directory.'); }
      fs.writeFileSync(fd, String(process.pid));
      return () => { fs.closeSync(fd); fs.rmSync(file, { force: true }); };
    },
    select(endpoint) {
      secure.check();
      writeJson(selection, { authentication: 'user', endpoint });
      if (!api.profile(endpoint)) writeJson(profilePath(endpoint), { endpoint, state: 'signed-out' });
    },
    save(endpoint, realm, session) {
      const key = hash(JSON.stringify([endpoint, realm, session.principalId, session.sessionId]));
      const metadata = { endpoint, realm, sessionId: session.sessionId, principalId: session.principalId, expiresAt: session.expiresAt };
      let saved = false;
      try {
        secure.write(key, JSON.stringify({ ...metadata, token: session.token }));
        // Read back on every OS so a failed write never becomes a successful login.
        const verified = JSON.parse(secure.read(key));
        if (verified.token !== session.token || verified.endpoint !== endpoint) throw new Error();
        writeJson(profilePath(endpoint), { ...metadata, key, state: 'active' });
        saved = true;
      } catch { throw new Error('SECURE_SESSION_STORE_UNAVAILABLE'); }
      finally { if (!saved) { try { secure.delete(key); } catch {} } }
      return metadata;
    },
    read(endpoint, allowExpired = false) {
      const profile = api.profile(endpoint);
      if (profile?.state !== 'active') throw new Error('LOGIN_REQUIRED: Run sfx login for this endpoint.');
      if (profile.endpoint !== endpoint || !profile.key) throw new Error('SESSION_SCOPE_INVALID');
      let value;
      try { value = JSON.parse(secure.read(profile.key)); } catch { throw new Error('SECURE_SESSION_STORE_UNAVAILABLE'); }
      if (['endpoint', 'realm', 'principalId', 'sessionId', 'expiresAt'].some(field => value[field] !== profile[field]) ||
          profile.key !== hash(JSON.stringify([endpoint, value.realm, value.principalId, value.sessionId]))) throw new Error('SESSION_SCOPE_INVALID');
      if (!allowExpired && !(Date.parse(value.expiresAt) > Date.now())) throw new Error('SESSION_EXPIRED: Run sfx login again.');
      return value;
    },
    clear(endpoint) {
      const profile = api.profile(endpoint);
      if (profile?.key) secure.delete(profile.key);
      writeJson(profilePath(endpoint), { endpoint, state: 'signed-out' });
    }
  };
  return api;
}
