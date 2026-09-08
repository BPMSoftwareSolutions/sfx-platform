import Link from 'next/link';
import { Suspense } from 'react';

import { ContactForm } from '@/components/contact/contact-form';
import { Callout, Hero, Section, SectionHeader } from '@/components/ui';
import { INQUIRY_TYPES } from '@/lib/inquiry-schema';
import { ROUTES } from '@/lib/routes';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Contact SideFX',
  description:
    'Talk to us about an enterprise capability estate, a migration, training or a partnership. Every inquiry gets a reference you can follow up with.',
  path: '/contact',
});

/** Query-string preselection stays editable (§5.15). */
async function Form({ searchParams }: { searchParams: Promise<{ intent?: string }> }) {
  const { intent } = await searchParams;
  const preselected = INQUIRY_TYPES.find((type) => type === intent);
  return <ContactForm initialIntent={preselected} />;
}

export default function ContactPage({ searchParams }: { searchParams: Promise<{ intent?: string }> }) {
  return (
    <>
      <Hero
        eyebrow="Contact"
        title="Tell us what you are trying to own."
        subhead="Enterprise estates, migrations, training and partnerships all start with the same question: which capability, and what do you need to be true about it?"
      />

      <Section labelledBy="form">
        <SectionHeader id="form" eyebrow="Send an inquiry" title="We reply to the address you give us." />
        <div className="grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div>
            <Suspense
              fallback={
                <div className="rounded-lg border border-grid-line bg-ink-2 p-6 text-sm text-muted">
                  Loading form…
                </div>
              }
            >
              <Form searchParams={searchParams} />
            </Suspense>
          </div>

          <aside className="space-y-4">
            <Callout tone="note" title="What happens to what you send">
              <p>
                Your message is validated, rate-limited and recorded with an inquiry reference before
                we acknowledge it. Contact details are never sent to analytics.
              </p>
              <p className="mt-2">
                <Link href={ROUTES.privacy.href} className="text-signal underline">
                  Read the privacy information
                </Link>
              </p>
            </Callout>
            <Callout tone="limitation" title="Delivery configuration">
              <p>
                Mail delivery depends on a configured recipient and provider, which are release
                dependencies. Where they are not configured, the acknowledgement says the inquiry was
                recorded rather than claiming it was emailed.
              </p>
            </Callout>
          </aside>
        </div>
      </Section>
    </>
  );
}
