import type { MetadataRoute } from 'next';

import { SITE } from '@/lib/routes';

/** §4, §7 — private and auth routes are excluded from indexing. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/workspace/', '/sign-in', '/auth/', '/api/', '/healthz', '/readyz'],
    },
    sitemap: new URL('/sitemap.xml', SITE.origin).toString(),
  };
}
