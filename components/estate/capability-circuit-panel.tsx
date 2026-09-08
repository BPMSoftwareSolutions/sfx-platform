'use client';

import { useEffect, useState } from 'react';

import { CircuitViewer } from '@/components/circuit/circuit-viewer';
import type { CircuitProjection } from '@/contracts/estate';

/**
 * Scenario and node selection — §5.17, §12.4.
 *
 * Selection is shareable URL state, but it is held in component state rather than read through
 * `useSearchParams`. That keeps the circuit and its text outline in the server-rendered HTML, so
 * public reading works without JavaScript; the URL is synchronised after hydration and a shared
 * link restores the same view.
 */
export function CapabilityCircuitPanel({ circuits }: { circuits: CircuitProjection[] }) {
  const first = circuits[0];
  const [scenarioId, setScenarioId] = useState(first?.scenarioId ?? '');
  const [nodeId, setNodeId] = useState<string | undefined>(undefined);

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

  return (
    <div className="circuit-surface">
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

      <CircuitViewer
        circuit={circuit}
        selectedNodeId={nodeId}
        onSelectNode={(next) => {
          setNodeId(next);
          syncUrl(circuit.scenarioId??'', next);
        }}
      />

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
