import { Callout, CtaBand, Faq, Hero, PrimaryLink, SecondaryLink, Section, SectionHeader } from '@/components/ui';
import { getPublication } from '@/lib/estate';
import { CTA, ROUTES } from '@/lib/routes';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'AI governance — engineered in, not bolted on',
  description:
    'Governance through inspection, scoped conformance receipts, attributable change history, capability ownership and access, and visible unresolved obligations.',
  path: '/platform/governance',
});

const FAQ_ITEMS = [
  {
    question: 'What can I inspect?',
    answer:
      'Every published capability opens its circuit, with each node’s meaning, exact source identity and declared state. Where the source does not resolve something, the page shows the absence rather than a default.',
  },
  {
    question: 'What makes a conformance claim trustworthy?',
    answer:
      'Its scope. A conformance receipt names the capability, revision, target and checks that ran. Results outside that scope are not implied, and missing results stay missing.',
  },
  {
    question: 'Is this an audit trail?',
    answer:
      'Auditability requires retained evidence and history. Monotonic circuit design keeps progress well-founded, but the audit view depends on records and timestamps actually being retained — it is not a property of the diagram.',
  },
  {
    question: 'Who can see a capability?',
    answer:
      'Private drafts live in their owner’s workspace and are never published by creation. Public visibility is a separate, explicit and authorized action, and artifact access is checked independently of page visibility.',
  },
];

export default function GovernancePage() {
  const publication = getPublication();

  return (
    <>
      <Hero
        eyebrow="AI governance"
        title="AI governance, engineered in — not bolted on."
        subhead="Governance is a property of how capabilities are defined, inspected and evidenced — not a report generated after the fact."
        actions={
          <>
            <PrimaryLink href={CTA.talkToUs.href}>{CTA.talkToUs.label}</PrimaryLink>
            <SecondaryLink href={ROUTES.solutionsEnterprise.href}>For enterprises</SecondaryLink>
          </>
        }
      />

      <Section labelledBy="mechanisms">
        <SectionHeader
          id="mechanisms"
          eyebrow="Mechanisms"
          title="What actually produces the governance property"
        />
        <ul className="grid gap-4 sm:grid-cols-2">
          {[
            ['Inspection', 'Every capability opens its circuit with source identities and declared states visible on demand.'],
            ['Scoped receipts', 'Conformance results carry their capability, revision, target and check scope. Nothing is generalised beyond it.'],
            ['Attributable history', 'Version and change history is attributable, so a claim can be traced to the revision that supports it.'],
            ['Ownership and access', 'Capability ownership and per-resource authorization are enforced independently of whether a page is public.'],
            ['Visible obligations', 'Unresolved obligations are shown as unresolved. An unassessed embodiment is never presented as conformant.'],
            ['Preserved findings', 'Source findings survive publication. The site reports what the estate records, including its gaps.'],
          ].map(([title, body]) => (
            <li key={title} className="rounded-lg border border-grid-line bg-ink-2 p-5">
              <h3 className="font-display text-base font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-muted">{body}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section labelledBy="evidence">
        <SectionHeader
          id="evidence"
          eyebrow="An honest example"
          title="What this publication records about itself"
          lede="The clearest governance demonstration a site can give is to publish its own gaps."
        />
        {publication && publication.findings.length > 0 ? (
          <ul className="grid gap-3 lg:grid-cols-2">
            {publication.findings.map((finding) => (
              <li key={finding.code} className="rounded-lg border border-telemetry/40 bg-ink-2 p-4">
                <p className="font-mono text-xs text-telemetry">
                  {finding.code} · {finding.count}
                </p>
                <p className="mt-1 text-sm text-muted">{finding.message}</p>
              </li>
            ))}
          </ul>
        ) : (
          <Callout tone="unavailable" title="No publication is readable in this build">
            <p>Findings are shown from the published generation; none is available.</p>
          </Callout>
        )}
      </Section>

      <Section labelledBy="faq">
        <SectionHeader id="faq" eyebrow="Questions" title="Inspection, evidence and access" />
        <div className="max-w-3xl">
          <Faq items={FAQ_ITEMS} />
        </div>
      </Section>

      <CtaBand
        title="Govern an estate you can actually inspect."
        actions={
          <>
            <PrimaryLink href={CTA.talkToUs.href}>{CTA.talkToUs.label}</PrimaryLink>
            <SecondaryLink href={CTA.explore.href}>{CTA.explore.label}</SecondaryLink>
          </>
        }
      />
    </>
  );
}
