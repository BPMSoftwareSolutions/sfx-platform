// Verification-only fixture observer: the circuit host on a spare loopback port
// with an environment that cannot inherit host configuration (SFX_*, SDA_*,
// PROCEDURE_EXTRACT_*, …) from the caller's shell. Callers pass every host
// setting they depend on explicitly, so verifiers can run side by side and a
// developer's environment cannot change what a green result covered.
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const observerModule = path.join(repoRoot, 'live-circuit', 'dispatch-pair', 'observe-server.mjs');
const HOST_CONFIGURATION = /^(SFX_|SDA_|SIDEFX_|PROCEDURE_EXTRACT_|OBSERVER_|CIRCUIT_)/i;

export function isolatedEnvironment(explicit = {}) {
  const inherited = Object.fromEntries(Object.entries(process.env).filter(([name]) => !HOST_CONFIGURATION.test(name)));
  return { ...inherited, ...explicit };
}

function sparePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => { const { port } = probe.address(); probe.close(() => resolve(port)); });
  });
}

// Resolves once /health answers; rejects with the observer's last output line
// when it exits first (for example a port taken between probe and listen).
export async function startFixtureObserver(settings = {}, { timeoutMs = 20000 } = {}) {
  const port = await sparePort();
  const child = spawn(process.execPath, [observerModule], { cwd: repoRoot, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: isolatedEnvironment({ ...settings, OBSERVER_PORT: String(port) }) });
  let output = '';
  const retain = chunk => { output = (output + chunk).slice(-4000); };
  child.stdout.on('data', retain); child.stderr.on('data', retain); child.on('error', () => {});
  const stop = () => { if (child.exitCode === null) child.kill(); };
  const base = `http://localhost:${port}`;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`observe-server exited early with code ${child.exitCode}: ${output.trim().split('\n').at(-1) ?? ''}`);
    try { if ((await fetch(`${base}/health`, { signal: AbortSignal.timeout(2000) })).ok) return { base, port, stop }; } catch { /* not listening yet */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  stop();
  throw new Error(`observe-server did not answer /health within ${timeoutMs} ms`);
}
