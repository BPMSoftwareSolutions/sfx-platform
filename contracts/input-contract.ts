/**
 * Input contract publication — §11.3.
 *
 * The declared input contract of each capability's root scenario, with the retained JSON Schema
 * it references. Published by scripts/publish-input-contracts.mjs from one pinned generation, so
 * the site can build an input form from the capability's own declared shape without opening a
 * database connection (§11.1).
 *
 * A capability with no declared contract, or whose schema is not retained, carries a null
 * reference. The site then offers raw input only; it never invents a shape.
 */
import { z } from 'zod';

import { Digest } from './estate';

/** A JSON Schema as retained. Kept opaque: the site renders it, it does not re-author it. */
export const JsonSchema = z.record(z.string(), z.unknown());
export type JsonSchema = z.infer<typeof JsonSchema>;

export const CapabilityInputContract = z.object({
  scenarioId: z.string(),
  /** Declared contract identity, or null when this generation declared none. */
  contractId: z.string().nullable(),
  /** Key into `schemas`, or null when no schema was retained for it. */
  schemaRef: Digest.nullable(),
});
export type CapabilityInputContract = z.infer<typeof CapabilityInputContract>;

export const InputContractPublication = z.object({
  publicationType: z.literal('sidefx-input-contract-publication.v1'),
  publicationId: Digest,
  builtAt: z.string(),
  source: z.object({
    snapshotId: z.string(),
    projectionDigest: z.string(),
    viewDefinitionDigest: z.string(),
    queryDigest: z.string(),
    disposition: z.literal('READ_QUERY_COMPLETE'),
  }),
  capabilities: z.record(z.string(), CapabilityInputContract),
  /** Schemas are shared between capabilities, so they are pooled by content digest. */
  schemas: z.record(z.string(), JsonSchema),
});
export type InputContractPublication = z.infer<typeof InputContractPublication>;

/** What a capability page needs to render its input surface. */
export interface ResolvedInputContract {
  contractId: string | null;
  schema: JsonSchema | null;
}
