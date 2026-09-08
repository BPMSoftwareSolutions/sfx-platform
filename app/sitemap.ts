import type { MetadataRoute } from 'next';

import { getCapabilities, getMechanics, getProviders } from '@/lib/estate';
import { ROUTES, SITE } from '@/lib/routes';

/**
 * Sitemap — §4, §7.
 *
 * Generated from the route registry and the publication manifest only. Unavailable routes and
 * private/auth routes never appear, so the sitemap cannot advertise a destination that does not
 * exist.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const url = (path: string) => new URL(path, SITE.origin).toString();

  const staticEntries = Object.values(ROUTES)
    .filter((route) => route.available && route.indexable)
    .map((route) => ({
      url: url(route.href),
      changeFrequency: 'weekly' as const,
      priority: route.href === '/' ? 1 : 0.7,
    }));

  const estateEntries = [
    ...getCapabilities().map((c) => url(`/capabilities/${c.urlKey}`)),
    ...getMechanics().map((m) => url(`/mechanics/${m.urlKey}`)),
    ...getProviders().map((p) => url(`/providers/${p.urlKey}`)),
  ].map((entry) => ({ url: entry, changeFrequency: 'monthly' as const, priority: 0.5 }));

  return [...staticEntries, ...estateEntries];
}
