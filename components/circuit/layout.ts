import type { CircuitProjection } from '@/contracts/estate';

import { layoutCircuit as layoutCircuitJs, wrapLabel as wrapLabelJs, VIEW_WIDTH } from './geometry.js';

/**
 * Typed surface over the deterministic geometry in `geometry.js` — §12.3.
 *
 * The algorithm lives in plain JavaScript so the test runner can exercise it without a build
 * step. This module supplies the project's types and is the only import the renderer uses.
 *
 * The layout is a layered DAG: ranks are altitude bands raised by the longest forward path,
 * siblings share a rank in lanes, splits/joins route over staggered channels with junction dots,
 * and return/recurrence routes loop back outside the drawing.
 */

export { VIEW_WIDTH };

export interface LaidOutNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Pre-wrapped declared label lines. Wrapping happens once, here, not in the renderer. */
  lines: string[];
  /**
   * Presentation wrap of the label with any shared preamble between drawn labels stripped.
   * Display only: the declared label stays whole in `lines`, the outline and the inspector.
   */
  displayLines: string[];
  /** Altitude rank (longest forward path floor by band). */
  rank: number;
  /** Row within the rank when siblings wrap; column within the row. */
  row: number;
  column: number;
}

export interface LaidOutEdge {
  id: string;
  from: string;
  to: string;
  /** The engine's route kind when the projection declares one. */
  kind: string | null;
  /** A loop-back route: return/recurrence, up-band, or a same-band cycle break. */
  back: boolean;
  /** Exact compiled path. The flow player follows this same path (§12.4). */
  path: string;
  midpoint: { x: number; y: number };
  /** Split/merge junction points where this route meets a shared trunk, for the junction dots. */
  junctions: Array<{ x: number; y: number }>;
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
