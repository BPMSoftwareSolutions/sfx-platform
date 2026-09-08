'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { TraceGraph } from './plan-trace';
import { useTracePlayer } from './use-trace-player';

/**
 * Topology workbench — ADR 0001.
 *
 * Replaces the sandboxed iframe while keeping every capability the content lab's workbench had:
 * grouped source-view selection, material/base appearance, fit and zoom, SVG export, component
 * search, the outline, the full source inspector, declared-route stepping and illustrative flow.
 *
 * The delivery change is orthogonal to all of that. The diagram is rendered on the server and
 * handed in as `svg`, so geometry never enters the hydration payload — the largest view carries
 * 1,493 components — and the page reads without JavaScript. Everything here adds interaction on
 * top of that rendered SVG.
 */

/** What a component or route needs for the outline, the inspector and route stepping. */
export interface OutlineEntry {
  id: string;
  kind: string;
  label: string;
  detail: string;
  identity: string;
  sourceLabel: string;
  sourceKind: string;
  sourceSha: string;
  sourcePointer: string;
  /** Identity and compiler facts, pretty-printed for the provenance disclosure. */
  facts: string;
  /** Route endpoints, present on routes only. */
  source?: string;
  target?: string;
}

export interface WorkbenchPanel {
  id: string;
  label: string;
  viewKind: string;
  viewKindName: string;
  sourceKind: string;
  graphDigest: string;
  nodeCount: number;
  routeCount: number;
  coverage: string;
  findings: string;
  width: number;
  height: number;
  outline: OutlineEntry[];
  routes: OutlineEntry[];
  view: TraceGraph;
  /** Where this view renders on demand when it was not server-rendered. */
  href: string;
  downloadName: string;
  /** The server-rendered diagram markup, present only for the primary view. */
  svg?: string;
}

const MIN_SCALE = 0.05;
const MAX_SCALE = 2;

export function TopologyWorkbench({ panels, label }: { panels: WorkbenchPanel[]; label: string }) {
  const [activeId, setActiveId] = useState(panels[0]?.id ?? '');
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [fetched, setFetched] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<string | undefined>(undefined);
  const [scale, setScale] = useState(1);
  const [material, setMaterial] = useState(true);
  const [query, setQuery] = useState('');
  const surfaceRef = useRef<HTMLDivElement>(null);

  const active = panels.find((panel) => panel.id === activeId) ?? panels[0];

  const player = useTracePlayer({
    view: active?.view,
    surface: surfaceRef,
    // The trace drives the inspector, so the reader follows what the sphere is reaching.
    onVisit: (nodeId) => setSelectedId(nodeId),
  });

  const selected = active
    ? [...active.outline, ...active.routes].find((entry) => entry.id === selectedId)
    : undefined;

  // A view without a server-rendered diagram is rendered on demand by the topology endpoint.
  useEffect(() => {
    const panel = panels.find((p) => p.id === activeId);
    if (!panel || panel.svg || fetched[activeId]) return;
    let cancelled = false;
    fetch(panel.href)
      .then((response) =>
        response.ok ? response.text() : Promise.reject(new Error(String(response.status))),
      )
      .then((markup) => {
        if (!cancelled) setFetched((current) => ({ ...current, [activeId]: markup }));
      })
      .catch(() => {
        // The diagram is reported as unavailable rather than replaced by another view's picture.
        if (!cancelled) setFailed(activeId);
      });
    return () => {
      cancelled = true;
    };
  }, [activeId, panels, fetched]);

  /** Applies the current zoom to the rendered SVG. */
  useEffect(() => {
    const svg = surfaceRef.current?.querySelector('div:not([hidden]) svg') as SVGElement | null;
    if (!svg || !active) return;
    svg.style.width = `${active.width * scale}px`;
    svg.style.height = `${active.height * scale}px`;
    svg.style.minWidth = '0';
  }, [scale, active, fetched]);

  // Selection marks the server-rendered SVG in place rather than re-rendering it.
  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    for (const marked of surface.querySelectorAll('[data-selected="true"]')) {
      marked.removeAttribute('data-selected');
    }
    if (!selectedId) return;
    surface
      .querySelector(`[data-entity="${CSS.escape(selectedId)}"],[data-route="${CSS.escape(selectedId)}"]`)
      ?.setAttribute('data-selected', 'true');
  }, [selectedId, activeId, fetched]);

  const fit = useCallback(() => {
    const viewport = surfaceRef.current;
    if (!viewport || !active) return;
    setScale(
      Math.min(
        1,
        (viewport.clientWidth - 40) / active.width,
        (viewport.clientHeight - 40) / active.height,
      ),
    );
  }, [active]);

  /** Centres the viewport on a component and zooms in enough to read it. */
  const revealNode = useCallback(
    (nodeId: string) => {
      const viewport = surfaceRef.current;
      const box = active?.view.boxes[nodeId];
      if (!viewport || !box) return;
      const next = Math.max(scale, 0.7);
      setScale(next);
      requestAnimationFrame(() => {
        viewport.scrollLeft = Math.max(0, (box[0] + box[2] / 2) * next - viewport.clientWidth / 2);
        viewport.scrollTop = Math.max(0, (box[1] + box[3] / 2) * next - viewport.clientHeight / 2);
      });
    },
    [active, scale],
  );

  const select = useCallback(
    (id: string | undefined, reveal = false) => {
      // §12.4 — inspecting a component pauses the trace rather than fighting it.
      player.pause();
      setSelectedId(id);
      if (id && reveal) revealNode(id);
    },
    [player, revealNode],
  );

  const pick = (event: React.MouseEvent | React.KeyboardEvent) => {
    const target = (event.target as Element).closest('[data-entity],[data-route]');
    if (!target) return;
    const id = target.getAttribute('data-entity') ?? target.getAttribute('data-route');
    if (!id) return;
    select(selectedId === id ? undefined : id);
  };

  /** Declared routes leaving the selected component. A support link is not execution (§12.3). */
  const outgoing = useMemo(() => {
    if (!active || !selectedId) return [];
    return active.routes.filter((r) => r.source === selectedId && r.kind !== 'Provider binding');
  }, [active, selectedId]);

  const filteredOutline = useMemo(() => {
    if (!active) return [];
    const needle = query.trim().toLowerCase();
    if (!needle) return active.outline;
    return active.outline.filter((entry) =>
      `${entry.identity} ${entry.label} ${entry.detail}`.toLowerCase().includes(needle),
    );
  }, [active, query]);

  /** Exports the base diagram: material plates are a treatment, not the drawing. */
  const download = useCallback(() => {
    if (!active) return;
    const markup = active.svg ?? fetched[active.id];
    if (!markup) return;
    const doc = new DOMParser().parseFromString(markup, 'image/svg+xml');
    for (const image of doc.querySelectorAll('image')) image.remove();
    const url = URL.createObjectURL(
      new Blob([new XMLSerializer().serializeToString(doc)], { type: 'image/svg+xml' }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = active.downloadName;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [active, fetched]);

  if (!active) return null;

  const grouped = Object.entries(
    panels.reduce<Record<string, WorkbenchPanel[]>>((groups, panel) => {
      (groups[panel.viewKindName] ??= []).push(panel);
      return groups;
    }, {}),
  );

  const guidance =
    active.viewKind === 'expression'
      ? 'Arrows show named expression dependencies; conditional arguments remain distinct.'
      : 'Select a component, then follow its declared routes.';

  return (
    <div className={`topology-workbench${material ? '' : ' base'}`}>
      <div className="topology-toolbar">
        {panels.length > 1 ? (
          <>
            <label htmlFor="topology-view" className="topology-toolbar-label">
              Source view ({panels.length})
            </label>
            <select
              id="topology-view"
              value={active.id}
              onChange={(event) => {
                setSelectedId(undefined);
                setActiveId(event.target.value);
                setScale(1);
              }}
            >
              {grouped.map(([groupName, groupPanels]) => (
                <optgroup key={groupName} label={groupName}>
                  {groupPanels.map((panel) => (
                    <option key={panel.id} value={panel.id}>
                      {panel.label} · {panel.nodeCount} components / {panel.routeCount} routes
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </>
        ) : (
          <span className="topology-toolbar-label">{active.label}</span>
        )}
        <span className="topology-count">
          {active.viewKindName} · {active.coverage}
        </span>
      </div>

      <div className="topology-toolbar topology-view-controls">
        <div className="topology-button-group">
          <button type="button" aria-pressed={material} onClick={() => setMaterial(true)}>
            Material
          </button>
          <button type="button" aria-pressed={!material} onClick={() => setMaterial(false)}>
            Base SVG
          </button>
        </div>
        <div className="topology-button-group">
          <button type="button" onClick={fit}>
            Fit diagram
          </button>
          <button type="button" onClick={() => setScale(1)}>
            Read at 100%
          </button>
          <button
            type="button"
            aria-label="Zoom out"
            onClick={() => setScale((s) => Math.max(MIN_SCALE, s / 1.3))}
          >
            −
          </button>
          <output className="topology-zoom">{Math.round(scale * 100)}%</output>
          <button
            type="button"
            aria-label="Zoom in"
            onClick={() => setScale((s) => Math.min(MAX_SCALE, s * 1.3))}
          >
            +
          </button>
          <button type="button" onClick={download}>
            Download SVG
          </button>
        </div>
      </div>

      {/* Illustrative flow — §12.4. Starts only on request and invokes no provider. */}
      <div className="topology-flow">
        <button type="button" className="trace-primary" onClick={() => player.toggle(selectedId)}>
          {player.state === 'playing'
            ? 'Pause trace'
            : player.state === 'complete'
              ? 'Replay trace'
              : player.state === 'paused'
                ? 'Resume trace'
                : 'Trace flow'}
        </button>
        <button type="button" onClick={player.stepOnce}>
          Next step
        </button>
        <button
          type="button"
          onClick={() => {
            player.reset();
            setSelectedId(undefined);
          }}
        >
          Reset
        </button>
        <label className="trace-control">
          Speed
          <select
            aria-label="Trace speed"
            value={player.speed}
            onChange={(event) => player.setSpeed(Number(event.target.value))}
          >
            {[1, 4, 16, 64].map((value) => (
              <option key={value} value={value}>
                {value}×
              </option>
            ))}
          </select>
        </label>
        <label className="trace-control">
          <input
            type="checkbox"
            checked={player.follow}
            onChange={(event) => player.setFollow(event.target.checked)}
          />
          Follow flow
        </label>
        <p className="trace-status" role="status" data-state={player.state}>
          {player.status || guidance}
        </p>
      </div>

      <div className="topology-main">
        <div
          ref={surfaceRef}
          className="topology-surface"
          role="group"
          tabIndex={0}
          aria-label={`${label} — scrollable source diagram`}
          onClick={pick}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            if (!(event.target as Element).closest('[data-entity],[data-route]')) return;
            event.preventDefault();
            pick(event);
          }}
        >
          {panels.map((panel) => {
            const markup = panel.svg ?? fetched[panel.id];
            if (!markup) return null;
            return (
              <div
                key={panel.id}
                hidden={panel.id !== active.id}
                dangerouslySetInnerHTML={{ __html: markup }}
              />
            );
          })}
          {!active.svg && !fetched[active.id] ? (
            <p className="topology-loading" role="status">
              {failed === active.id
                ? 'This view could not be rendered. Its diagram is not shown rather than substituting another.'
                : 'Rendering this view…'}
            </p>
          ) : null}
        </div>

        <aside className="topology-aside">
          <label className="topology-search">
            Find a component
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Identity, mechanic, or responsibility"
            />
          </label>
          <nav className="topology-outline" aria-label="Diagram components">
            <ol>
              {filteredOutline.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    aria-pressed={entry.id === selectedId}
                    onClick={() => select(entry.id === selectedId ? undefined : entry.id, true)}
                  >
                    <span className="topology-outline-kind">{entry.kind}</span>
                    <span>{entry.label}</span>
                  </button>
                </li>
              ))}
              {filteredOutline.length === 0 ? (
                <li className="topology-empty">No component matches.</li>
              ) : null}
            </ol>
          </nav>
        </aside>
      </div>

      {/* Declared routes leaving the selection, stepped one at a time. */}
      {selectedId && active.outline.some((n) => n.id === selectedId) ? (
        <div className="topology-routes" aria-label="Outgoing routes">
          <p className="topology-routes-status">
            {outgoing.length === 0
              ? 'End of this declared path.'
              : outgoing.length > 1
                ? 'Choose a declared route to follow. Alternatives are not executed by this diagram.'
                : 'One declared continuation.'}
          </p>
          {outgoing.map((route) => (
            <button key={route.id} type="button" onClick={() => select(route.target, true)}>
              {route.label || route.kind} →{' '}
              {active.outline.find((n) => n.id === route.target)?.label ?? route.target}
            </button>
          ))}
        </div>
      ) : null}

      <section className="topology-inspection">
        <div>
          <p className="topology-eyebrow">{selected ? selected.kind : 'Inspect the source'}</p>
          <h3>
            {selected ? selected.label || selected.identity : 'Every component keeps its identity.'}
          </h3>
          <p className="topology-detail">
            {selected
              ? selected.detail || selected.kind
              : 'Select a shape or route to inspect its responsibility, contracts and exact source.'}
          </p>
        </div>
        <div>
          {selected ? (
            <details>
              <summary>Identity, contracts and provenance</summary>
              <pre>{selected.facts}</pre>
              <p className="topology-mono">
                {selected.sourceLabel} · SHA-256 {selected.sourceSha} · {selected.sourcePointer}
              </p>
            </details>
          ) : null}
          {active.findings ? <p className="topology-findings">{active.findings}</p> : null}
          <p className="topology-evidence">
            Declared topology. Tracing illustrates source relationships; it does not run providers
            or establish execution evidence.
          </p>
          <p className="topology-provenance">
            graph {active.graphDigest.slice(0, 12)} · source {active.sourceKind}
          </p>
        </div>
      </section>
    </div>
  );
}
