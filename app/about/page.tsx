import { Callout, CtaBand, Hero, PrimaryLink, SecondaryLink, Section, SectionHeader } from '@/components/ui';
import { CTA, ROUTES, SITE } from '@/lib/routes';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'About SideFX and BPM Intelligence',
  description:
    'SideFX — Semantic Intent-Driven Engineering Effects — is built by BPM Intelligence, founded by Sidney Jones, around capability ownership.',
  path: '/about',
});

export default function AboutPage() {
  return (
    <>
      <Hero
        eyebrow="About"
        title="Semantic Intent-Driven Engineering Effects."
        subhead={`${SITE.name} is built by ${SITE.owner}, founded by Sidney Jones, around a single commitment: the customer owns the capability.`}
      />

      <Section labelledBy="name">
        <SectionHeader id="name" eyebrow="The name" title="What SideFX stands for" />
        <div className="max-w-3xl space-y-4 text-lg">
          <p>
            <strong>Semantic</strong> — a capability is defined by meaning that both people and
            machines can act on. <strong>Intent-Driven</strong> — that meaning starts from a stated
            need rather than from a file. <strong>Engineering</strong> — the definition is
            inspectable, projectable and verifiable. <strong>Effects</strong> — what the capability
            actually delivers to the person using it.
          </p>
          <p>
            The product sequence follows the name: {SITE.sequence}
          </p>
        </div>
      </Section>

      <Section labelledBy="story">
        <SectionHeader id="story" eyebrow="The story" title="From business process to capability ownership" />
        <div className="max-w-3xl space-y-4">
          <p>
            {SITE.owner} — formerly BPM Software Solutions LLC — came from business process work,
            where the recurring failure was never a lack of software. It was that nobody could state,
            precisely and durably, what a capability was supposed to do.
          </p>
          <p>
            Generative AI made that failure acute. Code arrives faster than meaning can be recorded,
            and the resulting sprawl is a governance liability, a cost-of-ownership trap and a
            lock-in vector at the same time.
          </p>
          <p>
            SideFX answers with a capability estate built on executable meaning, an intent-driven
            environment for authoring capabilities, and downloadable authority and embodiments.
          </p>
        </div>
      </Section>

      <Section labelledBy="credibility">
        <SectionHeader id="credibility" eyebrow="Attribution" title="What is claimed, and what is not" />
        <div className="max-w-3xl">
          <Callout tone="limitation" title="Founder biography, portrait and timeline are pending editorial approval">
            <p>
              Specific contributions require an attributable source and a date before they are
              published here. The company history, rebrand dates and product milestones need verified
              dates, and any future item must be labelled as planned.
            </p>
            <p className="mt-2">
              SideFX describes its own implementation. It does not attribute the invention of the
              underlying techniques it builds on to its founder.
            </p>
          </Callout>
        </div>
      </Section>

      <Section labelledBy="youtube">
        <SectionHeader
          id="youtube"
          eyebrow="Teaching"
          title="The recurring episode structure"
          lede="Semantic → Intent-Driven → Engineering → Effects."
        />
        <div className="max-w-3xl space-y-4 text-sm text-muted">
          <p>
            Each episode starts from a spoken need, reveals the capability circuit, demonstrates the
            supported result and ends at the ownership step — the download.
          </p>
          <p>
            Every episode binds the same capability revision and visual artifacts the site uses, so a
            video and its capability page cannot drift apart. Episodes are linked from here once a
            reviewed video and a verified channel destination exist; none is linked before then.
          </p>
        </div>
      </Section>

      <CtaBand
        title="Own your capabilities."
        actions={
          <>
            <PrimaryLink href={CTA.build.href}>{CTA.build.label}</PrimaryLink>
            <SecondaryLink href={ROUTES.managedCapabilityProvider.href}>The category</SecondaryLink>
          </>
        }
      />
    </>
  );
}
