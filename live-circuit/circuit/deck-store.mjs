// Transport for exported deck data. No generator, SQL driver, or source checkout is loaded.
import { readFile, readdir, stat, mkdtemp, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';

const execute = promisify(execFile);
const root = path.resolve(process.env.CIRCUIT_DECK_ROOT ?? fileURLToPath(new URL('../../evidence/circuit-decks/', import.meta.url)));
const cache = new Map();
const json = async (file) => JSON.parse(await readFile(file, 'utf8'));
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

export async function listDecks() {
  let entries;
  try { entries = await readdir(root, { withFileTypes: true }); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  const decks = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !/^[a-zA-Z0-9._-]+$/.test(entry.name)) continue;
    const file = path.join(root, entry.name, 'receipt.json');
    try {
      const receipt = await json(file);
      if (!receipt.selection?.capabilityId || !receipt.snapshotDigest) continue;
      decks.push({ id: entry.name, ...receipt.selection, snapshotDigest: receipt.snapshotDigest,
        exportedAt: (await stat(file)).mtime.toISOString() });
    } catch { /* An incomplete export is not a selectable deck. */ }
  }
  return decks.sort((a, b) => b.exportedAt.localeCompare(a.exportedAt));
}

async function readMap(snapshot, blueprint) {
  const dir = await mkdtemp(path.join(tmpdir(), 'sfx-circuit-'));
  const input = path.join(dir, 'input.json');
  try {
    await writeFile(input, JSON.stringify({ contractId: 'deck-observation-map-request.v1', payload: {
      identity: snapshot.identity, scenarios: snapshot.scenarios, nodes: blueprint.nodes, snapshotDigest: snapshot.snapshotDigest,
    } }));
    // Fixed command and generated input path; no URL value is interpolated into a shell.
    const command = `sfx capability invoke read-deck-observation-map --input "@${input}" --json`;
    const { stdout } = await execute(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', command], {
      cwd: fileURLToPath(new URL('../../', import.meta.url)), windowsHide: true, windowsVerbatimArguments: true,
      timeout: 30000, maxBuffer: 8 * 1024 * 1024,
    });
    const result = JSON.parse(stdout);
    const reading = result.contractId === 'deck-observation-map.v1' ? result : result.result?.outcome;
    if (reading?.contractId !== 'deck-observation-map.v1' || reading.snapshotDigest !== snapshot.snapshotDigest)
      throw new Error(result.message ?? 'The declared reader returned no matching observation map.');
    return reading;
  } finally {
    if (path.dirname(path.resolve(dir)) !== path.resolve(tmpdir()) || !path.basename(dir).startsWith('sfx-circuit-'))
      throw new Error('Unexpected temporary directory');
    await rm(dir, { recursive: true, force: true });
  }
}

export async function loadDeck(id, refresh = false) {
  const selected = (await listDecks()).find((deck) => deck.id === id);
  if (!selected) throw new Error('DECK_NOT_FOUND');
  if (!refresh && cache.has(id)) return cache.get(id);
  const directory = path.join(root, id);
  const [snapshot, storyboard, blueprint, receipt] = await Promise.all([
    json(path.join(directory, 'snapshot.json')), json(path.join(directory, 'storyboard.json')),
    json(path.join(directory, 'circuit-blueprint.json')), json(path.join(directory, 'receipt.json')),
  ]);
  if (snapshot.snapshotDigest !== selected.snapshotDigest || blueprint.snapshotDigest !== selected.snapshotDigest ||
      snapshot.identity.capabilityId !== selected.capabilityId) throw new Error('DECK_IDENTITY_MISMATCH');
  const slides = [];
  for (const [index, slide] of storyboard.slides.entries()) {
    const ordinal = index + 1;
    const volume = receipt.volumes.find((item) => ordinal >= item.firstSlide && ordinal <= item.lastSlide);
    if (!volume) throw new Error('DECK_VOLUME_MISSING');
    const file = path.join(directory, `volume-${String(volume.volume).padStart(2, '0')}`, `slide-${String(ordinal).padStart(3, '0')}.svg`);
    const bytes = await readFile(file);
    slides.push({ id: slide.id, title: slide.title, blueprint: slide.blueprint, commands: slide.commands,
      interpretation: slide.interpretation, evidenceRefs: slide.evidenceRefs, svgDigest: digest(bytes),
      imageUrl: `/circuit/deck-slide?id=${encodeURIComponent(id)}&slide=${ordinal}` });
  }
  let observationMap = null, mapError = null;
  try { observationMap = await readMap(snapshot, blueprint); }
  catch (error) { mapError = (error.stderr || error.message).slice(0, 2000); }
  const result = { ...selected, slides, nodes: blueprint.nodes, edges: blueprint.edges,
    inspection: blueprint.review?.inspection, observationMap, mapError };
  cache.set(id, result);
  return result;
}

export async function readSlide(id, ordinal) {
  const selected = (await listDecks()).find((deck) => deck.id === id);
  if (!selected || !Number.isSafeInteger(ordinal) || ordinal < 1) throw new Error('SLIDE_NOT_FOUND');
  const receipt = await json(path.join(root, id, 'receipt.json'));
  const volume = receipt.volumes.find((item) => ordinal >= item.firstSlide && ordinal <= item.lastSlide);
  if (!volume) throw new Error('SLIDE_NOT_FOUND');
  return readFile(path.join(root, id, `volume-${String(volume.volume).padStart(2, '0')}`, `slide-${String(ordinal).padStart(3, '0')}.svg`));
}
