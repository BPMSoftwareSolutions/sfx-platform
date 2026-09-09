import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { InputContractPublication } from '../contracts/input-contract.ts';
import {
  describeField,
  emptyValue,
  initialDocument,
  objectProperties,
  resolveSchema,
} from '../lib/json-schema-form.ts';

/**
 * Input form generation — §8.3, §13.1.
 *
 * The form is generated from the capability's declared contract, so these check that it reads
 * the contract faithfully: that a fixed value stays fixed, that a shape it cannot render says
 * so instead of being approximated, and that it seeds nothing the contract did not declare.
 */

const ROOT = join(import.meta.dirname, '..');
const PUBLICATION = join(ROOT, 'generated', 'input-contracts.json');

test('a local $ref resolves against $defs, and a foreign one is left alone', () => {
  const root = { $defs: { digest: { type: 'string', pattern: '^sha256:' } } };
  assert.deepEqual(resolveSchema({ $ref: '#/$defs/digest' }, root), root.$defs.digest);
  const foreign = { $ref: 'https://example.test/schema.json' };
  assert.deepEqual(resolveSchema(foreign, root), foreign);
});

test('a value the contract fixed is reported as fixed, not as an editable field', () => {
  const field = describeField({ const: 'sidefx-provider-resolution-request.v1' }, {});
  assert.equal(field.kind, 'const');
  // A const seeds itself, because the contract declared that exact value.
  assert.equal(emptyValue({ const: 'x' }, {}), 'x');
});

test('a shape the form cannot render faithfully is raw rather than approximated', () => {
  for (const schema of [
    { oneOf: [{ type: 'string' }, { type: 'number' }] },
    { anyOf: [{ type: 'string' }] },
    { type: ['string', 'number'] },
    {},
  ]) {
    assert.equal(describeField(schema, {}).kind, 'raw', JSON.stringify(schema));
  }
});

test('a nullable declaration keeps its real type and is marked nullable', () => {
  const field = describeField({ type: ['string', 'null'] }, {});
  assert.equal(field.kind, 'string');
  assert.equal(field.nullable, true);
});

test('the form seeds required members and fixed values, and invents nothing else', () => {
  const schema = {
    type: 'object',
    required: ['needed'],
    properties: {
      fixed: { const: 'FIXED' },
      needed: { type: 'string' },
      optional: { type: 'string' },
      list: { type: 'array', items: { type: 'string' } },
    },
  };
  const value = emptyValue(schema, schema) as Record<string, unknown>;
  assert.equal(value.fixed, 'FIXED');
  assert.equal(value.needed, '');
  // An optional member the contract did not require is not invented into the document.
  assert.ok(!('optional' in value), 'an optional member was seeded');
  assert.ok(!('list' in value), 'an optional array was seeded');
});

test('with no declared schema the document is empty and no shape is implied', () => {
  assert.deepEqual(initialDocument(null), {});
});

test('the published contracts render as fields rather than falling back to raw', () => {
  if (!existsSync(PUBLICATION)) return; // run `npm run publish:contracts` to exercise this
  const publication = InputContractPublication.parse(JSON.parse(readFileSync(PUBLICATION, 'utf8')));

  const schemas = Object.values(publication.schemas);
  assert.ok(schemas.length > 0, 'no schemas published');

  let renderable = 0;
  let total = 0;
  for (const schema of schemas) {
    for (const [, child] of objectProperties(schema)) {
      total += 1;
      if (describeField(child, schema).kind !== 'raw') renderable += 1;
    }
  }
  // Most declared properties must render as real controls, or the form is not worth offering.
  assert.ok(total > 0, 'published schemas declare no properties');
  assert.ok(renderable / total > 0.8, `only ${renderable}/${total} properties render as fields`);

  // Every published capability resolves to its own scenario and a contract or an explicit null.
  for (const [capabilityId, entry] of Object.entries(publication.capabilities)) {
    assert.ok(entry.scenarioId, `${capabilityId} has no root scenario`);
    if (entry.schemaRef) assert.ok(publication.schemas[entry.schemaRef], `${capabilityId} references a missing schema`);
  }
});
