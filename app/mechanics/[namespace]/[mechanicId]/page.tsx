import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EntityArt } from '@/components/estate/entity-art';

import { Callout, FactList, Hero, NotDeclared, Section, SectionHeader, StatusBadge } from '@/components/ui';
import { findMechanic, getMechanics, getProviders } from '@/lib/estate';
import { ROUTES } from '@/lib/routes';
import { pageMetadata } from '@/lib/seo';

interface Params {
  params: Promise<{ namespace: string; mechanicId: string }>;
}

export async function generateMetadata({ params }: Params) {
  const { namespace, mechanicId } = await params;
  const mechanic = findMechanic(namespace, mechanicId);
  if (!mechanic) {
    return pageMetadata({ title: 'Mechanic not found', description: 'Unknown mechanic identity.', path: '/mechanics', noindex: true });
  }
  return pageMetadata({
    title: `${mechanic.title} — mechanic`,
    description: (
      mechanic.summary ?? `A published SideFX mechanic with ${mechanic.providerIds.length} declared provider implementations.`
    ).slice(0, 155),
    path: `/mechanics/${mechanic.urlKey}`,
  });
}

export function generateStaticParams() {
  return getMechanics().map((m) => ({ namespace: m.urlNamespace, mechanicId: m.entityId }));
}

export default async function MechanicDetailPage({ params }: Params) {
  const { namespace, mechanicId } = await params;
  const mechanic = findMechanic(namespace, mechanicId);
  if (!mechanic) notFound();

  const providers = getProviders().filter((p) => mechanic.providerIds.includes(p.entityId));

  return (
    <>
      <Hero eyebrow="Mechanic" eyebrowHref={ROUTES.mechanics.href} title={mechanic.title} subhead={mechanic.summary??undefined} media={<EntityArt visuals={mechanic.visuals} title={mechanic.title} kind="MECHANIC" priority/>}>
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone="authority">{mechanic.entityId}</StatusBadge>
          {mechanic.mechanicKind ? <StatusBadge>{mechanic.mechanicKind}</StatusBadge> : null}
          <StatusBadge tone={mechanic.providerIds.length > 0 ? 'signal' : 'neutral'}>
            {mechanic.providerIds.length} declared implementer
            {mechanic.providerIds.length === 1 ? '' : 's'}
          </StatusBadge>
        </div>
      </Hero>

      <Section labelledBy="responsibility">
        <SectionHeader id="responsibility" eyebrow="Declared responsibility" title="What this mechanic is responsible for" />
        {mechanic.summary ? (
          <p className="max-w-3xl text-lg">{mechanic.summary}</p>
        ) : (
          <Callout tone="limitation" title="No declared responsibility text in this generation">
            <p>
              This mechanic carries provider relationships but no display name or description in the
              selected model. Its exact identity above is the authority; nothing has been written in
              to stand for the missing meaning.
            </p>
          </Callout>
        )}

        <div className="mt-8 max-w-3xl">
          <FactList
            facts={[
              { term: 'Identity', value: <span className="break-all font-mono text-xs">{mechanic.entityId}</span> },
              { term: 'Namespace', value: mechanic.namespaceId ?? <NotDeclared /> },
              { term: 'Definition profile', value: mechanic.definitionProfile ?? <NotDeclared /> },
              { term: 'Kind', value: mechanic.mechanicKind ?? <NotDeclared /> },
              { term: 'Semantic object', value: <span className="font-mono text-xs">{mechanic.semanticObjectPk}</span> },
              {
                term: 'Definition',
                value: <span className="font-mono text-xs">{mechanic.semanticObjectDefinitionPk}</span>,
              },
              { term: 'Implementation relationships', value: String(mechanic.implementationRelationshipCount) },
            ]}
          />
        </div>
      </Section>

      <Section labelledBy="implementers">
        <SectionHeader
          id="implementers"
          eyebrow="Declared implementations"
          title="Providers that declare this mechanic"
          lede="A declared implementation is not an active binding, a qualification result or an execution record. Those are separate states."
        />
        {providers.length > 0 ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {providers.map((provider) => (
              <li key={provider.entityId}>
                <Link
                  href={`/providers/${provider.urlKey}`}
                  className="block rounded-lg border border-grid-line bg-ink-2 p-4 hover:border-signal"
                >
                  <span className="block break-all text-sm">{provider.title}</span>
                  <span className="mt-1 block font-mono text-xs text-muted">
                    {provider.declarationProfile ?? 'no declaration profile'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Callout tone="note" title="No provider declares this mechanic in this generation">
            <p>
              Zero declared relationships means none is recorded in the selected model. It does not
              establish that the mechanic has no implementation: atomic language-registry resolution
              is a separate surface that this publication does not cover.
            </p>
          </Callout>
        )}
      </Section>

      <Section>
        <Callout tone="limitation" title="Artwork for this mechanic has not been produced">
          <p>
            Every mechanic carries its own image requirement. This one is recorded as required and no
            reviewed image is stored, so no illustration is shown in its place.
          </p>
        </Callout>
      </Section>
    </>
  );
}
