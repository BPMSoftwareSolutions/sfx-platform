import type { Metadata } from 'next';

import { SITE } from './routes';

/**
 * Metadata rules — §7.
 *
 * Every indexable public page gets a unique title (target <=60 chars), a description
 * (target <=155 chars) and a canonical URL. Private and auth pages use generic metadata that
 * exposes no private capability facts and stay noindex.
 */

interface PageMetaInput {
  title: string;
  description: string;
  path: string;
  /** Reviewed page or capability image. Absent until a reviewed asset exists (§12.5). */
  image?: string;
  noindex?: boolean;
}
export const HOME_META:PageMetaInput={title:'SideFX — Own the meaning. Build what follows.',description:'Explore a living capability estate. See the scenarios, inspect the circuit, and understand the mechanics behind the work.',path:'/'};

export function pageMetadata({ title, description, path, image, noindex }: PageMetaInput): Metadata {
  const url = new URL(path, SITE.origin).toString();
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: noindex ? { index: false, follow: false } : undefined,
    openGraph: {
      title,
      description,
      url,
      siteName: SITE.name,
      type: 'website',
      ...(image ? { images: [{ url: new URL(image, SITE.origin).toString() }] } : {}),
    },
    twitter: { card: image ? 'summary_large_image' : 'summary', title, description },
  };
}

/** Private and authenticated routes: generic metadata that leaks no capability facts (§7). */
export const privateMetadata: Metadata = {
  title: `${SITE.name} workspace`,
  description: `Private ${SITE.name} workspace.`,
  robots: { index: false, follow: false },
};

/**
 * §7 — Organization and WebSite structured data for the confirmed company identity.
 * The legal entity name is a P1 release dependency (§10); until it is supplied this markup
 * carries the brand identity only and makes no legal-entity claim.
 */
export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE.origin}/#organization`,
        name: SITE.owner,
        url: SITE.origin,
        brand: { '@type': 'Brand', name: SITE.name },
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE.origin}/#website`,
        url: SITE.origin,
        name: SITE.name,
        publisher: { '@id': `${SITE.origin}/#organization` },
      },
    ],
  };
}
