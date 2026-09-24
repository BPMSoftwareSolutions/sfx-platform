import type { CircuitEdge, CircuitNode, MaterialToken } from '@/contracts/estate';
import type { BoundaryRole, CircuitPresentationPolicy } from '@/contracts/circuit-presentation';

/**
 * Explicit mapping from SCL semantic types to shell palette tokens — §6.2.
 *
 * The website palette cannot silently recolor a semantic type: every mapping is stated here,
 * and every node also carries a word and a shape so status never depends on color (§6.6).
 */

export interface PrimitiveStyle {
  /** Word shown on the node. Status is legible without color. */
  label: string;
  /** Deterministic shape cue, distinct per primitive. */
  shape: 'terminal-in' | 'event' | 'process' | 'terminal-out' | 'slot' | 'unresolved';
  stroke: string;
  fill: string;
  text: string;
}

export const PRIMITIVE_STYLES: Record<CircuitNode['primitive'], PrimitiveStyle> = {
  INPUT: {
    label: 'Input',
    shape: 'terminal-in',
    stroke: 'var(--color-authority)',
    fill: 'color-mix(in srgb, var(--color-authority) 12%, var(--color-ink-2))',
    text: 'var(--color-text)',
  },
  EVENT: {
    label: 'Event',
    shape: 'event',
    stroke: 'var(--color-signal)',
    fill: 'color-mix(in srgb, var(--color-signal) 10%, var(--color-ink-2))',
    text: 'var(--color-text)',
  },
  RESPONSIBILITY: {
    label: 'Responsibility',
    shape: 'process',
    stroke: 'var(--color-text)',
    fill: 'var(--color-ink-2)',
    text: 'var(--color-text)',
  },
  OUTCOME: {
    label: 'Outcome',
    shape: 'terminal-out',
    stroke: '#72e1ad',
    fill: 'color-mix(in srgb, #72e1ad 12%, var(--color-ink-2))',
    text: 'var(--color-text)',
  },
  PROVIDER_SLOT: {
    label: 'Provider slot',
    shape: 'slot',
    stroke: '#82a8f9',
    fill: 'color-mix(in srgb, var(--color-telemetry) 10%, var(--color-ink-2))',
    text: 'var(--color-text)',
  },
  UNRESOLVED: {
    label: 'Unresolved',
    shape: 'unresolved',
    stroke: 'var(--color-failure)',
    fill: 'var(--color-ink-2)',
    text: 'var(--color-muted)',
  },
  SCENARIO: {
    label: 'Scenario',
    shape: 'terminal-in',
    stroke: 'var(--color-signal)',
    fill: 'color-mix(in srgb, var(--color-signal) 12%, var(--color-ink-2))',
    text: 'var(--color-text)',
  },
  MECHANIC: {
    label: 'Mechanic',
    shape: 'process',
    stroke: 'var(--color-authority)',
    fill: 'color-mix(in srgb, var(--color-authority) 8%, var(--color-ink-2))',
    text: 'var(--color-text)',
  },
  PROVIDER: {
    label: 'Provider',
    shape: 'slot',
    stroke: 'var(--color-telemetry)',
    fill: 'color-mix(in srgb, var(--color-telemetry) 10%, var(--color-ink-2))',
    text: 'var(--color-text)',
  },
  PHYSICAL: {
    label: 'Physical',
    shape: 'process',
    stroke: 'var(--color-projection)',
    fill: 'color-mix(in srgb, var(--color-projection) 10%, var(--color-ink-2))',
    text: 'var(--color-text)',
  },
};

/** §12.3 — route families keep their type; a support link is not execution flow. */
export const EDGE_STYLES: Record<CircuitEdge['family'], { label: string; stroke: string; dash?: string }> = {
  EXECUTION: { label: 'Execution', stroke: 'var(--color-signal)' },
  PRODUCT_TRANSFER: { label: 'Product transfer', stroke: 'var(--color-authority)', dash: '1 0' },
  SUPPORT: { label: 'Support', stroke: 'var(--color-muted)', dash: '4 4' },
};

export type MaterialShape =
  | 'rounded-rectangle'
  | 'beveled-rectangle'
  | 'capsule'
  | 'socket'
  | 'tabbed-tile'
  | 'shield-check'
  | 'document-stack'
  | 'person-in-gate'
  | 'top-band-frame'
  | 'fork'
  | 'radial-hub'
  | 'merge'
  | 'diamond'
  | 'solid-end-cap'
  | 'barred-octagon';

export interface MaterialStyle {
  label: string;
  shape: MaterialShape;
  stroke: string;
  /** Translated 1:1 from declarations/infographic-grammar.v1.json. */
  fill: string;
  text: string;
  /** Foreground bounds of the 1024×1024 plate, so the material fills the drawn shape. */
  crop: { x: number; y: number; width: number; height: number };
}

export const MATERIAL_STYLES: Record<MaterialToken, MaterialStyle> = {
  input: { label: 'Input', shape: 'rounded-rectangle', stroke: '#75baff', fill: 'color-mix(in srgb, #75baff 10%, #07131e)', text: 'var(--color-text)', crop: { x: 140, y: 276, width: 744, height: 456 } },
  event: { label: 'Event', shape: 'beveled-rectangle', stroke: '#4eddeb', fill: 'color-mix(in srgb, #4eddeb 10%, #07131e)', text: 'var(--color-text)', crop: { x: 140, y: 288, width: 736, height: 448 } },
  outcome: { label: 'Outcome', shape: 'capsule', stroke: '#72e1ad', fill: 'color-mix(in srgb, #72e1ad 10%, #07131e)', text: 'var(--color-text)', crop: { x: 144, y: 280, width: 736, height: 464 } },
  'provider-port': { label: 'Provider port', shape: 'socket', stroke: '#82a8f9', fill: 'color-mix(in srgb, #82a8f9 10%, #07131e)', text: 'var(--color-text)', crop: { x: 104, y: 256, width: 816, height: 512 } },
  provider: { label: 'Provider', shape: 'tabbed-tile', stroke: '#b397ed', fill: 'color-mix(in srgb, #b397ed 10%, #07131e)', text: 'var(--color-text)', crop: { x: 144, y: 284, width: 732, height: 448 } },
  validation: { label: 'Validation', shape: 'shield-check', stroke: '#67d7bb', fill: 'color-mix(in srgb, #67d7bb 10%, #07131e)', text: 'var(--color-text)', crop: { x: 144, y: 292, width: 732, height: 416 } },
  evidence: { label: 'Evidence', shape: 'document-stack', stroke: '#d7ecf6', fill: 'color-mix(in srgb, #d7ecf6 10%, #07131e)', text: 'var(--color-text)', crop: { x: 144, y: 268, width: 748, height: 460 } },
  'human-approval': { label: 'Human approval', shape: 'person-in-gate', stroke: '#f2c472', fill: 'color-mix(in srgb, #f2c472 10%, #07131e)', text: 'var(--color-text)', crop: { x: 144, y: 296, width: 728, height: 432 } },
  authority: { label: 'Policy / authority', shape: 'top-band-frame', stroke: '#f6e6b6', fill: 'color-mix(in srgb, #f6e6b6 10%, #07131e)', text: 'var(--color-text)', crop: { x: 144, y: 296, width: 736, height: 436 } },
  branch: { label: 'Branch', shape: 'fork', stroke: '#83cfd5', fill: 'color-mix(in srgb, #83cfd5 10%, #07131e)', text: 'var(--color-text)', crop: { x: 160, y: 252, width: 700, height: 520 } },
  'fan-out': { label: 'Fan-out', shape: 'radial-hub', stroke: '#83cfd5', fill: 'color-mix(in srgb, #83cfd5 10%, #07131e)', text: 'var(--color-text)', crop: { x: 8, y: 172, width: 1008, height: 680 } },
  convergence: { label: 'Convergence', shape: 'merge', stroke: '#83cfd5', fill: 'color-mix(in srgb, #83cfd5 10%, #07131e)', text: 'var(--color-text)', crop: { x: 140, y: 248, width: 752, height: 528 } },
  decision: { label: 'Decision / selection', shape: 'diamond', stroke: '#83cfd5', fill: 'color-mix(in srgb, #83cfd5 10%, #07131e)', text: 'var(--color-text)', crop: { x: 96, y: 280, width: 832, height: 464 } },
  termination: { label: 'Termination', shape: 'solid-end-cap', stroke: '#d7ecf6', fill: 'color-mix(in srgb, #d7ecf6 10%, #07131e)', text: 'var(--color-text)', crop: { x: 96, y: 116, width: 828, height: 788 } },
  rejection: { label: 'Rejection / hold', shape: 'barred-octagon', stroke: '#efa585', fill: 'color-mix(in srgb, #efa585 10%, #07131e)', text: 'var(--color-text)', crop: { x: 192, y: 144, width: 640, height: 736 } },
};

/**
 * Primitive fallback silhouettes. An authored projection (or an unresolved run cell) still draws
 * the same kind of plate, never a uniform card. This is the one table the renderer consults for a
 * primitive's shape; it asserts silhouette, not meaning, so it cannot decide a cell's material.
 */
export const PRIMITIVE_MATERIAL: Record<CircuitNode['primitive'], MaterialToken> = {
  INPUT: 'input',
  EVENT: 'event',
  RESPONSIBILITY: 'decision',
  OUTCOME: 'outcome',
  PROVIDER_SLOT: 'provider-port',
  UNRESOLVED: 'rejection',
  SCENARIO: 'outcome',
  MECHANIC: 'event',
  PROVIDER: 'provider-port',
  PHYSICAL: 'provider',
};

/**
 * §12.3 — the declared material maps (`circuit-presentation.v1`, read through the estate's
 * `read-circuit-presentation` and published into `generated/circuit-presentation.json`).
 *
 * Every assignment is an exact key in a declared map: the scenario cell's three boundary roles
 * through `materials.boundary`, every other cell through `materials.byAuthority` (its verbatim
 * `execution.authorityId`), and every route through `materials.byEdgeKind`. No map falls back to
 * another, nothing is matched by substring, prefix or word stem, and a miss resolves to `null` —
 * which the projection draws as the visible UNRESOLVED primitive, never a guessed plate.
 */
export type DeclaredMaterials = NonNullable<CircuitPresentationPolicy['materials']>;

/** The declared maps a validated policy carries, or `null` when it declares none. */
export function materialsFromPolicy(policy: CircuitPresentationPolicy | null | undefined): DeclaredMaterials | null {
  return policy?.materials ?? null;
}

/** Resolve one drawn cell to its declared material. A miss stays unresolved. */
export function resolveCellMaterial(
  input: {
    /** The cell's verbatim `execution.authorityId`; null when the record predates it. */
    authorityId: string | null;
    /** A scenario cell is drawn as its boundary role rather than by authority. */
    boundaryRole?: BoundaryRole | null;
  },
  materials: DeclaredMaterials | null
): MaterialToken | null {
  if (!materials) return null;
  if (input.boundaryRole) return materials.boundary[input.boundaryRole] ?? null;
  if (!input.authorityId) return null;
  return materials.byAuthority[input.authorityId] ?? null;
}

/** Resolve one drawn route to its declared material. A miss stays unresolved. */
export function resolveEdgeMaterial(kind: string | null, materials: DeclaredMaterials | null): MaterialToken | null {
  if (!materials || !kind) return null;
  return materials.byEdgeKind[kind] ?? null;
}

export const FIDELITY_COPY = {
  FULL: {
    label: 'Full topology',
    explanation: 'The source qualifies this capability circuit in full.',
  },
  BOUNDARY: {
    label: 'Boundary view',
    explanation:
      'Boundary view — detailed topology incomplete. This generation qualifies the declared input, event, responsibility and outcome. Deeper topology is not drawn because the source does not resolve it.',
  },
  PARTIAL_BOUNDARY: {
    label: 'Partial boundary view',
    explanation:
      'Partial boundary view — one or more boundary members are not declared in this generation. Unresolved slots are shown as unresolved rather than filled in.',
  },
  RUN_GRAPH: {
    label: 'Run graph',
    explanation:
      'The composed execution graph of this run. Every planned cell is drawn unlit; a cell lights only when its own testimony arrives. Authored circuits are comparison candidates and are never shown as observed execution.',
  },
  COMPILED_GRAPH: {
    label: 'Compiled execution graph',
    explanation:
      'The execution graph the engine compiled for this capability. No run has been observed: every cell is drawn planned and unlit, and a cell lights only when a run’s own testimony arrives. Authored circuits are comparison candidates and are never shown as this graph.',
  },
  NONE: {
    label: 'No circuit published',
    explanation:
      'This generation publishes no circuit for this face: the execution graph is compiled by the engine at request time, and a compile that cannot succeed is shown as an explicit absence, never a substitute.',
  },
} as const;
