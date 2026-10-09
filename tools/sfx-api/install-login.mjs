#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { authEndpoint } from './auth.mjs';

const { values } = parseArgs({ options: { endpoint: { type: 'string' }, 'input-directory': { type: 'string' }, bin: { type: 'string' },
  'local-launcher': { type: 'string' }, root: { type: 'string' } } });
const endpoint = authEndpoint(values.endpoint);
const windows = process.platform === 'win32';
if (!windows && process.platform !== 'darwin') throw new Error('SECURE_SESSION_STORE_UNSUPPORTED');
if (!values['input-directory'] || !values['local-launcher']) throw new Error('--input-directory and --local-launcher are required.');
const inputDirectory = fs.realpathSync(values['input-directory']);
const helper = path.join(inputDirectory, 'sfx-login-input' + (windows ? '.exe' : ''));
if (!fs.statSync(helper).isFile()) throw new Error('Published login input provider required.');
const bin = path.resolve(values.bin || (windows ? path.dirname(values['local-launcher']) : path.join(os.homedir(), '.local/bin')));
const root = path.resolve(values.root || path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), '.local/share'), 'sfx', 'api-client'));
const source = path.dirname(fileURLToPath(import.meta.url));
const files = ['sfx-api.mjs', 'auth.mjs', 'session-store.mjs', 'session-store.ps1', 'credential.ps1'];
const digest = createHash('sha256');
for (const file of files) digest.update(file).update(fs.readFileSync(path.join(source, file)));
function hashTree(directory, prefix = '') {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const relative = path.join(prefix, entry.name), full = path.join(directory, entry.name);
    if (entry.isDirectory()) hashTree(full, relative);
    else if (entry.isFile()) digest.update(relative).update(fs.readFileSync(full));
    else throw new Error('Published input must contain regular files only.');
  }
}
hashTree(inputDirectory);
const version = digest.digest('hex'), destination = path.join(root, version);
fs.mkdirSync(destination, { recursive: true }); fs.mkdirSync(bin, { recursive: true });
for (const file of files) fs.copyFileSync(path.join(source, file), path.join(destination, file));
const installedInput = path.join(destination, 'login-input');
if (!fs.existsSync(installedInput) || fs.realpathSync(installedInput) !== inputDirectory)
  fs.cpSync(inputDirectory, installedInput, { recursive: true });
const localArgument = fs.realpathSync(values['local-launcher']);
const previousPath = path.join(root, 'login-install.json');
const previous = fs.existsSync(previousPath) ? JSON.parse(fs.readFileSync(previousPath, 'utf8')) : null;
let local = localArgument;
if (fs.readFileSync(localArgument, 'utf8').includes('SFX_AUTH_WRAPPER')) {
  if (!previous?.localLauncher || !fs.existsSync(previous.localLauncher)) throw new Error('Previous local delegate unavailable.');
  local = previous.localLauncher;
}
// Always install the delegate by content, including an explicitly supplied
// launcher update. Never leave dispatch pointing into a checkout/build folder.
// Reinstalling through the auth wrapper retains its current installed delegate.
const localBytes = fs.readFileSync(local);
const localHash = createHash('sha256').update(localBytes).digest('hex');
const preserved = path.join(root, `local-${localHash}${windows ? '.ps1' : ''}`);
if (fs.existsSync(preserved)) {
  if (!fs.readFileSync(preserved).equals(localBytes)) throw new Error('LOCAL_LAUNCHER_DIGEST_MISMATCH');
} else fs.writeFileSync(preserved, localBytes, { mode: 0o700, flag: 'wx' });
local = preserved;
const config = path.join(root, 'config.json');
// A human-client installation never asks for or changes a machine credential.
const profile = fs.existsSync(config) ? JSON.parse(fs.readFileSync(config, 'utf8').replace(/^\uFEFF/, '')) : {};
if (!profile.endpoint) fs.writeFileSync(config, JSON.stringify({ endpoint }) + '\n');
const userConfig = path.join(root, 'user-config.json');
fs.writeFileSync(userConfig, JSON.stringify({ endpoint }) + '\n');
const entry = path.join(destination, 'sfx-api.mjs');
if (windows) {
  const ps = value => "'" + value.replaceAll("'", "''") + "'";
  const common = `param([Parameter(ValueFromRemainingArguments=$true)][string[]]$rest)\n# SFX_AUTH_WRAPPER\n$ErrorActionPreference = 'Stop'\nif ($null -eq $rest) { $rest = @() }\n`;
  const run = `$savedArgs = $env:SFX_API_ARGV_B64\n$savedConfig = $env:SFX_API_CONFIG\ntry {\n    $env:SFX_API_ARGV_B64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes((ConvertTo-Json -InputObject @($rest) -Compress)))\n    if (-not $env:SFX_API_CONFIG) { $env:SFX_API_CONFIG = ${ps(userConfig)} }\n    & ${ps(process.execPath)} ${ps(entry)}\n    $result = $LASTEXITCODE\n} finally {\n    $env:SFX_API_ARGV_B64 = $savedArgs\n    $env:SFX_API_CONFIG = $savedConfig\n}\nexit $result\n`;
  const dispatch = `if ($rest.Count -eq 0 -or $rest[0] -notin @('login','whoami','logout')) {\n    & ${ps(local)} @rest\n    exit $LASTEXITCODE\n}\n`;
  fs.writeFileSync(path.join(bin, 'sfx.ps1'), '\uFEFF' + common + dispatch + run);
  // The API retains the original machine profile for explicit --auth machine.
  fs.writeFileSync(path.join(bin, 'sfx-api.ps1'), '\uFEFF' + common + run.replace(ps(userConfig), ps(config)));
  for (const name of ['sfx', 'sfx-api']) fs.writeFileSync(path.join(bin, name + '.cmd'), `@echo off\r\nsetlocal\r\nset "SFX_CLI_START_TIME=%TIME%"\r\npowershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0${name}.ps1" %*\r\nexit /b %ERRORLEVEL%\r\n`);
} else {
  const sh = value => "'" + value.replaceAll("'", "'\\''") + "'";
  fs.writeFileSync(path.join(bin, 'sfx'), `#!/bin/sh\n# SFX_AUTH_WRAPPER\ncase "$1" in\n login|whoami|logout) [ -n "\${SFX_API_CONFIG:-}" ] || export SFX_API_CONFIG=${sh(userConfig)}; exec ${sh(process.execPath)} ${sh(entry)} "$@" ;;\n *) exec ${sh(local)} "$@" ;;\nesac\n`, { mode: 0o755 });
  fs.writeFileSync(path.join(bin, 'sfx-api'), `#!/bin/sh\n# SFX_AUTH_WRAPPER\n[ -n "\${SFX_API_CONFIG:-}" ] || export SFX_API_CONFIG=${sh(config)}\nexec ${sh(process.execPath)} ${sh(entry)} "$@"\n`, { mode: 0o755 });
}
fs.writeFileSync(previousPath, JSON.stringify({ version, destination, localLauncher: local, localLauncherDigest: `sha256:${localHash}`, bin, endpoint, installedAt: new Date().toISOString() }, null, 2) + '\n');
console.log(`Installed sfx login/whoami/logout and sfx-api in ${bin}; local commands delegate to ${local}.`);
