import publishedPolicy from '@/generated/circuit-presentation.json';

import { CircuitPresentationPolicy } from '@/contracts/circuit-presentation';

/**
 * Circuit presentation policy reader.
 *
 * The estate declares the policy through `read-circuit-presentation` (D3); the declared value is
 * published into `generated/circuit-presentation.json` by `scripts/publish-circuit-presentation.mjs`
 * and validated here. The page passes the policy to the circuit panel, and the run-graph view
 * builder resolves every drawn cell, boundary role and route against it. A policy that cannot be
 * read leaves the drawing visibly unresolved; no platform table stands in for a declaration.
 */

const parsed = CircuitPresentationPolicy.safeParse(publishedPolicy);

export const CIRCUIT_PRESENTATION: CircuitPresentationPolicy | null = parsed.success ? parsed.data : null;

/** The declared policy this publication carries, or `null` when it carries none. */
export function getCircuitPresentation(): CircuitPresentationPolicy | null {
  return CIRCUIT_PRESENTATION;
}
