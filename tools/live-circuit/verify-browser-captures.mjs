import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { captureDeclaredHome } from './browser-captures.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const args = process.argv.slice(2);
const flags = new Set(args.filter(arg => arg.startsWith('--')));
const positional = args.filter(arg => !arg.startsWith('--'));
const origin = positional[0] ?? process.env.SFX_BROWSER_ORIGIN;
if (!origin) throw new Error('BROWSER_ORIGIN_REQUIRED');
const outFlag = args.indexOf('--out');
if (outFlag >= 0 && !args[outFlag + 1]) throw new Error('OUT_DIRECTORY_REQUIRED');
const outDir = path.resolve(outFlag >= 0 ? args[outFlag + 1] : (process.env.SFX_BROWSER_CAPTURES || path.join(root, 'artifacts/staging/browser-captures')));
const requireSignedIn = flags.has('--require-signed-in') || process.env.SFX_CAPTURE_REQUIRE_SIGNED_IN === '1';
assert(process.env.SFX_BROWSER_TEST_MODULE, 'SFX_BROWSER_TEST_MODULE_REQUIRED');
const { chromium } = await import(pathToFileURL(process.env.SFX_BROWSER_TEST_MODULE).href);
const browser = await chromium.launch({ executablePath: process.env.SFX_BROWSER_EXECUTABLE, headless: true });
let receipt = null;
try {
  receipt = await captureDeclaredHome({ browser, origin, outDir, requireSignedIn });
  process.stdout.write(JSON.stringify(receipt));
} catch (error) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'failed.json'), JSON.stringify({ at: new Date().toISOString(), error: error.name, message: error.message, checks: error.receipt?.checks ?? receipt?.checks ?? [] }, null, 2) + '\n');
  process.stderr.write(`BROWSER_CAPTURES_FAILED (${error.name})\n`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
