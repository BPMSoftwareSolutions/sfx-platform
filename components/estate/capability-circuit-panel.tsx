'use client';

import { useEffect, useRef, useState } from 'react';

import {
  CircuitViewer,
  type LiveNodeState as ViewerLiveState,
  type LiveTrailStep as ViewerTrailStep,
} from '@/components/circuit/circuit-viewer';
import type { CircuitProjection } from '@/contracts/estate';
import { testimonyTrail, type LiveNodeState } from '@/lib/live-trace';
import { runGraphViewProjection, type CapabilityGraphSurface } from '@/lib/run-graph';
import { CircuitFrame } from './circuit-frame';
import { useLiveRunOptional, type LiveRunView } from './live-run';

/**
 * The viewer declares its drawn-state vocabulary as the four resting states. The trace carries
 * one more — `held`, a declared non-success attempt superseded by a later route — and the viewer
 * renders whatever state it is handed as a `circuit-node--<state>` / `data-live` pair. The
 * literals pass through unchanged; the cast names that contract at the binding boundary until the
 * viewer's local union is replaced by the trace's own type (layout lane).
 */
function viewerStates(states: Record<string, LiveNodeState> | undefined): Partial<Record<string, ViewerLiveState>> | undefined {
  return states as Partial<Record<string, ViewerLiveState>> | undefined;
}

function viewerTrail(steps: Array<{ id: string; state: LiveNodeState }>): ViewerTrailStep[] {
  return steps as ViewerTrailStep[];
}

/**
 * Scenario and node selection — §5.17, §12.4, trace plan §4.3.
 *
 * The trace surface is the engine's compiled execution graph: fetched server-side for the
 * capability and drawn planned and unlit when no run exists, then lit only by its own testimony
 * during a run. An authored bundle is never the trace surface: it renders only as a labelled
 * comparison candidate, with its provenance stated. A capability whose graph the engine cannot
 * compile shows the engine's own reason — never a boundary lens or any other substitute circuit.
 *
 * Selection is shareable URL state, but it is held in component state rather than read through
 * `useSearchParams`. That keeps the circuit and its text outline in the server-rendered HTML, so
 * public reading works without JavaScript; the URL is synchronised after hydration and a shared
 * link restores the same view.
 */
export function CapabilityCircuitPanel({
  circuits,
  capabilityGraph,
  liveOverride,
  materials,
}: {
  circuits: CircuitProjection[];
  /** The compiled capability graph (no run) or the engine's compile failure, from the server. */
  capabilityGraph?: CapabilityGraphSurface;
  liveOverride?: LiveRunView;
  /** Canonical material token to its published `/media/materials/...` asset. */
  materials?: Record<string, string>;
}) {
  const first = circuits[0];
  const [scenarioId, setScenarioId] = useState(first?.scenarioId ?? '');
  const [nodeId, setNodeId] = useState<string | undefined>(undefined);
  const rootRef = useRef<HTMLDivElement>(null);
  const contextLive = useLiveRunOptional();
  const live = liveOverride ?? contextLive;

  const traceActive = Boolean(live?.graph || (live && Object.keys(live.states).length > 0));
  useEffect(() => {
    if (traceActive) rootRef.current?.closest('details')?.setAttribute('open', '');
  }, [traceActive]);

  // Restore a shared selection once the URL is available in the browser.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const scenario = params.get('scenario');
    if (scenario && circuits.some((c) => c.scenarioId === scenario)) setScenarioId(scenario);
    const node = params.get('node');
    if (node) setNodeId(node);
  }, [circuits]);

  const syncUrl = (nextScenario: string, nextNode: string | undefined) => {
    const params = new URLSearchParams(window.location.search);
    params.set('scenario', nextScenario);
    if (nextNode) params.set('node', nextNode);
    else params.delete('node');
    // replaceState keeps the shareable URL current without a navigation or a scroll jump.
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
  };

  const circuit = circuits.find((c) => c.scenarioId === scenarioId) ?? first;

  // §12.2 — an authored bundle is a teaching/comparison artifact. It is labelled as such and is
  // never rendered as the trace surface.
  const renderer = circuit?.renderer;
  const authoredUrl = renderer?.kind === 'AUTHORED_CIRCUIT' && renderer.url ? renderer.url : null;

  const graphView = live?.graph;
  const trace = graphView
    ? runGraphViewProjection(graphView, {
        capabilityId: circuit?.capabilityId ?? graphView.graphId,
        scenarioId: circuit?.scenarioId ?? null,
      })
    : undefined;

  const authoredComparison = authoredUrl ? (
    <details className="authored-comparison mt-4 rounded-lg bg-ink-2 p-4">
      <summary className="font-display text-sm font-semibold">
        Authored circuit — labelled comparison candidate (not observed execution)
      </summary>
      <div className="mt-3">
        <CircuitFrame
          key={authoredUrl}
          src={authoredUrl}
          title={`${circuit?.capabilityId ?? ''} / ${circuit?.scenarioId ?? 'capability'} — authored comparison candidate`}
        />
        <p className="mt-2 text-xs text-muted">
          Authored bundle from the live topology ({renderer?.subjectKind?.toLowerCase()} bundle{' '}
          {renderer?.bundleRevision?.slice(0, 12)}…{renderer?.topologyViews ? ` · ${renderer.topologyViews} views` : ''}).
          Provenance: authored, not observed. The trace lights only from a run&rsquo;s testimony; this bundle is never it.
        </p>
      </div>
    </details>
  ) : null;

  const selectNode = (next: string | undefined) => {
    setNodeId(next);
    syncUrl(circuit?.scenarioId ?? '', next);
  };

  return (
    <div className="circuit-surface" ref={rootRef}>
      {circuits.length > 1 ? (
        <div className="mb-4">
          <label
            htmlFor="scenario-select"
            className="block font-mono text-xs uppercase tracking-widest text-muted"
          >
            Scenario comparison ({circuits.length})
          </label>
          <select
            id="scenario-select"
            value={circuit?.scenarioId ?? ''}
            onChange={(event) => {
              // A scenario change clears a node selection belonging to the previous scenario.
              setScenarioId(event.target.value);
              setNodeId(undefined);
              syncUrl(event.target.value, undefined);
            }}
            className="mt-2 w-full max-w-xl rounded border border-grid-line bg-ink px-3 py-2 text-sm"
          >
            {circuits.map((c) => (
              <option key={c.scenarioId ?? 'overview'} value={c.scenarioId ?? ''}>
                {c.scenarioId}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {trace && graphView ? (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded border border-signal/50 px-2 py-0.5 font-mono text-xs text-signal">
              Live execution trace
            </span>
            <span className="font-mono text-xs text-muted">
              run {live?.runId?.slice(0, 8)} · {graphView.nodes.length} of {graphView.totalCells} cells drawn
              {graphView.collapsed ? ` · collapsed at limit ${graphView.detailCellLimit}` : ''}
            </span>
          </div>
          <p className="mb-3 text-sm text-muted">
            Every drawn cell is planned and unlit until its own testimony arrives; an edge lights
            only from its own edge testimony, and the token walks that observed trail in cursor
            order. Nothing is inferred from process exit or elapsed time.
          </p>
          {live?.graphError ? (
            <div className="mb-3 rounded-lg border border-failure/40 bg-ink-2 p-4 text-sm text-muted" role="status">
              The run graph was not served for this run ({live.graphError.code}). The trace cannot
              bind by cell id, so no node is lit from these events.
            </div>
          ) : null}
          <CircuitViewer
            circuit={trace}
            selectedNodeId={nodeId}
            liveNodes={viewerStates(live?.states)}
            liveEdges={viewerStates(live?.edgeStates)}
            liveTrail={viewerTrail(testimonyTrail(live?.transitions ?? []))}
            onSelectNode={selectNode}
            materials={materials}
          />
          {live && live.unmatched.length > 0 ? (
            <details className="mt-4 rounded-lg border border-failure/40 bg-ink-2 p-4">
              <summary className="cursor-pointer font-display text-sm font-semibold">
                Unmatched testimony ({live.unmatched.length}) — no node in this run graph
              </summary>
              <p className="mt-3 text-sm text-muted">
                These ids were observed on the lane but carry no membership in the run graph. They
                are shown here rather than dropped, and they never light a node.
              </p>
              <ul className="mt-2 space-y-1 font-mono text-xs text-muted">
                {live.unmatched.map((id) => <li key={id}>{id}</li>)}
              </ul>
            </details>
          ) : null}
          {authoredComparison}
        </>
      ) : capabilityGraph && 'projection' in capabilityGraph ? (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded border border-telemetry/50 px-2 py-0.5 font-mono text-xs text-telemetry">
              Compiled execution graph
            </span>
            <span className="font-mono text-xs text-muted">
              {capabilityGraph.stats.drawnNodes} of {capabilityGraph.stats.totalCells} cells drawn ·{' '}
              {capabilityGraph.stats.drawnEdges} of {capabilityGraph.stats.totalEdges} routes
              {capabilityGraph.stats.collapsed ? ` · collapsed at limit ${capabilityGraph.stats.detailCellLimit}` : ''} · no run
            </span>
          </div>
          <p className="mb-3 text-sm text-muted">
            This is the execution graph the engine compiled for this capability, with no run
            observed. Every drawn cell is planned and unlit; a cell lights only when a run&rsquo;s
            own testimony arrives, and nothing is inferred from compilation.
          </p>
          <CircuitViewer
            circuit={capabilityGraph.projection}
            selectedNodeId={nodeId}
            liveNodes={Object.fromEntries(
              capabilityGraph.projection.nodes.map((node) => [node.id, 'planned' as const])
            )}
            onSelectNode={selectNode}
            materials={materials}
          />
          {authoredComparison}
        </>
      ) : (
        <>
          <div className="rounded-lg border border-failure/40 bg-ink-2 p-5 text-sm text-muted" role="status">
            <p className="font-display text-sm font-semibold">
              The engine could not compile this capability&rsquo;s execution graph.
            </p>
            {capabilityGraph && 'error' in capabilityGraph ? (
              <p className="mt-2">
                Engine reason <span className="font-mono text-xs">{capabilityGraph.error.code}</span>:{' '}
                {capabilityGraph.error.message}
              </p>
            ) : (
              <p className="mt-2">No compiled graph was served for this capability.</p>
            )}
            <p className="mt-2 text-xs">
              No substitute circuit is shown. Authored bundles, when this generation publishes them,
              appear only below and are labelled comparison candidates.
            </p>
          </div>
          {authoredComparison}
        </>
      )}

      {/* Without JavaScript the select above cannot switch scenarios; these links can. */}
      {circuits.length > 1 ? (
        <noscript>
          <nav aria-label="All scenarios" className="mt-4 rounded-lg border border-grid-line bg-ink-2 p-4">
            <h3 className="font-mono text-xs uppercase tracking-widest text-muted">All scenarios</h3>
            <ul className="mt-2 space-y-1">
              {circuits.map((c) => (
                <li key={c.scenarioId}>
                  <a href={`?scenario=${encodeURIComponent(c.scenarioId ?? '')}`} className="text-sm text-signal underline">
                    {c.scenarioId}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </noscript>
      ) : null}
    </div>
  );
}
