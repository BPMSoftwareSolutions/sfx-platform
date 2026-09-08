import Link from 'next/link';

import { Callout, CtaBand, Faq, Hero, PrimaryLink, SecondaryLink, Section, SectionHeader } from '@/components/ui';
import { getFeaturedCapabilities } from '@/lib/estate';
import { CTA, ROUTES } from '@/lib/routes';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Executable meaning — own the definition, not the output',
  description:
    'Executable meaning is the semantic authority that defines a capability’s behavior: a downloadable definition with contracts, digests and a projection path to targets.',
  path: '/platform/executable-meaning',
});

const FAQ_ITEMS = [
  {
    question: 'What exactly do I own?',
    answer:
      'The semantic authority for the capability and revision you exported: its definition, contracts, dependency references, provenance and any verification evidence produced for it. Credentials are supplied in your environment and are never part of a bundle.',
  },
  {
    question: 'Do I still need SideFX to run it?',
    answer:
      'No. A download must be usable without an ongoing SideFX session. Independent use may still require the declared runtimes, provider accounts, credentials and dependencies named in the manifest.',
  },
  {
    question: 'Can I change providers without changing meaning?',
    answer:
      'Meaning is preserved when the replacement satisfies the declared contracts and verification obligations. The binding or adapter work that remains is stated explicitly rather than promised away.',
  },
  {
    question: 'What are the limits today?',
    answer:
      'The export adapter is not connected in this build, so no download is offered. Target availability is not carried by the current published generation, so no target matrix is claimed for any capability.',
  },
];

export default function ExecutableMeaningPage() {
  const example = getFeaturedCapabilities(1)[0];

  return (
    <>
      <Hero
        eyebrow="Executable meaning"
        title="Meaning you own. Meaning that executes."
        subhead="A capability's behavior is defined by its semantic authority, not by whichever code a generator last produced. That authority is what you inspect, verify and download."
        actions={
          <>
            <PrimaryLink href={CTA.build.href}>{CTA.build.label}</PrimaryLink>
            <SecondaryLink href={ROUTES.ownership.href}>What a bundle contains</SecondaryLink>
          </>
        }
      />

      <Section labelledBy="definition">
        <SectionHeader
          id="definition"
          eyebrow="Definition"
          title="What executable meaning is, in plain language"
        />
        <div className="max-w-3xl space-y-4 text-lg">
          <p>
            A capability declares what comes in, what triggers it, what it is responsible for, and
            what comes out. That declaration is a definition a machine can act on and a person can
            read — which is why it can be projected into a target language and also inspected as a
            circuit.
          </p>
          <p>
            Generated code is an <em>embodiment</em> of that definition. It is downstream. Replace it
            and the meaning survives; lose the definition and no amount of generated code tells you
            what the capability was supposed to do.
          </p>
        </div>
        {example ? (
          <p className="mt-6 text-sm text-muted">
            A published example:{' '}
            <Link href={`/capabilities/${example.urlKey}`} className="text-signal underline">
              {example.title}
            </Link>{' '}
            declares {example.scenarios.length} scenario faces, each with its own input, event,
            responsibility and outcome.
          </p>
        ) : null}
      </Section>

      <Section labelledBy="projection">
        <SectionHeader
          id="projection"
          eyebrow="Projection"
          title="Authority → target projection → embodiment → scoped checks"
          lede="Each arrow is a separate state with its own evidence. None of them is implied by the one before it."
        />
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Authority', 'The canonical definition and its contracts, with a digest that identifies the exact revision.'],
            ['Projection', 'The definition resolved against a specific target family — SQL, Node, Python or C#.'],
            ['Embodiment', 'An actual artifact produced for that target. Its existence is recorded, not assumed.'],
            ['Conformance', 'Scoped checks against the declared contract. Missing results stay explicit.'],
          ].map(([title, body]) => (
            <li key={title} className="rounded-lg border border-grid-line bg-ink-2 p-5">
              <h3 className="font-display text-base font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-muted">{body}</p>
            </li>
          ))}
        </ol>
        <div className="mt-6">
          <Callout tone="limitation" title="No target matrix is published for this generation">
            <p>
              The current published generation carries no target requirement or resolution records,
              so no capability page claims a supported target. When those records are published, each
              target will show its own compilation, execution and conformance state separately.
            </p>
          </Callout>
        </div>
      </Section>

      <Section labelledBy="faq">
        <SectionHeader id="faq" eyebrow="Questions" title="Ownership, dependencies and limitations" />
        <div className="max-w-3xl">
          <Faq items={FAQ_ITEMS} />
        </div>
      </Section>

      <CtaBand
        title="Inspect a real capability's meaning."
        actions={
          <>
            <PrimaryLink href={CTA.explore.href}>{CTA.explore.label}</PrimaryLink>
            <SecondaryLink href={ROUTES.scl.href}>Read the SCL guide</SecondaryLink>
          </>
        }
      />
    </>
  );
}
