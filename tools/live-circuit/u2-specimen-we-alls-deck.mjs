#!/usr/bin/env node
// u2-specimen-we-alls-deck.mjs — the U2 specimen-we-alls review deck.
//
// Consumes the browser-capture bundle produced by tools/live-circuit/browser-captures.mjs
// (artifacts/staging/browser-captures/capture.json plus its PNGs) and emits a
// self-contained HTML review deck and a JSON manifest. Every image is a real
// capture of the running host; every caption is read from the bundle record.
// A missing or hash-mismatched PNG, a bundle without specimen captures, or a
// silent (neither rendered nor named-refused) section fails the build instead
// of printing a substitute.
//
//   node tools/live-circuit/u2-specimen-we-alls-deck.mjs [--bundle <dir>] [--out <dir>]
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const args = process.argv.slice(2);
const flag = name => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] && !args[index + 1].startsWith('--') ? args[index + 1] : null;
};
const bundleDir = path.resolve(flag('bundle') ?? process.env.SFX_BROWSER_CAPTURES ?? path.join(repoRoot, 'artifacts', 'staging', 'browser-captures'));
const outDir = path.resolve(flag('out') ?? path.join(bundleDir, 'u2-specimen-we-alls-deck'));
const fail = message => { console.error(`u2-specimen-we-alls-deck: ${message}`); process.exit(1); };
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const relative = target => path.relative(repoRoot, target).split(path.sep).join('/');

const captureFile = path.join(bundleDir, 'capture.json');
if (!fs.existsSync(captureFile)) fail(`no capture bundle at ${captureFile}; run the browser capture first`);
const receipt = JSON.parse(fs.readFileSync(captureFile, 'utf8'));
if (receipt.contractId !== 'browser-captures.v1') fail(`capture bundle contractId=${receipt.contractId}, expected browser-captures.v1`);
const records = Array.isArray(receipt.specimens?.captures) ? receipt.specimens.captures : [];
if (!records.length) fail('the capture bundle has no specimen captures; capture the /circuit/specimen-* pages first');

const images = [];
for (const record of records) {
  if (typeof record.file !== 'string' || !record.file) fail(`specimen capture ${record.name} names no PNG`);
  const file = path.join(bundleDir, record.file);
  if (!fs.existsSync(file)) fail(`specimen capture ${record.name} has no PNG at ${file}`);
  const bytes = fs.readFileSync(file);
  const digest = sha256(bytes);
  if (digest !== record.sha256) fail(`specimen capture ${record.name} PNG sha256=${digest} does not match the recorded ${record.sha256}`);
  images.push({ name: record.name, file: record.file, sha256: digest, bytes });
}
if (images.some(image => !/^[a-f0-9]{64}$/.test(image.sha256))) fail('a specimen capture has no recorded sha256');

const postureText = posture => posture.refused ? 'refused by name' : posture.hasContent ? 'rendered' : 'silent';
const silent = records.flatMap(record => (record.posture ?? []).filter(posture => !posture.refused && !posture.hasContent));
if (silent.length) fail(`silent sections: ${silent.map(posture => posture.sectionId).join(', ')}`);

const externalMedia = [...new Set(records.flatMap(record => record.externalMedia ?? []))];
const groups = new Map();
for (const image of images) {
  const record = records.find(candidate => candidate.name === image.name);
  if (!groups.has(record.page)) groups.set(record.page, []);
  groups.get(record.page).push({ image, record });
}

const slide = (image, record) => `
<section class="slide">
  <header>
    <p class="kicker">U2 specimen-we-alls</p>
    <h2>${escapeHtml(record.page)} · ${escapeHtml(record.viewport?.name)}</h2>
    <p class="meta">revision ${escapeHtml(record.revision)} · digest ${escapeHtml(String(record.pageDigest ?? '').slice(0, 12))}… · ${escapeHtml(record.viewport?.width)}×${escapeHtml(record.viewport?.height)} · captured ${escapeHtml(receipt.capturedAt ?? '(not recorded)')}</p>
  </header>
  <div class="body">
    <figure><img src="data:image/png;base64,${image.bytes.toString('base64')}" alt="${escapeHtml(record.name)}"></figure>
    <aside>
      <h3>Sections</h3>
      <table>
        <thead><tr><th>section</th><th>kind</th><th>posture</th><th>refusals</th></tr></thead>
        <tbody>
          ${(record.posture ?? []).map(posture => `<tr><td>${escapeHtml(posture.sectionId)}</td><td>${escapeHtml(posture.kind)}</td><td>${escapeHtml(postureText(posture))}</td><td>${escapeHtml((posture.refusals ?? []).join(', ') || '—')}</td></tr>`).join('\n          ')}
        </tbody>
      </table>
      <h3>External media</h3>
      <p>${record.externalMedia?.length ? record.externalMedia.map(escapeHtml).join('<br>') : 'none on this page'}</p>
      <p class="hash">PNG sha256 ${escapeHtml(image.sha256)}</p>
    </aside>
  </div>
</section>`;

const pendingPages = (receipt.specimens?.pages ?? []).filter(page => page.pending);
const title = `
<section class="slide title">
  <h1>U2 specimen-we-alls</h1>
  <p>Agreement-wave component kinds captured from the running host: tabs, timeline, form, media.gallery, code, chart.</p>
  <p class="meta">origin ${escapeHtml(receipt.origin)} · home revision ${escapeHtml(receipt.revision)} · ${escapeHtml(records.length)} captures over ${escapeHtml(groups.size)} pages · bundle ${escapeHtml(relative(captureFile))}${pendingPages.length ? ` · ${pendingPages.length} pending (not served by the capture host)` : ''}</p>
  <p>Media is referenced by external https URLs; no serving route is involved.</p>
</section>`;

const deckHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>U2 specimen-we-alls</title>
<style>
  :root { color-scheme: light; }
  body { margin: 0; background: #0b1220; font-family: system-ui, sans-serif; color: #e8edf5; }
  .slide { width: 13.333in; height: 7.5in; box-sizing: border-box; padding: 0.45in; background: #101a2c; margin: 0 auto 0.25in; page-break-after: always; overflow: hidden; display: flex; flex-direction: column; }
  .title { justify-content: center; }
  .kicker { color: #22beff; text-transform: uppercase; letter-spacing: 0.12em; font-size: 10pt; margin: 0; }
  h1 { font-size: 34pt; margin: 0.1in 0; }
  h2 { font-size: 20pt; margin: 0.05in 0; }
  h3 { font-size: 11pt; color: #22beff; margin: 0.1in 0 0.04in; }
  .meta { color: #9fb0c8; font-size: 9pt; margin: 0.02in 0; }
  .body { display: flex; gap: 0.2in; flex: 1; min-height: 0; }
  figure { flex: 1.35; margin: 0; display: flex; align-items: center; }
  img { max-width: 100%; max-height: 5.9in; object-fit: contain; border: 1px solid #2a3a55; }
  aside { flex: 1; overflow: hidden; font-size: 8.5pt; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 0.03in 0.05in; border-bottom: 1px solid #223149; vertical-align: top; }
  th { color: #9fb0c8; font-weight: 600; }
  .hash { color: #9fb0c8; word-break: break-all; font-size: 7.5pt; }
  @media print { body { background: #fff; } .slide { margin: 0; background: #fff; color: #101a2c; } }
</style>
</head>
<body>
${title}
${[...groups.values()].flat().map(({ image, record }) => slide(image, record)).join('\n')}
</body>
</html>
`;

fs.mkdirSync(outDir, { recursive: true });
const deckFile = path.join(outDir, 'u2-specimen-we-alls-deck.html');
fs.writeFileSync(deckFile, deckHtml, 'utf8');
const manifest = {
  contractId: 'u2-specimen-we-alls-deck.v1',
  builtAt: new Date().toISOString(),
  source: {
    bundle: relative(captureFile),
    origin: receipt.origin ?? null,
    capturedAt: receipt.capturedAt ?? null,
    homeRevision: receipt.revision ?? null,
    homeDigest: receipt.pageDigest ?? null
  },
  specimenPages: (receipt.specimens?.pages ?? []).map(page => ({
    path: page.path,
    kind: page.kind ?? null,
    pending: Boolean(page.pending),
    status: page.status ?? null,
    revision: page.revision ?? null,
    pageDigest: page.pageDigest ?? null,
    captures: page.captures ?? []
  })),
  slides: images.map(image => {
    const record = records.find(candidate => candidate.name === image.name);
    return {
      name: record.name,
      page: record.page ?? null,
      kind: record.kind ?? null,
      viewport: record.viewport ?? null,
      revision: record.revision ?? null,
      pageDigest: record.pageDigest ?? null,
      png: { file: image.file, sha256: image.sha256 },
      sections: record.sections ?? [],
      posture: record.posture ?? [],
      externalMedia: record.externalMedia ?? []
    };
  }),
  checks: {
    capturesVerified: images.length,
    pages: groups.size,
    refusedPostures: records.flatMap(record => (record.posture ?? []).filter(posture => posture.refused)).length,
    renderedPostures: records.flatMap(record => (record.posture ?? []).filter(posture => !posture.refused && posture.hasContent)).length,
    silentPostures: silent.length,
    externalMediaRefs: externalMedia.length,
    pendingPages: pendingPages.length
  },
  deck: { file: path.basename(deckFile), sha256: sha256(Buffer.from(deckHtml, 'utf8')) }
};
const manifestFile = path.join(outDir, 'u2-specimen-we-alls-deck.json');
fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({
  tool: 'u2-specimen-we-alls-deck.mjs',
  deck: relative(deckFile),
  manifest: relative(manifestFile),
  deckSha256: manifest.deck.sha256,
  ...manifest.checks
}, null, 2));
