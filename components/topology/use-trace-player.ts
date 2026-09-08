'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { planTrace, type TraceGraph, type TraceWave } from './plan-trace';

/**
 * Illustrative flow player — ported from the retired `templates/estate-topology/viewer.js`.
 *
 * Drives the server-rendered SVG directly: the silver sphere follows the exact compiled route
 * path through `getPointAtLength`, so it travels the geometry Graphviz measured, not an
 * approximation. Fan-out waves animate together; a convergence waits for its required arrivals.
 *
 * §6.5 / §12.4 — playback starts only on request, reduced motion advances to route boundaries
 * instead of animating, inspecting a component pauses it, and leaving or hiding the page stops it.
 */

export type TraceState = 'idle' | 'playing' | 'paused' | 'complete';

interface Options {
  view: TraceGraph | undefined;
  /** The element containing the rendered SVG for `view`. */
  surface: React.RefObject<HTMLElement | null>;
  /** Called as the trace reaches each component, so the inspector can follow along. */
  onVisit?: (nodeId: string) => void;
}

const DURATION_MS = 800;

export function useTracePlayer({ view, surface, onVisit }: Options) {

  const [state, setState] = useState<TraceState>('idle');
  const [status, setStatus] = useState('');
  const [speed, setSpeed] = useState(1);
  const [follow, setFollow] = useState(true);

  const planRef = useRef<TraceWave[]>([]);
  const cursorRef = useRef(0);
  const visitedRoutes = useRef(new Set<string>());
  const visitedNodes = useRef(new Set<string>());
  /** Incremented to abandon in-flight animation frames when the trace is interrupted. */
  const tokenRef = useRef(0);
  const runningRef = useRef(false);
  const speedRef = useRef(speed);
  const followRef = useRef(follow);

  // Mirrored into refs so the animation loop reads the current value without re-subscribing.
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);
  useEffect(() => {
    followRef.current = follow;
  }, [follow]);

  const reduced = () =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion:reduce)').matches;

  const clearMarks = useCallback(() => {
    const marked = surface.current?.querySelectorAll('.active-route, .traced');
    if (!marked) return;
    marked.forEach((el) => el.classList.remove('active-route', 'traced'));
  }, [surface]);

  const reset = useCallback(() => {
    tokenRef.current += 1;
    runningRef.current = false;
    planRef.current = [];
    cursorRef.current = 0;
    visitedRoutes.current.clear();
    visitedNodes.current.clear();
    clearMarks();
    setState('idle');
    setStatus('');
  }, [clearMarks]);

  // A new view, or a re-render of the same one, starts from a clean trace.
  useEffect(() => {
    reset();
    if (view) {
      const waves = planTrace(view);
      // Large graphs would otherwise take minutes; the default speed scales with the plan.
      setSpeed(waves.length > 500 ? 16 : waves.length > 80 ? 4 : 1);
    }
  }, [view, reset]);

  const pause = useCallback(() => {
    if (!runningRef.current) return;
    tokenRef.current += 1;
    runningRef.current = false;
    setState('paused');
    setStatus(
      `Trace paused · ${visitedRoutes.current.size} / ${view?.routes.length ?? 0} routes`,
    );
  }, [view]);

  // §12.4 — hiding or leaving the page stops motion.
  useEffect(() => {
    const onHide = () => {
      if (document.hidden) pause();
    };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      tokenRef.current += 1;
      runningRef.current = false;
    };
  }, [pause]);

  /** Scrolls the viewport to keep the travelling sphere visible. */
  const followPoint = useCallback(
    (x: number, y: number) => {
      const viewport = surface.current;
      if (!viewport || !followRef.current || reduced()) return;
      const svg = viewport.querySelector('svg');
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const scaleX = rect.width / (view?.width ?? 1);
      const scaleY = rect.height / (view?.height ?? 1);
      if (rect.width > viewport.clientWidth) {
        viewport.scrollLeft = Math.max(0, x * scaleX - viewport.clientWidth / 2);
      }
      if (rect.height > viewport.clientHeight) {
        viewport.scrollTop = Math.max(0, y * scaleY - viewport.clientHeight / 2);
      }
    },
    [surface, view],
  );

  /** Animates one route, returning false if the trace was interrupted mid-flight. */
  const travel = useCallback(
    async (routeId: string, source: string, target: string): Promise<boolean> => {
      const mine = tokenRef.current;
      const group = surface.current?.querySelector(`[data-route="${CSS.escape(routeId)}"]`);
      const path = group?.querySelector('.route-path') as SVGPathElement | null;
      // Geometry that is not on the page is not animated along a guessed line.
      if (!path) return true;

      visitedNodes.current.add(source);
      group?.classList.add('active-route');

      const svg = surface.current?.querySelector('svg');
      const ball = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      ball.setAttribute('r', '6');
      ball.setAttribute('fill', '#f2ffff');
      ball.setAttribute('stroke', '#89b8c3');
      ball.setAttribute('stroke-width', '2');
      ball.setAttribute('pointer-events', 'none');
      svg?.append(ball);

      const length = path.getTotalLength();
      const isReduced = reduced();
      const start = performance.now();

      await new Promise<void>((resolve) => {
        const frame = (now: number) => {
          // Reduced motion advances straight to the route boundary (§6.5).
          const t = isReduced ? 1 : Math.min(1, (now - start) / (DURATION_MS / speedRef.current));
          const point = path.getPointAtLength(length * t);
          ball.setAttribute('cx', String(point.x));
          ball.setAttribute('cy', String(point.y));
          followPoint(point.x, point.y);
          if (t === 1 || mine !== tokenRef.current) resolve();
          else requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      });

      ball.remove();
      if (mine !== tokenRef.current) {
        if (!visitedRoutes.current.has(routeId)) group?.classList.remove('active-route');
        return false;
      }
      visitedRoutes.current.add(routeId);
      visitedNodes.current.add(target);
      onVisit?.(target);
      return true;
    },
    [surface, followPoint, onVisit],
  );

  /** Runs the plan from the cursor. `play` false advances a single wave. */
  const run = useCallback(
    async (play: boolean, preferred?: string) => {
      if (!view) return;

      if (!planRef.current.length || cursorRef.current >= planRef.current.length) {
        planRef.current = planTrace(view, planRef.current.length ? undefined : preferred);
        cursorRef.current = 0;
        visitedRoutes.current.clear();
        visitedNodes.current.clear();
        clearMarks();
      }

      const mine = ++tokenRef.current;
      runningRef.current = play;
      setState(play ? 'playing' : 'paused');

      do {
        const wave = planRef.current[cursorRef.current];
        if (!wave) break;
        const pending = wave.filter((step) =>
          step.routeId ? !visitedRoutes.current.has(step.routeId) : !visitedNodes.current.has(step.nodeId ?? ''),
        );
        const routes = pending.filter((step) => step.routeId);

        setStatus(
          pending.length > 1
            ? `Tracing ${visitedRoutes.current.size + 1}–${visitedRoutes.current.size + routes.length} / ${view.routes.length} · ${pending.length} parallel branches`
            : `Tracing ${Math.min(visitedRoutes.current.size + 1, view.routes.length)} / ${view.routes.length} · ${pending[0]?.kind ?? 'isolated component'}`,
        );

        const completed = await Promise.all(
          pending.map(async (step) => {
            if (step.routeId) return travel(step.routeId, step.source ?? '', step.target ?? '');
            if (step.nodeId) {
              visitedNodes.current.add(step.nodeId);
              onVisit?.(step.nodeId);
              const box = view.boxes[step.nodeId];
              if (box) followPoint(box[0] + box[2] / 2, box[1] + box[3] / 2);
              await new Promise((resolve) => requestAnimationFrame(resolve));
            }
            return true;
          }),
        );

        if (mine !== tokenRef.current) return;
        if (completed.some((ok) => !ok)) return;

        for (const step of pending) {
          const id = step.target ?? step.nodeId;
          if (id) surface.current?.querySelector(`[data-entity="${CSS.escape(id)}"]`)?.classList.add('traced');
        }
        cursorRef.current += 1;
      } while (play && runningRef.current && cursorRef.current < planRef.current.length);

      if (mine !== tokenRef.current) return;

      if (cursorRef.current >= planRef.current.length) {
        runningRef.current = false;
        setState('complete');
        setStatus(
          `Trace complete · ${visitedRoutes.current.size} / ${view.routes.length} routes · ${visitedNodes.current.size} / ${view.nodes.length} components. All declared alternatives inspected.`,
        );
      } else {
        runningRef.current = false;
        setState('paused');
        setStatus(`Trace paused · ${visitedRoutes.current.size} / ${view.routes.length} routes`);
      }
    },
    [view, travel, clearMarks, followPoint, onVisit, surface],
  );

  const toggle = useCallback(
    (preferred?: string) => {
      if (runningRef.current) pause();
      else void run(true, preferred);
    },
    [pause, run],
  );

  const stepOnce = useCallback(() => {
    if (runningRef.current) pause();
    void run(false);
  }, [pause, run]);

  const replay = useCallback(() => {
    reset();
    void run(true);
  }, [reset, run]);

  return {
    state,
    status,
    speed,
    setSpeed,
    follow,
    setFollow,
    toggle,
    stepOnce,
    replay,
    pause,
    reset,
  };
}
