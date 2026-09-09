import type { JsonSchema } from '@/contracts/input-contract';

/**
 * JSON Schema reading for the input form — §13.1.
 *
 * Enough of draft 2020-12 to render the shapes the estate actually declares: const, enum,
 * string/integer/number/boolean, nullable unions, objects, arrays and local `$ref` into `$defs`.
 *
 * Anything outside that is reported as `raw` rather than approximated, so a field the site
 * cannot faithfully render is edited as JSON instead of being silently flattened. The schema is
 * read, never rewritten: this module produces no defaults the contract did not declare.
 */

export type FieldKind =
  | 'const' | 'enum' | 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array' | 'raw';

export interface FieldShape {
  kind: FieldKind;
  schema: JsonSchema;
  /** True when the declared type union admits null. */
  nullable: boolean;
  description?: string;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Resolves a local `#/$defs/...` reference against the root schema. Foreign refs stay raw. */
export function resolveSchema(schema: JsonSchema, root: JsonSchema): JsonSchema {
  let current: JsonSchema = schema;
  for (let depth = 0; depth < 10; depth += 1) {
    const ref = current.$ref;
    if (typeof ref !== 'string') return current;
    if (!ref.startsWith('#/')) return current;
    let node: unknown = root;
    for (const segment of ref.slice(2).split('/')) {
      if (!isObject(node)) return current;
      node = node[segment.replaceAll('~1', '/').replaceAll('~0', '~')];
    }
    if (!isObject(node)) return current;
    current = node as JsonSchema;
  }
  return current;
}

export function describeField(schema: JsonSchema, root: JsonSchema): FieldShape {
  const resolved = resolveSchema(schema, root);
  const description = typeof resolved.description === 'string' ? resolved.description : undefined;

  const declared = resolved.type;
  const types = Array.isArray(declared) ? declared.filter(t => typeof t === 'string') as string[]
    : typeof declared === 'string' ? [declared] : [];
  const nullable = types.includes('null');
  const type = types.find(t => t !== 'null');

  const kind: FieldKind =
    resolved.const !== undefined ? 'const'
    : Array.isArray(resolved.enum) ? 'enum'
    // A union of real types, or a combinator, is not something to approximate with one control.
    : types.filter(t => t !== 'null').length > 1 ? 'raw'
    : resolved.oneOf || resolved.anyOf || resolved.allOf ? 'raw'
    : type === 'object' || (!type && isObject(resolved.properties)) ? 'object'
    : type === 'array' ? 'array'
    : type === 'string' ? 'string'
    : type === 'integer' ? 'integer'
    : type === 'number' ? 'number'
    : type === 'boolean' ? 'boolean'
    : 'raw';

  return { kind, schema: resolved, nullable, description };
}

export function objectProperties(schema: JsonSchema): [string, JsonSchema][] {
  return isObject(schema.properties)
    ? Object.entries(schema.properties).filter(([, value]) => isObject(value)) as [string, JsonSchema][]
    : [];
}

export function requiredKeys(schema: JsonSchema): Set<string> {
  return new Set(Array.isArray(schema.required) ? schema.required.filter(k => typeof k === 'string') as string[] : []);
}

export function itemSchema(schema: JsonSchema): JsonSchema | null {
  return isObject(schema.items) ? schema.items as JsonSchema : null;
}

/**
 * A starting value for a field.
 *
 * Only a `const` produces a value the contract itself fixed; everything else starts empty, so a
 * form never presents an invented value as though the capability declared it.
 */
export function emptyValue(schema: JsonSchema, root: JsonSchema): unknown {
  const field = describeField(schema, root);
  switch (field.kind) {
    case 'const': return field.schema.const;
    case 'object': {
      const required = requiredKeys(field.schema);
      const value: Record<string, unknown> = {};
      for (const [key, child] of objectProperties(field.schema)) {
        const childField = describeField(child, root);
        // Required members and fixed values are seeded so the shape is visible; the rest stay out.
        if (childField.kind === 'const') value[key] = childField.schema.const;
        else if (required.has(key)) value[key] = emptyValue(child, root);
      }
      return value;
    }
    case 'array': return [];
    case 'boolean': return false;
    default: return '';
  }
}

/** Builds the initial document for a capability's declared input contract. */
export function initialDocument(schema: JsonSchema | null): unknown {
  return schema ? emptyValue(schema, schema) : {};
}
