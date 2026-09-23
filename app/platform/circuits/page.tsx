import Link from 'next/link';

import { CircuitViewer } from '@/components/circuit/circuit-viewer';
import { Callout, CtaBand, Hero, PrimaryLink, SecondaryLink, Section, SectionHeader } from '@/components/ui';
import { getCircuitsForCapability, getFeaturedCapabilities } from '@/lib/estate';
import { CTA, ROUTES } from '@/lib/routes';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Capability circuits — see what it will do',
  description:
    'SCL projects capability meaning into an interactive circuit with explicit inputs, events, responsibilities, outcomes, provider slots and evidence.',
  path: '/platform/circuits',
});

export default function CircuitsPage() {
  const capability = getFeaturedCapabilities(1)[0];
  const circuit = capability ? getCircuitsForCapability(capability.entityId)[0] : undefined;

  return (
    <>
      <Hero
        eyebrow="Agentic capability circuits"
        title="See what your capability will do."
        subhead="SCL — the SideFX Circuit Language — projects a capability's meaning into a circuit you can read, navigate by keyboard and inspect node by node."
        actions={
          <>
            <PrimaryLink href={CTA.build.href}>{CTA.build.label}</PrimaryLink>
            <SecondaryLink href={ROUTES.scl.href}>Read the SCL guide</SecondaryLink>
          </>
        }
      />

      <Section labelledBy="example">
        <SectionHeader
          id="example"
          eyebrow="A real circuit"
          title="Input, event, responsibility, outcome"
          lede="This is a published capability from the estate, not a mockup. Select any node to read its meaning, source identity and declared state."
        />
        {capability && circuit && circuit.nodes.length > 0 ? (
          <>
            <p className="mb-4 text-sm text-muted">
              Showing{' '}
              <Link href={`/capabilities/${capability.urlKey}`} className="text-signal underline">
                {capability.title}
              </Link>{' '}
              · scenario <span className="font-mono text-xs">{circuit.scenarioId}</span>
            </p>
            <CircuitViewer circuit={circuit} />
          </>
        ) : (
          <Callout tone="unavailable" title="No published circuit is available">
            <p>
              {capability && circuit
                ? 'This capability’s execution graph is compiled by the engine at request time; open the capability page to see it.'
                : 'The estate publication is not readable in this build, so no circuit can be shown.'}
            </p>
          </Callout>
        )}
      </Section>

      <Section labelledBy="semantics">
        <SectionHeader
          id="semantics"
          eyebrow="Circuit semantics"
          title="What the language commits to"
          lede="SCL distinguishes route families, branch policies and terminals. The renderer preserves those distinctions rather than flattening them into a generic graph."
        />
        <ul className="grid gap-4 sm:grid-cols-2">
          {[
            ['Typed routes', 'Execution, product transfer and support links keep their types. A provider binding is not execution flow.'],
            ['Branches and joins', 'Single-choice decisions, all-branch fan-out and convergence with an all, any or quorum policy are distinct — never one interchangeable glyph.'],
            ['Bounded retries', 'Retries are explicit and bounded. Recurrence outside the supported profile stays inspectable and is not animated as if it were supported.'],
            ['Terminals', 'A terminal has no outgoing execution route. Its caption states the actual disposition; a reached outcome is not proof.'],
          ].map(([title, body]) => (
            <li key={title} className="rounded-lg border border-grid-line bg-ink-2 p-5">
              <h3 className="font-display text-base font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-muted">{body}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section labelledBy="fidelity">
        <SectionHeader
          id="fidelity"
          eyebrow="Fidelity"
          title="Every open capability gets a circuit — an honest one"
        />
        <div className="max-w-3xl space-y-4">
          <p className="text-lg">
            The circuit surface is the execution graph the engine compiles, not a pre-rendered
            substitute. Where this generation carries only an authored bundle, that bundle is a
            labelled comparison candidate — never the trace.
          </p>
          <Callout tone="limitation" title="Authored bundles are comparison candidates">
            <p>
              The compiled execution graph is fetched from the engine at request time, and a
              capability the engine cannot compile shows the engine&rsquo;s own reason instead of a
              substitute circuit. Authored bundles are labelled as authored and are never presented
              as observed execution.
            </p>
          </Callout>
        </div>
      </Section>

      <Section labelledBy="motion">
        <SectionHeader
          id="motion"
          eyebrow="Illustrative flow"
          title="Playback shows declared order, not observed execution"
        />
        <div className="max-w-3xl space-y-3 text-sm text-muted">
          <p>
            Playback starts only when you press <strong>Play flow</strong>. It follows the exact
            compiled route paths. Inspecting a node pauses it; hiding or leaving the page stops it.
          </p>
          <p>
            Reduced-motion settings advance to event boundaries instead of animating. Nothing on this
            page invokes a provider, and no loop implies live telemetry: an observed-execution overlay
            would require a trace bound to actual execution evidence and timestamps.
          </p>
        </div>
      </Section>

      <CtaBand
        title="Open a circuit from the estate."
        actions={
          <>
            <PrimaryLink href={CTA.explore.href}>{CTA.explore.label}</PrimaryLink>
            <SecondaryLink href={ROUTES.blueprints.href}>How blueprints relate</SecondaryLink>
          </>
        }
      />
    </>
  );
}
