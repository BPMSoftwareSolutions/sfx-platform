import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

import { CircuitProjection, Digest, EstatePublication } from '../contracts/estate.ts';
import { VisualPublication } from '../contracts/visuals.ts';
import { InputContractPublication } from '../contracts/input-contract.ts';

export const PublicationManifest = z.object({
  version: z.literal(2),
  publicationId: Digest,
  artifacts: z.object({
    'estate-publication.json': Digest,
    'circuit-projections.json': Digest,
    'visual-publication.json': Digest,
    'input-contracts.json': Digest,
  }).strict(),
}).strict();

export function digest(bytes: string | Buffer): string {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

export function stableDigest(value: unknown): string {
  const canonical = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(canonical);
    if (v && typeof v === 'object') {
      return Object.fromEntries(Object.entries(v).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
        .map(([key, item]) => [key, canonical(item)]));
    }
    return v;
  };
  return digest(JSON.stringify(canonical(value)));
}

/** Validate the actual paired bytes before they can enter a release or serve a page. */
export function validatePublication(publicationBytes: Buffer, circuitBytes: Buffer) {
  const raw: unknown = JSON.parse(publicationBytes.toString('utf8'));
  const publication = EstatePublication.parse(raw);
  const circuits = CircuitProjection.array().parse(JSON.parse(circuitBytes.toString('utf8')));
  const require = (condition: unknown, message: string) => {
    if (!condition) throw new Error(message);
  };
  require(publication.publicationId === stableDigest({ ...(raw as object), publicationId: '', builtAt: '' }),
    'Publication content digest mismatch');
  require(!publication.source.truncated && publication.source.disposition === 'READ_QUERY_COMPLETE',
    'Publication source is incomplete');
  require(Number.isFinite(Date.parse(publication.source.observedAt)) &&
    Number.isFinite(Date.parse(publication.builtAt)) &&
    Date.parse(publication.source.observedAt) <= Date.parse(publication.builtAt), 'Invalid publication dates');
  require(publication.capabilities.length > 0, 'A release requires a nonempty capability estate');
  const faces = new Map(publication.capabilities.flatMap(c => c.scenarios.map(s =>
    [JSON.stringify([c.entityId, s.scenarioId]), s] as const)));
  require(publication.coverage.publishedCapabilities === publication.capabilities.length &&
    publication.coverage.mechanics === publication.mechanics.length &&
    publication.coverage.providers === publication.providers.length &&
    publication.coverage.scenarioFaces === faces.size, 'Publication coverage mismatch');
  const emptyCapabilities = new Set(publication.capabilities.filter(c=>!c.scenarios.length).map(c=>c.entityId));
  require(circuits.length === faces.size + emptyCapabilities.size, 'Circuit coverage mismatch');
  const seen = new Set<string>();
  for (const circuit of circuits) {
    const key = JSON.stringify([circuit.capabilityId, circuit.scenarioId]);
    const overview=circuit.scenarioId===null && emptyCapabilities.has(circuit.capabilityId) && circuit.lens==='CAPABILITY_OVERVIEW' && circuit.fidelity==='PARTIAL_BOUNDARY';
    require((faces.has(key)||overview) && !seen.has(key), 'Circuit owner/scenario mismatch or duplicate');
    seen.add(key);
    require(circuit.graphDigest === stableDigest({ nodes: circuit.nodes, edges: circuit.edges }),
      'Circuit graph digest mismatch');
    const nodes = new Set(circuit.nodes.map(n => n.id));
    require(nodes.size === circuit.nodes.length && circuit.nodes.length > 0, 'Invalid circuit nodes');
    require(circuit.edges.every(e => nodes.has(e.from) && nodes.has(e.to)), 'Unresolved circuit edge');
  }
  return { publication, circuits };
}

export function validateInputContracts(bytes: Buffer, estate: EstatePublication) {
  const raw = JSON.parse(bytes.toString('utf8'));
  const contracts = InputContractPublication.parse(raw);
  if (contracts.publicationId !== stableDigest({ ...raw, publicationId: '', builtAt: '' })) {
    throw new Error('Input contract publication content digest mismatch');
  }
  if (contracts.source.snapshotId !== estate.source.snapshotId ||
      contracts.source.projectionDigest !== estate.source.projectionDigest) {
    throw new Error('Input contract source generation differs from selected estate');
  }
  for (const [key, schema] of Object.entries(contracts.schemas)) {
    if (key !== stableDigest(schema)) throw new Error('Input contract schema digest mismatch');
  }
  const owners = new Map(estate.capabilities.map(capability => [capability.entityId, capability]));
  for (const [id, entry] of Object.entries(contracts.capabilities)) {
    if (!owners.get(id)?.scenarios.some(scenario => scenario.scenarioId === entry.scenarioId)) {
      throw new Error('Input contract owner/scenario mismatch');
    }
    if (entry.schemaRef && (!contracts.schemas[entry.schemaRef] || !entry.sourceSchemaDigest || !entry.contractId) ||
        !entry.schemaRef && entry.sourceSchemaDigest) {
      throw new Error('Input contract schema reference is unresolved');
    }
  }
  return contracts;
}

export function readValidatedPublication(directory = join(process.cwd(), 'generated')) {
  const manifest = PublicationManifest.parse(JSON.parse(readFileSync(join(directory, 'publication-manifest.json'), 'utf8')));
  const publicationBytes = readFileSync(join(directory, 'estate-publication.json'));
  const circuitBytes = readFileSync(join(directory, 'circuit-projections.json'));
  const visualBytes = readFileSync(join(directory, 'visual-publication.json'));
  const inputBytes = readFileSync(join(directory, 'input-contracts.json'));
  if (digest(publicationBytes) !== manifest.artifacts['estate-publication.json'] ||
      digest(circuitBytes) !== manifest.artifacts['circuit-projections.json'] ||
      digest(visualBytes) !== manifest.artifacts['visual-publication.json'] ||
      digest(inputBytes) !== manifest.artifacts['input-contracts.json']) {
    throw new Error('Selected publication artifact digest mismatch');
  }
  const validated = validatePublication(publicationBytes, circuitBytes);
  const inputContracts = validateInputContracts(inputBytes, validated.publication);
  const visuals=VisualPublication.parse(JSON.parse(visualBytes.toString('utf8')));
  if (`sha256:${visuals.source.snapshotDigest}`!==validated.publication.source.snapshotId || `sha256:${visuals.source.mappingDigest}`!==validated.publication.source.projectionDigest) throw new Error('Media source generation differs from selected estate');
  for(const entity of [...validated.publication.capabilities,...validated.publication.mechanics,...validated.publication.providers,...validated.publication.capabilities.flatMap(c=>c.scenarios)]){
    for(const v of entity.visuals.filter(v=>v.state==='READY')){
      if(!visuals.visuals.some(m=>m.revision===v.assetRevisionId&&m.objectPk===entity.semanticObjectPk&&m.definitionPk===entity.semanticObjectDefinitionPk&&m.kind===v.subjectKind&&m.purpose===v.purpose&&m.url===v.publishedUrl&&`sha256:${m.originalDigest}`===v.originalDigest&&m.mediaType===v.mediaType&&m.width===v.width&&m.height===v.height&&m.altText===v.altText&&m.model===v.generatorModel)) throw new Error('Entity image binding differs from SQL media selection');
    }
  }
  for(const circuit of visuals.circuits){
    const owner=validated.publication.capabilities.find(c=>c.semanticObjectDefinitionPk===circuit.capabilityDefinitionPk&&c.entityId===circuit.capabilityId);
    if(!owner?.scenarios.some(s=>s.semanticObjectDefinitionPk===circuit.definitionPk&&s.semanticObjectPk===circuit.objectPk&&s.scenarioId===circuit.scenarioId))throw new Error('Stored circuit owner/definition mismatch');
  }
  for(const edition of visuals.editions){
    const owner=validated.publication.capabilities.find(c=>c.semanticObjectDefinitionPk===edition.definitionPk);
    if(!owner||edition.image&&!owner.visuals.some(v=>v.purpose==='DETAIL'&&v.state==='READY'&&v.publishedUrl===edition.image))throw new Error('Visual edition owner/selection mismatch');
  }
  if (validated.publication.publicationId !== manifest.publicationId) {
    throw new Error('Selected publication identity mismatch');
  }
  return { ...validated, manifest, inputContracts };
}
