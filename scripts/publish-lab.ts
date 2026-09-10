import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { compilePublication, digest } from '../lib/lab/compiler';
import type { LabPilot, LabProfile, JsonObject } from '../contracts/lab';

async function main() {
const embody = path.resolve(process.argv[2] ?? '../sfx-embody');
const read = async (file: string) => JSON.parse(await fs.readFile(file, 'utf8'));
const profiles = (await read(path.join(embody, 'docs/research/hugging-face-platform/pilot-interaction-profiles.json'))).profiles as LabProfile[];
profiles.push(await read(path.join(embody, 'docs/research/hugging-face-platform/live-finance-interaction-profile.json')));
const runtimeFile = path.join(embody, 'config/database-runtime.json');
const runtime = await read(runtimeFile);
for (const key of ['databaseRoot', 'sdaRoot']) runtime[key] = path.resolve(path.dirname(runtimeFile), runtime[key]);
const { config: databaseConfig } = await import(pathToFileURL(path.join(runtime.databaseRoot, 'src/core.mjs')).href);
const { connectionString } = await import(pathToFileURL(path.join(runtime.databaseRoot, 'src/ingest/database.mjs')).href);
const { connectionEnvironmentVariable } = await databaseConfig();
process.env[connectionEnvironmentVariable] = connectionString(connectionEnvironmentVariable);
const { readAuthority } = await import(pathToFileURL(path.join(embody, 'src/read-authority.mjs')).href);
const { planNode } = await import(pathToFileURL(path.join(embody, 'src/materialize-node.mjs')).href);
type Source = { source_path: string; content_digest: string; content_bytes: { base64: string } };
const pilots: LabPilot[] = [];
for (const profile of profiles) {
  const bundle = await readAuthority(runtime.databaseRoot, { capabilityId: profile.subject, namespaceId: profile.namespace, target: 'node' }, { retainObjects: false });
  const plan = await planNode({ bundle, sdaRoot: runtime.sdaRoot });
  const entry = plan.receipts.find((r: { plan: { scenarioId: string } }) => r.plan.scenarioId === plan.selectedScenarioId);
  assert(entry, 'SELECTED_PLAN_REQUIRED');
  const sources = bundle.authority.recordsets[1] as Source[];
  const resource = (sourcePath: string) => {
    const matches = sources.filter(r => r.source_path === sourcePath);
    assert(matches.length && new Set(matches.map(r => r.content_digest)).size === 1, 'SOURCE_UNRESOLVED:' + sourcePath);
    const record = matches[0]!;
    const text = Buffer.from(record.content_bytes.base64, 'base64').toString('utf8');
    assert.equal(digest(text), record.content_digest, 'SOURCE_BYTES_CHANGED');
    return { sourcePath, digest: record.content_digest, text };
  };
  const prefix = 'capabilities/' + profile.subject;
  const interfaces = JSON.parse(resource(prefix + '/interfaces.authority.json').text);
  if (profile.providerInputBindingDigest) {
    const bindings = (interfaces.invocationInputBindings ?? []).map((ref: string) => resource(path.posix.join(prefix, ref)));
    assert.equal(bindings.filter((r: { digest: string }) => r.digest === profile.providerInputBindingDigest).length, 1, 'PROVIDER_INPUT_BINDING_NOT_SELECTED');
  }
  const catalogPath = path.posix.normalize(path.posix.join(prefix, interfaces.contractCatalog));
  const catalog = JSON.parse(resource(catalogPath).text) as Record<string, string>;
  const resources = [...new Set(Object.values(catalog).map(ref => path.posix.normalize(path.posix.join(path.posix.dirname(catalogPath), ref))))].map(resource);
  const schema = (pin: string): JsonObject => {
    const record = resources.find(r => r.digest === pin); assert(record, 'PINNED_SCHEMA_NOT_IN_CATALOG'); return JSON.parse(record.text);
  };
  const examples: LabPilot['examples'] = [];
  if (profile.exampleSource) {
    const source = resource(profile.exampleSource.sourcePath);
    assert.equal(source.digest, profile.exampleSource.digest, 'FIXTURE_AUTHORITY_CHANGED');
    const fixtures = JSON.parse(source.text).fixtures as { fixtureId: string; input: unknown }[];
    for (const id of profile.exampleSource.allowedFixtureIds) {
      const selected = fixtures.filter(f => f.fixtureId === id); assert.equal(selected.length, 1, 'FIXTURE_UNRESOLVED');
      assert(profile.exampleLabels?.[id], 'EXAMPLE_LABEL_REQUIRED');
      examples.push({ id, label: profile.exampleLabels[id], input: selected[0]!.input });
    }
  }
  pilots.push({ profile, resources, inputSchema: schema(profile.inputSchemaDigest), outcomeSchema: schema(profile.outcome.schemaDigest), examples,
    authority: { snapshotId: bundle.authority.snapshotId, projectionDigest: bundle.authority.projectionDigest, scenarioId: plan.selectedScenarioId,
      identity: Object.fromEntries(['scenarioDefinitionDigest', 'pinnedPlatformCommit', 'platformDigest', 'resolverVersion', 'artifactDigest'].map(key => [key, entry.receipt[key]])) } });
  console.log(JSON.stringify({ selected: profile.subject, snapshotId: bundle.authority.snapshotId }));
}
assert.equal(new Set(pilots.map(p => p.authority.snapshotId)).size, 1, 'PUBLICATION_SNAPSHOT_CHANGED');
assert.equal(new Set(pilots.map(p => p.authority.projectionDigest)).size, 1, 'PUBLICATION_PROJECTION_CHANGED');
const publication = compilePublication(pilots);
await fs.mkdir('generated', { recursive: true });
await fs.writeFile('generated/lab-publication.json', JSON.stringify(publication, null, 2) + '\n');
console.log(JSON.stringify({ publicationId: publication.publicationId, pilots: pilots.length, examples: pilots.reduce((n, p) => n + p.examples.length, 0) }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
