'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import type { CircuitProjection, MaterialToken } from '@/contracts/estate';
import type { LiveOutcome } from '@/lib/live-trace';

import { focusViewport, layoutCircuit } from './layout';
import { materialGeometry, type MaterialGeometry } from './material-geometry';
import {
  EDGE_STYLES,
  FIDELITY_COPY,
  MATERIAL_STYLES,
  PRIMITIVE_MATERIAL,
  PRIMITIVE_STYLES,
  type MaterialStyle,
} from './scl-theme';

/**
 * Circuit viewer — §12.2, §12.4, §6.6.
 *
 * Topology, labels, status and evidence come from the deterministic projection. The viewer adds
 * selection, an equivalent text outline, a legend, a node inspector and one observed token.
 *
 * A node carrying a canonical `material` is drawn as the component plate inside its defining
 * shape, with the state affordances layered over the material — the observed class never replaces
 * what the component is. Nodes without a material (authored projections) keep the primitive rect.
 *
 * A run's own testimony leaves a trail (`liveTrail`): one circular token advances along the exact
 * compiled path, shape to shape, in cursor order. It never walks a route no testimony named, and
 * a compiled view with no run has no trail at all — the two modes are the same drawing.
 *
 * The SVG and the text outline are both server-rendered, so public reading and the text
 * explanation remain available without JavaScript; only the controls require it.
 */

/** Observed execution state for one node, applied as an explicit class and data attribute. */
export type LiveNodeState = 'planned' | 'active' | 'done' | 'held' | 'failed';

/** One observed step, in cursor order: a drawn node or edge whose testimony advanced. */
export interface LiveTrailStep {
  /** Drawn node id or drawn edge id. */
  id: string;
  state: LiveNodeState;
}

/** `url(#…)` fragments must not carry cell-id punctuation. */
const fragmentId = (value: string) => `circuit-${value.replace(/[^a-zA-Z0-9]+/g, '-')}`;
const clipId = (nodeId: string) => fragmentId(`clip-${nodeId}`);
const edgePatternId = (token: string) => fragmentId(`edge-${token}`);

/**
 * The outcome badge text: the testified variant and classification, clipped to the node's width.
 * The inspector and the text outline carry the full value, and the clip is visible on the badge
 * itself, so a long variant is never silently turned into a different one.
 */
function outcomeBadge(outcome: LiveOutcome, availableWidth: number): string {
  const text = [outcome.variant ?? 'outcome', outcome.classification].filter(Boolean).join(' · ');
  const maxChars = Math.max(8, Math.floor((availableWidth - 8) / 5.4));
  return text.length > maxChars ? `${text.slice(0, maxChars - 1)}…` : text;
}

interface Props {
  circuit: CircuitProjection;
  /** Selection is shareable URL state; the page owns the URL and passes the selection down. */
  selectedNodeId?: string;
  onSelectNode?: (nodeId: string | undefined) => void;
  /** Live trace overlay: node id to observed state. Declared route is never recoloured as observed otherwise. */
  liveNodes?: Partial<Record<string, LiveNodeState>>;
  /** Live trace overlay for drawn edges: edge id to observed state. */
  liveEdges?: Partial<Record<string, LiveNodeState>>;
  /**
   * Drawn node id -> the outcome its own cell testified (the trace's `outcomes`). A node with a
   * testified outcome shows the variant and classification it reached; a node without one shows
   * nothing — an outcome is never inferred from a declared variant or a sibling's testimony.
   */
  liveOutcomes?: Partial<Record<string, LiveOutcome>>;
  /**
   * Drawn edge id -> its declared selection/recurrence variant (`RunGraphViewEdge.selectsVariant`).
   * A walked arm (an edge with its own observed state) is labelled with the variant it walked; an
   * unwalked arm carries no state and no label.
   */
  edgeVariants?: Partial<Record<string, string | boolean | null>>;
  /**
   * The run's observed trail in cursor order. The token follows it node/edge by node/edge; with
   * no trail (compiled view, authored circuit) it never renders.
   */
  liveTrail?: LiveTrailStep[];
  /** Canonical material token to its published `/media/materials/...` asset. */
  materials?: Record<string, string>;
}

export function CircuitViewer({ circuit, selectedNodeId, onSelectNode, liveNodes, liveEdges, liveOutcomes, edgeVariants, liveTrail, materials }: Props) {
  const layout = useMemo(() => layoutCircuit(circuit), [circuit]);
  // The focused camera for live watching (M12): the active drawn node keeps itself in view. Only
  // the camera moves — the drawing is never trimmed and every drawn id stays bound.
  const activeNodeId = useMemo(() => {
    if (!liveNodes) return undefined;
    for (const [id, state] of Object.entries(liveNodes)) if (state === 'active') return id;
    return undefined;
  }, [liveNodes]);
  const camera = useMemo(() => (activeNodeId ? focusViewport(layout, activeNodeId) : null), [layout, activeNodeId]);
  const [internalSelection, setInternalSelection] = useState<string | undefined>(undefined);
  const [reducedMotion, setReducedMotion] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const tokenRef = useRef<SVGGElement>(null);
  const pathRefs = useRef(new Map<string, SVGPathElement>());
  const trailRef = useRef<LiveTrailStep[]>([]);
  const playedRef = useRef(0);
  const runningRef = useRef(false);
  const rafRef = useRef(0);
  const lastPosRef = useRef<{ x: number; y: number } | undefined>(undefined);
  const trailLength = liveTrail?.length ?? 0;

  // The running token reads the latest observed trail without restarting: a ref may not be
  // written during render, so an effect keeps it current (declared before the animation effect).
  useEffect(() => {
    trailRef.current = liveTrail ?? [];
  });

  const selected = selectedNodeId ?? internalSelection;
  const select = (id: string | undefined) => {
    setInternalSelection(id);
    onSelectNode?.(id);
  };

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  // One token per run, advancing only through the observed trail. The animation writes the token
  // group's transform directly (no per-frame React state), stops when the trail is exhausted and
  // resumes when later testimony lengthens it. A compiled view has no trail and shows no token.
  useEffect(() => {
    const setTokenAt = (x: number, y: number, visible = true) => {
      const token = tokenRef.current;
      if (!token) return;
      token.style.display = visible ? '' : 'none';
      token.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
      lastPosRef.current = { x, y };
    };
    if (trailLength === 0) {
      playedRef.current = 0;
      runningRef.current = false;
      cancelAnimationFrame(rafRef.current);
      lastPosRef.current = undefined;
      setTokenAt(0, 0, false);
      return;
    }
    if (runningRef.current) return;
    runningRef.current = true;

    const edgeById = new Map(layout.edges.map((edge) => [edge.id, edge]));
    let motion:
      | { kind: 'edge'; path: SVGPathElement; length: number; startedAt: number; duration: number }
      | { kind: 'node'; from: { x: number; y: number }; to: { x: number; y: number }; startedAt: number; duration: number }
      | undefined;

    const startNext = (now: number): boolean => {
      while (playedRef.current < trailRef.current.length) {
        const step = trailRef.current[playedRef.current];
        playedRef.current += 1;
        if (!step) continue;
        const edge = edgeById.get(step.id);
        if (edge) {
          const path = pathRefs.current.get(edge.id);
          if (!path) continue;
          const length = path.getTotalLength();
          const end = path.getPointAtLength(length);
          if (reducedMotion) {
            setTokenAt(end.x, end.y);
            continue;
          }
          const start = path.getPointAtLength(0);
          setTokenAt(start.x, start.y);
          motion = {
            kind: 'edge',
            path,
            length,
            startedAt: now,
            // Longer routes take longer, bounded so a multi-step page still trails the lane.
            duration: Math.max(320, Math.min(1400, 240 + length * 0.65)),
          };
          return true;
        }
        const node = layout.nodeById[step.id];
        if (!node) continue;
        const to = { x: node.x + node.width / 2, y: node.y + node.height / 2 };
        if (reducedMotion) {
          setTokenAt(to.x, to.y);
          continue;
        }
        motion = { kind: 'node', from: lastPosRef.current ?? to, to, startedAt: now, duration: 260 };
        return true;
      }
      return false;
    };

    const tick = (now: number) => {
      if (!motion && !startNext(now)) {
        runningRef.current = false;
        return;
      }
      if (motion) {
        const progress = motion.duration > 0 ? Math.min(1, (now - motion.startedAt) / motion.duration) : 1;
        if (motion.kind === 'edge') {
          const point = motion.path.getPointAtLength(motion.length * progress);
          setTokenAt(point.x, point.y);
        } else {
          setTokenAt(
            motion.from.x + (motion.to.x - motion.from.x) * progress,
            motion.from.y + (motion.to.y - motion.from.y) * progress
          );
        }
        if (progress >= 1) motion = undefined;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [trailLength, layout, reducedMotion]);

  // Every drawn node carries a material silhouette. A run cell resolves its own material; an
  // authored projection falls back to the primitive's table entry. The plate image is layered
  // only when the projection resolves a canonical material and its asset is published.
  const nodeVisuals = useMemo(() => {
    const map = new Map<
      string,
      { token: MaterialToken; style: MaterialStyle; url?: string; geometry: MaterialGeometry; plate: boolean }
    >();
    for (const node of circuit.nodes) {
      const box = layout.nodeById[node.id];
      if (!box) continue;
      const token = node.material ?? PRIMITIVE_MATERIAL[node.primitive];
      const style = MATERIAL_STYLES[token];
      if (!style) continue;
      const url = node.material ? materials?.[token] : undefined;
      map.set(node.id, { token, style, url, geometry: materialGeometry(style.shape, box), plate: Boolean(url) });
    }
    return map;
  }, [circuit.nodes, layout, materials]);

  const edgeMaterialTokens = useMemo(() => {
    const tokens = new Set<MaterialToken>();
    if (!materials) return tokens;
    for (const edge of circuit.edges) {
      if (edge.material && materials[edge.material]) tokens.add(edge.material);
    }
    return tokens;
  }, [circuit.edges, materials]);

  const fidelity = FIDELITY_COPY[circuit.fidelity];
  const selectedNode = circuit.nodes.find((n) => n.id === selected);
  const titleId = `circuit-title-${circuit.scenarioId}`;
  const descId = `circuit-desc-${circuit.scenarioId}`;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded border border-telemetry/50 px-2 py-0.5 font-mono text-xs text-telemetry">
            {fidelity.label}
          </span>
          <span className="font-mono text-xs text-muted">
            SCL {circuit.sclVersion} · {circuit.sourceProfile}
          </span>
          <div className="ml-auto flex gap-2">
            {selected ? (
              <button
                type="button"
                onClick={() => select(undefined)}
                className="rounded border border-grid-line px-3 py-1 text-xs hover:border-signal"
              >
                Clear selection
              </button>
            ) : null}
          </div>
        </div>

        {/* §12.4 — the circuit has its own labelled region with an equivalent text view. */}
        <div
          role="group"
          aria-label={`Capability circuit for scenario ${circuit.scenarioId}`}
          className="overflow-x-auto rounded-lg border border-grid-line bg-ink-2 p-2"
        >
          <svg
            ref={svgRef}
            viewBox={
              camera
                ? `${camera.x} ${camera.y} ${camera.width} ${camera.height}`
                : `0 0 ${layout.width} ${layout.height}`
            }
            data-following={camera ? activeNodeId : undefined}
            width="100%"
            role="img"
            aria-labelledby={`${titleId} ${descId}`}
            style={{ minWidth: layout.width }}
          >
            <title id={titleId}>{`Circuit: ${circuit.capabilityId} / ${circuit.scenarioId}`}</title>
            <desc id={descId}>
              {`${fidelity.explanation} ${circuit.nodes.length} nodes, ${circuit.edges.length} routes. The node list below carries the same content as text.`}
            </desc>

            <defs>
              {[...nodeVisuals.entries()]
                .filter(([, visual]) => visual.plate)
                .map(([nodeId, visual]) => (
                  <clipPath key={nodeId} id={clipId(nodeId)}>
                    <path d={visual.geometry.silhouette} />
                  </clipPath>
                ))}
              {[...edgeMaterialTokens].map((token) => {
                const crop = MATERIAL_STYLES[token].crop;
                return (
                  <pattern
                    key={token}
                    id={edgePatternId(token)}
                    patternUnits="userSpaceOnUse"
                    width={120}
                    height={28}
                  >
                    <svg
                      x={0}
                      y={0}
                      width={120}
                      height={28}
                      viewBox={`${crop.x} ${crop.y} ${crop.width} ${crop.height}`}
                      preserveAspectRatio="none"
                    >
                      <image
                        href={materials?.[token]}
                        x={0}
                        y={0}
                        width={1024}
                        height={1024}
                        preserveAspectRatio="none"
                      />
                    </svg>
                  </pattern>
                );
              })}
            </defs>

            {layout.edges.map((edge) => {
              const source = circuit.edges.find((e) => e.id === edge.id);
              const style = EDGE_STYLES[source?.family ?? 'SUPPORT'];
              const liveEdge = liveEdges?.[edge.id];
              const edgeToken = source?.material && materials?.[source.material] ? source.material : undefined;
              // A walked selection/recurrence arm shows the variant it walked. An unwalked arm
              // carries no observed state, so it is never labelled and never lit.
              const variant = edgeVariants?.[edge.id];
              const walked = liveEdge === 'active' || liveEdge === 'done';
              // A loop-back route reads as a loop: dashed at rest; state still layers over it.
              const dash = edge.back ? '6 4' : style.dash === '1 0' ? undefined : style.dash;
              return (
                <g key={edge.id} style={edgeToken ? { isolation: 'isolate' } : undefined} data-back={edge.back || undefined}>
                  {edgeToken ? (
                    <>
                      <path d={edge.path} fill="none" stroke="#07131e" strokeWidth={6} strokeLinecap="round" opacity={0.9} />
                      <path
                        d={edge.path}
                        className={liveEdge ? `circuit-edge-material circuit-edge-material--${liveEdge}` : 'circuit-edge-material'}
                        fill="none"
                        stroke={`url(#${edgePatternId(edgeToken)})`}
                        strokeWidth={6}
                        strokeLinecap="round"
                        opacity={0.4}
                        style={{ mixBlendMode: 'screen' }}
                      />
                    </>
                  ) : null}
                  <path
                    ref={(element) => {
                      // The token samples this same compiled path; no second geometry is derived.
                      if (element) pathRefs.current.set(edge.id, element);
                      else pathRefs.current.delete(edge.id);
                    }}
                    d={edge.path}
                    className={liveEdge ? `circuit-edge circuit-edge--${liveEdge}` : 'circuit-edge'}
                    data-live={liveEdge}
                    fill="none"
                    stroke={style.stroke}
                    strokeWidth={1.5}
                    strokeDasharray={dash}
                    opacity={0.8}
                  />
                  {edge.junctions.map((junction, index) => (
                    <circle
                      key={`${edge.id}-junction-${index}`}
                      className="circuit-junction"
                      cx={junction.x}
                      cy={junction.y}
                      r={3.2}
                      fill={style.stroke}
                      stroke="#07131e"
                      strokeWidth={1}
                    />
                  ))}
                  {variant !== undefined && variant !== null && walked ? (
                    <text
                      className="circuit-arm-label"
                      x={edge.midpoint.x}
                      y={edge.midpoint.y - 7}
                      textAnchor="middle"
                      fontSize={9.5}
                      fontFamily="var(--font-mono)"
                      aria-hidden="true"
                    >
                      {typeof variant === 'boolean' ? (variant ? 'TRUE' : 'FALSE') : String(variant)}
                    </text>
                  ) : null}
                </g>
              );
            })}

            {layout.nodes.map((box) => {
              const node = circuit.nodes.find((candidate) => candidate.id === box.id);
              if (!node) return null;
              const visual = nodeVisuals.get(node.id);
              const primitiveStyle = PRIMITIVE_STYLES[node.primitive];
              const style = node.material && visual ? visual.style : primitiveStyle;
              const isSelected = node.id === selected;
              const live = liveNodes?.[node.id];
              const geometry = visual?.geometry;
              // Every silhouette keeps its glyph band clear of the label.
              const inset = geometry?.labelInsetX ?? 14;
              // The plate image is drawn only when the projection itself resolves a material.
              const plateUrl = node.material ? visual?.url : undefined;
              const crop = plateUrl ? visual?.style.crop : undefined;
              const colors =
                node.material && visual
                  ? { fill: visual.style.fill, stroke: visual.style.stroke }
                  : { fill: primitiveStyle.fill, stroke: primitiveStyle.stroke };
              const stateStroke = isSelected ? 'var(--color-signal)' : colors.stroke;
              // The node's own testified outcome, when the trace carries one: variant and
              // classification, never inferred from a declared variant or a member's testimony.
              const outcome = liveOutcomes?.[node.id];
              const outcomeText = outcome
                ? [outcome.variant ?? 'outcome', outcome.classification].filter(Boolean).join(' · ')
                : '';
              // A container's header badge is a silhouette, so it always needs a material shape.
              const containerShape =
                visual?.style.shape ?? MATERIAL_STYLES[PRIMITIVE_MATERIAL[node.primitive]].shape;
              return (
                <g
                  key={node.id}
                  className={live ? `circuit-node circuit-node--${live}` : 'circuit-node'}
                  data-live={live}
                  data-container={box.container ? 'true' : undefined}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  aria-label={`${style.label}: ${node.label}${outcomeText ? ` — ${outcomeText}` : ''}`}
                  onClick={() => select(isSelected ? undefined : node.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      select(isSelected ? undefined : node.id);
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  {box.container ? (
                    <>
                      {/* A composite is drawn as a frame around its children: containment is geometry. */}
                      <rect
                        className="circuit-container-frame"
                        x={box.x}
                        y={box.y}
                        width={box.width}
                        height={box.height}
                        rx={16}
                        fill="color-mix(in srgb, #07131e 72%, transparent)"
                        stroke={stateStroke}
                        strokeWidth={isSelected ? 2.5 : 1.4}
                        strokeDasharray="9 5"
                      />
                      <rect
                        x={box.x}
                        y={box.y}
                        width={box.width}
                        height={box.headerHeight ?? 34}
                        rx={16}
                        fill={colors.fill}
                        stroke={stateStroke}
                        strokeWidth={isSelected ? 2.5 : 1.4}
                      />
                      {/* The container's own material keeps its defining silhouette as a header badge. */}
                      <path
                        className="circuit-container-badge"
                        d={materialGeometry(containerShape, { x: box.x + 12, y: box.y + 9, width: 38, height: 16 }).silhouette}
                        fill={colors.fill}
                        stroke={colors.stroke}
                        strokeWidth={1.2}
                      />
                      <text
                        x={box.x + 58}
                        y={box.y + 14}
                        fill={style.stroke}
                        fontSize={10}
                        fontFamily="var(--font-mono)"
                        letterSpacing="0.08em"
                      >
                        {style.label.toUpperCase()}
                      </text>
                      <text
                        x={box.x + 58}
                        y={box.y + 29}
                        fill={style.text}
                        fontSize={13}
                        fontFamily="var(--font-sans)"
                      >
                        {box.displayLines[0] ?? node.label}
                      </text>
                      {outcome ? (
                        <text
                          className={`circuit-outcome circuit-outcome--${outcome.classification ?? 'unclassified'}`}
                          x={box.x + box.width - 14}
                          y={box.y + box.height - 8}
                          textAnchor="end"
                          fontSize={9.5}
                          fontFamily="var(--font-mono)"
                        >
                          {outcomeBadge(outcome, box.width - 28)}
                        </text>
                      ) : null}
                    </>
                  ) : geometry && plateUrl && crop ? (
                    <>
                      {/* The material plate inside the token's defining shape; state layers over it. */}
                      <path d={geometry.silhouette} fill="#07131e" opacity={0.6} />
                      <g
                        clipPath={`url(#${clipId(node.id)})`}
                        className="circuit-node-plate"
                        style={{ isolation: 'isolate', pointerEvents: 'none' }}
                      >
                        <path d={geometry.silhouette} fill="#07131e" />
                        <svg
                          x={box.x}
                          y={box.y}
                          width={box.width}
                          height={box.height}
                          viewBox={`${crop.x} ${crop.y} ${crop.width} ${crop.height}`}
                          preserveAspectRatio="none"
                        >
                          <image
                            href={plateUrl}
                            x={0}
                            y={0}
                            width={1024}
                            height={1024}
                            preserveAspectRatio="none"
                            opacity={0.92}
                            style={{ mixBlendMode: 'screen' }}
                          />
                        </svg>
                      </g>
                      {geometry.details.map((d, index) => (
                        <path
                          key={`${node.id}-detail-${index}`}
                          d={d}
                          className="circuit-node-detail"
                          fill="none"
                          stroke={colors.stroke}
                          strokeWidth={1.2}
                          opacity={0.7}
                        />
                      ))}
                      {([
                        [14, 0.05],
                        [8, 0.09],
                        [4, 0.16],
                      ] as const).map(([width, opacity]) => (
                        <path
                          key={`${node.id}-glow-${width}`}
                          d={geometry.silhouette}
                          fill="none"
                          stroke={colors.stroke}
                          strokeWidth={width}
                          opacity={opacity}
                        />
                      ))}
                      <path
                        d={geometry.silhouette}
                        className="circuit-node-contour"
                        fill="none"
                        stroke={isSelected ? 'var(--color-signal)' : style.stroke}
                        strokeWidth={isSelected ? 2.5 : 1.5}
                      />
                    </>
                  ) : geometry ? (
                    <>
                      {/* The same silhouette without its asset: fill, details and contour. */}
                      <path d={geometry.silhouette} fill={colors.fill} />
                      {geometry.details.map((d, index) => (
                        <path
                          key={`${node.id}-detail-${index}`}
                          d={d}
                          className="circuit-node-detail"
                          fill="none"
                          stroke={colors.stroke}
                          strokeWidth={1.2}
                          opacity={0.7}
                        />
                      ))}
                      <path
                        d={geometry.silhouette}
                        className="circuit-node-contour"
                        fill="none"
                        stroke={isSelected ? 'var(--color-signal)' : colors.stroke}
                        strokeWidth={isSelected ? 2.5 : 1.5}
                        strokeDasharray={node.primitive === 'UNRESOLVED' ? '5 4' : undefined}
                      />
                    </>
                  ) : (
                    <rect
                      x={box.x}
                      y={box.y}
                      width={box.width}
                      height={box.height}
                      rx={14}
                      fill={colors.fill}
                      stroke={isSelected ? 'var(--color-signal)' : colors.stroke}
                      strokeWidth={isSelected ? 2.5 : 1.5}
                    />
                  )}
                  {box.container ? null : (
                    <>
                      <text
                        x={box.x + inset}
                        y={box.y + 20}
                        fill={style.stroke}
                        fontSize={10}
                        fontFamily="var(--font-mono)"
                        letterSpacing="0.08em"
                      >
                        {style.label.toUpperCase()}
                      </text>
                      {(box.displayLines ?? box.lines).map((line, index) => (
                        <text
                          key={`${node.id}-line-${index}`}
                          x={box.x + inset}
                          y={box.y + 40 + index * 19}
                          fill={style.text}
                          fontSize={13}
                          fontFamily="var(--font-sans)"
                        >
                          {line}
                        </text>
                      ))}
                      {outcome ? (
                        <text
                          className={`circuit-outcome circuit-outcome--${outcome.classification ?? 'unclassified'}`}
                          x={box.x + inset}
                          y={box.y + box.height - 7}
                          fontSize={9.5}
                          fontFamily="var(--font-mono)"
                        >
                          {outcomeBadge(outcome, box.width - inset * 2)}
                        </text>
                      ) : null}
                    </>
                  )}
                </g>
              );
            })}

            {/* The observed token: one per run, moved only by its own testimony. */}
            <g ref={tokenRef} className="circuit-token" aria-hidden="true" style={{ display: 'none' }}>
              <circle r={7} className="circuit-token-halo" />
              <circle r={3.6} className="circuit-token-core" />
            </g>
          </svg>
        </div>

        <p className="mt-3 text-sm text-muted">{fidelity.explanation}</p>

        {circuit.diagnostics.length > 0 ? (
          <details className="mt-3 rounded-lg border border-grid-line bg-ink-2 p-4">
            <summary className="cursor-pointer font-display text-sm font-semibold">
              Source findings for this circuit ({circuit.diagnostics.length})
            </summary>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              {circuit.diagnostics.map((d) => (
                <li key={d.code}>
                  <span className="font-mono text-xs text-telemetry">{d.code}</span> — {d.message}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>

      <aside className="min-w-0 space-y-4">
        {/* §12.4 — the navigable text outline. Present with or without JavaScript. */}
        <nav aria-label="Circuit outline" className="rounded-lg border border-grid-line bg-ink-2 p-4">
          <h3 className="font-mono text-xs uppercase tracking-widest text-muted">Circuit outline</h3>
          <ol className="mt-3 space-y-2">
            {circuit.nodes.map((node) => {
              const style = node.material ? MATERIAL_STYLES[node.material] : PRIMITIVE_STYLES[node.primitive];
              const outcome = liveOutcomes?.[node.id];
              return (
                <li key={node.id}>
                  <button
                    type="button"
                    onClick={() => select(node.id === selected ? undefined : node.id)}
                    aria-pressed={node.id === selected}
                    className={`w-full rounded border px-3 py-2 text-left text-sm ${
                      node.id === selected ? 'border-signal' : 'border-grid-line'
                    }`}
                  >
                    <span className="block font-mono text-[10px] uppercase tracking-widest text-muted">
                      {style.label}
                    </span>
                    <span className="block">{node.label}</span>
                    {outcome ? (
                      <span className="mt-0.5 block font-mono text-[10px] text-telemetry">
                        {[outcome.variant ?? 'outcome', outcome.classification].filter(Boolean).join(' · ')}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="rounded-lg border border-grid-line bg-ink-2 p-4">
          <h3 className="font-mono text-xs uppercase tracking-widest text-muted">Node inspector</h3>
          {selectedNode ? (
            <dl className="mt-3 space-y-3 text-sm">
              <div>
                <dt className="text-xs text-muted">Meaning</dt>
                <dd>{selectedNode.label}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Primitive</dt>
                <dd>
                  {selectedNode.material
                    ? MATERIAL_STYLES[selectedNode.material].label
                    : PRIMITIVE_STYLES[selectedNode.primitive].label}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Source identity</dt>
                <dd className="break-all font-mono text-xs">
                  {selectedNode.sourceId ?? <span className="italic text-muted">Not declared</span>}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Source state</dt>
                <dd>
                  {selectedNode.state.readable}
                  {selectedNode.state.value ? (
                    <span className="ml-2 font-mono text-xs text-muted">({selectedNode.state.value})</span>
                  ) : null}
                </dd>
              </div>
              {liveOutcomes?.[selectedNode.id] ? (
                <div>
                  <dt className="text-xs text-muted">Testified outcome</dt>
                  <dd className="font-mono text-xs">
                    {liveOutcomes[selectedNode.id]?.variant ?? 'outcome'}
                    {liveOutcomes[selectedNode.id]?.classification
                      ? ` · ${liveOutcomes[selectedNode.id]?.classification}`
                      : ''}
                  </dd>
                </div>
              ) : null}
            </dl>
          ) : (
            <p className="mt-3 text-sm text-muted">
              Select a node in the circuit or the outline to read its meaning, source identity and
              declared state.
            </p>
          )}
        </div>

        <div className="rounded-lg border border-grid-line bg-ink-2 p-4">
          <h3 className="font-mono text-xs uppercase tracking-widest text-muted">Legend</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {Object.entries(EDGE_STYLES).map(([family, style]) => (
              <li key={family} className="flex items-center gap-2">
                <svg width="28" height="8" aria-hidden="true">
                  <line
                    x1="0"
                    y1="4"
                    x2="28"
                    y2="4"
                    stroke={style.stroke}
                    strokeWidth="2"
                    strokeDasharray={style.dash === '1 0' ? undefined : style.dash}
                  />
                </svg>
                <span>{style.label}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">
            The token advances only as testimony arrives: node to node along the declared route,
            in cursor order. It is not a spinner — no route is walked without its own observed
            step, and a compiled view with no run shows no token at all. During a live run the
            camera follows the active operation; the drawing itself is never trimmed, so every
            drawn id stays bound and covered.
          </p>
        </div>

        <p className="font-mono text-[10px] leading-relaxed text-muted">
          graph {circuit.graphDigest.slice(7, 19)} · source {circuit.sourceDigest.slice(7, 19)} ·
          renderer {circuit.rendererVersion}
        </p>
      </aside>
    </div>
  );
}
