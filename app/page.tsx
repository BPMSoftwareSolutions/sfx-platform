import Link from 'next/link';

import { EstateStatusNotice, PublicationProvenance } from '@/components/estate/estate-status';
import { CircuitViewer } from '@/components/circuit/circuit-viewer';
import {
  Callout,
  Card,
  CtaBand,
  Hero,
  PrimaryLink,
  SecondaryLink,
  Section,
  SectionHeader,
  StatusBadge,
} from '@/components/ui';
import { getCircuitsForCapability, getEstateStatus, getFeaturedCapabilities, getMechanics, getProviders } from '@/lib/estate';
import { CTA, PLATFORM_PILLARS, ROUTES, SITE, SOLUTION_ROUTES, linkable } from '@/lib/routes';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'SideFX — Capability Management & Engineering Platform',
  description:
    'Own your capabilities. Download the semantic authority that defines a capability and use it with open-source SDA or your own architecture.',
  path: '/',
});

export default function HomePage() {
  const status = getEstateStatus();
  const featured = getFeaturedCapabilities(6);
  // §5.1 block 2 — one source-bound example, linked to its actual capability page.
  const lead = featured[0];
  const leadCircuit = lead ? getCircuitsForCapability(lead.entityId)[0] : undefined;
  const mechanics = getMechanics().slice(0, 4);
  const providers = getProviders()
    .filter((p) => p.mechanicIds.length > 0)
    .slice(0, 4);

  return (
    <>
      <Hero
        eyebrow="The SideFX intent-driven environment"
        eyebrowHref={ROUTES.build.href}
        title={SITE.tagline}
        subhead="Describe what you need. See the capability as a circuit. Download its semantic authority and available embodiments to use with open-source SDA or your own architecture."
        actions={
          <>
            <PrimaryLink href={CTA.build.href}>{CTA.build.label}</PrimaryLink>
            <SecondaryLink href={CTA.explore.href}>{CTA.explore.label}</SecondaryLink>
          </>
        }
      >
        {lead && leadCircuit ? (
          <div className="rounded-xl border border-grid-line bg-ink-2/60 p-4 sm:p-6">
            <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <Link href={`/capabilities/${lead.urlKey}`} className="font-display text-xl font-semibold hover:text-signal">
                {lead.title}
              </Link>
              <span className="font-mono text-xs text-muted">{lead.entityId}</span>
              <StatusBadge tone="telemetry">Published estate capability</StatusBadge>
            </div>
            <CircuitViewer circuit={leadCircuit} />
          </div>
        ) : (
          <EstateStatusNotice />
        )}
      </Hero>

      {/* Block 1 — Try an intent. */}
      <Section labelledBy="try-an-intent">
        <SectionHeader
          id="try-an-intent"
          eyebrow="Try an intent"
          title="Start from what you need, not from a file."
          lede={SITE.sequence}
        />
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-grid-line bg-ink-2 p-5">
            <p className="font-mono text-xs uppercase tracking-widest text-muted">Example intent</p>
            <p className="mt-3 text-lg">
              &ldquo;Connect to Yahoo Finance and retrieve stock prices for company X via RapidAPI
              marketplace.&rdquo;
            </p>
            <p className="mt-4 text-sm text-muted">
              The intent-driven environment resolves the company to an explicit symbol and exchange,
              asks which quote fields and freshness you need, and looks up an actual eligible
              marketplace listing before proposing a circuit.
            </p>
            <div className="mt-5">
              <PrimaryLink href={CTA.build.href}>{CTA.build.label}</PrimaryLink>
            </div>
          </div>
          <div className="rounded-lg border border-grid-line bg-ink-2 p-5">
            <p className="font-mono text-xs uppercase tracking-widest text-muted">Example intent</p>
            <p className="mt-3 text-lg">&ldquo;Connect to X component on landscape.cncf.io.&rdquo;</p>
            <p className="mt-4 text-sm text-muted">
              A project name alone is not capability intent. The environment resolves the actual
              project and the action you want, then uses the project&rsquo;s own interface and
              deployment documentation to identify a provider responsibility and its environment
              requirements.
            </p>
            <div className="mt-5">
              <SecondaryLink href={ROUTES.ecosystem.href}>How provider discovery works</SecondaryLink>
            </div>
          </div>
        </div>
      </Section>

      {/* Block 3 — Take it with you. */}
      <Section labelledBy="take-it-with-you">
        <SectionHeader
          id="take-it-with-you"
          eyebrow="Take it with you"
          title="Download the meaning, not just the code."
          lede="A download identifies the capability and revision, its semantic authority and digests, contracts, dependency references, selected embodiment targets, invocation instructions, provenance and available verification evidence."
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <Card title="Download authority">
            The semantic authority that defines the capability&rsquo;s behavior, with its contracts
            and digests.
          </Card>
          <Card title="Download embodiments">
            The target artifacts produced for that revision, each with its own build and conformance
            record.
          </Card>
          <Card title="Download bundle">
            Both, with target selection, licenses, runtime requirements and the dependencies you must
            acquire separately.
          </Card>
        </div>
        <div className="mt-6">
          <Callout tone="unavailable" title="Downloads are not yet operational in this build">
            <p>
              The capability export adapter, the verified SDA release reference and the
              own-architecture integration example are open P1 dependencies. Until an export is
              produced and independently executed, this site describes the ownership contract without
              offering a download.
            </p>
            <p className="mt-2">
              <Link href={ROUTES.ownership.href} className="text-signal underline">
                Read what the bundle will contain
              </Link>
            </p>
          </Callout>
        </div>
      </Section>

      {/* Block 4 — Explore the estate. */}
      <Section labelledBy="explore-the-estate">
        <SectionHeader
          id="explore-the-estate"
          eyebrow="Explore the estate"
          title="Capabilities, the parts they reuse, and who implements them."
          lede="Every card below is queried from the published estate projection. Each capability opens its circuit."
        />
        <EstateStatusNotice />

        {featured.length > 0 ? (
          <>
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((capability) => (
                <li key={capability.entityId}>
                  <Card
                    href={`/capabilities/${capability.urlKey}`}
                    title={capability.title}
                    footer={
                      <div className="flex flex-wrap gap-2">
                        <StatusBadge>
                          {capability.scenarios.length} scenario
                          {capability.scenarios.length === 1 ? '' : 's'}
                        </StatusBadge>
                        <StatusBadge tone="telemetry">
                          {capability.graphFidelity === 'BOUNDARY' ? 'Boundary view' : 'Partial boundary'}
                        </StatusBadge>
                      </div>
                    }
                  >
                    <span className="font-mono text-xs break-all">{capability.entityId}</span>
                  </Card>
                </li>
              ))}
            </ul>

            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              <div>
                <h3 className="mb-3 font-display text-lg font-semibold">Reusable mechanics</h3>
                <ul className="space-y-2">
                  {mechanics.map((mechanic) => (
                    <li key={mechanic.entityId}>
                      <Link
                        href={`/mechanics/${mechanic.urlKey}`}
                        className="block rounded border border-grid-line bg-ink-2 p-3 text-sm hover:border-signal"
                      >
                        <span className="font-mono text-xs break-all text-muted">{mechanic.entityId}</span>
                        <span className="mt-1 block">
                          {mechanic.summary ?? 'No declared description in this generation.'}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <Link href={ROUTES.mechanics.href} className="mt-3 inline-block text-sm text-signal underline">
                  All mechanics
                </Link>
              </div>
              <div>
                <h3 className="mb-3 font-display text-lg font-semibold">Declared implementers</h3>
                <ul className="space-y-2">
                  {providers.map((provider) => (
                    <li key={provider.entityId}>
                      <Link
                        href={`/providers/${provider.urlKey}`}
                        className="block rounded border border-grid-line bg-ink-2 p-3 text-sm hover:border-signal"
                      >
                        <span className="block break-all">{provider.title}</span>
                        <span className="mt-1 block text-xs text-muted">
                          Declares {provider.mechanicIds.length} mechanic
                          {provider.mechanicIds.length === 1 ? '' : 's'}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <Link href={ROUTES.providers.href} className="mt-3 inline-block text-sm text-signal underline">
                  All providers
                </Link>
              </div>
            </div>
          </>
        ) : null}

        <PublicationProvenance />
      </Section>

      {/* Block 5 — How SideFX works. */}
      <Section labelledBy="how-it-works">
        <SectionHeader
          id="how-it-works"
          eyebrow="How SideFX works"
          title="One meaning, inspected and projected."
          lede="SideFX stands for Semantic Intent-Driven Engineering Effects. Intent expresses the need, engineering makes the capability inspectable and executable, and effects deliver the intended experience."
        />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {linkable(PLATFORM_PILLARS).map((pillar) => (
            <li key={pillar.href}>
              <Card href={pillar.href} title={pillar.label}>
                {pillar.description}
              </Card>
            </li>
          ))}
        </ul>
      </Section>

      {/* Block 6 — Why ownership matters. */}
      <Section labelledBy="why-ownership">
        <SectionHeader
          id="why-ownership"
          eyebrow="Why ownership matters"
          title="Provider independence, because meaning lives in canonical authority."
          lede="Generated code is an embodiment. The authority is what you own — which is why a provider can be replaced when the replacement satisfies the declared contracts and verification obligations."
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <Card title="Inspect">
            Read the capability&rsquo;s inputs, events, responsibilities and outcomes as the source
            declares them, with unresolved references left visible.
          </Card>
          <Card title="Export">
            Take the authority and available embodiments, with a manifest that identifies the exact
            revision and its dependency closure.
          </Card>
          <Card title="Operate">
            Manage and invoke the capability with open-source SDA or your own architecture. A download
            must be usable without an ongoing SideFX session.
          </Card>
        </div>
        <div className="mt-6">
          <SecondaryLink href={ROUTES.managedCapabilityProvider.href}>
            The Managed Capability Provider category
          </SecondaryLink>
        </div>
      </Section>

      {/* Block 7 — Audience and ecosystem. */}
      <Section labelledBy="audiences">
        <SectionHeader id="audiences" eyebrow="Who it is for" title="Pick the route that matches your work." />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {linkable(SOLUTION_ROUTES).map((route) => (
            <li key={route.href}>
              <Card href={route.href} title={route.label} />
            </li>
          ))}
        </ul>
      </Section>

      {/* Block 8 — Learn the method. */}
      <Section labelledBy="learn">
        <SectionHeader
          id="learn"
          eyebrow="Learn the method"
          title="Start with the quickstart and the SCL guide."
          lede="Training courses and the writing archive are planned work; they are not published yet, so they are described here rather than linked."
        />
        <ul className="grid gap-4 sm:grid-cols-2">
          {linkable(['quickstart', 'scl']).map((route) => (
            <li key={route.href}>
              <Card href={route.href} title={route.label} />
            </li>
          ))}
        </ul>
      </Section>

      <CtaBand
        title="Own your capabilities."
        actions={
          <>
            <PrimaryLink href={CTA.build.href}>{CTA.build.label}</PrimaryLink>
            <SecondaryLink href={CTA.talkToUs.href}>{CTA.talkToUs.label}</SecondaryLink>
          </>
        }
      >
        {status.state === 'UNAVAILABLE'
          ? 'Estate browsing is currently unavailable in this build.'
          : 'Describe a capability, inspect its circuit, and decide how you want to own it.'}
      </CtaBand>
    </>
  );
}
