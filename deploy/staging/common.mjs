import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
export const root = fileURLToPath(new URL('../../', import.meta.url));
export const config = JSON.parse(fs.readFileSync(new URL('./config.json', import.meta.url)));
export const azure = JSON.parse(fs.readFileSync(path.join(root, 'infra/azure.json')));
export const slotUrl = `https://management.azure.com/subscriptions/${azure.subscriptionId}/resourceGroups/${azure.resourceGroup}/providers/Microsoft.Web/sites/${azure.appName}/slots/${azure.stagingSlot}`;
export const evidence = path.resolve(process.env.SFX_RELEASE_EVIDENCE || path.join(root, 'artifacts/staging'));
export function write(name, data) { fs.mkdirSync(evidence, { recursive: true }); fs.writeFileSync(path.join(evidence, name), JSON.stringify(data, null, 2) + '\n'); }
export function read(name) { return JSON.parse(fs.readFileSync(path.join(evidence, name))); }
export async function run(command, args, { input, env = {}, timeout = 900000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, windowsHide: true, env: { ...process.env, ...env }, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, timeout);
    child.stdout.on('data', b => stdout += b); child.stderr.on('data', b => stderr += b);
    child.on('error', () => { clearTimeout(timer); reject(new Error('COMMAND_START_FAILED: ' + path.basename(command))); });
    child.on('close', code => {
      clearTimeout(timer);
      // Captured output may contain tokens. Never attach it to thrown errors.
      if (code || timedOut) reject(new Error(`COMMAND_FAILED: ${path.basename(command)} (${timedOut ? 'timeout' : code})`));
      else resolve(stdout);
    });
    child.stdin.end(input);
  });
}
export async function az(args) {
  const windows = process.platform === 'win32';
  const executable = windows ? (process.env.SFX_AZURE_CLI_PYTHON || 'C:/Program Files/Microsoft SDKs/Azure/CLI2/python.exe') : 'az';
  const result = await run(executable, [...(windows ? ['-IBm', 'azure.cli'] : []), ...args, '--only-show-errors', '--output', 'json']);
  if (!result.trim()) return null;
  try { return JSON.parse(result); } catch { return result.trim(); } // ACR login/build can return plain status text.
}
export const rest = (method, suffix, body) => az(['rest', '--method', method, '--url', `${slotUrl}${suffix}?api-version=${azure.appServiceApiVersion}`, ...(body ? ['--body', JSON.stringify(body)] : [])]);
export async function token() {
  const settings = await rest('post', '/config/appsettings/list');
  const value = settings.properties.SDA_API_TOKEN;
  if (!value || value.startsWith('@Microsoft.KeyVault')) throw new Error('DIRECT_MACHINE_TOKEN_REQUIRED');
  return value;
}
export async function privateFixture() {
  const value = await az(['keyvault', 'secret', 'show', '--vault-name', config.keyVault, '--name', config.acceptanceSecret]);
  const fixture = JSON.parse(value.value);
  if (fixture.endpoint !== config.origin || !fixture.identifier?.startsWith('staging-release-') || !fixture.password) throw new Error('ACCEPTANCE_FIXTURE_INVALID');
  return fixture;
}
export async function json(url, init = {}) {
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(90000), ...init });
  if (!response.ok) {
    let code;
    try { const body = await response.json(); code = typeof body.error === 'string' ? body.error : body.error?.code; } catch {}
    throw new Error(`HTTP_${response.status}: ${new URL(url).pathname}${/^[A-Z0-9_]+$/.test(code || '') ? ' (' + code + ')' : ''}`);
  }
  return response.json();
}
export async function sleep(ms) { await new Promise(resolve => setTimeout(resolve, ms)); }
