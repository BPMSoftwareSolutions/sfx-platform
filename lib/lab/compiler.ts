import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import Ajv2020 from 'ajv/dist/2020.js';
import type { JsonObject, LabPilot, LabProfile, LabPublication, SchemaResource } from '@/contracts/lab';

export const digest = (value: string) => 'sha256:' + createHash('sha256').update(value).digest('hex');
export const object = (v: unknown): v is JsonObject => !!v && typeof v === 'object' && !Array.isArray(v);
export const parts = (pointer: string) => {
  if (!/^\/(?:[^/~]|~[01])+(?:\/(?:[^/~]|~[01])+)*$/.test(pointer)) throw new Error('UNSUPPORTED_POINTER');
  const keys = pointer.slice(1).split('/').map(k => k.replaceAll('~1', '/').replaceAll('~0', '~'));
  if (keys.some(k => ['__proto__', 'prototype', 'constructor'].includes(k))) throw new Error('UNSAFE_POINTER');
  return keys;
};
export function at(value: unknown, pointer: string): unknown {
  return parts(pointer).reduce<unknown>((v, k) => object(v) && Object.hasOwn(v, k) ? v[k] : undefined, value);
}

// A fresh schema registry per pilot: duplicate IDs cannot leak across publications/scopes.
export function validators(pilot: Pick<LabPilot, 'resources' | 'inputSchema' | 'outcomeSchema'>) {
  const ajv = new Ajv2020({ strict: false, allErrors: true, validateFormats: false, addUsedSchema: false });
  const ids = new Map<string, string>();
  for (const resource of pilot.resources) {
    assert.equal(digest(resource.text), resource.digest, 'SCHEMA_BYTES_CHANGED');
    const schema = JSON.parse(resource.text) as JsonObject;
    const id = schema.$id;
    assert.equal(typeof id, 'string', 'SCOPED_SCHEMA_ID_REQUIRED');
    assert(!ids.has(id as string) || ids.get(id as string) === resource.digest, 'AMBIGUOUS_SCHEMA_ID');
    if (!ids.has(id as string)) { ajv.addSchema(schema); ids.set(id as string, resource.digest); }
  }
  // Ajv refuses unresolved references. It never fetches schema URLs over the network.
  return { input: ajv.compile(pilot.inputSchema), outcome: ajv.compile(pilot.outcomeSchema) };
}

function schemaAt(root: JsonObject, pointer: string): JsonObject {
  let node = root;
  for (const key of parts(pointer)) {
    assert(!node.$ref && object(node.properties) && object(node.properties[key]), 'UNSUPPORTED_INPUT_PATH:' + pointer);
    node = node.properties[key];
  }
  return node;
}

export function validatePilot(pilot: LabPilot) {
  const { profile: p } = pilot;
  assert(['action', 'form', 'retained-example-selection'].includes(p.interaction), 'UNSUPPORTED_INTERACTION');
  assert(['text', 'structured-result'].includes(p.outcome.view), 'UNSUPPORTED_OUTCOME_VIEW');
  const input = pilot.resources.find(r => r.digest === p.inputSchemaDigest);
  const output = pilot.resources.find(r => r.digest === p.outcome.schemaDigest);
  assert(input && output, 'ROOT_SCHEMA_MISSING');
  assert.deepEqual(JSON.parse(input.text), pilot.inputSchema, 'INPUT_SCHEMA_CHANGED');
  assert.deepEqual(JSON.parse(output.text), pilot.outcomeSchema, 'OUTCOME_SCHEMA_CHANGED');
  const mapped = new Map(p.inputs.map(b => [b.pointer, b]));
  assert.equal(mapped.size, p.inputs.length, 'DUPLICATE_INPUT_BINDING');
  const visit = (node: JsonObject, prefix = '') => {
    assert.equal(node.type, 'object', 'UNSUPPORTED_OBJECT');
    assert.equal(node.additionalProperties, false, 'OPEN_INPUT_OBJECT_UNSUPPORTED');
    assert(!node.$ref && !node.oneOf && !node.anyOf && !node.allOf, 'UNSUPPORTED_INPUT_BRANCH');
    for (const [key, raw] of Object.entries((node.properties ?? {}) as JsonObject)) {
      assert(object(raw), 'UNSUPPORTED_PROPERTY');
      const pointer = prefix + '/' + key.replaceAll('~', '~0').replaceAll('/', '~1');
      const b = mapped.get(pointer);
      assert(b, 'INPUT_OWNERSHIP_MISSING:' + pointer);
      if (b.ownership === 'derived') {
        assert.equal(b.construction, 'object-from-declared-children'); visit(raw, pointer);
      } else if (b.ownership === 'editable') {
        assert.equal(raw.type, 'string'); assert.equal(b.control, raw.enum ? 'select' : 'text');
        assert.equal(b.trim, false); assert.equal(b.unicodeNormalization, 'none');
        assert.equal(b.minLength, raw.minLength); assert.equal(b.maxLength, raw.maxLength);
        assert.equal(b.required, (node.required as string[]).includes(key));
        assert.deepEqual(b.enum, raw.enum, 'CHOICE_SEMANTICS_CHANGED');
        assert.equal(b.pattern, raw.pattern, 'PATTERN_SEMANTICS_CHANGED');
        if (b.enum) assert(b.enum.length > 0 && b.enum.every(v => typeof v === 'string'), 'UNSUPPORTED_CHOICE');
        if (b.pattern) new RegExp(b.pattern, 'u');
        assert(!raw.$ref && !Object.hasOwn(raw, 'const') && !raw.format, 'UNSUPPORTED_TEXT_SEMANTICS');
      } else if (b.ownership === 'fixed') {
        if (Object.hasOwn(raw, 'const')) assert.deepEqual(b.value, raw.const, 'FIXED_CONSTANT_CHANGED');
        else assert(raw.type === 'object' && raw.additionalProperties === false && !raw.properties && object(b.value) && Object.keys(b.value).length === 0, 'UNSUPPORTED_FIXED_VALUE');
      } else {
        assert.equal(b.ownership, 'system-bound');
        assert.equal(p.interaction, 'retained-example-selection');
        assert.equal(b.source, 'selected-retained-fixture');
      }
    }
  };
  visit(pilot.inputSchema);
  for (const b of p.inputs) schemaAt(pilot.inputSchema, b.pointer);
  const editable = p.inputs.filter(b => b.ownership === 'editable');
  assert(p.interaction === 'form' ? editable.length > 0 : editable.length === 0, 'INTERACTION_OWNERSHIP_MISMATCH');
  const validate = validators(pilot);
  if (p.interaction === 'retained-example-selection') {
    assert(p.exampleSource && pilot.examples.length > 0, 'EXAMPLE_SOURCE_REQUIRED');
    assert.deepEqual(pilot.examples.map(e => e.id), p.exampleSource.allowedFixtureIds, 'EXAMPLE_ALLOWLIST_CHANGED');
    assert.equal(new Set(pilot.examples.map(e => e.id)).size, pilot.examples.length, 'AMBIGUOUS_EXAMPLE');
    for (const example of pilot.examples) {
      assert(validate.input(example.input), 'INVALID_RETAINED_INPUT');
      for (const b of p.inputs.filter(b => b.ownership === 'fixed')) assert.deepEqual(at(example.input, b.pointer), b.value, 'FIXTURE_FIXED_VALUE_CHANGED');
    }
  } else assert.equal(pilot.examples.length, 0, 'UNDECLARED_EXAMPLES');
  if (p.outcome.view === 'text') {
    assert(p.outcome.pointer, 'OUTCOME_POINTER_REQUIRED');
    const leaf = schemaAt(pilot.outcomeSchema, p.outcome.pointer);
    assert(leaf.type === 'string' || typeof leaf.const === 'string', 'TEXT_OUTCOME_REQUIRED');
  } else {
    for (const pointer of [...p.outcome.summaryPointers ?? [], ...p.outcome.collectionPointers ?? [], ...p.outcome.tracePointers ?? []]) schemaAt(pilot.outcomeSchema, pointer);
    for (const [pointer, keys] of Object.entries(p.outcome.collectionFields ?? {})) {
      assert(p.outcome.collectionPointers?.includes(pointer), 'UNDECLARED_COLLECTION');
      let item = schemaAt(pilot.outcomeSchema, pointer).items;
      assert(object(item), 'COLLECTION_ITEMS_UNSUPPORTED');
      if (typeof item.$ref === 'string') {
        const url = new URL(item.$ref, String(pilot.outcomeSchema.$id));
        const fragment = url.hash.slice(1); url.hash = '';
        const target = pilot.resources.map(r => JSON.parse(r.text)).find(s => s.$id === url.href);
        assert(target, 'COLLECTION_REFERENCE_UNRESOLVED');
        item = fragment ? at(target, fragment) : target;
      }
      assert(object(item) && object(item.properties), 'COLLECTION_FIELDS_UNSUPPORTED');
      assert(keys.length && new Set(keys).size === keys.length, 'COLLECTION_FIELDS_REQUIRED');
      for (const key of keys) assert(Object.hasOwn(item.properties, key), 'COLLECTION_FIELD_UNDECLARED');
    }
  }
  return pilot;
}

export function compilePublication(pilots: LabPilot[]): LabPublication {
  assert(pilots.length > 0, 'EMPTY_PUBLICATION');
  assert.equal(new Set(pilots.map(p => p.profile.subject)).size, pilots.length, 'AMBIGUOUS_SUBJECT');
  pilots.forEach(validatePilot);
  const body = { compiler: 'sidefx-lab-profile-compiler.v1', pilots };
  return { publicationId: digest(JSON.stringify(body)), ...body };
}

export function verifyPublication(publication: LabPublication) {
  const compiled = compilePublication(publication.pilots);
  assert.equal(publication.compiler, compiled.compiler, 'COMPILER_UNSUPPORTED');
  assert.equal(publication.publicationId, compiled.publicationId, 'PUBLICATION_DIGEST_CHANGED');
  return publication;
}

export type { LabProfile, SchemaResource };
