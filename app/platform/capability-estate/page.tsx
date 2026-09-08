import Link from 'next/link';

import { EstateStatusNotice, PublicationProvenance } from '@/components/estate/estate-status';
import { Callout, CtaBand, FactList, Hero, PrimaryLink, SecondaryLink, Section, SectionHeader } from '@/components/ui';
import { getPublication } from '@/lib/estate';
import { CTA, ROUTES } from '@/lib/routes';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Capability estate — every capability, one inventory',
  description:
    'Manage one capability estate: a published inventory of capabilities, mechanics, providers and scenarios with the lineage and findings the source records.',
  path: '/platform/capability-estate',
});

export default function CapabilityEstatePage() {
  const publication = getPublication();

  return (
    <>
      <Hero
        eyebrow="Capability estate"
        title="Every capability. One estate."
        subhead="AI coding platforms produce sprawl. An estate answers it with one inventory where each capability has an identity, a revision, declared relationships and visible gaps."
        actions={
          <>
            <PrimaryLink href={CTA.explore.href}>{CTA.explore.label}</PrimaryLink>
            <SecondaryLink href={ROUTES.mechanics.href}>See the reusable parts</SecondaryLink>
          </>
        }
      />

      <Section labelledBy="inventory">
        <SectionHeader
          id="inventory"
          eyebrow="Live inventory"
          title="The published generation, as it is"
          lede="Every count below carries its generation and its coverage. Search availability is a separate matter from retrieval readiness."
        />
        <EstateStatusNotice />
        {publication ? (
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <FactList
              facts={[
                { term: 'Capability identities', value: String(publication.coverage.capabilityIdentities) },
                { term: 'Capability definitions', value: String(publication.coverage.capabilityDefinitions) },
                { term: 'Managed capabilities', value: String(publication.coverage.managedCapabilities) },
                { term: 'Published capability pages', value: String(publication.coverage.publishedCapabilities) },
                { term: 'Scenario faces', value: String(publication.coverage.scenarioFaces) },
                { term: 'Mechanics', value: String(publication.coverage.mechanics) },
                { term: 'Providers', value: String(publication.coverage.providers) },
              ]}
            />
            <div>
              <h3 className="mb-3 font-display text-lg font-semibold">Findings preserved from source</h3>
              <ul className="space-y-3">
                {publication.findings.map((finding) => (
                  <li key={finding.code} className="rounded-lg border border-telemetry/40 bg-ink-2 p-4">
                    <p className="font-mono text-xs text-telemetry">
                      {finding.code} · {finding.count}
                    </p>
                    <p className="mt-1 text-sm text-muted">{finding.message}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
        {publication ? <PublicationProvenance /> : null}
      </Section>

      <Section labelledBy="scopes">
        <SectionHeader
          id="scopes"
          eyebrow="Scopes stay separate"
          title="Managed capabilities and platform capability identities are not one number"
          lede="Counting them together would inflate the estate. They are published, filtered and counted separately."
        />
        <div className="max-w-3xl space-y-4 text-sm text-muted">
          <p>
            The selected model records capability identities across a larger set of definitions:
            several definitions can describe the same identity at different revisions. The managed
            estate is its own membership contract, and platform capability identities belong to the
            platform&rsquo;s own catalog.
          </p>
          <p>
            Where a managed capability carries no scenario face in a generation, it has no publishable
            circuit. That difference is published as a finding rather than reconciled into a rounder
            number.
          </p>
        </div>
      </Section>

      <Section labelledBy="migration">
        <SectionHeader
          id="migration"
          eyebrow="Migration"
          title="Bring one capability in before you bring them all"
          lede="A migration starts with a single capability: assess what it declares, identify the dependencies you keep, and validate the result before moving the next one."
        />
        <div className="flex flex-wrap gap-3">
          <SecondaryLink href={ROUTES.solutionsSmb.href}>How a staged migration works</SecondaryLink>
          <SecondaryLink href={CTA.discussMigration.href}>{CTA.discussMigration.label}</SecondaryLink>
        </div>
        <div className="mt-6">
          <Callout tone="limitation" title="No scoped cost or migration example is published yet">
            <p>
              A cost or migration claim needs a scoped example with its assumptions stated. Until one
              exists, this site describes the workflow and does not put a saving on it.
            </p>
          </Callout>
        </div>
      </Section>

      <CtaBand
        title="Look at the estate yourself."
        actions={
          <>
            <PrimaryLink href={CTA.explore.href}>{CTA.explore.label}</PrimaryLink>
            <Link
              href={ROUTES.providers.href}
              className="rounded border border-grid-line px-5 py-3 text-sm font-semibold hover:border-signal"
            >
              Browse providers
            </Link>
          </>
        }
      />
    </>
  );
}
