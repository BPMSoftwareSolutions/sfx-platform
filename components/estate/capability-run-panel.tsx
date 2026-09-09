'use client';

import { useId, useMemo, useState, useTransition } from 'react';

import type { JsonSchema } from '@/contracts/input-contract';
import type { InvocationView } from '@/contracts/invocation';
import { initialDocument, objectProperties, requiredKeys } from '@/lib/json-schema-form';
import { childPath, hasInvalidDraft, parseDraft, removeItemDrafts, type JsonDrafts, type JsonEditor } from '@/lib/json-drafts';
import { SchemaField } from './schema-field';

/**
 * Capability run panel — §13.1.
 *
 * Input is composed either as a form generated from the capability's own declared contract, or
 * as raw JSON. The two are the same document: switching modes carries the value across, so the
 * form is a view of the input rather than a separate thing that has to agree with it.
 *
 * Nothing executes until the visitor presses Run. The panel renders exactly what the estate
 * returned — a kernel disposition and outcome, or the estate's own refusal code — and never
 * fills a refusal with an example result.
 */

interface Props {
  namespace: string;
  capabilityId: string;
  contractId: string | null;
  schema: JsonSchema | null;
  example: string | null;
  run: (namespace: string, capabilityId: string, input: string) => Promise<InvocationView>;
}

type Mode = 'form' | 'raw';

const REFUSAL_GUIDANCE: Record<string, string> = {
  CAPABILITY_PREPARATION_REQUIRED:
    'This capability has no preparation retained for the current estate generation, so it cannot be executed yet. Preparation resolves its requirements and proves its fixtures before any execution is offered.',
  CAPABILITY_PREPARATION_STALE:
    'A preparation exists but was made against a different estate generation or toolchain, so it no longer stands for this revision. It has to be prepared again.',
  CAPABILITY_NOT_FOUND:
    'The estate resolved no declared root for this capability, so there is nothing to execute.',
};

export function CapabilityRunPanel({ namespace, capabilityId, contractId, schema, example, run }: Props) {
  const baseId = useId();

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
  const [view, setView] = useState<InvocationView | undefined>();
  const [pending, startTransition] = useTransition();

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
    setView(undefined);
    startTransition(async () => {
      try { setView(await run(namespace, capabilityId, payload)); }
      catch { setView({ status: 'UNKNOWN', capabilityId, code: 'REQUEST_FAILED', message: 'The page lost contact before execution could be confirmed.' }); }
    });
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

      <p aria-live="polite" className="invocation-status">
        {pending ? 'Reading the prepared authority and executing in memory…' : view ? summarise(view) : ''}
      </p>

      {view ? <Result view={view} /> : null}
    </div>
  );
}

function summarise(view: InvocationView): string {
  if (view.status === 'EXECUTED') return `Execution complete — disposition ${view.disposition}.`;
  if (view.status === 'REFUSED') return `Not executed — ${view.code}.`;
  if (view.status === 'UNKNOWN') return 'Execution unconfirmed — check its status before retrying.';
  return `Not executed — ${view.message}`;
}

function Result({ view }: { view: InvocationView }) {
  if (view.status === 'UNKNOWN') {
    return (
      <div className="invocation-result invocation-result--refused">
        <p className="kicker">Execution unconfirmed · {view.code}</p>
        <p>{view.message}</p>
        <p className="invocation-note">The request may still be running or may have completed. Losing the response does not cancel execution. Check its status before retrying.</p>
      </div>
    );
  }
  if (view.status === 'UNAVAILABLE') {
    return (
      <div className="invocation-result invocation-result--refused">
        <p className="kicker">Not executed · {view.code}</p>
        <p>{view.message}</p>
      </div>
    );
  }

  if (view.status === 'REFUSED') {
    return (
      <div className="invocation-result invocation-result--refused">
        <p className="kicker">Estate refusal · {view.code}</p>
        <p>{REFUSAL_GUIDANCE[view.code] ?? view.message}</p>
        <p className="invocation-note">
          This is the estate&apos;s own result for this capability. Nothing was executed and no other
          capability&apos;s result stands in for it.
        </p>
      </div>
    );
  }

  const refused = view.disposition === 'rejected' || view.disposition === 'failed';
  return (
    <div className={`invocation-result${refused ? ' invocation-result--refused' : ''}`}>
      <div className="invocation-verdict">
        <div>
          <p className="kicker">Kernel disposition</p>
          <p className="invocation-disposition">{view.disposition}</p>
        </div>
        <div>
          <p className="kicker">Kernel testimony</p>
          <p>{view.observationCount} observations · {view.executionCount} executions{view.durationMs !== null ? ` · ${view.durationMs} ms` : ''}</p>
        </div>
      </div>

      {view.disposition === 'rejected' ? (
        <p className="invocation-note">
          The capability&apos;s contract refused this input. That is a real result of running it, not a
          fault in this page.
        </p>
      ) : null}

      <details>
        <summary>Outcome</summary>
        <pre>{JSON.stringify(view.outcome, null, 2)}</pre>
      </details>

      <details>
        <summary>Execution provenance</summary>
        <pre>{JSON.stringify(view.evidence, null, 2)}</pre>
      </details>
      <details>
        <summary>Full execution record</summary>
        <pre>{JSON.stringify(view.execution, null, 2)}</pre>
      </details>
    </div>
  );
}
