'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { EntityArt } from './entity-art';
import type { EntityVisual } from '@/contracts/estate';

/**
 * Catalog search and filtering — §5.17, §5.20.
 *
 * Empty, filtered-empty and loading states are explicit. Filters operate on published fields
 * only; a filter never invents a status the source did not declare.
 */

export interface CatalogItem {
  kind: string;
  visuals: EntityVisual[];
  id: string;
  href: string;
  title: string;
  /** Shown verbatim under the title so the exact identity is always visible. */
  identity: string;
  summary: string | null;
  /** Facet values this item carries. Used for both search and filtering. */
  facets: { label: string; value: string }[];
  badges: { label: string; tone?: 'neutral' | 'signal' | 'telemetry' }[];
  /** Searchable text beyond title and identity. */
  searchText: string;
}

interface Props {
  items: CatalogItem[];
  facetName: string;
  /** Distinct facet values offered as filters, in a stable order. */
  facetValues: string[];
  /** What one row is called, for empty-state copy. */
  noun: string;
  emptyMessage: string;
}

const PAGE_SIZE = 24;

export function Catalog({ items, facetName, facetValues, noun, emptyMessage }: Props) {
  const [query, setQuery] = useState('');
  const [facet, setFacet] = useState('');
  const [visible, setVisible] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      if (facet && !item.facets.some((f) => f.value === facet)) return false;
      if (!needle) return true;
      return (
        item.title.toLowerCase().includes(needle) ||
        item.identity.toLowerCase().includes(needle) ||
        item.searchText.toLowerCase().includes(needle)
      );
    });
  }, [items, query, facet]);

  const shown = filtered.slice(0, visible);

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-grid-line bg-ink-2 p-6 text-sm text-muted">{emptyMessage}</div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-grid-line bg-ink-2 p-4">
        <div className="min-w-[220px] flex-1">
          <label htmlFor="catalog-search" className="block font-mono text-xs uppercase tracking-widest text-muted">
            Search
          </label>
          <input
            id="catalog-search"
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setVisible(PAGE_SIZE);
            }}
            placeholder={`Search ${noun} by name, identity or declared meaning`}
            className="mt-2 w-full rounded border border-grid-line bg-ink px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="catalog-facet" className="block font-mono text-xs uppercase tracking-widest text-muted">
            {facetName}
          </label>
          <select
            id="catalog-facet"
            value={facet}
            onChange={(event) => {
              setFacet(event.target.value);
              setVisible(PAGE_SIZE);
            }}
            className="mt-2 rounded border border-grid-line bg-ink px-3 py-2 text-sm"
          >
            <option value="">All</option>
            {facetValues.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p aria-live="polite" className="mt-4 text-sm text-muted">
        {filtered.length} of {items.length} {noun}
        {query || facet ? ' match the current filters' : ' published in this generation'}.
      </p>

      {filtered.length === 0 ? (
        <div className="mt-4 rounded-lg border border-grid-line bg-ink-2 p-6 text-sm text-muted">
          No {noun} match this search. Clear the search or choose a different {facetName.toLowerCase()}.
        </div>
      ) : (
        <>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="catalog-card"
                >
                  <EntityArt visuals={item.visuals} title={item.title} kind={item.kind}/>
                  <div className="catalog-card-copy">
                  <h3 className="font-display text-base font-semibold break-words">{item.title}</h3>
                  <p className="mt-1 break-all font-mono text-xs text-muted">{item.identity}</p>
                  {item.summary ? (
                    <p className="mt-3 line-clamp-4 text-sm text-muted">{item.summary}</p>
                  ) : (
                    <p className="mt-3 text-sm italic text-muted">
                      No declared description in this generation.
                    </p>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {item.badges.map((badge) => (
                      <span
                        key={badge.label}
                        className={`rounded border px-2 py-0.5 font-mono text-xs ${
                          badge.tone === 'signal'
                            ? 'border-signal/50 text-signal'
                            : badge.tone === 'telemetry'
                              ? 'border-telemetry/50 text-telemetry'
                              : 'border-grid-line text-muted'
                        }`}
                      >
                        {badge.label}
                      </span>
                    ))}
                  </div>
                  <span className="mt-4 text-sm text-signal">Open →</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {visible < filtered.length ? (
            <button
              type="button"
              onClick={() => setVisible((v) => v + PAGE_SIZE)}
              className="mt-6 rounded border border-grid-line px-5 py-3 text-sm hover:border-signal"
            >
              Show more ({filtered.length - visible} remaining)
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}
