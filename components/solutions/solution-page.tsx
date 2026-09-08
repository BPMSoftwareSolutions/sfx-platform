import Link from 'next/link';

import { Callout, CtaBand, Hero, PrimaryLink, SecondaryLink, Section, SectionHeader } from '@/components/ui';
import { getFeaturedCapabilities } from '@/lib/estate';
import { CTA, ROUTES } from '@/lib/routes';

/**
 * The one solutions skeleton — §5.11.
 *
 * problem → SideFX mechanism → outcome (3 bullets) → proof → persona CTA.
 *
 * The proof block states what is actually available. Where a proof asset does not exist, the
 * intended outcome is described as a target and the limitation is exposed rather than dressed
 * up as evidence.
 */
export interface SolutionContent {
  eyebrow: string;
  title: string;
  subhead: string;
  problem: { title: string; body: string[] };
  mechanism: { title: string; body: string[] };
  outcomes: [string, string, string];
  /** Real, available support for the claims above — or an explicit statement that none exists yet. */
  proof: { title: string; body: string; available: boolean };
  cta: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
}

export function SolutionPage({ content }: { content: SolutionContent }) {
  const example = getFeaturedCapabilities(1)[0];

  return (
    <>
      <Hero
        eyebrow={content.eyebrow}
        title={content.title}
        subhead={content.subhead}
        actions={
          <>
            <PrimaryLink href={content.cta.href}>{content.cta.label}</PrimaryLink>
            {content.secondaryCta ? (
              <SecondaryLink href={content.secondaryCta.href}>{content.secondaryCta.label}</SecondaryLink>
            ) : null}
          </>
        }
      />

      <Section labelledBy="problem">
        <SectionHeader id="problem" eyebrow="The problem" title={content.problem.title} />
        <div className="max-w-3xl space-y-4 text-lg">
          {content.problem.body.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </Section>

      <Section labelledBy="mechanism">
        <SectionHeader id="mechanism" eyebrow="The mechanism" title={content.mechanism.title} />
        <div className="max-w-3xl space-y-4 text-lg">
          {content.mechanism.body.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
        {example ? (
          <p className="mt-6 text-sm text-muted">
            Work through it on a published capability:{' '}
            <Link href={`/capabilities/${example.urlKey}`} className="text-signal underline">
              {example.title}
            </Link>
            .
          </p>
        ) : null}
      </Section>

      <Section labelledBy="outcomes">
        <SectionHeader id="outcomes" eyebrow="The outcome" title="What changes for you" />
        <ul className="grid gap-4 lg:grid-cols-3">
          {content.outcomes.map((outcome) => (
            <li key={outcome} className="rounded-lg border border-grid-line bg-ink-2 p-5 text-sm">
              {outcome}
            </li>
          ))}
        </ul>
      </Section>

      <Section labelledBy="proof">
        <SectionHeader id="proof" eyebrow="Proof" title={content.proof.title} />
        <div className="max-w-3xl">
          {content.proof.available ? (
            <p className="text-lg">{content.proof.body}</p>
          ) : (
            <Callout tone="limitation" title="This outcome is a target, not a demonstrated result">
              <p>{content.proof.body}</p>
            </Callout>
          )}
        </div>
      </Section>

      <CtaBand
        title={content.cta.label}
        actions={
          <>
            <PrimaryLink href={content.cta.href}>{content.cta.label}</PrimaryLink>
            <SecondaryLink href={ROUTES.docs.href}>Read the docs</SecondaryLink>
          </>
        }
      >
        {CTA.build.href === content.cta.href
          ? 'Describe a capability and inspect the circuit it proposes.'
          : undefined}
      </CtaBand>
    </>
  );
}
