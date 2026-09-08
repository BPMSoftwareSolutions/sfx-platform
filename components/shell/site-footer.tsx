import Link from 'next/link';

import { DOC_ROUTES, PLATFORM_PILLARS, SITE, SOLUTION_ROUTES, linkable } from '@/lib/routes';

/**
 * Footer — §4.
 *
 * Available platform/solution pages, the catalogs, docs, ecosystem, the category page, About,
 * Contact, Legal and the BPM Intelligence attribution. Training and Latest are added only once
 * those pages ship. No social destinations appear until they are verified (§10).
 */
export function SiteFooter() {
  const groups = [
    { heading: 'Explore', items: linkable(['capabilities', 'mechanics', 'providers', 'build']) },
    { heading: 'Platform', items: linkable(['platform', ...PLATFORM_PILLARS, 'executableMeaning']) },
    { heading: 'Solutions', items: linkable(SOLUTION_ROUTES) },
    { heading: 'Learn', items: linkable(['docs', ...DOC_ROUTES]) },
    {
      heading: 'Company',
      items: linkable(['managedCapabilityProvider', 'ecosystem', 'about', 'contact', 'privacy', 'terms']),
    },
  ];

  return (
    <footer className="mt-24 border-t border-grid-line bg-ink-2">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          {groups.map((group) => (
            <nav key={group.heading} aria-label={group.heading}>
              <h2 className="mb-3 font-mono text-xs uppercase tracking-widest text-muted">
                {group.heading}
              </h2>
              <ul className="space-y-2">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="text-sm text-text hover:text-signal">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 border-t border-grid-line pt-6 text-sm text-muted">
          <p className="font-display text-base text-text">{SITE.tagline}</p>
          <p className="mt-2">
            {SITE.name} — {SITE.expansion}. A {SITE.owner} product.
          </p>
          <p className="mt-2 text-xs">
            Estate content on this site is published from a pinned generation of the capability
            estate. Counts, states and evidence are shown as the source records them.
          </p>
        </div>
      </div>
    </footer>
  );
}
