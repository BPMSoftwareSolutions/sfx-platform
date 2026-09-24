import { z } from 'zod';

import { MaterialToken } from './estate';

/**
 * The declared circuit presentation policy — `circuit-presentation.v1`.
 *
 * The policy is estate authority, read through the declared `read-circuit-presentation` capability
 * and published into `generated/circuit-presentation.json`. The platform renders it; it decides no
 * meaning here. The schema is deliberately open (`additionalProperties: true` upstream): a further
 * policy extension does not break this reader.
 *
 * The three material maps are exact-key. No map falls back to another and nothing is matched by
 * substring or prefix; a miss renders `UNRESOLVED` on the platform.
 */
export const CircuitPresentationPolicy = z
  .object({
    policyType: z.literal('circuit-presentation.v1'),
    /** What one drawn node is. `operation` collapses expression, binding and selection cells. */
    granularity: z
      .object({
        detailCellLimit: z.number().int().positive().optional(),
        node: z.string().min(1).optional(),
      })
      .loose()
      .optional(),
    materials: z
      .object({
        /** The scenario cell drawn as its three boundary roles. */
        boundary: z
          .object({
            input: MaterialToken,
            event: MaterialToken,
            outcome: MaterialToken,
          })
          .loose(),
        /** Exact `execution.authorityId` -> material token, for every non-scenario authority. */
        byAuthority: z.record(z.string(), MaterialToken),
        /** Exact edge kind -> material token. */
        byEdgeKind: z.record(z.string(), MaterialToken),
      })
      .loose()
      .optional(),
  })
  .loose();
export type CircuitPresentationPolicy = z.infer<typeof CircuitPresentationPolicy>;

/** The boundary roles a scenario cell is drawn as, in OA5 order. */
export type BoundaryRole = 'input' | 'event' | 'outcome';
