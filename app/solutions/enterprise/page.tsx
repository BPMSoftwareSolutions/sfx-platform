import { SolutionPage, type SolutionContent } from '@/components/solutions/solution-page';
import { CTA, ROUTES } from '@/lib/routes';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'SideFX for enterprises — govern the capability estate',
  description:
    'Manage and govern an AI capability estate at scale: sprawl control, scoped conformance receipts and the switching leverage that comes from owning authority.',
  path: '/solutions/enterprise',
});

const content: SolutionContent = {
  eyebrow: 'For enterprises',
  title: 'Manage, inspect and govern your capability estate at scale.',
  subhead:
    'Governance gaps in AI delivery are not a documentation problem. They are a consequence of capabilities having no canonical, inspectable definition.',
  problem: {
    title: 'Sprawl, opacity and cost of ownership arrive together',
    body: [
      'AI-assisted delivery multiplies implementations faster than any review function can absorb them. Each one carries an operational obligation and none carries a canonical statement of intent.',
      'The governance question — what does this system do, on whose authority, verified how — has no artifact to point at. So it gets answered with process, which does not scale either.',
    ],
  },
  mechanism: {
    title: 'One estate, with evidence kept at its real scope',
    body: [
      'Every capability has an identity, a revision, declared relationships and a circuit that can be inspected. Sprawl becomes an inventory rather than a rumour.',
      'Conformance receipts state their own scope: capability, revision, target and the checks that ran. A result is never generalised past what it covered, and an unassessed embodiment is never presented as conformant.',
      'Because authority is downloadable and contracts are declared, provider substitution is an engineering exercise with a stated remainder — not a renegotiation from zero.',
    ],
  },
  outcomes: [
    'Sprawl control: one inventory with identities, revisions and declared relationships.',
    'Conformance receipts whose scope is explicit, including what they do not cover.',
    'Switching leverage that comes from owning the authority rather than from a contract clause.',
  ],
  proof: {
    title: 'What is demonstrated today',
    body:
      'This site publishes its own estate generation together with its findings — including the capabilities whose topology is unresolved and the entities with no artwork produced. That is the governance posture applied to itself. Conformance receipts and telemetry require the evidence adapters, which are open dependencies in this build.',
    available: true,
  },
  cta: CTA.talkToUs,
  secondaryCta: { label: 'Governance in detail', href: ROUTES.governance.href },
};

export default function EnterprisePage() {
  return <SolutionPage content={content} />;
}
