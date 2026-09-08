import { Catalog, type CatalogItem } from '@/components/estate/catalog';
import { EstateStatusNotice, PublicationProvenance } from '@/components/estate/estate-status';
import { Callout, Hero, Section } from '@/components/ui';
import { getEstateStatus, getMechanics, getPublication } from '@/lib/estate';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Mechanics — reusable responsibilities',
  description:
    'The published mechanic library: each mechanic’s declared responsibility, its definition profile and the providers that declare an implementation.',
  path: '/mechanics',
});

export default function MechanicsPage() {
  const status = getEstateStatus();
  const mechanics = getMechanics();
  const publication = getPublication();
  const kinds = [...new Set(mechanics.map((m) => m.mechanicKind).filter((k): k is string => Boolean(k)))].sort();

  const items: CatalogItem[] = mechanics.map((mechanic) => ({
    kind: mechanic.kind,
    visuals: mechanic.visuals,
    id: mechanic.entityId,
    href: `/mechanics/${mechanic.urlKey}`,
    title: mechanic.title,
    identity: mechanic.entityId,
    summary: mechanic.summary,
    facets: [{ label: 'Kind', value: mechanic.mechanicKind ?? 'unknown' }],
    badges: [
      ...(mechanic.mechanicKind ? [{ label: mechanic.mechanicKind }] : []),
      {
        label:
          mechanic.providerIds.length > 0
            ? `${mechanic.providerIds.length} declared implementer${mechanic.providerIds.length === 1 ? '' : 's'}`
            : 'No declared implementer',
        tone: mechanic.providerIds.length > 0 ? ('signal' as const) : ('neutral' as const),
      },
    ],
    searchText: [mechanic.summary, mechanic.definitionProfile, ...mechanic.providerIds].filter(Boolean).join(' '),
  }));

  const withoutNames = publication?.coverage.mechanicsWithoutDeclaredName ?? 0;

  return (
    <>
      <Hero
        eyebrow="Mechanic library"
        title="The reusable parts of your capabilities."
        subhead="A mechanic is a declared responsibility that capabilities reuse and providers implement. Every mechanic here is generated from the exact selected estate definition."
      />
      <Section>
        <EstateStatusNotice />
        {status.state !== 'UNAVAILABLE' ? (
          <div className="mt-6 space-y-6">
            {withoutNames > 0 ? (
              <Callout tone="limitation" title="Some mechanics carry no declared display name">
                <p>
                  {withoutNames} platform-provided mechanics have provider relationships but no
                  display name in this generation. Their exact identity is shown and their card
                  stands as an identity card; no editorial name or description has been sourced for
                  them yet, and none has been generated to fill the gap.
                </p>
              </Callout>
            ) : null}
            <Catalog
              items={items}
              noun="mechanics"
              facetName="Kind"
              facetValues={kinds}
              emptyMessage="This publication contains no mechanics."
            />
            <PublicationProvenance />
          </div>
        ) : null}
      </Section>
    </>
  );
}
