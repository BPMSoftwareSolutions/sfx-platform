import type { TopologyNodeKind } from '@/contracts/topology';

/**
 * SCL semantic grammar for topology views — §6.2, §12.3.
 *
 * These values are the versioned circuit grammar's, mapped explicitly rather than re-derived
 * from the website shell palette. The shell may not silently recolor a semantic type, so every
 * mapping below is stated and matches `declarations/infographic-grammar.v1.json` in the content
 * lab. Each kind also carries a word, so status never depends on color alone (§6.6).
 */

export interface NodeGrammar {
  /** Canonical label rendered above the node's own text. */
  label: string;
  /** Semantic color from the circuit grammar. */
  color: string;
  /** Canonical shape. The renderer maps this to geometry. */
  shape:
    | 'rounded-rectangle'
    | 'beveled-rectangle'
    | 'capsule'
    | 'socket'
    | 'tabbed-tile'
    | 'diamond'
    | 'solid-end-cap'
    | 'barred-octagon'
    | 'radial-hub'
    | 'merge';
  /**
   * Reviewed material texture, addressed by content hash. One texture per kind: verified across
   * 250 sampled views as 8,374 texture references with zero conflicts (ADR 0001 §1.2).
   */
  texture: string;
}

const TEXTURES = '/media/library/outputs/estate-topology/textures';

export const NODE_GRAMMAR: Record<TopologyNodeKind, NodeGrammar> = {
  input: {
    label: 'Input',
    color: '#75baff',
    shape: 'rounded-rectangle',
    texture: `${TEXTURES}/8fea27caed885cd94f14371632894dc48592018eab35926733f305b085a5a126.webp`,
  },
  event: {
    label: 'Event',
    color: '#4eddeb',
    shape: 'beveled-rectangle',
    texture: `${TEXTURES}/bd6fec244bff0256906391b26b8381795fd8acd4b1a047695c197cb3aab64d6c.webp`,
  },
  outcome: {
    label: 'Outcome',
    color: '#72e1ad',
    shape: 'capsule',
    texture: `${TEXTURES}/7050ba6630711017207836082ad574ba31c2015d7cec965f186e4a4966b4601e.webp`,
  },
  provider: {
    label: 'Provider',
    color: '#b397ed',
    shape: 'tabbed-tile',
    texture: `${TEXTURES}/026a7d50edb06ee81918c691e2c631d6947571cf91bb8b7f7f12d66938248afc.webp`,
  },
  'provider-port': {
    label: 'Provider port',
    color: '#82a8f9',
    shape: 'socket',
    texture: `${TEXTURES}/49d7605833bb79859ac0e7af145aa220c1113d79ce095fba3edb69faedb9172a.webp`,
  },
  decision: {
    label: 'Decision / selection',
    color: '#83cfd5',
    shape: 'diamond',
    texture: `${TEXTURES}/71c591ed2d4687a4b376828684bbe913e3a837d8def04a95e82e924bb7f08faa.webp`,
  },
  termination: {
    label: 'Termination',
    color: '#d7ecf6',
    shape: 'solid-end-cap',
    texture: `${TEXTURES}/9637072de851f78ab39cd1aae35a0d6c0dd9ed1bf36a5aed756d85e58855ccd6.webp`,
  },
  rejection: {
    label: 'Rejection / hold',
    color: '#efa585',
    shape: 'barred-octagon',
    texture: `${TEXTURES}/3a54046d850149829e577c655ac5fbc718785202592a752717ffb9f2950e9c8e.webp`,
  },
  'fan-out': {
    label: 'Fan-out',
    color: '#83cfd5',
    shape: 'radial-hub',
    texture: `${TEXTURES}/8746ef430865d0e5b7b9dd095436eaae890876c857a9744d553e6ff4d89a9fd0.webp`,
  },
  /**
   * An unresolved reference. The compiler draws it with the rejection shape and material; the
   * label says what it actually is, so a reader never mistakes it for a declared rejection.
   */
  unresolved: {
    label: 'Unresolved reference',
    color: '#efa585',
    shape: 'barred-octagon',
    texture: `${TEXTURES}/3a54046d850149829e577c655ac5fbc718785202592a752717ffb9f2950e9c8e.webp`,
  },
  convergence: {
    label: 'Convergence',
    color: '#83cfd5',
    shape: 'merge',
    texture: `${TEXTURES}/706793265bfb67459e81463b81fcb57967d976d81758e974872e9ff519c103e3.webp`,
  },
};

/** Route families whose line is drawn dashed: support relationships and returns (§12.3). */
const DASHED = new Set([
  'provider-binding',
  'return',
  'recurrence',
  'bounded_return',
  'BOUNDED_RETURN',
  'scenario-return',
]);

/** A support link never carries an execution arrowhead — it is not execution flow (§12.3). */
const NO_ARROW = new Set(['provider-binding']);

/**
 * Route colors, matching the compiler's `color()` in `estate_topology_render.py`. An unrecognised
 * route kind falls through to the neutral execution color rather than failing to render.
 */
export function routeColor(kind: string): string {
  if (DASHED.has(kind) && kind !== 'provider-binding') return '#b8a0e9';
  if (kind === 'selection' || kind === 'BRANCH_ROUTE' || kind === 'conditional-argument') return '#ddb877';
  if (kind === 'provider-binding' || kind === 'altitude_descent' || kind === 'ALTITUDE_DESCENT') return '#82a8f9';
  if (kind === 'cancellation') return '#efaa91';
  return '#85bcc3';
}

export function routeIsDashed(kind: string): boolean {
  return DASHED.has(kind);
}

export function routeHasArrow(kind: string): boolean {
  return !NO_ARROW.has(kind);
}

/** Readable name for a route family, so the legend and inspector never rely on color. */
export function routeLabel(kind: string): string {
  const named: Record<string, string> = {
    'operation-order': 'Operation order',
    'operation-result': 'Operation result',
    'provider-binding': 'Provider binding',
    'scenario-call': 'Scenario call',
    'scenario-return': 'Scenario return',
    'scenario-transition': 'Scenario transition',
    'argument-dependency': 'Argument dependency',
    'conditional-argument': 'Conditional argument',
    sequence: 'Sequence',
    selection: 'Selection',
    recurrence: 'Recurrence',
    return: 'Return',
    TRANSITION: 'Transition',
    BRANCH_ROUTE: 'Branch route',
    ALTITUDE_DESCENT: 'Altitude descent',
    BOUNDED_RETURN: 'Bounded return',
  };
  return named[kind] ?? kind;
}

/** Diagram surface color from the compiler, kept so exported and on-page views agree. */
export const TOPOLOGY_SURFACE = '#071722';
export const TOPOLOGY_INK = '#e8efee';
export const TOPOLOGY_MUTED = '#91acb5';
