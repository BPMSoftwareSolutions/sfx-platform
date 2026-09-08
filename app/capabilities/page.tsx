import { Catalog, type CatalogItem } from '@/components/estate/catalog';
import { EstateStatusNotice, PublicationProvenance } from '@/components/estate/estate-status';
import { Hero, Section } from '@/components/ui';
import { getCapabilities, getEstateStatus } from '@/lib/estate';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Capabilities — the published estate',
  description:
    'Search the published capability estate. Every capability opens its circuit with the scenarios, states and findings the source declares.',
  path: '/capabilities',
});

export default function CapabilitiesPage() {
  const status = getEstateStatus();
  const capabilities = getCapabilities();

  const items: CatalogItem[] = capabilities.map((capability) => ({
    kind: capability.kind,
    visuals: capability.visuals,
    id: capability.entityId,
    href: `/capabilities/${capability.urlKey}`,
    title: capability.title,
    identity: capability.entityId,
    // The capability's own summary is undeclared; its scenario responsibilities are source text.
    summary: capability.summary ?? capability.scenarios[0]?.responsibility ?? null,
    facets: [{ label: 'Graph fidelity', value: capability.graphFidelity }],
    badges: [
      { label: `${capability.scenarios.length} scenarios` },
      { label: capability.graphFidelity === 'BOUNDARY' ? 'Boundary view' : 'Partial boundary', tone: 'telemetry' },
    ],
    searchText: capability.scenarios
      .map((s) => [s.scenarioId, s.responsibility, s.inputId, s.eventId, s.outcomeId].filter(Boolean).join(' '))
      .join(' '),
  }));

  return (
    <>
      <Hero
        eyebrow="Capability estate"
        title="Every capability. One estate."
        subhead="Search the published generation by name, identity, declared responsibility or contract. Each capability opens the circuit its source qualifies."
      />
      <Section>
        <EstateStatusNotice />
        {status.state !== 'UNAVAILABLE' ? (
          <div className="mt-6">
            <Catalog
              items={items}
              noun="capabilities"
              facetName="Graph fidelity"
              facetValues={['BOUNDARY', 'PARTIAL_BOUNDARY']}
              emptyMessage="This publication contains no capabilities."
            />
            <PublicationProvenance />
          </div>
        ) : null}
      </Section>
    </>
  );
}
