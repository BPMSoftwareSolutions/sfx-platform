import { Callout, CtaBand, Hero, PrimaryLink, SecondaryLink, Section, SectionHeader } from '@/components/ui';
import { CTA, ROUTES, SITE } from '@/lib/routes';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Managed Capability Provider — the category',
  description:
    'The Managed Capability Provider model: customers own downloadable capability authority and choose who operates it. Capability ownership without operator lock-in.',
  path: '/managed-capability-provider',
});

export default function ManagedCapabilityProviderPage() {
  return (
    <>
      <Hero
        eyebrow="The category"
        title="Your capabilities. Your choice of operator."
        subhead={`${SITE.owner}'s Managed Capability Provider model puts downloadable capability authority in your hands.`}
        actions={
          <>
            <PrimaryLink href={CTA.build.href}>{CTA.build.label}</PrimaryLink>
            <SecondaryLink href={CTA.talkToUs.href}>{CTA.talkToUs.label}</SecondaryLink>
          </>
        }
      />

      <Section labelledBy="thesis">
        <SectionHeader id="thesis" eyebrow="Category thesis" title="Why a new category, and what it claims" />
        <div className="max-w-3xl space-y-4 text-lg">
          <p>
            The SaaS era outsourced capabilities: the vendor held the capability, and the customer
            held an account. The generative AI agency era inverts the pressure. Companies now want{' '}
            <strong>capability sovereignty</strong> — capabilities they own — and the freedom to
            switch operators as fast as conditions change.
          </p>
          <p>
            A Managed Capability Provider operates capabilities the customer owns. The authority is
            downloadable, the contracts are declared, and the operator is a choice rather than a
            dependency.
          </p>
        </div>
        <div className="mt-6 max-w-3xl">
          <Callout tone="limitation" title="This page states a category thesis, not a first-mover claim">
            <p>
              A public claim to be the <em>first</em> Managed Capability Provider requires a dated
              category definition and substantiated competitive research. Until that record exists,
              the category is published as a thesis without the superlative.
            </p>
          </Callout>
        </div>
      </Section>

      <Section labelledBy="split">
        <SectionHeader
          id="split"
          eyebrow="The split"
          title="What the provider manages, and what you control"
        />
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-grid-line bg-ink-2 p-6">
            <h3 className="font-display text-lg font-semibold">The provider manages</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              <li>Authoring, projection and embodiment production for the capabilities you commission.</li>
              <li>Verification against declared contracts, within the scope stated on each receipt.</li>
              <li>Operation of the capability where you ask for it to be operated.</li>
              <li>Provider selection and binding work, disclosed rather than hidden.</li>
            </ul>
          </div>
          <div className="rounded-lg border border-signal/40 bg-ink-2 p-6">
            <h3 className="font-display text-lg font-semibold">You control</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              <li>The semantic authority: downloadable, versioned and digest-identified.</li>
              <li>The available embodiments for the revisions you export.</li>
              <li>Which architecture manages and invokes the capability — open-source SDA or your own.</li>
              <li>Whether a capability is published, and to whom.</li>
            </ul>
          </div>
        </div>
      </Section>

      <Section labelledBy="comparison">
        <SectionHeader
          id="comparison"
          eyebrow="Compare on terms"
          title="The questions worth asking any offering"
          lede="These are the explicit ownership, export and operation terms to compare. This site does not characterise a named competitor's terms on their behalf."
        />
        <div className="overflow-x-auto rounded-lg border border-grid-line">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <caption className="sr-only">Ownership, export and operation questions to ask any provider</caption>
            <thead className="bg-ink-2 text-left font-mono text-xs uppercase tracking-widest text-muted">
              <tr>
                <th scope="col" className="p-3">Question</th>
                <th scope="col" className="p-3">What a satisfactory answer looks like</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-grid-line">
              {[
                ['Can I download the definition of what I bought?', 'A versioned artifact with contracts, digests and provenance — not a UI export of settings.'],
                ['Can I run it without you?', 'A documented import and invocation path in an architecture you control, with dependencies named.'],
                ['Can I change the underlying provider?', 'Declared contracts plus a statement of the binding or adapter work that remains.'],
                ['What does your evidence actually cover?', 'A named scope: capability, revision, target and checks. Absent results shown as absent.'],
                ['Who can see my capabilities?', 'Private by default; publication as a separate authorized action.'],
              ].map(([question, answer]) => (
                <tr key={question} className="align-top">
                  <td className="p-3 font-semibold">{question}</td>
                  <td className="p-3 text-muted">{answer}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section labelledBy="acronym">
        <SectionHeader id="acronym" eyebrow="A note on the acronym" title="MCP is an overloaded three letters" />
        <p className="max-w-3xl text-sm text-muted">
          &ldquo;Managed Capability Provider&rdquo; is written in full in navigation, headings and
          metadata. Where the acronym MCP appears elsewhere in the industry it usually refers to the{' '}
          <a
            href="https://modelcontextprotocol.io/specification/2024-11-05/index"
            className="text-signal underline"
            rel="noopener noreferrer"
            target="_blank"
          >
            Model Context Protocol
          </a>
          , which is a different thing entirely. The <span className="font-mono text-xs">/mcp</span>{' '}
          path on this site permanently redirects here and carries no duplicate content.
        </p>
      </Section>

      <CtaBand
        title="Own the capability. Choose the operator."
        actions={
          <>
            <PrimaryLink href={CTA.build.href}>{CTA.build.label}</PrimaryLink>
            <SecondaryLink href={ROUTES.ownership.href}>Read the ownership guide</SecondaryLink>
          </>
        }
      />
    </>
  );
}
