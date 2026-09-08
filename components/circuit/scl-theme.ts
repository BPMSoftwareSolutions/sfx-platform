import type { CircuitEdge, CircuitNode } from '@/contracts/estate';

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
    stroke: 'var(--color-projection)',
    fill: 'color-mix(in srgb, var(--color-projection) 12%, var(--color-ink-2))',
    text: 'var(--color-text)',
  },
  PROVIDER_SLOT: {
    label: 'Provider slot',
    shape: 'slot',
    stroke: 'var(--color-telemetry)',
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
};

/** §12.3 — route families keep their type; a support link is not execution flow. */
export const EDGE_STYLES: Record<CircuitEdge['family'], { label: string; stroke: string; dash?: string }> = {
  EXECUTION: { label: 'Execution', stroke: 'var(--color-signal)' },
  PRODUCT_TRANSFER: { label: 'Product transfer', stroke: 'var(--color-authority)', dash: '1 0' },
  SUPPORT: { label: 'Support', stroke: 'var(--color-muted)', dash: '4 4' },
};

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
} as const;
