import Link from 'next/link';

import { Callout, Hero, Section, SectionHeader } from '@/components/ui';
import { ROUTES, SITE } from '@/lib/routes';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Terms',
  description:
    'The terms covering use of the SideFX website and the export rights attached to a downloaded capability.',
  path: '/legal/terms',
});

export default function TermsPage() {
  return (
    <>
      <Hero
        eyebrow="Legal"
        title="Terms"
        subhead="The terms that will govern use of this site and the rights attached to a downloaded capability."
      />

      <Section>
        <div className="max-w-3xl">
          <Callout tone="unavailable" title="These terms are not yet in force">
            <p>
              Publishable terms require the contracting entity&rsquo;s legal identity and approved
              copy covering the service as implemented, the export rights attached to a download, and
              the actual data processing. {SITE.name} and {SITE.owner} are brand names; they do not
              determine the legal entity.
            </p>
            <p className="mt-2">
              The summary below states the intended position so it can be reviewed. It is not a
              contract.
            </p>
          </Callout>
        </div>
      </Section>

      <Section labelledBy="intended">
        <SectionHeader id="intended" eyebrow="Intended position" title="What the terms are meant to establish" />
        <div className="max-w-3xl space-y-6 text-sm text-muted">
          <div>
            <h3 className="font-display text-base font-semibold text-text">Ownership of exported capabilities</h3>
            <p className="mt-2">
              A downloaded capability&rsquo;s semantic authority and its available embodiments are
              yours to manage, invoke and use — with open-source SDA or with your own architecture —
              without an ongoing session on this site.
            </p>
          </div>
          <div>
            <h3 className="font-display text-base font-semibold text-text">Third-party dependencies</h3>
            <p className="mt-2">
              Runtimes, provider accounts, credentials and dependencies that must be acquired
              separately are named in the bundle manifest and remain governed by their own licenses.
            </p>
          </div>
          <div>
            <h3 className="font-display text-base font-semibold text-text">What evidence means</h3>
            <p className="mt-2">
              Conformance and verification results apply only within the scope each receipt states.
              Nothing on this site should be read as a warranty of behavior outside that scope.
            </p>
          </div>
          <div>
            <h3 className="font-display text-base font-semibold text-text">Publication</h3>
            <p className="mt-2">
              Capabilities you create are private to your workspace. Public publication is a separate,
              explicit and authorized action.
            </p>
          </div>
        </div>
      </Section>

      <Section>
        <p className="text-sm text-muted">
          See also the{' '}
          <Link href={ROUTES.privacy.href} className="text-signal underline">
            privacy information
          </Link>{' '}
          and the{' '}
          <Link href={ROUTES.ownership.href} className="text-signal underline">
            ownership guide
          </Link>
          .
        </p>
      </Section>
    </>
  );
}
