import { SolutionPage, type SolutionContent } from '@/components/solutions/solution-page';
import { CTA, ROUTES } from '@/lib/routes';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'SideFX for domain experts — describe the goal, see the circuit',
  description:
    'Describe the experience you want, review the proposed inputs, actions and outcomes, and collaborate on provider choices without writing code.',
  path: '/solutions/domain-experts',
});

const content: SolutionContent = {
  eyebrow: 'For domain experts',
  title: 'Describe the goal. Read the circuit. Decide.',
  subhead:
    'You know what the capability has to do. A circuit lets you check that the proposal matches, before anyone builds it.',
  problem: {
    title: 'Every change goes through a translation you cannot see',
    body: [
      'You describe a domain goal; someone translates it into a system; the system comes back weeks later behaving in a way you would have corrected on day one.',
      'The gap is not effort. It is that the translation has no readable intermediate form you can inspect and correct.',
    ],
  },
  mechanism: {
    title: 'The circuit is that readable intermediate form',
    body: [
      'A capability circuit names its input, the event that triggers it, the responsibility it carries and the outcome it produces — in plain language, before implementation.',
      'You can read it, follow it as a text outline, select any node to see exactly what the source declares, and say where it is wrong.',
      'Provider choices are visible too: which responsibility needs an outside service, what that service must satisfy, and what remains unresolved.',
    ],
  },
  outcomes: [
    'Review a proposed capability in its own terms rather than in code.',
    'Catch a wrong assumption at the definition stage instead of after delivery.',
    'Share an exact view of a scenario by link, node selection included.',
  ],
  proof: {
    title: 'What is demonstrated today',
    body:
      'The published estate on this site is readable this way now: every capability opens its circuit with a keyboard-navigable outline and a node inspector that shows the exact declared state, including where the source resolves nothing.',
    available: true,
  },
  cta: CTA.explore,
  secondaryCta: { label: 'See how circuits work', href: ROUTES.circuits.href },
};

export default function DomainExpertsPage() {
  return <SolutionPage content={content} />;
}
