import Link from 'next/link';

import { Callout, CtaBand, Hero, PrimaryLink, SecondaryLink, Section, SectionHeader } from '@/components/ui';
import { getMechanics, getProviders, getPublication } from '@/lib/estate';
import { CTA, ROUTES } from '@/lib/routes';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Ecosystem — off-the-shelf capabilities, your authority',
  description:
    'Use existing mechanics and providers, then discover more through RapidAPI and the CNCF landscape. Discovery, candidacy, binding and verification stay distinct.',
  path: '/ecosystem',
});

export default function EcosystemPage() {
  const publication = getPublication();
  const providers = getProviders()
    .filter((p) => p.mechanicIds.length > 2)
    .slice(0, 6);
  const mechanics = getMechanics()
    .filter((m) => m.providerIds.length > 0 && m.summary)
    .slice(0, 6);

  return (
    <>
      <Hero
        eyebrow="Ecosystem"
        title="Off-the-shelf capabilities. Your semantic authority."
        subhead="Reuse what exists — inside the estate first, then beyond it — while the meaning of your capability stays yours."
        actions={
          <>
            <PrimaryLink href={CTA.build.href}>{CTA.build.label}</PrimaryLink>
            <SecondaryLink href={ROUTES.mechanics.href}>Browse mechanics</SecondaryLink>
          </>
        }
      />

      <Section labelledBy="internal">
        <SectionHeader
          id="internal"
          eyebrow="Start inside the estate"
          title="The reusable parts you already have"
          lede="Before reaching for a marketplace, the estate itself already declares reusable responsibilities and the providers that implement them."
        />
        {publication ? (
          <p className="mb-6 text-sm text-muted">
            This generation publishes {publication.coverage.mechanics} mechanics,{' '}
            {publication.coverage.providers} providers and{' '}
            {publication.coverage.providerMechanicRelationships} declared provider–mechanic
            relationships.
          </p>
        ) : null}
        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <h3 className="mb-3 font-display text-lg font-semibold">Declared responsibilities</h3>
            <ul className="space-y-2">
              {mechanics.map((mechanic) => (
                <li key={mechanic.entityId}>
                  <Link
                    href={`/mechanics/${mechanic.urlKey}`}
                    className="block rounded border border-grid-line bg-ink-2 p-3 text-sm hover:border-signal"
                  >
                    <span className="break-all font-mono text-xs text-muted">{mechanic.entityId}</span>
                    <span className="mt-1 block">{mechanic.summary}</span>
                  </Link>
                </li>
              ))}
            </ul>
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
                      {provider.mechanicIds.length} declared mechanics
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="mt-6 text-sm text-muted">
          Similar mechanic names are not interchangeable contracts, and an internal provider is not a
          marketplace service. Each page shows exactly what its source declares.
        </p>
      </Section>

      <Section labelledBy="states">
        <SectionHeader
          id="states"
          eyebrow="Four different states"
          title="A landscape entry is not an integration"
          lede="Discovery, candidacy, binding and verified execution are separate. Reaching one does not establish the next."
        />
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Discovered project', 'It exists and is listed somewhere — a marketplace, a landscape, a registry.'],
            ['Candidate provider', 'It plausibly satisfies a responsibility your capability declares.'],
            ['Bound provider', 'It is selected for a specific capability revision, with contracts checked.'],
            ['Verified execution', 'It actually ran against the contract, in a recorded environment.'],
          ].map(([title, body], index) => (
            <li key={title} className="rounded-lg border border-grid-line bg-ink-2 p-5">
              <p className="font-mono text-xs text-signal">{String(index + 1).padStart(2, '0')}</p>
              <h3 className="mt-1 font-display text-base font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-muted">{body}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section labelledBy="discovery">
        <SectionHeader
          id="discovery"
          eyebrow="External discovery"
          title="Where candidate providers come from"
        />
        <div className="max-w-3xl space-y-4 text-sm text-muted">
          <p>
            API marketplaces such as RapidAPI and the CNCF landscape are discovery sources. They tell
            you a project or listing exists; they do not establish that it is remotely hosted, that
            you have access, or that it satisfies your contract.
          </p>
          <p>
            Provider selection then works from the project&rsquo;s own interface and deployment
            documentation: what it accepts, what it returns, which credentials and environment it
            needs, and what remains unresolved.
          </p>
        </div>
        <div className="mt-6 max-w-3xl">
          <Callout tone="note" title="No partnership is implied">
            <p>
              Naming a marketplace or landscape identifies a discovery source. It does not imply a
              working integration, an affiliation or a partnership, and no provider artwork on this
              site substitutes for an official logo.
            </p>
          </Callout>
        </div>
      </Section>

      <CtaBand
        title="Compose from what exists."
        actions={
          <>
            <PrimaryLink href={CTA.build.href}>{CTA.build.label}</PrimaryLink>
            <SecondaryLink href={ROUTES.providers.href}>Browse providers</SecondaryLink>
          </>
        }
      />
    </>
  );
}
