import { Callout, FactList, Hero, Section, SectionHeader } from '@/components/ui';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Ownership — what a bundle contains',
  description:
    'What a SideFX download contains, how to use it with open-source SDA or your own architecture, and which dependencies you must acquire separately.',
  path: '/docs/ownership',
});

export default function OwnershipPage() {
  return (
    <>
      <Hero
        eyebrow="Ownership"
        title="What you get, and what it takes to run it."
        subhead="The ownership promise is concrete: a versioned artifact, a manifest that names what it needs, and a documented path to invoking it without us."
      />

      <Section labelledBy="manifest">
        <SectionHeader
          id="manifest"
          eyebrow="The manifest"
          title="What a download identifies"
          lede="Every bundle carries a manifest. These are its required contents."
        />
        <div className="max-w-3xl">
          <FactList
            facts={[
              { term: 'Capability and revision', value: 'The exact identity and version the bundle was produced from.' },
              { term: 'Semantic authority', value: 'The authority files that define behavior, with their digests.' },
              { term: 'Contracts', value: 'The declared input, event, outcome and provider contracts.' },
              { term: 'Dependency references', value: 'What the capability needs, including what you must acquire separately.' },
              { term: 'Embodiment targets', value: 'The selected targets and the artifacts produced for them.' },
              { term: 'Invocation instructions', value: 'How to import and invoke the capability in a supported environment.' },
              { term: 'Provenance', value: 'Where the authority came from and which generation produced the bundle.' },
              { term: 'Verification evidence', value: 'Any conformance results, with their scope stated — and the gaps left explicit.' },
              { term: 'Licenses and runtimes', value: 'Applicable licenses and the runtime requirements for each target.' },
            ]}
          />
        </div>
      </Section>

      <Section labelledBy="excluded">
        <SectionHeader id="excluded" eyebrow="Boundaries" title="What a bundle never contains" />
        <div className="max-w-3xl space-y-4 text-sm text-muted">
          <p>
            <strong>Credentials.</strong> Secrets are supplied in your environment. They are never
            written into a bundle, a graph label, a log, a URL or analytics.
          </p>
          <p>
            <strong>Dependency authority that cannot be redistributed.</strong> Where redistribution
            is not permitted, the dependency is listed explicitly for you to acquire, rather than
            silently omitted.
          </p>
        </div>
      </Section>

      <Section labelledBy="three-downloads">
        <SectionHeader id="three-downloads" eyebrow="Three downloads" title="Authority, embodiments, or both" />
        <ul className="grid max-w-4xl gap-4 sm:grid-cols-3">
          {[
            ['Download authority', 'The definition and its contracts. Available once the capability compiles to a valid revision.'],
            ['Download embodiments', 'The target artifacts. Requires an actual embodiment artifact — a design draft is not executable.'],
            ['Download bundle', 'Both, with target selection.'],
          ].map(([title, body]) => (
            <li key={title} className="rounded-lg border border-grid-line bg-ink-2 p-5">
              <h3 className="font-display text-base font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-muted">{body}</p>
            </li>
          ))}
        </ul>
        <p className="mt-4 max-w-3xl text-sm text-muted">
          Draft exports stay available and are clearly labelled as candidate design artifacts. A
          download must be usable without an ongoing SideFX session, though independent use may still
          require the declared runtimes, provider accounts, credentials and dependencies.
        </p>
      </Section>

      <Section labelledBy="providers">
        <SectionHeader id="providers" eyebrow="Switching" title="What provider independence actually promises" />
        <div className="max-w-3xl space-y-4">
          <p className="text-lg">
            Meaning is preserved when a replacement provider satisfies the declared contracts and the
            verification obligations attached to them. What that leaves is binding or adapter work,
            and the amount of it is stated rather than waved away.
          </p>
          <Callout tone="note" title="A concrete promise, not an unqualified guarantee">
            <p>
              &ldquo;No lock-in&rdquo; as a slogan is unfalsifiable. The promise here is narrower and
              checkable: you hold the authority, the contracts are declared, and the remaining work to
              move is disclosed.
            </p>
          </Callout>
        </div>
      </Section>

      <Section labelledBy="today">
        <SectionHeader id="today" eyebrow="Today" title="The current state of this contract" />
        <div className="max-w-3xl">
          <Callout tone="unavailable" title="No download is offered in this build">
            <p>
              Offering a download requires the capability export adapter, a verified public URL,
              license and compatible release for open-source SDA, and a documented own-architecture
              integration example — each tied to the exact export. These are open P1 dependencies.
            </p>
            <p className="mt-2">
              This page therefore documents the contract that must be met, and no capability page
              presents an export action.
            </p>
          </Callout>
        </div>
      </Section>
    </>
  );
}
