'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import type { CircuitProjection, MaterialToken } from '@/contracts/estate';

import { layoutCircuit } from './layout';
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
 * selection, an equivalent text outline, a legend, a node inspector and opt-in illustrative flow.
 *
 * A node carrying a canonical `material` is drawn as the component plate inside its defining
 * shape, with the state affordances layered over the material — the observed class never replaces
 * what the component is. Nodes without a material (authored projections) keep the primitive rect.
 *
 * The SVG and the text outline are both server-rendered, so public reading and the text
 * explanation remain available without JavaScript; only the controls require it.
 */

/** Observed execution state for one node, applied as an explicit class and data attribute. */
export type LiveNodeState = 'planned' | 'active' | 'done' | 'failed';

/** `url(#…)` fragments must not carry cell-id punctuation. */
const fragmentId = (value: string) => `circuit-${value.replace(/[^a-zA-Z0-9]+/g, '-')}`;
const clipId = (nodeId: string) => fragmentId(`clip-${nodeId}`);
const edgePatternId = (token: string) => fragmentId(`edge-${token}`);

interface Props {
  circuit: CircuitProjection;
  /** Selection is shareable URL state; the page owns the URL and passes the selection down. */
  selectedNodeId?: string;
  onSelectNode?: (nodeId: string | undefined) => void;
  /** Live trace overlay: node id to observed state. Declared route is never recoloured as observed otherwise. */
  liveNodes?: Partial<Record<string, LiveNodeState>>;
  /** Live trace overlay for drawn edges: edge id to observed state. */
  liveEdges?: Partial<Record<string, LiveNodeState>>;
  /** Canonical material token to its published `/media/materials/...` asset. */
  materials?: Record<string, string>;
}

export function CircuitViewer({ circuit, selectedNodeId, onSelectNode, liveNodes, liveEdges, materials }: Props) {
  const layout = useMemo(() => layoutCircuit(circuit), [circuit]);
  const [internalSelection, setInternalSelection] = useState<string | undefined>(undefined);
  const [playing, setPlaying] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const selected = selectedNodeId ?? internalSelection;
  const select = (id: string | undefined) => {
    // §12.4 — node inspection pauses playback.
    setPlaying(false);
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

  useEffect(() => {
    if (!playing) return;
    // §12.4 — hiding or leaving the page stops motion.
    const onVisibility = () => {
      if (document.hidden) setPlaying(false);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [playing]);

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
            <button
              type="button"
              onClick={() => setPlaying((v) => !v)}
              aria-pressed={playing}
              className="rounded border border-grid-line px-3 py-1 text-xs hover:border-signal"
            >
              {playing ? 'Pause flow' : 'Play flow'}
            </button>
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
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            width="100%"
            role="img"
            aria-labelledby={`${titleId} ${descId}`}
            className="min-w-[520px]"
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
                  {playing && !reducedMotion ? (
                    // Illustrative flow only. It follows the exact compiled path (§12.4).
                    <circle r={5} fill="var(--color-text)" opacity={0.9}>
                      <animateMotion dur="1.6s" repeatCount="indefinite" path={edge.path} />
                    </circle>
                  ) : null}
                  {playing && reducedMotion ? (
                    <circle
                      cx={edge.midpoint.x}
                      cy={edge.midpoint.y}
                      r={5}
                      fill="var(--color-text)"
                      opacity={0.9}
                    />
                  ) : null}
                </g>
              );
            })}

            {circuit.nodes.map((node) => {
              const box = layout.nodeById[node.id];
              if (!box) return null;
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
              return (
                <g
                  key={node.id}
                  className={live ? `circuit-node circuit-node--${live}` : 'circuit-node'}
                  data-live={live}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  aria-label={`${style.label}: ${node.label}`}
                  onClick={() => select(isSelected ? undefined : node.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      select(isSelected ? undefined : node.id);
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  {geometry && plateUrl && crop ? (
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
                </g>
              );
            })}
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
            Playback is labelled <strong>illustrative flow</strong>. It shows the declared route
            order; it is not observed execution and invokes no provider.
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
