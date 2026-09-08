import { Callout, CtaBand, Hero, PrimaryLink, SecondaryLink, Section, SectionHeader, StatusBadge } from '@/components/ui';
import { CTA, ROUTES } from '@/lib/routes';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Projection & embodiment — one meaning, many targets',
  description:
    'Project one capability definition into SQL, Node, Python or C#. Compilation, execution and conformance are recorded as separate results per target and revision.',
  path: '/platform/projections',
});

const TARGET_FAMILIES = [
  ['SQL', 'Database bindings and set-oriented embodiments.'],
  ['Node', 'JavaScript and TypeScript runtimes.'],
  ['Python', 'Python runtimes and data tooling.'],
  ['C#', '.NET runtimes and services.'],
];

export default function ProjectionsPage() {
  return (
    <>
      <Hero
        eyebrow="Projection & embodiment"
        title="One meaning. Choose its embodiment."
        subhead="A capability's definition is projected into the target families it supports. You select the target; the definition stays the same."
        actions={
          <>
            <PrimaryLink href={CTA.build.href}>{CTA.build.label}</PrimaryLink>
            <SecondaryLink href={ROUTES.ownership.href}>What you can download</SecondaryLink>
          </>
        }
      />

      <Section labelledBy="families">
        <SectionHeader
          id="families"
          eyebrow="Target families"
          title="The families in the platform story"
          lede="Availability and verification are recorded per capability, scenario, target and revision — never as a blanket platform claim."
        />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TARGET_FAMILIES.map(([name, body]) => (
            <li key={name} className="rounded-lg border border-grid-line bg-ink-2 p-5">
              <h3 className="font-display text-base font-semibold">{name}</h3>
              <p className="mt-2 text-sm text-muted">{body}</p>
              <p className="mt-4">
                <StatusBadge>Availability recorded per capability</StatusBadge>
              </p>
            </li>
          ))}
        </ul>
      </Section>

      <Section labelledBy="states">
        <SectionHeader
          id="states"
          eyebrow="Separate results"
          title="Compilation, execution and conformance are three different facts"
        />
        <div className="overflow-x-auto rounded-lg border border-grid-line">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <caption className="sr-only">What each target-level result does and does not establish</caption>
            <thead className="bg-ink-2 text-left font-mono text-xs uppercase tracking-widest text-muted">
              <tr>
                <th scope="col" className="p-3">Result</th>
                <th scope="col" className="p-3">Establishes</th>
                <th scope="col" className="p-3">Does not establish</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-grid-line">
              <tr className="align-top">
                <td className="p-3 font-semibold">Can attempt embodiment</td>
                <td className="p-3">The projection has enough declared information to try this target.</td>
                <td className="p-3 text-muted">That an artifact exists, or that anything ran.</td>
              </tr>
              <tr className="align-top">
                <td className="p-3 font-semibold">Compilation</td>
                <td className="p-3">An artifact was produced for the target from this revision.</td>
                <td className="p-3 text-muted">That it executes correctly, or conforms.</td>
              </tr>
              <tr className="align-top">
                <td className="p-3 font-semibold">Execution</td>
                <td className="p-3">The artifact ran in a recorded environment.</td>
                <td className="p-3 text-muted">That it satisfies the declared contract.</td>
              </tr>
              <tr className="align-top">
                <td className="p-3 font-semibold">Conformance</td>
                <td className="p-3">Scoped checks passed against the declared contract, within their stated scope.</td>
                <td className="p-3 text-muted">Anything outside that scope, or on another target.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section labelledBy="availability">
        <SectionHeader id="availability" eyebrow="Today" title="What this build can show you" />
        <Callout tone="limitation" title="No target records are carried by the published generation">
          <p>
            The current published estate generation contains no target requirement, language
            resolution or readiness records. Capability pages therefore show an explicit absence
            rather than an empty matrix that could be mistaken for &ldquo;no targets supported&rdquo;.
          </p>
          <p className="mt-2">
            When those records are published, each capability will show its own per-target state and
            the evidence behind it, and inverse checks will be shown where they exist.
          </p>
        </Callout>
      </Section>

      <CtaBand
        title="One definition, whichever runtime you need."
        actions={
          <>
            <PrimaryLink href={CTA.explore.href}>{CTA.explore.label}</PrimaryLink>
            <SecondaryLink href={ROUTES.executableMeaning.href}>Executable meaning</SecondaryLink>
          </>
        }
      />
    </>
  );
}
