import type { CircuitEdge, CircuitNode, MaterialToken } from '@/contracts/estate';

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

/**
 * §12.3 — the material interpreter for the engine's native execution graph.
 *
 * The dynamic trace is compiled by the engine and publishes cells as `altitude` + `kind` plus an
 * edge `kind` (§11.3; the engine's own model names the same vocabulary). That vocabulary is coarser
 * than the fifteen canonical infographic materials, so this module is the single, table-driven
 * interpreter between them. It is deliberately data, not conditionals: one exact-key table, one
 * structural junction table, and one word table for operation semantics — no capability-specific
 * code. The estates's authored bundles resolve the same primitives from declared node kinds; when
 * the engine declares a native primitive profile on its cells the exact-key table can be replaced
 * by that declared mapping without touching the renderer (see KNOWN DEFECT in lib/run-graph.ts).
 */

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
 * Exact interpreter keys: `altitude|kind` of a drawn cell as the engine publishes them.
 * `scenario` closes every route of its scenario, so it reads as the scenario outcome;
 * a `mechanic` cell is the execution of a responsibility (`event`); a provider cell is the
 * declared responsibility boundary (`provider-port`); its realized physical cell is the
 * fulfiller (`provider`). A `junction` is classified structurally, below.
 *
 * The engine may also declare the operation's primitive directly as the cell `kind`; those
 * exact keys keep the mapping table the single place a silhouette is chosen.
 */
export const CELL_MATERIAL: Record<string, MaterialToken> = {
  'scenario|scenario': 'outcome',
  'mechanic|mechanic': 'event',
  'provider|provider': 'provider-port',
  'physical|physical': 'provider',
  'mechanic|input': 'input',
  'mechanic|event': 'event',
  'mechanic|outcome': 'outcome',
  'mechanic|authority': 'authority',
  'mechanic|validation': 'validation',
  'mechanic|evidence': 'evidence',
  'mechanic|human-approval': 'human-approval',
  'mechanic|decision': 'decision',
  'mechanic|branch': 'branch',
  'mechanic|fan-out': 'fan-out',
  'mechanic|convergence': 'convergence',
  'mechanic|rejection': 'rejection',
  'mechanic|termination': 'termination',
};

/**
 * Junction cells carry no sub-kind in the public projection; the route kinds around them do.
 * The engine's edge kinds are `sequence | selection | broadcast | join | recurrence | return |
 * failure | cancellation | testimony` (model.d.ts). First matching rule wins.
 */
export const JUNCTION_MATERIAL: Array<{ out: string[]; in: string[]; token: MaterialToken }> = [
  { out: ['failure', 'cancellation'], in: [], token: 'rejection' },
  { out: ['broadcast'], in: [], token: 'fan-out' },
  { out: ['selection', 'recurrence'], in: [], token: 'branch' },
  { out: [], in: ['join'], token: 'convergence' },
  { out: [], in: ['broadcast'], token: 'convergence' },
];

/**
 * Primitive fallback silhouettes. A run graph resolves its material through `CELL_MATERIAL`
 * above; an authored projection (or an unresolved run cell) still draws the same kind of plate,
 * never a uniform card. This is the one table the renderer consults for a primitive's shape.
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

/** The engine's edge kind → the canonical material the route is drawn over. */
export const EDGE_MATERIAL: Array<{ needle: string; token: MaterialToken }> = [
  { needle: 'product', token: 'outcome' },
  { needle: 'support', token: 'evidence' },
  { needle: 'failure', token: 'rejection' },
  { needle: 'cancellation', token: 'rejection' },
  { needle: 'broadcast', token: 'fan-out' },
  { needle: 'join', token: 'convergence' },
  { needle: 'selection', token: 'branch' },
  { needle: 'recurrence', token: 'branch' },
  { needle: 'return', token: 'outcome' },
  { needle: 'testimony', token: 'evidence' },
  { needle: 'sequence', token: 'event' },
];

/**
 * Operation semantics, in order. The mechanic name lives in the cell's semantic address
 * (`validate-semantic-carrier/...`, `select-equity-price-route#/expression`); these word stems are
 * matched against it so a validating mechanic draws Validation and a sealing one Authority. This
 * is generic vocabulary, not a capability list.
 */
export const MATERIAL_WORDS: Array<{ token: MaterialToken; stems: string[] }> = [
  { token: 'human-approval', stems: ['approv', 'signoff', 'human'] },
  { token: 'rejection', stems: ['reject', 'deny', 'refus', 'hold', 'cancel'] },
  { token: 'termination', stems: ['terminat', 'finali', 'complet'] },
  { token: 'authority', stems: ['authorit', 'authoriz', 'policy', 'govern', 'seal', 'admit'] },
  { token: 'validation', stems: ['validat', 'verif', 'conform', 'certif', 'conformance'] },
  { token: 'evidence', stems: ['evidence', 'proof', 'prove', 'receipt', 'testimony', 'attest'] },
  { token: 'decision', stems: ['select', 'choose', 'decision', 'adjudicat'] },
  { token: 'branch', stems: ['branch', 'otherwise', 'alternative'] },
  { token: 'fan-out', stems: ['fanout', 'fan', 'broadcast', 'parallel', 'spread'] },
  { token: 'convergence', stems: ['converge', 'merge', 'quorum', 'aggregat'] },
  { token: 'input', stems: ['input', 'request', 'intake', 'inquir', 'enquir'] },
  { token: 'outcome', stems: ['outcome', 'result', 'disposition', 'response', 'output'] },
  { token: 'provider-port', stems: ['port', 'slot', 'binding'] },
  { token: 'provider', stems: ['provider', 'implement', 'adapter', 'invoc'] },
];

function wordsOf(address: string): string[] {
  return address.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

function junctionMaterial(routeKinds: { in: string[]; out: string[] }): MaterialToken {
  const inKinds = new Set(routeKinds.in);
  const outKinds = new Set(routeKinds.out);
  for (const rule of JUNCTION_MATERIAL) {
    if (rule.out.some((kind) => outKinds.has(kind)) || rule.in.some((kind) => inKinds.has(kind))) return rule.token;
  }
  // A junction with no outgoing route ends its path; anything else compares and selects.
  return outKinds.size === 0 ? 'termination' : 'decision';
}

/** Resolve one drawn cell to its canonical material. Unknown vocabulary stays unresolved. */
export function resolveCellMaterial(input: {
  altitude: string | null;
  kind: string | null;
  /** Semantic addresses of the cell and the members it draws (collapsed view). */
  semanticHints: string[];
  /** Route kinds touching the cell itself, used to classify a junction. */
  routeKinds: { in: string[]; out: string[] };
}): MaterialToken | null {
  const altitude = input.altitude?.toLowerCase() ?? '';
  const kind = input.kind?.toLowerCase() ?? '';
  if (kind === 'junction') return junctionMaterial(input.routeKinds);
  const exact = CELL_MATERIAL[`${altitude}|${kind}`];
  if (exact) {
    // A mechanic's own name refines the generic execution plate; scopes and bindings stay fixed.
    if (exact !== 'event') return exact;
    const words = input.semanticHints.flatMap(wordsOf);
    for (const entry of MATERIAL_WORDS) {
      if (words.some((word) => entry.stems.some((stem) => word.startsWith(stem)))) return entry.token;
    }
    return exact;
  }
  return null;
}

/** Resolve one drawn route to the material its conduit is textured with. */
export function resolveEdgeMaterial(kind: string | null): MaterialToken | null {
  const value = kind?.toLowerCase() ?? '';
  if (!value) return null;
  for (const entry of EDGE_MATERIAL) {
    if (value.includes(entry.needle)) return entry.token;
  }
  return null;
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
