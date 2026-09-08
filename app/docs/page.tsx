import { Card, Hero, Section, SectionHeader } from '@/components/ui';
import { DOC_ROUTES, linkable } from '@/lib/routes';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Documentation',
  description:
    'Launch documentation for SideFX: the quickstart, the ownership guide, the SCL guide and the glossary of terms used across the product.',
  path: '/docs',
});

const DESCRIPTIONS: Record<string, string> = {
  '/docs/quickstart': 'Intent to circuit to export to independent use, on a supported example.',
  '/docs/ownership': 'What a bundle contains, and what it takes to run a capability without us.',
  '/docs/scl': 'The SideFX Circuit Language: symbols, a complete example, and design versus execution.',
  '/docs/glossary': 'Plain-language definitions for every term used on the product pages.',
};

export default function DocsPage() {
  return (
    <>
      <Hero
        eyebrow="Docs"
        title="Learn the method."
        subhead="Four documents cover the launch surface: how to go from intent to an owned capability, what ownership actually means, how to read a circuit, and what each term means."
      />
      <Section labelledBy="index">
        <SectionHeader id="index" eyebrow="Launch documentation" title="Start here" />
        <ul className="grid gap-4 sm:grid-cols-2">
          {linkable(DOC_ROUTES).map((route) => (
            <li key={route.href}>
              <Card href={route.href} title={route.label}>
                {DESCRIPTIONS[route.href]}
              </Card>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
