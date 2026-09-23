'use client';

import { useEffect, useRef, useState } from 'react';

import { CircuitViewer } from '@/components/circuit/circuit-viewer';
import type { CircuitProjection } from '@/contracts/estate';
import { runGraphViewProjection } from '@/lib/run-graph';
import { CircuitFrame } from './circuit-frame';
import { useLiveRunOptional, type LiveRunView } from './live-run';

/**
 * Scenario and node selection — §5.17, §12.4, trace plan §4.3.
 *
 * The trace surface is the run's declared public graph, drawn planned and lit only by its own
 * testimony. An authored bundle is never the trace surface: it renders only as a labelled
 * comparison candidate beside the trace, with its provenance stated. The declared boundary
 * projection remains the static surface before any run exists.
 *
 * Selection is shareable URL state, but it is held in component state rather than read through
 * `useSearchParams`. That keeps the circuit and its text outline in the server-rendered HTML, so
 * public reading works without JavaScript; the URL is synchronised after hydration and a shared
 * link restores the same view.
 */
export function CapabilityCircuitPanel({ circuits, liveOverride }: { circuits: CircuitProjection[]; liveOverride?: LiveRunView }) {
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

  if (!circuit) {
    return (
      <div className="rounded-lg border border-failure/40 bg-ink-2 p-5 text-sm text-muted">
        No circuit projection was published for this capability in this generation. The capability
        record is shown without a circuit rather than substituting another capability&rsquo;s graph.
      </div>
    );
  }

  // §12.2 — an authored bundle is a teaching/comparison artifact. It is labelled as such and is
  // never rendered as the trace surface.
  const renderer = circuit.renderer;
  const authoredUrl = renderer?.kind === 'AUTHORED_CIRCUIT' && renderer.url ? renderer.url : null;
  const absent = circuit.diagnostics.some((d) => d.code === 'NO_AUTHORED_CIRCUIT');

  const graphView = live?.graph;
  const trace = graphView
    ? runGraphViewProjection(graphView, { capabilityId: circuit.capabilityId, scenarioId: circuit.scenarioId })
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
          title={`${circuit.capabilityId} / ${circuit.scenarioId ?? 'capability'} — authored comparison candidate`}
        />
        <p className="mt-2 text-xs text-muted">
          Authored bundle from the live topology ({renderer?.subjectKind?.toLowerCase()} bundle{' '}
          {renderer?.bundleRevision?.slice(0, 12)}…{renderer?.topologyViews ? ` · ${renderer.topologyViews} views` : ''}).
          Provenance: authored, not observed. The trace beside it lights only from this run&rsquo;s testimony.
        </p>
      </div>
    </details>
  ) : null;

  return (
    <div className="circuit-surface" ref={rootRef}>
      {circuits.length > 1 ? (
        <div className="mb-4">
          <label
            htmlFor="scenario-select"
            className="block font-mono text-xs uppercase tracking-widest text-muted"
          >
            Scenario ({circuits.length})
          </label>
          <select
            id="scenario-select"
            value={circuit.scenarioId??''}
            onChange={(event) => {
              // A scenario change clears a node selection belonging to the previous scenario.
              setScenarioId(event.target.value);
              setNodeId(undefined);
              syncUrl(event.target.value, undefined);
            }}
            className="mt-2 w-full max-w-xl rounded border border-grid-line bg-ink px-3 py-2 text-sm"
          >
            {circuits.map((c) => (
              <option key={c.scenarioId??'overview'} value={c.scenarioId??''}>
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
            only from its own edge testimony. Nothing is inferred from process exit or elapsed time.
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
            liveNodes={live?.states}
            liveEdges={live?.edgeStates}
            onSelectNode={(next) => {
              setNodeId(next);
              syncUrl(circuit.scenarioId??'', next);
            }}
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
      ) : (
        <>
          {absent ? (
            <div className="mb-3 rounded-lg border border-failure/40 bg-ink-2 p-4 text-sm text-muted" role="status">
              No authored circuit bundle is published for this capability in this generation. The
              live topology read records this absence as a validation error; the source-backed
              boundary contract below is shown explicitly and is not a substitute circuit.
            </div>
          ) : null}
          <CircuitViewer
            circuit={circuit}
            selectedNodeId={nodeId}
            liveNodes={live?.states}
            liveEdges={live?.edgeStates}
            onSelectNode={(next) => {
              setNodeId(next);
              syncUrl(circuit.scenarioId??'', next);
            }}
          />
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
                  <a href={`?scenario=${encodeURIComponent(c.scenarioId??'')}`} className="text-sm text-signal underline">
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
