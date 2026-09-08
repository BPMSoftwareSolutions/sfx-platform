import Link from 'next/link';
import { Suspense } from 'react';

import { IntentComposer } from '@/components/ide/intent-composer';
import { Callout, Hero, Section, SectionHeader } from '@/components/ui';
import { getFeaturedCapabilities } from '@/lib/estate';
import { CTA, ROUTES } from '@/lib/routes';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Build a capability — the SideFX IDE',
  description:
    'Describe the capability you need by voice or by typing, and inspect the candidate circuit in the SideFX intent-driven environment.',
  path: '/build',
});

/** The composer reads `from` for lineage, so it renders inside Suspense (§3.3). */
async function Composer({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams;
  return <IntentComposer startingFrom={from} />;
}

export default function BuildPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const examples = getFeaturedCapabilities(3);

  return (
    <>
      <Hero
        eyebrow="SideFX IDE — intent-driven environment"
        title="What capability do you need?"
        subhead="Speak or type the capability you need. The environment resolves the ambiguity, proposes a circuit, and keeps the draft under your ownership."
      />

      <Section labelledBy="composer">
        <SectionHeader id="composer" eyebrow="Describe" title="Start with the need, in your own words." />
        <div className="max-w-3xl">
          <Suspense
            fallback={
              <div className="rounded-lg border border-grid-line bg-ink-2 p-6 text-sm text-muted">
                Loading composer…
              </div>
            }
          >
            <Composer searchParams={searchParams} />
          </Suspense>
        </div>
      </Section>

      <Section labelledBy="state">
        <SectionHeader id="state" eyebrow="Integration state" title="What works here today, and what does not" />
        <div className="grid max-w-4xl gap-4">
          <Callout tone="unavailable" title="Candidate authoring is not connected">
            <p>
              Designing a circuit from intent requires the existing Gemini Pro authoring conveyor,
              an authenticated workspace with durable job records, and the adapter that turns a
              validated candidate into a capability draft. Those integrations are open P1
              dependencies.
            </p>
            <p className="mt-2">
              Until they are connected, this page does not fabricate a candidate, and the primary
              call to action is not quietly replaced by a contact form. The launch phase is reported
              as incomplete instead.
            </p>
          </Callout>
          <Callout tone="note" title="What you can do now">
            <p>
              Speaking and typing both work, and your intent is retained on this device. Every
              published capability opens its real circuit, so the inspection experience an authored
              draft would land in is available today.
            </p>
          </Callout>
        </div>
      </Section>

      <Section labelledBy="journey">
        <SectionHeader
          id="journey"
          eyebrow="The journey"
          title="Where an intent goes once the conveyor is connected"
        />
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['Describe', 'Type or speak. The transcript stays editable, and audio is not retained by default.'],
            ['Resolve the need', 'Ambiguous identity, expected outcome, freshness, provider and environment requirements are settled by focused questions.'],
            ['Design', 'The reviewed intent goes to the authoring conveyor. Persistent authoring requires an account; signing in preserves what you already wrote.'],
            ['Inspect', 'The first valid candidate opens in your private workspace with its circuit, dependencies and unresolved obligations.'],
            ['Refine', 'Each change is a candidate revision with diagnostics. A late job result cannot overwrite newer work.'],
            ['Own', 'Download candidate artifacts once they compile, and authority plus embodiments once they are produced.'],
          ].map(([title, body], index) => (
            <li key={title} className="rounded-lg border border-grid-line bg-ink-2 p-5">
              <p className="font-mono text-xs text-signal">{String(index + 1).padStart(2, '0')}</p>
              <h3 className="mt-1 font-display text-base font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-muted">{body}</p>
            </li>
          ))}
        </ol>
      </Section>

      {examples.length > 0 ? (
        <Section labelledBy="examples">
          <SectionHeader
            id="examples"
            eyebrow="Meanwhile"
            title="Inspect a real capability circuit"
            lede="These are published estate capabilities, opened in the same viewer an authored draft would use."
          />
          <ul className="grid gap-4 sm:grid-cols-3">
            {examples.map((capability) => (
              <li key={capability.entityId}>
                <Link
                  href={`/capabilities/${capability.urlKey}`}
                  className="block h-full rounded-lg border border-grid-line bg-ink-2 p-5 hover:border-signal"
                >
                  <h3 className="font-display text-base font-semibold">{capability.title}</h3>
                  <p className="mt-1 break-all font-mono text-xs text-muted">{capability.entityId}</p>
                  <p className="mt-3 text-sm text-muted">
                    {capability.scenarios.length} scenario faces
                  </p>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-muted">
            Or browse the whole estate from{' '}
            <Link href={CTA.explore.href} className="text-signal underline">
              {CTA.explore.label.toLowerCase()}
            </Link>
            , and read what a download will contain in the{' '}
            <Link href={ROUTES.ownership.href} className="text-signal underline">
              ownership guide
            </Link>
            .
          </p>
        </Section>
      ) : null}
    </>
  );
}
