import { Catalog, type CatalogItem } from '@/components/estate/catalog';
import { EstateStatusNotice, PublicationProvenance } from '@/components/estate/estate-status';
import { Hero, Section } from '@/components/ui';
import { getEstateStatus, getProviders } from '@/lib/estate';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Providers — declared implementers',
  description:
    'The published provider library: each provider’s declared mechanics and capability relationships, with qualification and execution kept as separate states.',
  path: '/providers',
});

export default function ProvidersPage() {
  const status = getEstateStatus();
  const providers = getProviders();
  const profiles = [
    ...new Set(providers.map((p) => p.declarationProfile).filter((p): p is string => Boolean(p))),
  ].sort();

  const items: CatalogItem[] = providers.map((provider) => ({
    id: provider.entityId,
    href: `/providers/${provider.urlKey}`,
    title: provider.title,
    identity: provider.entityId,
    summary: provider.summary,
    facets: [{ label: 'Declaration profile', value: provider.declarationProfile ?? 'unknown' }],
    badges: [
      {
        label: `${provider.mechanicIds.length} mechanic${provider.mechanicIds.length === 1 ? '' : 's'}`,
        tone: provider.mechanicIds.length > 0 ? ('signal' as const) : ('neutral' as const),
      },
      { label: `${provider.capabilityRelationshipCount} capability links` },
    ],
    searchText: [provider.declarationProfile, ...provider.mechanicIds].filter(Boolean).join(' '),
  }));

  return (
    <>
      <Hero
        eyebrow="Provider library"
        title="Who declares an implementation."
        subhead="A provider identity is distinct from a capability identity and from an operating binding. This library shows what each provider declares, and nothing beyond it."
      />
      <Section>
        <EstateStatusNotice />
        {status.state !== 'UNAVAILABLE' ? (
          <div className="mt-6">
            <Catalog
              items={items}
              noun="providers"
              facetName="Declaration profile"
              facetValues={profiles}
              emptyMessage="This publication contains no providers."
            />
            <PublicationProvenance />
          </div>
        ) : null}
      </Section>
    </>
  );
}
