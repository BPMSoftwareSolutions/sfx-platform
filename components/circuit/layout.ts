import type { CircuitProjection } from '@/contracts/estate';

import { layoutCircuit as layoutCircuitJs, wrapLabel as wrapLabelJs, VIEW_WIDTH } from './geometry.js';

/**
 * Typed surface over the deterministic geometry in `geometry.js` — §12.3.
 *
 * The algorithm lives in plain JavaScript so the test runner can exercise it without a build
 * step. This module supplies the project's types and is the only import the renderer uses.
 */

export { VIEW_WIDTH };

export interface LaidOutNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Pre-wrapped label lines. Wrapping happens once, here, not in the renderer. */
  lines: string[];
}

export interface LaidOutEdge {
  id: string;
  from: string;
  to: string;
  /** Exact compiled path. The flow player follows this same path (§12.4). */
  path: string;
  midpoint: { x: number; y: number };
}

export interface CircuitLayout {
  width: number;
  height: number;
  nodes: LaidOutNode[];
  edges: LaidOutEdge[];
  nodeById: Record<string, LaidOutNode | undefined>;
}

export function wrapLabel(text: string, columns?: number): string[] {
  return wrapLabelJs(text, columns) as string[];
}

export function layoutCircuit(circuit: CircuitProjection): CircuitLayout {
  return layoutCircuitJs(circuit) as CircuitLayout;
}
