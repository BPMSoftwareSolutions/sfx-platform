import { SolutionPage, type SolutionContent } from '@/components/solutions/solution-page';
import { CTA, ROUTES } from '@/lib/routes';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'SideFX for SMBs — migrate one capability at a time',
  description:
    'Assess one existing capability, identify the dependencies you keep, plan a staged migration, and validate the result before moving the next one.',
  path: '/solutions/smb',
});

const content: SolutionContent = {
  eyebrow: 'For SMBs',
  title: 'Move one capability. Then decide about the rest.',
  subhead:
    'A migration you can stop after step one is a migration worth starting. Begin with a single capability and a written account of what it actually depends on.',
  problem: {
    title: 'Migration risk is mostly unknown dependency',
    body: [
      'The thing that makes a migration frightening is not the work — it is discovering, mid-way, a dependency nobody had written down.',
      'Meanwhile the current provider relationship keeps deepening, because staying still is the only option that never surfaces a surprise.',
    ],
  },
  mechanism: {
    title: 'Assess, declare, stage, validate',
    body: [
      'Start with one capability: describe what it does today and inspect the circuit that results. Its inputs, events, responsibilities and outcomes become explicit.',
      'Dependencies you must retain are named rather than discovered. Where something cannot be resolved, it is shown as unresolved instead of assumed.',
      'You move that one capability, validate it, and only then decide whether the next one is worth moving.',
    ],
  },
  outcomes: [
    'A written dependency picture for the capability before you commit to moving it.',
    'A staged path where each step is independently valuable and independently reversible.',
    'A validation step per capability rather than one large cut-over.',
  ],
  proof: {
    title: 'What is demonstrated today',
    body:
      'No scoped migration example with its assumptions has been published yet, so this page describes the workflow without attaching a timeline or a saving to it. A migration conversation starts from your actual capability, not from a template.',
    available: false,
  },
  cta: CTA.discussMigration,
  secondaryCta: { label: 'How the estate works', href: ROUTES.capabilityEstate.href },
};

export default function SmbPage() {
  return <SolutionPage content={content} />;
}
