'use client';

import type { JsonSchema } from '@/contracts/input-contract';
import {
  describeField,
  emptyValue,
  itemSchema,
  objectProperties,
  requiredKeys,
} from '@/lib/json-schema-form';

/**
 * One field of a generated input form — §13.1.
 *
 * Rendered from the capability's own declared contract. A `const` is shown as fixed rather than
 * editable, because the contract fixed it; a shape this form cannot render faithfully is edited
 * as JSON rather than approximated with a control that would misrepresent it.
 *
 * Nothing here validates the input. Admission belongs to the capability's contract, and its
 * refusal is a real result the page shows.
 */

interface Props {
  schema: JsonSchema;
  root: JsonSchema;
  value: unknown;
  onChange: (value: unknown) => void;
  label: string;
  required?: boolean;
  path: string;
}

export function SchemaField({ schema, root, value, onChange, label, required, path }: Props) {
  const field = describeField(schema, root);
  const id = `f-${path.replaceAll(/[^a-zA-Z0-9]/g, '-')}`;
  const hint = field.description;

  if (field.kind === 'const') {
    return (
      <div className="schema-field">
        <span className="schema-label">
          {label} <em>fixed by contract</em>
        </span>
        <output className="schema-fixed">{JSON.stringify(field.schema.const)}</output>
      </div>
    );
  }

  if (field.kind === 'object') {
    const required = requiredKeys(field.schema);
    const current = (value && typeof value === 'object' && !Array.isArray(value) ? value : {}) as Record<string, unknown>;
    const properties = objectProperties(field.schema);
    if (!properties.length) {
      return <RawField id={id} label={label} hint={hint} value={value} onChange={onChange} />;
    }
    return (
      <fieldset className="schema-object">
        <legend>
          {label}
          {required.size ? <span className="schema-required-note"> · {required.size} required</span> : null}
        </legend>
        {hint ? <p className="schema-hint">{hint}</p> : null}
        {properties.map(([key, child]) => (
          <SchemaField
            key={key}
            schema={child}
            root={root}
            label={key}
            required={required.has(key)}
            path={`${path}.${key}`}
            value={current[key]}
            onChange={next => onChange({ ...current, [key]: next })}
          />
        ))}
      </fieldset>
    );
  }

  if (field.kind === 'array') {
    const items = Array.isArray(value) ? value : [];
    const child = itemSchema(field.schema);
    if (!child) return <RawField id={id} label={label} hint={hint} value={value} onChange={onChange} />;
    return (
      <fieldset className="schema-object">
        <legend>
          {label} <span className="schema-required-note">· {items.length} {items.length === 1 ? 'item' : 'items'}{required ? ', required' : ''}</span>
        </legend>
        {hint ? <p className="schema-hint">{hint}</p> : null}
        {items.map((item, index) => (
          <div className="schema-array-item" key={index}>
            <SchemaField
              schema={child}
              root={root}
              label={`${index}`}
              path={`${path}.${index}`}
              value={item}
              onChange={next => onChange(items.map((existing, i) => (i === index ? next : existing)))}
            />
            <button type="button" className="text-link" onClick={() => onChange(items.filter((_, i) => i !== index))}>
              Remove item {index}
            </button>
          </div>
        ))}
        <button type="button" className="text-link" onClick={() => onChange([...items, emptyValue(child, root)])}>
          Add item
        </button>
      </fieldset>
    );
  }

  if (field.kind === 'enum') {
    const options = Array.isArray(field.schema.enum) ? field.schema.enum : [];
    return (
      <div className="schema-field">
        <label className="schema-label" htmlFor={id}>{label}{required ? <em>required</em> : null}</label>
        <select
          id={id}
          value={value === undefined || value === null ? '' : String(value)}
          onChange={event => {
            const raw = event.target.value;
            onChange(raw === '' ? (field.nullable ? null : '') : options.find(o => String(o) === raw) ?? raw);
          }}
        >
          <option value="">{field.nullable ? 'null' : 'Select…'}</option>
          {options.map(option => (
            <option key={String(option)} value={String(option)}>{String(option)}</option>
          ))}
        </select>
        {hint ? <p className="schema-hint">{hint}</p> : null}
      </div>
    );
  }

  if (field.kind === 'boolean') {
    return (
      <div className="schema-field schema-field--inline">
        <input id={id} type="checkbox" checked={value === true} onChange={event => onChange(event.target.checked)} />
        <label className="schema-label" htmlFor={id}>{label}{required ? <em>required</em> : null}</label>
        {hint ? <p className="schema-hint">{hint}</p> : null}
      </div>
    );
  }

  if (field.kind === 'string' || field.kind === 'number' || field.kind === 'integer') {
    const numeric = field.kind !== 'string';
    return (
      <div className="schema-field">
        <label className="schema-label" htmlFor={id}>{label}{required ? <em>required</em> : null}</label>
        <input
          id={id}
          type={numeric ? 'number' : 'text'}
          step={field.kind === 'integer' ? 1 : undefined}
          value={value === undefined || value === null ? '' : String(value)}
          placeholder={typeof field.schema.pattern === 'string' ? field.schema.pattern : undefined}
          onChange={event => {
            const raw = event.target.value;
            if (raw === '') return onChange(field.nullable ? null : '');
            onChange(numeric ? Number(raw) : raw);
          }}
        />
        {hint ? <p className="schema-hint">{hint}</p> : null}
      </div>
    );
  }

  return <RawField id={id} label={label} hint={hint} value={value} onChange={onChange} />;
}

/** A shape the form cannot render faithfully is edited as JSON, and says so. */
function RawField({
  id, label, hint, value, onChange,
}: { id: string; label: string; hint?: string; value: unknown; onChange: (value: unknown) => void }) {
  return (
    <div className="schema-field">
      <label className="schema-label" htmlFor={id}>
        {label} <em>JSON</em>
      </label>
      <textarea
        id={id}
        rows={3}
        spellCheck={false}
        defaultValue={value === undefined ? '' : JSON.stringify(value, null, 2)}
        onChange={event => {
          try { onChange(JSON.parse(event.target.value)); } catch { /* keep the last valid value */ }
        }}
      />
      <p className="schema-hint">{hint ?? 'This contract shape is edited as JSON so it is not misrepresented by a simpler control.'}</p>
    </div>
  );
}
