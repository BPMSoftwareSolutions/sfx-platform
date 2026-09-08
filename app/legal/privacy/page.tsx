import Link from 'next/link';

import { Callout, Hero, Section, SectionHeader } from '@/components/ui';
import { ROUTES, SITE } from '@/lib/routes';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Privacy',
  description:
    'What SideFX collects, what it does not send to analytics, and how voice input and contact inquiries are handled.',
  path: '/legal/privacy',
});

export default function PrivacyPage() {
  return (
    <>
      <Hero
        eyebrow="Legal"
        title="Privacy"
        subhead="What this site collects, what it deliberately does not, and where those decisions are enforced in the implementation."
      />

      <Section>
        <div className="max-w-3xl">
          <Callout tone="unavailable" title="This page is not yet legally complete">
            <p>
              A published privacy notice requires the contracting entity&rsquo;s legal identity,
              approved copy covering the service as implemented, and the actual data retention and
              consent configuration. The brand name {SITE.name} and the parent brand {SITE.owner} are
              not sufficient to identify a legal entity.
            </p>
            <p className="mt-2">
              What follows describes the behavior implemented in this build. It is accurate about the
              software and is not a substitute for the approved notice.
            </p>
          </Callout>
        </div>
      </Section>

      <Section labelledBy="what">
        <SectionHeader id="what" eyebrow="Implemented behavior" title="What this build does" />
        <div className="max-w-3xl space-y-6 text-sm text-muted">
          <div>
            <h3 className="font-display text-base font-semibold text-text">Voice input</h3>
            <p className="mt-2">
              The microphone is requested only when you activate <strong>Speak your intent</strong>,
              and a recording indicator is shown while it is active. Speech is converted to editable
              text in your browser; raw audio is not retained by default. Denying microphone access
              leaves every typed path working identically.
            </p>
          </div>
          <div>
            <h3 className="font-display text-base font-semibold text-text">Your intent text</h3>
            <p className="mt-2">
              An intent you type or speak is kept in your own browser&rsquo;s local storage so a
              reload or a failed submission does not lose it. You can clear it from the composer at
              any time.
            </p>
          </div>
          <div>
            <h3 className="font-display text-base font-semibold text-text">Contact inquiries</h3>
            <p className="mt-2">
              An inquiry is validated, rate-limited and recorded with a reference before it is
              acknowledged. Where mail delivery is not configured, the acknowledgement says so rather
              than claiming the message was sent.
            </p>
          </div>
          <div>
            <h3 className="font-display text-base font-semibold text-text">Analytics</h3>
            <p className="mt-2">
              Product analytics are limited to events such as a capability being opened, a circuit
              inspected or an inquiry accepted. Voice recordings, transcripts, prompts, credentials,
              private capability names and contact message contents are never sent to analytics. No
              analytics provider is enabled in this build.
            </p>
          </div>
        </div>
      </Section>

      <Section>
        <p className="text-sm text-muted">
          Questions about this notice can go through{' '}
          <Link href={ROUTES.contact.href} className="text-signal underline">
            contact
          </Link>
          .
        </p>
      </Section>
    </>
  );
}
