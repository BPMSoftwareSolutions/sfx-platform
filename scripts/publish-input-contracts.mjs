#!/usr/bin/env node
/**
 * Publish the declared input contract of every capability's root scenario.
 *
 *   node scripts/publish-input-contracts.mjs [--allow-missing]
 *
 * The estate declares each scenario's input contract, and the contract's JSON Schema is retained
 * source content addressed by digest. This reads one pinned generation through the database
 * repository's restricted reader and writes `generated/input-contracts.json`, so the website can
 * build an input form from the capability's own declared shape without opening a database
 * connection at request time (§11.1).
 *
 * A capability whose root scenario declares no input contract, or whose schema is not retained,
 * is published with a null schema. The site then offers raw input only — it never invents a shape.
 */
import { createHash } from 'node:crypto';
import { existsSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const allowMissing = process.argv.includes('--allow-missing');

const CANDIDATES = [
  process.env.SIDEFX_DATABASE_ROOT,
  join(ROOT, '.sidefx-database'),
  resolve(ROOT, '..', '..', 'sidefx-database'),
  resolve(ROOT, '..', 'sidefx-database'),
].filter(path => typeof path === 'string' && path.length > 0);

const databaseRoot = CANDIDATES.find(path => path && existsSync(join(path, 'src', 'query', 'run.mjs')));
if (!databaseRoot) {
  const message = 'Could not find the sidefx-database checkout; set SIDEFX_DATABASE_ROOT.';
  if (!allowMissing) { console.error(message); process.exit(1); }
  console.warn(`Skipping input contract publication: ${message}`);
  process.exit(0);
}

const digest = bytes => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const canonical = value => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, item]) => [key, canonical(item)]));
  }
  return value;
};
const stableDigest = value => digest(JSON.stringify(canonical(value)));

// The database repository owns the credential reference and the only SQL client.
const { config: readDatabaseConfig } = await import(pathToFileURL(join(databaseRoot, 'src/core.mjs')));
const { connectionString } = await import(pathToFileURL(join(databaseRoot, 'src/ingest/database.mjs')));
const { connectionEnvironmentVariable } = await readDatabaseConfig();
process.env[connectionEnvironmentVariable] = connectionString(connectionEnvironmentVariable);
const { query } = await import(pathToFileURL(join(databaseRoot, 'src/query/run.mjs')));

/**
 * One read: every capability's root-scenario input contract, joined to the retained schema bytes
 * through the digest the contract definition declares. Schemas are shared, so they are pooled.
 */
const statement = `
SELECT c.capability_id, s.scenario_id, ct.contract_id,
       LOWER(CONVERT(varchar(64), co.content_digest, 2)) AS schema_digest,
       CONVERT(nvarchar(max), CONVERT(varchar(max), co.content_bytes) COLLATE Latin1_General_100_BIN2_UTF8) AS schema_text
FROM sidefx.v_capability c
JOIN model.capability_root_scenario rs ON rs.capability_version_pk = c.capability_version_pk
JOIN model.capability_scenario cs ON cs.capability_version_pk = rs.capability_version_pk AND cs.scenario_pk = rs.scenario_pk
JOIN model.scenario s ON s.scenario_pk = cs.scenario_pk
LEFT JOIN model.scenario_input si ON si.scenario_version_pk = cs.scenario_version_pk
LEFT JOIN model.contract_version cv ON cv.contract_version_pk = si.input_contract_version_pk
LEFT JOIN model.contract ct ON ct.contract_pk = cv.contract_pk
LEFT JOIN analysis.v_selected_semantic_definition d ON d.semantic_object_definition_pk = cv.semantic_object_definition_pk
LEFT JOIN source.content_object co
  ON LOWER(CONVERT(varchar(64), co.content_digest, 2)) = JSON_VALUE(d.definition_json, '$.semantics.schema_digest')
ORDER BY c.capability_id`;

const result = await query(statement, { rowLimit: 100000, retainObjects: false });
if (result.truncated) throw new Error('INPUT_CONTRACT_READ_TRUNCATED');
if (result.disposition !== 'READ_QUERY_COMPLETE') throw new Error(`INPUT_CONTRACT_READ_${result.disposition}`);

const schemas = {};
const capabilities = {};
let withSchema = 0;

for (const row of result.recordsets[0]) {
  let schemaRef = null;
  if (row.schema_text) {
    try {
      const schema = JSON.parse(row.schema_text);
      const key = `sha256:${row.schema_digest}`;
      schemas[key] ??= schema;
      schemaRef = key;
      withSchema += 1;
    } catch {
      // Retained content that is not JSON is published as absent, never as a guessed shape.
      schemaRef = null;
    }
  }
  capabilities[row.capability_id] = {
    scenarioId: row.scenario_id,
    contractId: row.contract_id ?? null,
    schemaRef,
  };
}

const content = {
  publicationType: 'sidefx-input-contract-publication.v1',
  publicationId: '',
  builtAt: '',
  source: {
    snapshotId: result.snapshotId,
    projectionDigest: result.projectionDigest,
    viewDefinitionDigest: result.viewDefinitionDigest,
    queryDigest: result.queryDigest,
    disposition: result.disposition,
  },
  capabilities,
  schemas,
};
content.publicationId = stableDigest({ ...content, publicationId: '', builtAt: '' });
content.builtAt = new Date().toISOString();

const target = join(ROOT, 'generated', 'input-contracts.json');
writeFileSync(`${target}.tmp`, `${JSON.stringify(content, null, 2)}\n`);
renameSync(`${target}.tmp`, target);

console.log(JSON.stringify({
  publicationId: content.publicationId,
  capabilities: Object.keys(capabilities).length,
  withDeclaredSchema: withSchema,
  distinctSchemas: Object.keys(schemas).length,
  snapshotId: content.source.snapshotId,
}, null, 2));
