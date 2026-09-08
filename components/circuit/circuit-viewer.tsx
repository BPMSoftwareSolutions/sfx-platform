'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import type { CircuitProjection } from '@/contracts/estate';

import { layoutCircuit } from './layout';
import { EDGE_STYLES, FIDELITY_COPY, PRIMITIVE_STYLES } from './scl-theme';

/**
 * Circuit viewer — §12.2, §12.4, §6.6.
 *
 * Topology, labels, status and evidence come from the deterministic projection. The viewer adds
 * selection, an equivalent text outline, a legend, a node inspector and opt-in illustrative flow.
 *
 * The SVG and the text outline are both server-rendered, so public reading and the text
 * explanation remain available without JavaScript; only the controls require it.
 */

interface Props {
  circuit: CircuitProjection;
  /** Selection is shareable URL state; the page owns the URL and passes the selection down. */
  selectedNodeId?: string;
  onSelectNode?: (nodeId: string | undefined) => void;
}

export function CircuitViewer({ circuit, selectedNodeId, onSelectNode }: Props) {
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

            {layout.edges.map((edge) => {
              const source = circuit.edges.find((e) => e.id === edge.id);
              const style = EDGE_STYLES[source?.family ?? 'SUPPORT'];
              return (
                <g key={edge.id}>
                  <path
                    d={edge.path}
                    fill="none"
                    stroke={style.stroke}
                    strokeWidth={1.5}
                    strokeDasharray={style.dash === '1 0' ? undefined : style.dash}
                    opacity={0.8}
                  />
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
              const style = PRIMITIVE_STYLES[node.primitive];
              const isSelected = node.id === selected;
              return (
                <g
                  key={node.id}
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
                  <rect
                    x={box.x}
                    y={box.y}
                    width={box.width}
                    height={box.height}
                    rx={node.primitive === 'RESPONSIBILITY' ? 4 : 14}
                    fill={style.fill}
                    stroke={isSelected ? 'var(--color-signal)' : style.stroke}
                    strokeWidth={isSelected ? 2.5 : 1.5}
                    strokeDasharray={node.primitive === 'UNRESOLVED' ? '5 4' : undefined}
                  />
                  <text
                    x={box.x + 14}
                    y={box.y + 20}
                    fill={style.stroke}
                    fontSize={10}
                    fontFamily="var(--font-mono)"
                    letterSpacing="0.08em"
                  >
                    {style.label.toUpperCase()}
                  </text>
                  {box.lines.map((line, index) => (
                    <text
                      key={`${node.id}-line-${index}`}
                      x={box.x + 14}
                      y={box.y + 40 + index * 19}
                      fill={style.text}
                      fontSize={14}
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
              const style = PRIMITIVE_STYLES[node.primitive];
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
                <dd>{PRIMITIVE_STYLES[selectedNode.primitive].label}</dd>
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
