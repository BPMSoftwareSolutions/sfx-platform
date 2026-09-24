import type { CircuitProjection } from '@/contracts/estate';

import {
  focusViewport as focusViewportJs,
  layoutCircuit as layoutCircuitJs,
  wrapLabel as wrapLabelJs,
  FOCUS_VIEW_HEIGHT,
  VIEW_WIDTH,
} from './geometry.js';

/**
 * Typed surface over the deterministic geometry in `geometry.js` — §12.3.
 *
 * The algorithm lives in plain JavaScript so the test runner can exercise it without a build
 * step. This module supplies the project's types and is the only import the renderer uses.
 *
 * The layout is a top-to-bottom flow: rank is the declared operation order (the declared
 * `sequence` routes, deepened by the longest forward route below the declared-context floor), so
 * a serial chain descends one rank per operation and a material never reorders it. Parallel
 * siblings share a rank as side-by-side branch rails, splits and joins route over one shared rail
 * with junction dots, return/recurrence routes loop back outside the drawing, and a composite
 * with drawn children is framed around them as a container.
 */

export { FOCUS_VIEW_HEIGHT, VIEW_WIDTH };

/** A camera window over the drawing — the focused view for live watching (M12). */
export interface CircuitViewport {
  x: number;
  y: number;
  width: number;
  height: number;
}

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
  /** Rank: the declared-context floor raised by the longest forward declared route. */
  rank: number;
  /** Row within the rank when siblings wrap; column within the row. */
  row: number;
  column: number;
  /** True when this node is drawn as a frame around its children, not as a lane leaf. */
  container?: boolean;
  /** Header band height of a container frame, clear of the children. */
  headerHeight?: number;
  /** Direct drawn children wrapped by this container frame. */
  containerChildIds?: string[];
}

export interface LaidOutEdge {
  id: string;
  from: string;
  to: string;
  /** The engine's route kind when the projection declares one. */
  kind: string | null;
  /** A loop-back route: an upward close, a recurrence, or a same-context cycle break. */
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

/**
 * The focused camera for live watching (M12): a viewport centred on the active drawn node and
 * clamped to the drawing's bounds. The drawing is not trimmed, so every drawn id stays bound —
 * following the active operation moves the camera, never the view's coverage.
 */
export function focusViewport(layout: CircuitLayout, focusId: string): CircuitViewport | null {
  return focusViewportJs(layout, focusId) as CircuitViewport | null;
}
