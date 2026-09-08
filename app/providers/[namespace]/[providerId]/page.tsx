import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Callout, FactList, Hero, NotDeclared, Section, SectionHeader, StatusBadge } from '@/components/ui';
import { findProvider, getMechanics, getProviders } from '@/lib/estate';
import { ROUTES } from '@/lib/routes';
import { pageMetadata } from '@/lib/seo';

interface Params {
  params: Promise<{ namespace: string; providerId: string }>;
}

export async function generateMetadata({ params }: Params) {
  const { namespace, providerId } = await params;
  const provider = findProvider(namespace, providerId);
  if (!provider) {
    return pageMetadata({ title: 'Provider not found', description: 'Unknown provider identity.', path: '/providers', noindex: true });
  }
  return pageMetadata({
    title: `${provider.title} — provider`,
    description:
      `Declared implementations for ${provider.entityId}: ${provider.mechanicIds.length} mechanics and ${provider.capabilityRelationshipCount} capability relationships.`.slice(0, 155),
    path: `/providers/${provider.urlKey}`,
  });
}

export function generateStaticParams() {
  return getProviders().map((p) => ({ namespace: p.urlNamespace, providerId: encodeURIComponent(p.entityId) }));
}

export default async function ProviderDetailPage({ params }: Params) {
  const { namespace, providerId } = await params;
  const provider = findProvider(namespace, providerId);
  if (!provider) notFound();

  const mechanics = getMechanics().filter((m) => provider.mechanicIds.includes(m.entityId));

  return (
    <>
      <Hero eyebrow="Provider" eyebrowHref={ROUTES.providers.href} title={provider.title}>
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone="authority">{provider.entityId}</StatusBadge>
          <StatusBadge tone={provider.mechanicIds.length > 0 ? 'signal' : 'neutral'}>
            {provider.mechanicIds.length} declared mechanic
            {provider.mechanicIds.length === 1 ? '' : 's'}
          </StatusBadge>
        </div>
      </Hero>

      <Section labelledBy="declaration">
        <SectionHeader id="declaration" eyebrow="Declaration" title="What this provider declares" />
        <div className="max-w-3xl">
          <FactList
            facts={[
              { term: 'Identity', value: <span className="break-all font-mono text-xs">{provider.entityId}</span> },
              { term: 'Namespace', value: provider.namespaceId ?? <NotDeclared /> },
              { term: 'Declaration profile', value: provider.declarationProfile ?? <NotDeclared /> },
              { term: 'Semantic object', value: <span className="font-mono text-xs">{provider.semanticObjectPk}</span> },
              {
                term: 'Definition',
                value: <span className="font-mono text-xs">{provider.semanticObjectDefinitionPk}</span>,
              },
              { term: 'Declared mechanic relationships', value: String(provider.mechanicRelationshipCount) },
              { term: 'Declared capability relationships', value: String(provider.capabilityRelationshipCount) },
              { term: 'Binding state', value: <NotDeclared what="No binding is carried by this generation" /> },
              {
                term: 'Qualification',
                value: <NotDeclared what="No qualification assessment is carried by this generation" />,
              },
            ]}
          />
        </div>
        <div className="mt-6 max-w-3xl">
          <Callout tone="note" title="Declared is not bound, and bound is not verified">
            <p>
              This page shows declared implementation relationships from the selected model. Absence
              of a binding or a qualification assessment means unknown or unassessed — never active
              or qualified.
            </p>
          </Callout>
        </div>
      </Section>

      <Section labelledBy="mechanics">
        <SectionHeader
          id="mechanics"
          eyebrow="Declared mechanics"
          title={`${mechanics.length} mechanic${mechanics.length === 1 ? '' : 's'} implemented`}
        />
        {mechanics.length > 0 ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {mechanics.map((mechanic) => (
              <li key={mechanic.entityId}>
                <Link
                  href={`/mechanics/${mechanic.urlKey}`}
                  className="block h-full rounded-lg border border-grid-line bg-ink-2 p-4 hover:border-signal"
                >
                  <span className="block break-all font-mono text-xs text-muted">{mechanic.entityId}</span>
                  <span className="mt-2 block text-sm">
                    {mechanic.summary ?? <span className="italic text-muted">No declared description</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Callout tone="note" title="No mechanic relationship is declared for this provider">
            <p>Zero rows means none is recorded in the selected model for this generation.</p>
          </Callout>
        )}
      </Section>

      <Section>
        <Callout tone="limitation" title="Artwork for this provider has not been produced">
          <p>
            Provider artwork, when it exists, is labelled illustration. It cannot substitute for an
            official logo or imply affiliation. No reviewed image is stored for this provider, so
            none is shown.
          </p>
        </Callout>
      </Section>
    </>
  );
}
