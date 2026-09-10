'use client';

import { useRef, useState, type FormEvent } from 'react';
import type { LabRequest, LabResult, PublicPilot, LabProfile } from '@/contracts/lab';

const label = (value: string) => value.replace(/^\//, '').replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('/', ' / ');
const at = (value: unknown, pointer: string) => pointer.slice(1).split('/').reduce<unknown>((v, key) =>
  v !== null && typeof v === 'object' ? (v as Record<string, unknown>)[key.replaceAll('~1', '/').replaceAll('~0', '~')] : undefined, value);

export function Lab({ publicationId, pilots }: { publicationId: string; pilots: PublicPilot[] }) {
  const [selected, select] = useState(pilots[0]!.profile.subject);
  const [running, setRunning] = useState(false);
  const pilot = pilots.find(p => p.profile.subject === selected)!;
  return <div className="lab page-width">
    <header className="lab-heading"><p className="kicker">SideFX / Private capability lab</p>
      <h1>Choose an input.<br /><em>Inspect the outcome.</em></h1>
      <p>Run a declared capability and see what its result establishes.</p></header>
    <label className="lab-selector">Capability
      <select value={selected} disabled={running} onChange={e => select(e.target.value)}>{pilots.map(p =>
        <option key={p.profile.subject} value={p.profile.subject}>{p.profile.label}</option>)}</select>
    </label>
    <PilotForm key={selected} pilot={pilot} publicationId={publicationId} onPending={setRunning} />
    <details className="lab-publication"><summary>Experience revision</summary><code>{publicationId}</code></details>
  </div>;
}

export function PilotForm({ pilot, publicationId, onPending }: { pilot: PublicPilot; publicationId: string; onPending?: (pending: boolean) => void }) {
  const { profile } = pilot;
  const editable = profile.inputs.filter(b => b.ownership === 'editable');
  const initial = () => Object.fromEntries(editable.map(b => [b.pointer, b.enum?.[0] ?? '']));
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [exampleId, setExampleId] = useState(pilot.examples[0]?.id);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<LabResult>();
  const busy = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const clearResult = () => { setResult(undefined); setErrors({}); };
  const execute = async (event: FormEvent) => {
    event.preventDefault();
    if (busy.current) return;
    const next: Record<string, string> = {};
    for (const field of editable) {
      const count = [...(values[field.pointer] ?? '')].length;
      if (count < (field.minLength ?? (field.required ? 1 : 0))) next[field.pointer] = `Enter ${field.label?.toLowerCase() ?? 'a value'} (${field.minLength ?? 1}–${field.maxLength ?? 'any'} characters).`;
      else if (field.maxLength !== undefined && count > field.maxLength) next[field.pointer] = `Use at most ${field.maxLength} characters. You entered ${count}.`;
      else if (field.pattern && !new RegExp(field.pattern, 'u').test(values[field.pointer] ?? '')) next[field.pointer] = `Enter a value matching the declared format: ${field.pattern}`;
      else if (field.enum && !field.enum.includes(values[field.pointer] ?? '')) next[field.pointer] = 'Choose one of the offered values.';
    }
    setErrors(next); setResult(undefined);
    if (Object.keys(next).length) { form.current?.querySelector<HTMLInputElement>(`[name="${Object.keys(next)[0]}"]`)?.focus(); return; }
    busy.current = true; setPending(true); onPending?.(true);
    const request: LabRequest = { publicationId, subject: profile.subject, values, ...(exampleId === undefined ? {} : { exampleId }) };
    try {
      const response = await fetch('/lab/commands', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(request), signal: AbortSignal.timeout(630_000) });
      if (!response.ok) throw new Error('Response unavailable');
      setResult(await response.json() as LabResult);
    } catch {
      setResult({ status: 'UNKNOWN', capabilityId: profile.subject, code: 'RESPONSE_UNCONFIRMED',
        message: 'The response could not be confirmed. The run may have completed. Check its status before retrying.' });
    } finally {
      busy.current = false; setPending(false); onPending?.(false);
      // Wait for the result heading to enter the DOM, then announce it via focus.
      requestAnimationFrame(() => resultHeading.current?.focus());
    }
  };
  const reset = () => { setValues(initial()); setExampleId(pilot.examples[0]?.id); clearResult(); form.current?.querySelector<HTMLElement>('input, select, button')?.focus(); };
  return <section className="lab-workspace" aria-labelledby="pilot-title">
    <div className="lab-input">
      <p className="kicker">01 / Input</p><h2 id="pilot-title">{profile.label}</h2><p className="lab-description">{profile.description}</p>
      <form ref={form} onSubmit={execute} noValidate>
        <fieldset disabled={pending}>
          {editable.map((field, i) => <div className="lab-field" key={field.pointer}>
            <label htmlFor={`lab-field-${i}`}>{field.label}{field.required ? <span> (required)</span> : null}</label>
            {field.control === 'select' ? <select id={`lab-field-${i}`} name={field.pointer} value={values[field.pointer] ?? ''}
              required={field.required} aria-invalid={!!errors[field.pointer]} aria-describedby={`lab-help-${i} lab-error-${i}`}
              onChange={e => { setValues({ ...values, [field.pointer]: e.target.value }); clearResult(); }}>
              {field.enum?.map(value => <option key={value} value={value}>{value}</option>)}</select> : <input id={`lab-field-${i}`} name={field.pointer} type="text" value={values[field.pointer] ?? ''}
              required={field.required} aria-invalid={!!errors[field.pointer]} aria-describedby={`lab-help-${i} lab-error-${i}`}
              onChange={e => { setValues({ ...values, [field.pointer]: e.target.value }); clearResult(); }} />}
            <p id={`lab-help-${i}`} className="lab-note">{field.enum ? 'Choose an allowed value.' : field.pattern ? `${field.minLength}–${field.maxLength} characters. Format: ${field.pattern}` : `${field.minLength}–${field.maxLength} characters. Spaces and Unicode are preserved.`}</p>
            <p id={`lab-error-${i}`} className="lab-error" role={errors[field.pointer] ? 'alert' : undefined}>{errors[field.pointer] ?? ''}</p>
          </div>)}
          {pilot.examples.length > 0 ? <div className="lab-field"><label htmlFor="lab-example">Retained example</label>
            <select id="lab-example" value={exampleId} onChange={e => { setExampleId(e.target.value); clearResult(); }}>
              {pilot.examples.map(e => <option value={e.id} key={e.id}>{e.label}</option>)}
            </select><p className="lab-note">The selected fixture supplies the inventory and assurance values. This demonstration does not call or admit an external provider.</p>
          </div> : editable.length === 0 ? <p className="lab-note">No values to enter. Run requests the canonical greeting.</p> : null}
          <div className="action-row"><button className="button-primary" type="submit">{pending ? 'Running…' : 'Run capability'}<span aria-hidden="true">→</span></button>
            <button className="text-link" type="button" onClick={reset}>Reset</button></div>
        </fieldset>
      </form>
      <p className="lab-note" role="status" aria-live="polite">{pending ? 'Executing the selected capability…' : ''}</p>
    </div>
    <div className="lab-output" aria-busy={pending}>
      <p className="kicker">02 / Outcome</p><h2 ref={resultHeading} tabIndex={-1}>Run result</h2>
      {result ? <LabOutcome profile={profile} result={result} /> : <p className="lab-empty">{pending ? 'Waiting for the execution result.' : 'Your result will appear here after you run the capability.'}</p>}
    </div>
  </section>;
}

export function LabOutcome({ profile, result }: { profile: LabProfile; result: LabResult }) {
  if (result.status !== 'EXECUTED') return <div className="lab-message"><p className="lab-verdict">{result.status === 'UNKNOWN' ? 'Execution unconfirmed' : 'Not executed'}</p><p>{result.message}</p><code>{result.code}</code></div>;
  const { outcome } = result;
  return <div className="lab-result">
    <p className="lab-kernel">Kernel disposition <strong>{result.disposition}</strong></p>
    {result.evidence.providerInput ? <div className="lab-message"><p className="lab-verdict">Live provider retrieval</p>
      <p>Retrieved {String(at(result.evidence, '/providerInput/exchange/timing/completedAt') ?? '')}</p>
      <p>{String(at(result.evidence, '/providerInput/provider/providerId') ?? '')} · HTTP {String(at(result.evidence, '/providerInput/exchange/httpStatus') ?? '')}</p></div> : null}
    {result.disposition === 'terminated' ? profile.outcome.view === 'text'
      ? <p className="lab-greeting">{String(at(outcome, profile.outcome.pointer!) ?? '')}</p>
      : <>
        <dl className="lab-summary">{profile.outcome.summaryPointers?.map(pointer => <div key={pointer}><dt>{label(pointer)}</dt>
          <dd>{String(at(outcome, pointer) ?? 'Not supplied')}</dd>
          {profile.outcome.domainLabels?.[String(at(outcome, pointer))] ? <p>{profile.outcome.domainLabels[String(at(outcome, pointer))]}</p> : null}</div>)}</dl>
        {profile.outcome.collectionPointers?.map(pointer => <section className="lab-collection" key={pointer}><h3>{label(pointer)}</h3><Collection value={at(outcome, pointer)} fields={profile.outcome.collectionFields?.[pointer]} /></section>)}
        <details className="lab-trace"><summary>Trace digests</summary><dl>{profile.outcome.tracePointers?.map(pointer => <div key={pointer}><dt>{label(pointer)}</dt><dd><code>{String(at(outcome, pointer) ?? 'Not supplied')}</code></dd></div>)}</dl></details>
      </> : <><p>{result.disposition === 'rejected' ? 'The kernel refused a value against its contract.' : 'The execution failed.'}</p><Value value={outcome} /></>}
    <p className="lab-note">{result.observationCount} observations · {result.executionCount} execution{result.executionCount === 1 ? '' : 's'}. Managed admission: not requested.</p>
    <details className="lab-trace"><summary>Execution evidence</summary><pre>{JSON.stringify({ input: at(result.execution, '/result/input'), evidence: result.evidence }, null, 2)}</pre></details>
  </div>;
}

function Collection({ value, fields }: { value: unknown; fields?: string[] }) {
  if (!fields || !Array.isArray(value)) return <Value value={value} />;
  if (!value.length) return <p className="lab-note">No entries.</p>;
  return <ol className="lab-items">{value.map((item, index) => <li key={index}>
    <Value value={Object.fromEntries(fields.map(key => [key, item[key]]))} />
    <details className="lab-trace"><summary>Supporting details</summary><Value value={Object.fromEntries(Object.entries(item).filter(([key]) => !fields.includes(key)))} /></details>
  </li>)}</ol>;
}

function Value({ value }: { value: unknown }) {
  if (Array.isArray(value)) return value.length ? <ol className="lab-items">{value.map((v, i) => <li key={i}><Value value={v} /></li>)}</ol> : <p className="lab-note">No entries.</p>;
  if (value !== null && typeof value === 'object') return <dl className="lab-fields">{Object.entries(value).map(([k, v]) => <div key={k}><dt>{label(k)}</dt><dd><Value value={v} /></dd></div>)}</dl>;
  return <span>{value === undefined ? 'Not supplied' : value === null ? 'null' : String(value)}</span>;
}
