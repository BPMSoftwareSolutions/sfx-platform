'use client';

import { useEffect, useRef, useState } from 'react';

import { CircuitViewer } from '@/components/circuit/circuit-viewer';
import type { CircuitProjection } from '@/contracts/estate';
import { CircuitFrame } from './circuit-frame';
import { useLiveRunOptional } from './live-run';

/**
 * Scenario and node selection — §5.17, §12.4.
 *
 * Selection is shareable URL state, but it is held in component state rather than read through
 * `useSearchParams`. That keeps the circuit and its text outline in the server-rendered HTML, so
 * public reading works without JavaScript; the URL is synchronised after hydration and a shared
 * link restores the same view.
 *
 * Live run state is applied to the nodes as explicit classes. When this panel sits inside a
 * collapsed disclosure, an admitted run opens it so the observed trace is visible.
 */
export function CapabilityCircuitPanel({ circuits }: { circuits: CircuitProjection[] }) {
  const first = circuits[0];
  const [scenarioId, setScenarioId] = useState(first?.scenarioId ?? '');
  const [nodeId, setNodeId] = useState<string | undefined>(undefined);
  const rootRef = useRef<HTMLDivElement>(null);
  const live = useLiveRunOptional();
  const liveNodes = live?.states;

  const traceActive = Boolean(live && (live.phase === 'admitting' || live.phase === 'polling' || Object.keys(live.states).length > 0));
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

  // §12.2 — the live topology decides the renderer. An authored circuit bundle is rendered as
  // the authored circuit; the source-backed boundary outline stays available as its text
  // equivalent. A boundary projection must state that no authored circuit exists.
  const renderer = circuit.renderer;
  const authoredUrl = renderer?.kind === 'AUTHORED_CIRCUIT' && renderer.url ? renderer.url : null;
  const absent = circuit.diagnostics.some((d) => d.code === 'NO_AUTHORED_CIRCUIT');

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

      {authoredUrl ? (
        <>
          <CircuitFrame
            key={authoredUrl}
            src={authoredUrl}
            title={`${circuit.capabilityId} / ${circuit.scenarioId ?? 'capability'} — authored circuit`}
          />
          <p className="mt-2 text-xs text-muted">
            Authored circuit from the live topology ({renderer?.subjectKind?.toLowerCase()} bundle{' '}
            {renderer?.bundleRevision?.slice(0, 12)}…{renderer?.topologyViews ? ` · ${renderer.topologyViews} views` : ''}).
          </p>
          <details className="mt-3 rounded-lg border border-grid-line bg-ink-2 p-4">
            <summary className="cursor-pointer font-display text-sm font-semibold">
              Source-backed boundary outline
            </summary>
            <div className="mt-3">
              <CircuitViewer
                circuit={circuit}
                selectedNodeId={nodeId}
                liveNodes={liveNodes}
                onSelectNode={(next) => {
                  setNodeId(next);
                  syncUrl(circuit.scenarioId??'', next);
                }}
              />
            </div>
          </details>
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
            liveNodes={liveNodes}
            onSelectNode={(next) => {
              setNodeId(next);
              syncUrl(circuit.scenarioId??'', next);
            }}
          />
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
