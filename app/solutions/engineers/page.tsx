import { SolutionPage, type SolutionContent } from '@/components/solutions/solution-page';
import { CTA, ROUTES } from '@/lib/routes';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'SideFX for engineers — authority over generated code',
  description:
    'Describe intent, inspect the circuit and its contracts, verify the targets you need, and download the capability’s authority and embodiments.',
  path: '/solutions/engineers',
});

const content: SolutionContent = {
  eyebrow: 'For engineers',
  title: 'Stop reviewing sprawl. Start owning meaning.',
  subhead:
    'AI-generated code arrives faster than anyone can review it, and none of it records what the capability was supposed to do. SideFX puts the definition first.',
  problem: {
    title: 'Generated code is an artifact without an authority',
    body: [
      'A coding assistant produces plausible code. It does not produce a durable statement of what the capability must accept, when it runs, what it is responsible for, or what it must return. That statement lives in a ticket, a head, or nowhere.',
      'The result is sprawl: many implementations, no canonical meaning, and a review burden that grows faster than the team.',
    ],
  },
  mechanism: {
    title: 'Describe, inspect, verify, export',
    body: [
      'You describe the capability you need. The intent-driven environment proposes a circuit: explicit inputs, events, responsibilities, outcomes and provider slots, each with the state its source declares.',
      'You refine that circuit by conversation or by editing supported SCL. Every change is a candidate revision with validation diagnostics, so a bad edit tells you what to repair instead of silently degrading.',
      'When the definition is right, you export it. The bundle identifies the exact revision by digest and names every dependency you must supply yourself.',
    ],
  },
  outcomes: [
    'A canonical definition per capability, readable by a person and executable by a machine.',
    'Review at the level of meaning rather than diff-by-diff over generated output.',
    'A migration path off any single provider, because the contracts are declared rather than implied.',
  ],
  proof: {
    title: 'What is demonstrated today',
    body:
      'Every published capability on this site opens its real circuit from the estate, with source identities and declared states inspectable node by node. The export path is not connected in this build, so no download or independent-use result is claimed yet.',
    available: false,
  },
  cta: CTA.build,
  secondaryCta: { label: 'Read the SCL guide', href: ROUTES.scl.href },
};

export default function EngineersPage() {
  return <SolutionPage content={content} />;
}
