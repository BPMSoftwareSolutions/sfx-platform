import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

import { SiteFooter } from '@/components/shell/site-footer';
import { SiteNav } from '@/components/shell/site-nav';
import { SITE } from '@/lib/routes';
import { organizationJsonLd } from '@/lib/seo';

export const metadata: Metadata = {
  metadataBase: new URL(SITE.origin),
  title: {
    default: `${SITE.name} — Capability Management & Engineering Platform`,
    template: `%s — ${SITE.name}`,
  },
  description:
    'Own your capabilities. Describe what you need, inspect the capability circuit, and download its semantic authority and available embodiments.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* §6.3 — only the required weights of the three families are loaded. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap"
        />
      </head>
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <SiteNav />
        <main id="main" tabIndex={-1}>
          {children}
        </main>
        <SiteFooter />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd()) }}
        />
      </body>
    </html>
  );
}
