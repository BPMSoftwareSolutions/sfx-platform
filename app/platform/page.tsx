import { EstateStatusNotice, PublicationProvenance } from '@/components/estate/estate-status';
import {
  Callout,
  Card,
  CtaBand,
  FactList,
  Hero,
  PrimaryLink,
  SecondaryLink,
  Section,
  SectionHeader,
} from '@/components/ui';
import { getPublication } from '@/lib/estate';
import { CTA, PLATFORM_PILLARS, ROUTES, linkable } from '@/lib/routes';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Platform — one estate for every capability',
  description:
    'The SideFX platform: an intent-driven environment, executable meaning, capability circuits, projections, blueprints and governance over one capability estate.',
  path: '/platform',
});

export default function PlatformPage() {
  const publication = getPublication();

  return (
    <>
      <Hero
        eyebrow="Platform"
        title="One platform for your entire capability estate."
        subhead="Capability sovereignty, ownership you can exercise, and the flexibility to scale without handing your meaning to a provider."
        actions={
          <>
            <PrimaryLink href={CTA.build.href}>{CTA.build.label}</PrimaryLink>
            <SecondaryLink href={CTA.explore.href}>{CTA.explore.label}</SecondaryLink>
          </>
        }
      />

      <Section labelledBy="journey">
        <SectionHeader
          id="journey"
          eyebrow="The IDE journey"
          title="Intent to owned capability."
          lede="The SideFX IDE is an intent-driven environment. You describe a need; it proposes a circuit you can inspect, refine and take with you."
        />
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Describe', 'Type or speak the capability you need. The transcript stays editable.'],
            ['Inspect', 'Read the candidate circuit: inputs, events, responsibilities, outcomes and provider responsibilities.'],
            ['Verify', 'Select targets and providers, and see the readiness and results the source actually records.'],
            ['Own', 'Download the semantic authority and available embodiments, and operate them where you choose.'],
          ].map(([title, body], index) => (
            <li key={title}>
              <Card title={`${index + 1}. ${title}`}>{body}</Card>
            </li>
          ))}
        </ol>
      </Section>

      <Section labelledBy="architecture">
        <SectionHeader
          id="architecture"
          eyebrow="Architecture"
          title="How meaning moves through the platform."
          lede="Estate discovery is an input. Published inspection is a read projection. Neither is the authority."
        />
        <div className="overflow-x-auto rounded-lg border border-grid-line bg-ink-2 p-6">
          <ol className="flex min-w-[720px] items-stretch gap-3 font-mono text-xs">
            {[
              'Intent',
              'Candidate design',
              'Verified authority',
              'Available embodiments',
              'Execution evidence',
            ].map((step, index, all) => (
              <li key={step} className="flex flex-1 items-center gap-3">
                <span className="flex-1 rounded border border-grid-line bg-ink px-3 py-4 text-center text-text">
                  {step}
                </span>
                {index < all.length - 1 ? (
                  <span aria-hidden="true" className="text-signal">
                    →
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
        <p className="mt-4 max-w-3xl text-sm text-muted">
          Each stage keeps its own state. A capability that can attempt an embodiment does not
          thereby have an executable artifact, and an executable artifact is not a conformance
          result.
        </p>
      </Section>

      <Section labelledBy="pillars">
        <SectionHeader id="pillars" eyebrow="Pillars" title="The parts of the platform" />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {linkable(PLATFORM_PILLARS).map((pillar) => (
            <li key={pillar.href}>
              <Card href={pillar.href} title={pillar.label}>
                {pillar.description}
              </Card>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-muted">
          Governed knowledge across the estate is planned work. It is not linked here because its
          route does not exist yet.
        </p>
      </Section>

      <Section labelledBy="estate-backed">
        <SectionHeader
          id="estate-backed"
          eyebrow="From the published estate"
          title="What this generation actually contains"
          lede="These figures are read from the published generation at build time. They are not hardcoded marketing numbers."
        />
        <EstateStatusNotice />
        {publication ? (
          <div className="mt-6 max-w-3xl">
            <FactList
              facts={[
                { term: 'Managed capabilities', value: String(publication.coverage.managedCapabilities) },
                { term: 'Published capability pages', value: String(publication.coverage.publishedCapabilities) },
                { term: 'Scenario faces', value: String(publication.coverage.scenarioFaces) },
                { term: 'Mechanics', value: String(publication.coverage.mechanics) },
                { term: 'Providers', value: String(publication.coverage.providers) },
                {
                  term: 'Provider–mechanic relationships',
                  value: String(publication.coverage.providerMechanicRelationships),
                },
                {
                  term: 'Blueprints',
                  value: `${publication.coverage.blueprints} (${publication.coverage.blueprintNodes} nodes, ${publication.coverage.blueprintEdges} edges)`,
                },
                {
                  term: 'Entity images ready',
                  value: `${publication.coverage.visualsReady} of ${publication.coverage.visualsRequired} required`,
                },
              ]}
            />
            <PublicationProvenance />
          </div>
        ) : null}
      </Section>

      <Section>
        <Callout tone="unavailable" title="Ownership is documented here; it is not yet demonstrated">
          <p>
            The ownership promise requires a reviewed bundle, a documented import and invocation
            using SDA, and a documented integration with a customer-owned architecture — each tied to
            the exact export. Those adapters are open P1 dependencies, so this site describes the
            contract and does not present a completed demonstration.
          </p>
        </Callout>
      </Section>

      <CtaBand
        title="Start from a capability you need."
        actions={
          <>
            <PrimaryLink href={CTA.build.href}>{CTA.build.label}</PrimaryLink>
            <SecondaryLink href={ROUTES.managedCapabilityProvider.href}>
              The category thesis
            </SecondaryLink>
          </>
        }
      />
    </>
  );
}
