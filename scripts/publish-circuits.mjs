#!/usr/bin/env node
/**
 * Publish the scenario circuit component-shape mappings into the website visual publication.
 *
 * `generated/visual-publication.json` is generated content. Its entity artwork is restored from
 * the SQL media catalog, while the component-shape mappings — one declared topology bundle per
 * scenario face — live in the media base tables (`media.asset`, `media.asset_revision`,
 * `media.asset_semantic_source`, `media.subject`, `media.bundle_member`, `media.blob`). A
 * restored catalog that arrives without circuits leaves every capability page without its stored
 * circuit; this step re-derives them from those tables, preserves the scenario/input/event/
 * outcome/provider/port circuit projections untouched and merges the mappings into the
 * publication.
 *
 *   node scripts/publish-circuits.mjs [--verify-files]
 *
 * The reads are `scripts/sql/publish-circuit-media.sql`: direct base-table SELECTs, TOP-bounded
 * and executed as a ROLLBACK batch through the SDA kernel runner. File membership and media types
 * come from SQL; the artifact digests are measured over the delivered bytes the media restore
 * wrote under public/media, because delivery adaptations (such as iframe sizing) are themselves
 * the published revision. `--verify-files` rehashes every referenced delivery file.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GENERATED = join(ROOT, 'generated');
const VISUAL_FILE = join(GENERATED, 'visual-publication.json');
const ESTATE_FILE = join(GENERATED, 'estate-publication.json');
const MANIFEST_FILE = join(GENERATED, 'publication-manifest.json');
const SQL_FILE = join(ROOT, 'scripts', 'sql', 'publish-circuit-media.sql');

const verifyFiles = process.argv.includes('--verify-files');

function locateRunner() {
  const roots = [
    process.env.SIDEFX_SDA_ROOT,
    resolve(ROOT, '..', 'scenario-driven-architecture'),
    resolve(ROOT, '..', '..', 'scenario-driven-architecture'),
  ].filter((path) => typeof path === 'string' && path.length > 0);
  for (const root of roots) {
    const runner = join(root, 'languages', 'typescript', 'src', 'kernel', 'bootstrap', 'run-migration.mjs');
    if (existsSync(runner)) return runner;
  }
  console.error('Could not find the SDA kernel runner. Looked under:');
  for (const root of roots) console.error(`  ${root}`);
  console.error('Set SIDEFX_SDA_ROOT to the scenario-driven-architecture checkout.');
  process.exit(1);
}

function readResultSets(stdout) {
  const sets = new Map();
  let name = null;
  for (const raw of stdout.split(/\r?\n/)) {
    const header = /^RS (.+?) rows (\d+)$/.exec(raw);
    if (header) {
      name = header[1];
      continue;
    }
    const line = raw.trim();
    if (!name || !line.startsWith('{') || !line.endsWith('}')) continue;
    const rows = sets.get(name) ?? [];
    try {
      rows.push(JSON.parse(line));
    } catch {
      // A line that is not a complete row (the runner never splits a row) is ignored.
    }
    sets.set(name, rows);
  }
  return sets;
}

function jsonValue(sets, name) {
  const row = (sets.get(name) ?? [])[0];
  if (!row || typeof row.json_value !== 'string') throw new Error(`Result set ${name} is missing`);
  return JSON.parse(row.json_value);
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function digest(bytes) {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function urlOf(relativePath) {
  return `/media/library/${relativePath}`;
}

function readableFallback(scenarioId) {
  return scenarioId.split(/[-_]/).filter(Boolean).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function catalogLabels(documentText, scenarioId) {
  const prefix = 'window.ESTATE_TOPOLOGY_CATALOG=';
  if (!documentText.startsWith(prefix)) return null;
  const catalog = JSON.parse(documentText.slice(prefix.length).replace(/;\s*$/, ''));
  const view = (catalog.views ?? []).find((entry) => entry.scenarioId === scenarioId);
  if (!view || typeof view.label !== 'string') return null;
  const marker = view.label.indexOf(' · ');
  return { label: marker >= 0 ? view.label.slice(marker + 3) : view.label, views: catalog.views.length };
}

function main() {
  const runner = locateRunner();
  const result = spawnSync(process.execPath, [runner, SQL_FILE], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 512 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    console.error(result.stdout ?? '');
    console.error(result.stderr ?? '');
    throw new Error(`The circuit media query failed with status ${result.status}`);
  }
  const sets = readResultSets(result.stdout ?? '');

  const bundles = jsonValue(sets, 'circuit_bundles');
  const files = jsonValue(sets, 'circuit_files');
  const catalogs = jsonValue(sets, 'circuit_catalogs');

  const bundleByDefinition = new Map(bundles.map((row) => [String(row.definition_pk), row]));
  const filesByDefinition = new Map();
  for (const row of files) {
    const key = String(row.definition_pk);
    const list = filesByDefinition.get(key) ?? [];
    list.push(row);
    filesByDefinition.set(key, list);
  }
  const catalogByDefinition = new Map(catalogs.map((row) => [String(row.definition_pk), Buffer.from(row.document_hex, 'hex').toString('utf8')]));

  const publication = JSON.parse(readFileSync(VISUAL_FILE, 'utf8'));
  const estate = JSON.parse(readFileSync(ESTATE_FILE, 'utf8'));
  const artifacts = { ...publication.artifacts };
  const circuits = [];
  const gaps = [];
  const warnings = [];

  const entryPattern = /^outputs\/estate-topology\/([^/]+)\/scenario\/([^/]+)\/index\.html$/;

  const addArtifact = (row) => {
    const url = urlOf(row.relative_path);
    const file = join(ROOT, 'public', url);
    if (!existsSync(file)) throw new Error(`Referenced media file is missing: ${url}`);
    const bytes = readFileSync(file);
    const artifact = {
      sha256: createHash('sha256').update(bytes).digest('hex'),
      mediaType: row.media_type ?? 'application/octet-stream',
      bytes: bytes.length,
    };
    const existing = artifacts[url];
    if (existing) {
      if (existing.sha256 !== artifact.sha256 || existing.bytes !== artifact.bytes || existing.mediaType !== artifact.mediaType) {
        throw new Error(`Published media disagrees with the delivered bytes: ${url}`);
      }
      return url;
    }
    artifacts[url] = artifact;
    return url;
  };

  for (const capability of estate.capabilities) {
    for (const scenario of capability.scenarios) {
      const definition = String(scenario.semanticObjectDefinitionPk);
      const bundle = bundleByDefinition.get(definition);
      if (!bundle) continue;
      const bundleFiles = filesByDefinition.get(definition) ?? [];
      const exact = bundleFiles.find((row) => {
        const match = entryPattern.exec(row.relative_path);
        return match !== null && match[1] === capability.entityId && match[2] === scenario.scenarioId;
      });
      const entry = exact ?? bundleFiles.find((row) => {
        const match = entryPattern.exec(row.relative_path);
        return match !== null && match[2] === scenario.scenarioId;
      });
      if (!entry) {
        gaps.push(`${capability.entityId}/${scenario.scenarioId}: the bundle carries no scenario entry`);
        continue;
      }
      if (!exact) warnings.push(`${capability.entityId}/${scenario.scenarioId}: entry uses the bundle's capability directory`);
      const entryMatch = entryPattern.exec(entry.relative_path);
      const capabilityDirectory = entryMatch[1];
      const dataPath = entry.relative_path.replace(/index\.html$/, 'data.js');
      const data = bundleFiles.find((row) => row.relative_path === dataPath);
      if (!data) {
        gaps.push(`${capability.entityId}/${scenario.scenarioId}: the bundle carries no scenario data`);
        continue;
      }
      const views = bundleFiles.filter((row) =>
        row.relative_path.startsWith(`outputs/estate-topology/${capabilityDirectory}/n-`) && row.relative_path.endsWith('.js'));
      if (views.length === 0) {
        gaps.push(`${capability.entityId}/${scenario.scenarioId}: the bundle carries no topology views`);
        continue;
      }
      const ordered = [entry, data, ...bundleFiles.filter((row) => row !== entry && row !== data)
        .sort((a, b) => (a.relative_path < b.relative_path ? -1 : a.relative_path > b.relative_path ? 1 : 0))];
      const catalog = catalogByDefinition.has(definition) ? catalogLabels(catalogByDefinition.get(definition), scenario.scenarioId) : null;
      if (catalog && catalog.views !== views.length) {
        throw new Error(`${capability.entityId}/${scenario.scenarioId}: the catalog carries ${catalog.views} views but the bundle carries ${views.length}`);
      }
      const label = catalog?.label ?? null;
      if (!label) warnings.push(`${capability.entityId}/${scenario.scenarioId}: the bundle catalog declares no scenario label; the identity stands in`);
      circuits.push({
        capabilityId: capability.entityId,
        capabilityDefinitionPk: String(capability.semanticObjectDefinitionPk),
        scenarioId: scenario.scenarioId,
        definitionPk: definition,
        objectPk: String(scenario.semanticObjectPk),
        bundleRevision: bundle.bundle_revision,
        label: label ?? readableFallback(scenario.scenarioId),
        url: addArtifact(entry),
        artifacts: ordered.map(addArtifact),
        scope: 'DECLARED_SOURCE_TOPOLOGY',
        topologyViews: catalog?.views ?? views.length,
      });
    }
  }

  if (circuits.length === 0) throw new Error('No scenario circuit bundle resolved in the media tables');
  const withBundles = new Set(circuits.map((circuit) => circuit.capabilityId));
  const scenarioReady = publication.coverage.find((row) => row.kind === 'SCENARIO' && row.purpose === 'CIRCUIT' && row.state === 'READY');
  const capabilityReady = publication.coverage.find((row) => row.kind === 'CAPABILITY' && row.purpose === 'CIRCUIT' && row.state === 'READY');
  if (scenarioReady && scenarioReady.count !== circuits.length) {
    throw new Error(`The media tables carry ${circuits.length} scenario circuits but the coverage declares ${scenarioReady.count} ready`);
  }
  if (capabilityReady && capabilityReady.count !== withBundles.size) {
    throw new Error(`The media tables carry ${withBundles.size} capable circuits but the coverage declares ${capabilityReady.count} ready`);
  }

  publication.circuits = circuits;
  publication.artifacts = artifacts;
  const bytes = JSON.stringify(canonical(publication));
  const visualPath = `${VISUAL_FILE}.tmp`;
  writeFileSync(visualPath, bytes);
  renameSync(visualPath, VISUAL_FILE);

  const manifest = JSON.parse(readFileSync(MANIFEST_FILE, 'utf8'));
  manifest.artifacts['visual-publication.json'] = digest(Buffer.from(bytes));
  writeFileSync(MANIFEST_FILE, `${JSON.stringify(manifest, null, 2)}\n`);

  if (verifyFiles) {
    for (const url of Object.keys(artifacts)) {
      const file = join(ROOT, 'public', url);
      if (!existsSync(file)) throw new Error(`Referenced media file is missing: ${url}`);
      const fileBytes = readFileSync(file);
      const artifact = artifacts[url];
      if (fileBytes.length !== artifact.bytes || createHash('sha256').update(fileBytes).digest('hex') !== artifact.sha256) {
        throw new Error(`Referenced media file changed: ${url}`);
      }
    }
  }

  const refs = Object.keys(artifacts).length + circuits.reduce((n, circuit) => n + circuit.artifacts.length, 0);
  console.log(`Published ${circuits.length} scenario circuits over ${withBundles.size} capabilities (${Object.keys(artifacts).length} media artifacts, ${refs} references)`);
  console.log(`  manifest visual-publication.json ${manifest.artifacts['visual-publication.json']}`);
  for (const warning of warnings.slice(0, 10)) console.log(`  warning ${warning}`);
  for (const gap of gaps.slice(0, 10)) console.log(`  gap ${gap}`);
  if (verifyFiles) console.log(`  verified ${Object.keys(artifacts).length} delivery files under public/media`);
}

main();
