import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

import { CircuitProjection, Digest, EstatePublication } from '../contracts/estate.ts';

export const PublicationManifest = z.object({
  version: z.literal(1),
  publicationId: Digest,
  artifacts: z.object({
    'estate-publication.json': Digest,
    'circuit-projections.json': Digest,
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
  require(circuits.length === faces.size, 'Circuit coverage mismatch');
  const seen = new Set<string>();
  for (const circuit of circuits) {
    const key = JSON.stringify([circuit.capabilityId, circuit.scenarioId]);
    require(faces.has(key) && !seen.has(key), 'Circuit owner/scenario mismatch or duplicate');
    seen.add(key);
    require(circuit.graphDigest === stableDigest({ nodes: circuit.nodes, edges: circuit.edges }),
      'Circuit graph digest mismatch');
    const nodes = new Set(circuit.nodes.map(n => n.id));
    require(nodes.size === circuit.nodes.length && circuit.nodes.length > 0, 'Invalid circuit nodes');
    require(circuit.edges.every(e => nodes.has(e.from) && nodes.has(e.to)), 'Unresolved circuit edge');
  }
  return { publication, circuits };
}

export function readValidatedPublication(directory = join(process.cwd(), 'generated')) {
  const manifest = PublicationManifest.parse(JSON.parse(readFileSync(join(directory, 'publication-manifest.json'), 'utf8')));
  const publicationBytes = readFileSync(join(directory, 'estate-publication.json'));
  const circuitBytes = readFileSync(join(directory, 'circuit-projections.json'));
  if (digest(publicationBytes) !== manifest.artifacts['estate-publication.json'] ||
      digest(circuitBytes) !== manifest.artifacts['circuit-projections.json']) {
    throw new Error('Selected publication artifact digest mismatch');
  }
  const validated = validatePublication(publicationBytes, circuitBytes);
  if (validated.publication.publicationId !== manifest.publicationId) {
    throw new Error('Selected publication identity mismatch');
  }
  return { ...validated, manifest };
}
