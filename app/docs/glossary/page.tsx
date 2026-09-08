import { Hero, Section, SectionHeader } from '@/components/ui';
import { SITE } from '@/lib/routes';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Glossary',
  description:
    'Plain-language definitions for the terms used across SideFX: capability, estate, SCL, semantic authority, embodiment, conformance, evidence and more.',
  path: '/docs/glossary',
});

/** §7 — visible glossary entries, each emitted as DefinedTerm structured data. */
const TERMS: { term: string; definition: string }[] = [
  {
    term: 'Capability',
    definition:
      'A unit of behavior with a declared identity: what it accepts, what triggers it, what it is responsible for and what it produces.',
  },
  {
    term: 'Capability estate',
    definition:
      'The full inventory of an organisation’s capabilities, each with an identity, a revision, declared relationships and visible gaps.',
  },
  {
    term: 'IDE (intent-driven environment)',
    definition:
      'The SideFX authoring environment. You describe an intent; it proposes a capability circuit you can inspect and refine. Also described as an intent-design environment when the emphasis is on circuit design.',
  },
  {
    term: 'SCL (SideFX Circuit Language)',
    definition:
      'The language of executable capability circuits. It carries typed primitives and route families, and compiles deterministically to a graph and a rendering.',
  },
  {
    term: 'SDA (Scenario-Driven Architecture)',
    definition:
      'The open-source architecture for managing and invoking capabilities. You may operate a downloaded capability with SDA or with your own architecture.',
  },
  {
    term: 'Semantic authority',
    definition:
      'The canonical definition of a capability’s behavior. It is what you own and download; generated code is downstream of it.',
  },
  {
    term: 'Scenario',
    definition:
      'One face of a capability: a specific input, event, responsibility and outcome under that capability’s ownership.',
  },
  { term: 'Input', definition: 'What a capability accepts before it acts, governed by a declared contract.' },
  { term: 'Event', definition: 'What triggers a capability to act, under a declared authority.' },
  { term: 'Outcome', definition: 'What a capability produces when it acts.' },
  {
    term: 'Experience',
    definition:
      'What a person can actually do or see as a result of the capability. Kept separate from the data product it returns.',
  },
  {
    term: 'Provider',
    definition:
      'A declared implementer of a responsibility. A provider identity is distinct from a capability identity and from an operating binding.',
  },
  {
    term: 'Embodiment',
    definition:
      'An artifact produced for a specific target from a capability’s definition — for example a SQL, Node, Python or C# realisation.',
  },
  {
    term: 'Projection',
    definition:
      'Resolving a capability definition against a specific target family. Projection precedes an embodiment and does not guarantee one.',
  },
  {
    term: 'Blueprint',
    definition:
      'The design authority for a circuit: its topology, progress rules, provider slots and evidence obligations. Distinct from a runtime plan.',
  },
  {
    term: 'Conformance',
    definition:
      'A scoped result showing that an embodiment satisfied its declared contract under stated checks. Never generalised beyond that scope.',
  },
  {
    term: 'Cross-Apply',
    definition:
      'Comparing one capability’s meaning against another target or realisation to check that the same definition holds across them.',
  },
  {
    term: 'Evidence',
    definition:
      'Attributable support for a claim, carrying its own basis: declared, observed, target, gap or staging. Absence of evidence is shown as absence.',
  },
  {
    term: 'Telemetry',
    definition:
      'Observed measurements from real execution, bound to an execution record and a timestamp. Illustrative flow is not telemetry.',
  },
  {
    term: 'Monotonic progress',
    definition:
      'A circuit design rule that keeps progress well-founded. It does not by itself create an append-only audit trail.',
  },
  {
    term: 'Managed Capability Provider',
    definition:
      'A provider that operates capabilities the customer owns, where the authority is downloadable and the operator is a choice.',
  },
  {
    term: 'Boundary view',
    definition:
      'The circuit rendering used when the source cannot qualify full topology: the declared input, event, responsibility and outcome, with unresolved references left visible.',
  },
];

export default function GlossaryPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': TERMS.map((entry) => ({
      '@type': 'DefinedTerm',
      name: entry.term,
      description: entry.definition,
      inDefinedTermSet: `${SITE.origin}/docs/glossary`,
    })),
  };

  return (
    <>
      <Hero
        eyebrow="Glossary"
        title="The words, defined."
        subhead="Every term used on the product pages, in plain language. Advanced terms are also defined where they matter."
      />
      <Section labelledBy="terms">
        <SectionHeader id="terms" eyebrow="Definitions" title={`${TERMS.length} terms`} />
        <dl className="max-w-3xl divide-y divide-grid-line rounded-lg border border-grid-line bg-ink-2">
          {TERMS.map((entry) => (
            <div key={entry.term} className="p-5">
              <dt className="font-display text-base font-semibold">{entry.term}</dt>
              <dd className="mt-2 text-sm text-muted">{entry.definition}</dd>
            </div>
          ))}
        </dl>
      </Section>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
