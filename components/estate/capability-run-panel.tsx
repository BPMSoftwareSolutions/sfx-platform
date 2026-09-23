'use client';

import { useId, useMemo, useState } from 'react';

import type { JsonSchema } from '@/contracts/input-contract';
import { initialDocument, objectProperties, requiredKeys } from '@/lib/json-schema-form';
import { childPath, hasInvalidDraft, parseDraft, removeItemDrafts, type JsonDrafts, type JsonEditor } from '@/lib/json-drafts';
import { useLiveRun, type LiveRunView } from './live-run';
import { SchemaField } from './schema-field';

/**
 * Capability run panel — §13.1, SDA run API v1.
 *
 * Input is composed either as a form generated from the capability's own declared contract, or
 * as raw JSON. Nothing executes until the visitor presses Run: admission starts a run, the
 * observation lane advances by cursor and the circuit nodes take their live state from the
 * events. The result shown is the run's own terminal state and lean scenario output.
 */

interface Props {
  namespace: string;
  capabilityId: string;
  contractId: string | null;
  schema: JsonSchema | null;
  example: string | null;
}

type Mode = 'form' | 'raw';

export function CapabilityRunPanel({ namespace, capabilityId, contractId, schema, example }: Props) {
  const baseId = useId();
  const live = useLiveRun();

  const seed = useMemo(() => {
    if (example) { try { return JSON.parse(example) as unknown; } catch { /* fall through */ } }
    return initialDocument(schema);
  }, [example, schema]);

  const [mode, setMode] = useState<Mode>(schema ? 'form' : 'raw');
  const [document, setDocument] = useState<unknown>(seed);
  const [raw, setRaw] = useState(() => JSON.stringify(seed, null, 2));
  const [rawError, setRawError] = useState<string | undefined>();
  const [drafts, setDrafts] = useState<JsonDrafts>({});
  const invalidInput = !!rawError || hasInvalidDraft(drafts);
  const editor: JsonEditor = {
    drafts,
    edit(path, text, commit) {
      const parsed = parseDraft(text);
      setDrafts(previous => ({ ...previous, [path]: parsed.draft }));
      if (!parsed.draft.error) commit(parsed.value);
    },
    removeItem(path, index) { setDrafts(previous => removeItemDrafts(previous, path, index)); },
  };

  const pending = live.phase === 'admitting' || live.phase === 'polling';

  /** The document is the single value; each mode is a view of it. */
  const toMode = (next: Mode) => {
    if (next === mode || invalidInput) return;
    if (next === 'raw') setRaw(JSON.stringify(document, null, 2));
    else {
      try { setDocument(JSON.parse(raw)); setRawError(undefined); }
      catch (error) { setRawError(error instanceof Error ? error.message : 'Invalid JSON'); return; }
    }
    setMode(next);
    setDrafts({});
  };

  const editRaw = (text: string) => {
    setRaw(text);
    try { setDocument(JSON.parse(text)); setRawError(undefined); }
    catch (error) { setRawError(error instanceof Error ? error.message : 'Invalid JSON'); }
  };

  const execute = () => {
    if (invalidInput || pending) return;
    const payload = mode === 'raw' ? raw : JSON.stringify(document);
    live.admit(namespace, capabilityId, payload);
  };

  const properties = schema ? objectProperties(schema) : [];
  const required = schema ? requiredKeys(schema) : new Set<string>();
  const current = (document && typeof document === 'object' && !Array.isArray(document)
    ? document : {}) as Record<string, unknown>;

  return (
    <div className="invocation-panel">
      <div className="body-modes" role="radiogroup" aria-label="Input body">
        {(['form', 'raw'] as const).map(option => (
          <label key={option} className="body-mode">
            <input
              type="radio"
              name={`${baseId}-mode`}
              value={option}
              checked={mode === option}
              disabled={(option === 'form' && !schema) || (option !== mode && invalidInput)}
              onChange={() => toMode(option)}
            />
            <span>{option === 'form' ? 'form' : 'raw'}</span>
          </label>
        ))}
        <span className="body-mode-contract">
          {contractId
            ? <>JSON · <code>{contractId}</code></>
            : <>JSON · no input contract declared for this generation</>}
        </span>
      </div>

      {mode === 'form' && schema ? (
        <div className="schema-form">
          {properties.length ? properties.map(([key, child]) => (
            <SchemaField
              key={key}
              schema={child}
              root={schema}
              label={key}
              required={required.has(key)}
              path={childPath('', key)}
              editor={editor}
              value={current[key]}
              onChange={next => setDocument({ ...current, [key]: next })}
            />
          )) : (
            <p className="invocation-note">
              This contract declares no named properties, so there is nothing to lay out as fields.
              Use raw to supply its input.
            </p>
          )}
        </div>
      ) : (
        <label className="invocation-input" htmlFor={`${baseId}-raw`}>
          <span className="kicker">Raw JSON</span>
          <textarea
            id={`${baseId}-raw`}
            value={raw}
            spellCheck={false}
            rows={12}
            onChange={event => editRaw(event.target.value)}
            aria-describedby={`${baseId}-contract`}
            aria-invalid={rawError ? true : undefined}
          />
        </label>
      )}

      <p className="invocation-note" id={`${baseId}-contract`}>
        {rawError ? <strong>Not valid JSON: {rawError}. </strong> : null}
        {contractId
          ? <>Admitted against <code>{contractId}</code> by the capability&apos;s own contract before anything executes. An input it refuses is reported as refused, not corrected.</>
          : <>Admitted by the capability&apos;s own contract before anything executes.</>}
      </p>

      <div className="action-row">
        <button className="button-primary" type="button" onClick={execute} disabled={pending || invalidInput}>
          {pending ? 'Executing…' : 'Run this capability'} <span aria-hidden="true">→</span>
        </button>
      </div>

      <p aria-live="polite" className="invocation-status">{statusLine(live)}</p>

      {live.phase === 'failed' && live.error ? <Failure error={live.error} /> : null}
      {live.phase === 'complete' ? <LiveResult view={live} /> : null}
    </div>
  );
}

function statusLine(live: LiveRunView): string {
  if (live.phase === 'admitting') return 'Admitting the run…';
  if (live.phase === 'polling') return `Executing — ${live.events.length} events observed so far.`;
  if (live.phase === 'complete') return `Run complete — ${live.events.length} events observed.`;
  if (live.phase === 'failed') return live.error ? `Not executed — ${live.error.code}.` : 'Execution unconfirmed.';
  return '';
}

function Failure({ error }: { error: { code: string; message: string } }) {
  return (
    <div className="invocation-result invocation-result--refused">
      <p className="kicker">Run refused or unconfirmed · {error.code}</p>
      <p>{error.message}</p>
    </div>
  );
}

function messageOf(output: unknown): string | undefined {
  if (output === null || typeof output !== 'object') return undefined;
  const payload = (output as { payload?: unknown }).payload;
  if (payload === null || typeof payload !== 'object') return undefined;
  const message = (payload as { message?: unknown }).message;
  return typeof message === 'string' ? message : undefined;
}

function LiveResult({ view }: { view: LiveRunView }) {
  const message = messageOf(view.output);
  return (
    <div className="invocation-result">
      <div className="invocation-verdict">
        <div>
          <p className="kicker">Run state</p>
          <p className="invocation-disposition">{view.terminalState}</p>
        </div>
        <div>
          <p className="kicker">Observation lane</p>
          <p>{view.events.length} events · run {view.runId?.slice(0, 8)}</p>
        </div>
      </div>

      {message !== undefined ? <p className="live-output-message">{message}</p> : null}

      <details open>
        <summary>Scenario output</summary>
        <pre>{view.output !== undefined ? JSON.stringify(view.output, null, 2) : view.outputText ?? 'The run produced no readable scenario output.'}</pre>
      </details>

      <details>
        <summary>Observed node transitions ({view.transitions.length})</summary>
        <ol className="live-transitions">
          {view.transitions.map((transition, index) => (
            <li key={`${transition.cursor}-${transition.nodeId}-${index}`} className="font-mono text-xs">
              {transition.nodeId}: {transition.from ?? 'idle'} → {transition.to} (cursor {transition.cursor}, {transition.signal})
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}
