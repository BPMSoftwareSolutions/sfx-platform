import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CapabilityCircuitPanel } from '@/components/estate/capability-circuit-panel';
import { Callout, FactList, Hero, NotDeclared, Section, SectionHeader, StatusBadge } from '@/components/ui';
import { findCapability, getCapabilities, getCircuitsForCapability } from '@/lib/estate';
import { CTA, ROUTES } from '@/lib/routes';
import { pageMetadata } from '@/lib/seo';

interface Params {
  params: Promise<{ namespace: string; capabilityId: string }>;
}

/** §7 — public capability pages get source-derived titles, descriptions and canonical URLs. */
export async function generateMetadata({ params }: Params) {
  const { namespace, capabilityId } = await params;
  const capability = findCapability(namespace, capabilityId);
  if (!capability) return pageMetadata({ title: 'Capability not found', description: 'Unknown capability identity.', path: '/capabilities', noindex: true });

  const responsibility = capability.scenarios[0]?.responsibility;
  return pageMetadata({
    title: `${capability.title} — capability`,
    description: responsibility
      ? `${responsibility}. ${capability.scenarios.length} published scenarios in the SideFX capability estate.`.slice(0, 155)
      : `A published SideFX capability with ${capability.scenarios.length} scenarios and its source-backed circuit.`,
    path: `/capabilities/${capability.urlKey}`,
  });
}

/** Pre-render the published set; an unknown public identity returns 404 (§7). */
export function generateStaticParams() {
  return getCapabilities().map((c) => ({ namespace: c.urlNamespace, capabilityId: c.entityId }));
}

export default async function CapabilityDetailPage({ params }: Params) {
  const { namespace, capabilityId } = await params;
  const capability = findCapability(namespace, capabilityId);
  if (!capability) notFound();

  const circuits = getCircuitsForCapability(capability.entityId);
  const firstScenario = capability.scenarios[0];

  return (
    <>
      <Hero
        eyebrow="Capability"
        eyebrowHref={ROUTES.capabilities.href}
        title={capability.title}
        subhead={firstScenario?.responsibility ?? undefined}
      >
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone="authority">{capability.entityId}</StatusBadge>
          <StatusBadge>{capability.scope} scope</StatusBadge>
          <StatusBadge tone="telemetry">
            {capability.graphFidelity === 'BOUNDARY' ? 'Boundary view' : 'Partial boundary view'}
          </StatusBadge>
        </div>
        {capability.titleIsIdentityFallback ? (
          <p className="mt-4 max-w-2xl text-sm text-muted">
            This generation declares no editorial display name for the capability. The heading is
            derived from its exact identity, shown above, and no meaning has been added to it.
          </p>
        ) : null}
      </Hero>

      <Section labelledBy="circuit">
        <SectionHeader
          id="circuit"
          eyebrow="Visual circuit"
          title="See what this capability declares."
          lede="Topology, labels and states come from the published projection. Selecting a scenario or a node updates the URL so the exact view can be shared."
        />
        <CapabilityCircuitPanel circuits={circuits} />
      </Section>

      <Section labelledBy="scenarios">
        <SectionHeader
          id="scenarios"
          eyebrow="Scenarios"
          title={`${capability.scenarios.length} scenario face${capability.scenarios.length === 1 ? '' : 's'}`}
          lede="Each face carries its own input, event, responsibility and outcome, with the contract and authority state the source records."
        />
        <div className="overflow-x-auto rounded-lg border border-grid-line">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <caption className="sr-only">Scenario faces published for {capability.entityId}</caption>
            <thead className="bg-ink-2 text-left font-mono text-xs uppercase tracking-widest text-muted">
              <tr>
                <th scope="col" className="p-3">Scenario</th>
                <th scope="col" className="p-3">Input</th>
                <th scope="col" className="p-3">Event</th>
                <th scope="col" className="p-3">Responsibility</th>
                <th scope="col" className="p-3">Outcome</th>
                <th scope="col" className="p-3">States</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-grid-line">
              {capability.scenarios.map((scenario) => (
                <tr key={scenario.scenarioId} className="align-top">
                  <td className="p-3">
                    <Link
                      href={`/capabilities/${capability.urlKey}?scenario=${encodeURIComponent(scenario.scenarioId)}`}
                      className="break-all font-mono text-xs text-signal underline"
                    >
                      {scenario.scenarioId}
                    </Link>
                  </td>
                  <td className="break-all p-3 font-mono text-xs">{scenario.inputId ?? <NotDeclared />}</td>
                  <td className="break-all p-3 font-mono text-xs">{scenario.eventId ?? <NotDeclared />}</td>
                  <td className="p-3">{scenario.responsibility ?? <NotDeclared />}</td>
                  <td className="break-all p-3 font-mono text-xs">{scenario.outcomeId ?? <NotDeclared />}</td>
                  <td className="p-3 text-xs">
                    <div>Input contract: {scenario.inputContractState.readable}</div>
                    <div className="mt-1">Event authority: {scenario.eventAuthorityState.readable}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section labelledBy="authority">
        <SectionHeader
          id="authority"
          eyebrow="Authority, embodiments and evidence"
          title="What this publication can and cannot establish."
        />
        <div className="grid gap-6 lg:grid-cols-2">
          <FactList
            facts={[
              { term: 'Semantic object', value: <span className="font-mono text-xs">{capability.semanticObjectPk}</span> },
              {
                term: 'Definition',
                value: <span className="font-mono text-xs">{capability.semanticObjectDefinitionPk}</span>,
              },
              { term: 'Namespace', value: capability.namespaceId ?? <NotDeclared what="Not carried by this generation" /> },
              {
                term: 'Blueprints',
                value:
                  capability.blueprints.length > 0 ? (
                    <ul className="space-y-1">
                      {capability.blueprints.map((b) => (
                        <li key={b.blueprintId} className="break-all font-mono text-xs">
                          {b.blueprintId} — {b.sourceDisposition.readable}, {b.nodeCount} nodes,{' '}
                          {b.edgeCount} edges
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <NotDeclared what="No blueprint selected in this generation" />
                  ),
              },
              {
                term: 'Embodiment targets',
                value:
                  capability.targets.length > 0 ? (
                    capability.targets.map((t) => t.target).join(', ')
                  ) : (
                    <NotDeclared what="No target declaration is carried by this generation" />
                  ),
              },
            ]}
          />
          <div className="space-y-4">
            <Callout tone="unavailable" title="Downloads are not available for this capability">
              <p>{capability.downloadEligibility.reason}</p>
            </Callout>
            <Callout tone="limitation" title="What the boundary view means">
              <p>
                The selected blueprints for this capability carry nodes but no normalized edges, so
                deeper topology is not qualified. The circuit shows the source-backed input, event,
                responsibility and outcome and leaves the rest unresolved rather than drawing an
                inferred graph.
              </p>
            </Callout>
          </div>
        </div>
      </Section>

      {capability.relatedCapabilityIds.length > 0 ? (
        <Section labelledBy="related">
          <SectionHeader
            id="related"
            eyebrow="Related capabilities"
            title="Capabilities sharing a declared contract identity"
            lede="Relatedness here means a shared input or outcome contract identity in this generation — not an execution relationship."
          />
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {capability.relatedCapabilityIds.map((id) => (
              <li key={id}>
                <Link
                  href={`/capabilities/estate/${id}`}
                  className="block break-all rounded border border-grid-line bg-ink-2 p-3 font-mono text-xs hover:border-signal"
                >
                  {id}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section>
        <div className="flex flex-wrap gap-3">
          <Link
            href={`${CTA.build.href}?from=${encodeURIComponent(capability.urlKey)}`}
            className="rounded bg-signal px-5 py-3 text-sm font-semibold text-ink hover:brightness-110"
          >
            Use this as a starting point
          </Link>
          <Link
            href={ROUTES.capabilities.href}
            className="rounded border border-grid-line px-5 py-3 text-sm font-semibold hover:border-signal"
          >
            Back to the estate
          </Link>
        </div>
      </Section>
    </>
  );
}
