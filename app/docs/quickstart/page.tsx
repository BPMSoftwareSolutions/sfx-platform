import Link from 'next/link';

import { Callout, Hero, Section, SectionHeader } from '@/components/ui';
import { getFeaturedCapabilities } from '@/lib/estate';
import { CTA, ROUTES } from '@/lib/routes';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Quickstart — intent to owned capability',
  description:
    'The launch quickstart: describe an intent, inspect the candidate circuit, export the capability, and invoke it independently.',
  path: '/docs/quickstart',
});

export default function QuickstartPage() {
  const example = getFeaturedCapabilities(1)[0];

  return (
    <>
      <Hero
        eyebrow="Quickstart"
        title="Intent → circuit → download → independent use."
        subhead="The full path, with the steps that work today marked apart from the steps that need an integration this build does not have."
      />

      <Section labelledBy="status">
        <div className="max-w-3xl">
          <Callout tone="unavailable" title="This quickstart is not yet end-to-end">
            <p>
              A quickstart may only walk through an actual supported example. The authoring conveyor
              and the export adapter are open dependencies, so steps 3 and 4 below describe the
              intended path rather than a verified run. No unverified example is published as
              operational.
            </p>
          </Callout>
        </div>
      </Section>

      <Section labelledBy="steps">
        <SectionHeader id="steps" eyebrow="The path" title="Four steps" />
        <ol className="max-w-3xl space-y-6">
          <li className="rounded-lg border border-signal/40 bg-ink-2 p-6">
            <p className="font-mono text-xs uppercase tracking-widest text-signal">Step 1 · available</p>
            <h3 className="mt-1 font-display text-lg font-semibold">Describe the capability</h3>
            <p className="mt-2 text-sm text-muted">
              Open{' '}
              <Link href={CTA.build.href} className="text-signal underline">
                {CTA.build.label.toLowerCase()}
              </Link>{' '}
              and type or speak what you need. Speaking and typing produce the same editable text, and
              your intent is retained on your device.
            </p>
          </li>

          <li className="rounded-lg border border-signal/40 bg-ink-2 p-6">
            <p className="font-mono text-xs uppercase tracking-widest text-signal">Step 2 · available</p>
            <h3 className="mt-1 font-display text-lg font-semibold">Read a circuit</h3>
            <p className="mt-2 text-sm text-muted">
              Every published capability opens in the same viewer a candidate would use.
              {example ? (
                <>
                  {' '}
                  Try{' '}
                  <Link href={`/capabilities/${example.urlKey}`} className="text-signal underline">
                    {example.title}
                  </Link>{' '}
                  and select a node to see its meaning, exact source identity and declared state.
                </>
              ) : null}
            </p>
          </li>

          <li className="rounded-lg border border-grid-line bg-ink-2 p-6">
            <p className="font-mono text-xs uppercase tracking-widest text-telemetry">
              Step 3 · integration pending
            </p>
            <h3 className="mt-1 font-display text-lg font-semibold">Export the capability</h3>
            <p className="mt-2 text-sm text-muted">
              An export resolves a pinned manifest and immutable artifact hashes for the exact
              revision you selected. A missing, unauthorized or stale artifact fails with a clear
              recovery action — it never silently falls back to a different revision.
            </p>
          </li>

          <li className="rounded-lg border border-grid-line bg-ink-2 p-6">
            <p className="font-mono text-xs uppercase tracking-widest text-telemetry">
              Step 4 · integration pending
            </p>
            <h3 className="mt-1 font-display text-lg font-semibold">Invoke it independently</h3>
            <p className="mt-2 text-sm text-muted">
              Import the bundle into open-source SDA or your own architecture and invoke the
              capability there. The bundle names its runtimes, provider accounts and dependencies; the{' '}
              <Link href={ROUTES.ownership.href} className="text-signal underline">
                ownership guide
              </Link>{' '}
              covers what it contains.
            </p>
          </li>
        </ol>
      </Section>
    </>
  );
}
