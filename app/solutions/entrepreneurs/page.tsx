import { SolutionPage, type SolutionContent } from '@/components/solutions/solution-page';
import { CTA, ROUTES } from '@/lib/routes';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'SideFX for entrepreneurs — build on a foundation you own',
  description:
    'Build and export your startup’s first business capability, so provider dependency is a choice you make later rather than one you inherit at founding.',
  path: '/solutions/entrepreneurs',
});

const content: SolutionContent = {
  eyebrow: 'For entrepreneurs',
  title: 'Build your startup on a foundation you own.',
  subhead:
    'The dependencies you take at founding are the hardest ones to leave. Owning the definition of your capabilities keeps that decision reversible.',
  problem: {
    title: 'Provider dependency compounds from day one',
    body: [
      'Early speed usually means adopting whatever platform gets the first version shipped. The capability then exists only as configuration and generated code inside that platform.',
      'Two years later, the cost of leaving is not the code — it is that nobody can state precisely what the system was supposed to do.',
    ],
  },
  mechanism: {
    title: 'Own the definition first; choose the operator second',
    body: [
      'Describe the capability, inspect its circuit, and keep the semantic authority as your artifact. The authority names its contracts and dependencies explicitly.',
      'Operate it with open-source SDA or with your own architecture. A provider becomes a replaceable part rather than the place your meaning lives.',
    ],
  },
  outcomes: [
    'A capability definition that outlives any single vendor relationship.',
    'A clear statement, per capability, of what you depend on and must acquire yourself.',
    'A switching decision you can make on evidence rather than on fear.',
  ],
  proof: {
    title: 'What is demonstrated today',
    body:
      'The export path and its independent-use evidence are open dependencies in this build, so no cost or migration saving is claimed here. What you can do today is inspect real published capabilities and see exactly what a definition records.',
    available: false,
  },
  cta: CTA.build,
  secondaryCta: { label: 'The ownership contract', href: ROUTES.ownership.href },
};

export default function EntrepreneursPage() {
  return <SolutionPage content={content} />;
}
