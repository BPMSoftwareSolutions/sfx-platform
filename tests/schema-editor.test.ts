import assert from 'node:assert/strict';
import test from 'node:test';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SchemaField } from '../components/estate/schema-field.tsx';
import { childPath, hasInvalidDraft, parseDraft, removeItemDrafts, type JsonEditor } from '../lib/json-drafts.ts';

type Element = ReactElement<{ children?: ReactNode; [key: string]: unknown }>;
function elements(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<Element['props']>(node)) return [];
  if (typeof node.type === 'function') return elements((node.type as (props: Element['props']) => ReactNode)(node.props));
  return [node, ...elements(node.props.children)];
}
function editor(): JsonEditor {
  const state: JsonEditor = {
    drafts: {},
    edit(path, text, commit) {
      const parsed = parseDraft(text);
      state.drafts = { ...state.drafts, [path]: parsed.draft };
      if (!parsed.draft.error) commit(parsed.value);
    },
    removeItem(path, index) { state.drafts = removeItemDrafts(state.drafts, path, index); },
  };
  return state;
}

test('invalid raw field text stays visible with an error until corrected', () => {
  let value: unknown = { old: true };
  const state = editor();
  const field = () => SchemaField({ schema: {}, root: {}, value, onChange: next => { value = next; }, label: 'payload', path: '/payload', editor: state });
  const textarea = () => elements(field()).find(element => element.type === 'textarea')!;
  const change = (text: string) => (textarea().props.onChange as (event: { target: { value: string } }) => void)({ target: { value: text } });
  change('{"new":');
  assert.equal(textarea().props.value, '{"new":');
  assert.equal(textarea().props['aria-invalid'], true);
  assert.match(renderToStaticMarkup(field()), /Not valid JSON/);
  assert.equal(hasInvalidDraft(state.drafts), true);
  assert.deepEqual(value, { old: true });
  change('{"new":null}');
  assert.deepEqual(value, { new: null });
  assert.equal(hasInvalidDraft(state.drafts), false);
  assert.equal(textarea().props['aria-invalid'], undefined);
});

test('array removal keeps invalid drafts with their surviving items and discards deleted drafts', () => {
  let value: unknown[] = [{ first: true }, { second: true }, { third: true }];
  const state = editor();
  state.edit('/items/1', '{"second":', () => {});
  state.edit('/items/2', '{"third":', () => {});
  const field = () => SchemaField({ schema: { type: 'array', items: {} }, root: {}, value,
    onChange: next => { value = next as unknown[]; }, label: 'items', path: '/items', editor: state });
  const removeFirst = () => {
    const button = elements(field()).find(element => element.type === 'button')!;
    (button.props.onClick as () => void)();
  };
  removeFirst();
  assert.deepEqual(value, [{ second: true }, { third: true }]);
  assert.deepEqual(elements(field()).filter(element => element.type === 'textarea').map(element => element.props.value), ['{"second":', '{"third":']);
  removeFirst();
  assert.deepEqual(Object.keys(state.drafts), ['/items/0']);
  assert.equal(state.drafts['/items/0']?.text, '{"third":');
  removeFirst();
  assert.equal(hasInvalidDraft(state.drafts), false);
});

test('raw controls update when canonical values change and a const never conceals a different supplied value', () => {
  const props = { schema: {}, root: {}, value: { current: true }, onChange: () => {}, label: 'payload', path: '/payload', editor: editor() };
  assert.equal(elements(SchemaField(props)).find(element => element.type === 'textarea')?.props.value, '{\n  "current": true\n}');
  const fixed = SchemaField({ ...props, schema: { const: 'expected' }, value: 'different' });
  assert.equal(elements(fixed).find(element => element.type === 'textarea')?.props.value, '"different"');
  assert.match(renderToStaticMarkup(fixed), /contract expects/);
  assert.notEqual(childPath('', 'a/b'), childPath('/a', 'b'));
});
