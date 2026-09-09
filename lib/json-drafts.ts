export interface JsonDraft { text: string; error?: string }
export type JsonDrafts = Record<string, JsonDraft>;
export interface JsonEditor {
  drafts: JsonDrafts;
  edit: (path: string, text: string, commit: (value: unknown) => void) => void;
  removeItem: (path: string, index: number) => void;
}

export function parseDraft(text: string): { draft: JsonDraft; value?: unknown } {
  try { return { draft: { text }, value: JSON.parse(text) }; }
  catch (error) { return { draft: { text, error: error instanceof Error ? error.message : 'Invalid JSON' } }; }
}

export const hasInvalidDraft = (drafts: JsonDrafts) => Object.values(drafts).some(draft => draft.error !== undefined);
export const childPath = (path: string, key: string | number) => `${path}/${String(key).replaceAll('~', '~0').replaceAll('/', '~1')}`;

/** Keep each draft with its array item when an earlier item is removed. */
export function removeItemDrafts(drafts: JsonDrafts, path: string, index: number): JsonDrafts {
  const prefix = `${path}/`;
  return Object.fromEntries(Object.entries(drafts).flatMap(([key, draft]) => {
    if (!key.startsWith(prefix)) return [[key, draft]];
    const [segment, ...rest] = key.slice(prefix.length).split('/');
    const item = Number(segment);
    if (item === index) return [];
    const next = item > index ? `${prefix}${item - 1}${rest.length ? `/${rest.join('/')}` : ''}` : key;
    return [[next, draft]];
  }));
}
