import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

test('Windows installation preserves local launcher through junction paths and reinstalls safely', { skip: process.platform !== 'win32' }, t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sfx-install-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const bin = path.join(root, 'bin'), alias = path.join(root, 'alias'), input = path.join(root, 'input'), install = path.join(root, 'install');
  fs.mkdirSync(bin); fs.mkdirSync(input); fs.symlinkSync(bin, alias, 'junction');
  // Installer fixture only; no fake helper is ever invoked as a login provider.
  fs.writeFileSync(path.join(input, 'sfx-login-input.exe'), 'installer fixture');
  const local = "param([Parameter(ValueFromRemainingArguments=$true)][string[]]$rest)\nConvertTo-Json -InputObject @($rest) -Compress\nexit 0\n";
  fs.writeFileSync(path.join(bin, 'sfx.ps1'), local);
  const installer = fileURLToPath(new URL('./install-login.mjs', import.meta.url));
  const arguments_ = [installer, '--endpoint', 'https://example.test', '--input-directory', input, '--bin', alias, '--root', install, '--local-launcher', path.join(alias, 'sfx.ps1')];
  for (let i = 0; i < 2; i++) execFileSync(process.execPath, arguments_, { stdio: 'pipe' });
  const manifest = JSON.parse(fs.readFileSync(path.join(install, 'login-install.json')));
  assert.equal(fs.readFileSync(manifest.localLauncher, 'utf8'), local);
  assert.notEqual(manifest.localLauncher, fs.realpathSync(path.join(alias, 'sfx.ps1')));
  const actual = execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(alias, 'sfx.ps1'), 'capability', 'list'],
    { encoding: 'utf8', cwd: os.tmpdir(), stdio: 'pipe' });
  assert.deepEqual(JSON.parse(actual), ['capability', 'list']);
  const help = execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(alias, 'sfx.ps1'), 'login', '--help'],
    { encoding: 'utf8', cwd: os.tmpdir(), stdio: 'pipe' });
  assert.ok(help.includes('hidden interactive prompt'));

  // An explicit launcher upgrade is copied into the installation. Dispatch
  // must keep working after the supplied source is changed or removed.
  const updateSource = path.join(root, 'new-launcher.ps1');
  const updated = "param([Parameter(ValueFromRemainingArguments=$true)][string[]]$rest)\nConvertTo-Json -InputObject @{ revision = 2; arguments = @($rest) } -Compress\nexit 0\n";
  fs.writeFileSync(updateSource, updated);
  execFileSync(process.execPath, [installer, '--endpoint', 'https://example.test', '--input-directory', path.join(manifest.destination, 'login-input'),
    '--bin', alias, '--root', install, '--local-launcher', updateSource], { stdio: 'pipe' });
  const upgraded = JSON.parse(fs.readFileSync(path.join(install, 'login-install.json')));
  assert.equal(upgraded.localLauncherDigest, 'sha256:' + createHash('sha256').update(updated).digest('hex'));
  assert.equal(path.dirname(upgraded.localLauncher), install);
  assert.notEqual(upgraded.localLauncher, updateSource);
  assert.notEqual(upgraded.localLauncher, manifest.localLauncher);
  assert.equal(fs.readFileSync(manifest.localLauncher, 'utf8'), local, 'old installed copy remains intact');
  fs.unlinkSync(updateSource);
  for (let i = 0; i < 2; i++) {
    execFileSync(process.execPath, arguments_, { stdio: 'pipe' });
    const retained = JSON.parse(fs.readFileSync(path.join(install, 'login-install.json')));
    assert.equal(retained.localLauncher, upgraded.localLauncher, 'wrapper reinstall retains the upgrade');
    const output = execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(alias, 'sfx.ps1'), 'capability', 'list'],
      { encoding: 'utf8', cwd: os.tmpdir(), stdio: 'pipe' });
    assert.deepEqual(JSON.parse(output), { revision: 2, arguments: ['capability', 'list'] });
  }
});
