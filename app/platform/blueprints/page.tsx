import { Callout, CtaBand, FactList, Hero, PrimaryLink, SecondaryLink, Section, SectionHeader } from '@/components/ui';
import { getCapabilities, getPublication } from '@/lib/estate';
import { CTA, ROUTES } from '@/lib/routes';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Blueprints — the design authority for a circuit',
  description:
    'A blueprint is a design authority: explicit topology, progress rules, provider slots and evidence obligations, distinct from a runtime plan and from an image.',
  path: '/platform/blueprints',
});

export default function BlueprintsPage() {
  const publication = getPublication();
  const dispositions = new Map<string, number>();
  for (const capability of getCapabilities()) {
    for (const blueprint of capability.blueprints) {
      const key = blueprint.sourceDisposition.value ?? 'NOT_DECLARED';
      dispositions.set(key, (dispositions.get(key) ?? 0) + 1);
    }
  }

  return (
    <>
      <Hero
        eyebrow="Blueprints"
        title="Build against the blueprint."
        subhead="A blueprint is the design authority for a capability circuit: its topology, progress rules, provider slots and evidence obligations, stated before anything is built."
        actions={
          <>
            <PrimaryLink href={CTA.build.href}>{CTA.build.label}</PrimaryLink>
            <SecondaryLink href={ROUTES.circuits.href}>How circuits render</SecondaryLink>
          </>
        }
      />

      <Section labelledBy="distinctions">
        <SectionHeader
          id="distinctions"
          eyebrow="Three different things"
          title="A design blueprint is not a runtime plan, and neither is an image"
        />
        <ul className="grid gap-4 lg:grid-cols-3">
          {[
            ['Design blueprint', 'The authority: what the circuit must contain, which slots exist, and what evidence is owed.'],
            ['Runtime plan', 'What an execution actually intends to do, in an environment, at a time. Bound to a run, not to the design.'],
            ['Image', 'Artwork. It illustrates; it never supplies topology, status or evidence.'],
          ].map(([title, body]) => (
            <li key={title} className="rounded-lg border border-grid-line bg-ink-2 p-5">
              <h3 className="font-display text-base font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-muted">{body}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section labelledBy="published">
        <SectionHeader
          id="published"
          eyebrow="In this generation"
          title="The selected blueprints and their state"
          lede="Each blueprint carries the disposition its source records. A candidate blueprint has not been admitted."
        />
        {publication ? (
          <div className="max-w-3xl">
            <FactList
              facts={[
                { term: 'Selected blueprints', value: String(publication.coverage.blueprints) },
                { term: 'Normalized nodes', value: String(publication.coverage.blueprintNodes) },
                { term: 'Normalized edges', value: String(publication.coverage.blueprintEdges) },
                ...[...dispositions.entries()]
                  .sort()
                  .map(([state, count]) => ({ term: `Disposition: ${state}`, value: String(count) })),
              ]}
            />
          </div>
        ) : null}
        <div className="mt-6 max-w-3xl">
          <Callout tone="limitation" title="Nodes without edges do not become invented wiring">
            <p>
              The selected blueprints carry nodes and no normalized edges. Blueprint geometry is
              deterministic: where the source resolves no edges, none is drawn, and the capability
              circuit falls back to its source-backed boundary view. Zero edges is not a blank cheque
              for an image model to supply topology.
            </p>
          </Callout>
        </div>
      </Section>

      <Section labelledBy="progress">
        <SectionHeader
          id="progress"
          eyebrow="Progress rules"
          title="Explicit transitions, selections, joins and bounded retries"
        />
        <div className="max-w-3xl space-y-4 text-sm text-muted">
          <p>
            SCL states progress explicitly: which transitions exist, where a single alternative is
            selected, where every branch is taken, how a convergence decides it has enough arrivals,
            and how many times a retry may occur.
          </p>
          <p>
            Monotonic circuit design keeps that progress well-founded. It does not, by itself, create
            an append-only audit trail: an audit history is a separate evidence view built on retained
            records and timestamps.
          </p>
        </div>
      </Section>

      <CtaBand
        title="Design against a stated authority."
        actions={
          <>
            <PrimaryLink href={CTA.build.href}>{CTA.build.label}</PrimaryLink>
            <SecondaryLink href={ROUTES.governance.href}>Governance and evidence</SecondaryLink>
          </>
        }
      />
    </>
  );
}
