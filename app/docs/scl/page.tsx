import Link from 'next/link';

import { Callout, Hero, Section, SectionHeader } from '@/components/ui';
import { PRIMITIVE_STYLES, EDGE_STYLES } from '@/components/circuit/scl-theme';
import { getCircuitsForCapability, getFeaturedCapabilities } from '@/lib/estate';
import { ROUTES } from '@/lib/routes';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'SCL guide — the SideFX Circuit Language',
  description:
    'The SCL symbol legend, a complete published example, 0.1 compatibility, and the distinction between a design and an execution.',
  path: '/docs/scl',
});

export default function SclPage() {
  const example = getFeaturedCapabilities(1)[0];
  const circuit = example ? getCircuitsForCapability(example.entityId)[0] : undefined;

  return (
    <>
      <Hero
        eyebrow="SCL"
        title="The SideFX Circuit Language."
        subhead="SCL is the language of executable capability circuits. It states what a capability accepts, what triggers it, what it is responsible for and what it produces — in a form both a person and a compiler can read."
      />

      <Section labelledBy="legend">
        <SectionHeader
          id="legend"
          eyebrow="Legend"
          title="Primitives this renderer carries"
          lede="Each primitive has its own word and shape, so a circuit stays legible without relying on color."
        />
        <div className="overflow-x-auto rounded-lg border border-grid-line">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <caption className="sr-only">SCL primitives rendered by the website circuit viewer</caption>
            <thead className="bg-ink-2 text-left font-mono text-xs uppercase tracking-widest text-muted">
              <tr>
                <th scope="col" className="p-3">Primitive</th>
                <th scope="col" className="p-3">Reads as</th>
                <th scope="col" className="p-3">Meaning</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-grid-line">
              {[
                ['INPUT', 'What the capability accepts before anything happens.'],
                ['EVENT', 'What triggers the capability to act.'],
                ['RESPONSIBILITY', 'What the capability is accountable for doing.'],
                ['OUTCOME', 'What the capability produces.'],
                ['PROVIDER_SLOT', 'A responsibility that an outside provider must satisfy.'],
                ['UNRESOLVED', 'A member the source declares but does not resolve. Never filled in.'],
              ].map(([key, meaning]) => (
                <tr key={key}>
                  <td className="p-3 font-mono text-xs">{key}</td>
                  <td className="p-3">{PRIMITIVE_STYLES[key as keyof typeof PRIMITIVE_STYLES].label}</td>
                  <td className="p-3 text-muted">{meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className="mt-8 mb-3 font-display text-lg font-semibold">Route families</h3>
        <ul className="space-y-2 text-sm">
          {Object.entries(EDGE_STYLES).map(([family, style]) => (
            <li key={family} className="flex items-center gap-3">
              <svg width="40" height="8" aria-hidden="true">
                <line
                  x1="0"
                  y1="4"
                  x2="40"
                  y2="4"
                  stroke={style.stroke}
                  strokeWidth="2"
                  strokeDasharray={style.dash === '1 0' ? undefined : style.dash}
                />
              </svg>
              <span>
                <strong>{style.label}</strong> —{' '}
                {family === 'EXECUTION'
                  ? 'the capability proceeds along this route.'
                  : family === 'PRODUCT_TRANSFER'
                    ? 'a product moves between contracts whose identities match.'
                    : 'a supporting relationship — a binding, an authority or an evidence link. Never execution.'}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section labelledBy="example">
        <SectionHeader id="example" eyebrow="A complete example" title="A published circuit, read as text" />
        {example && circuit ? (
          <div className="max-w-3xl">
            <p className="mb-4 text-sm text-muted">
              From{' '}
              <Link href={`/capabilities/${example.urlKey}`} className="text-signal underline">
                {example.title}
              </Link>
              , scenario <span className="font-mono text-xs">{circuit.scenarioId}</span>:
            </p>
            <ol className="space-y-3">
              {circuit.nodes.map((node) => (
                <li key={node.id} className="rounded border border-grid-line bg-ink-2 p-4">
                  <p className="font-mono text-xs uppercase tracking-widest text-muted">
                    {PRIMITIVE_STYLES[node.primitive].label}
                  </p>
                  <p className="mt-1">{node.label}</p>
                  {node.sourceId ? (
                    <p className="mt-1 break-all font-mono text-xs text-muted">{node.sourceId}</p>
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <Callout tone="unavailable" title="No published circuit is available in this build">
            <p>The example is drawn from the published estate, which is not readable here.</p>
          </Callout>
        )}
      </Section>

      <Section labelledBy="versions">
        <SectionHeader id="versions" eyebrow="Versions" title="0.2 for authoring, 0.1 for compatibility" />
        <div className="max-w-3xl space-y-4 text-sm text-muted">
          <p>
            New candidate authoring uses SCL 0.2 in its Lite and canonical forms. SCL 0.1 is preserved
            for compatible reveals of existing estate capabilities, and saved drafts are never
            silently migrated between versions.
          </p>
          <p>
            Parser, schema, graph, grammar, renderer and source versions are all pinned, and each
            published circuit carries its versions alongside its digests.
          </p>
        </div>
      </Section>

      <Section labelledBy="design-vs-execution">
        <SectionHeader
          id="design-vs-execution"
          eyebrow="The key distinction"
          title="A design is not an execution"
        />
        <div className="max-w-3xl space-y-4">
          <p className="text-lg">
            Authored SCL is a <em>candidate design</em> until the applicable capability authority
            boundary accepts it. An SCL reveal of an existing capability is a <em>projection</em> of
            its source, not a new authority.
          </p>
          <p className="text-sm text-muted">
            A visual layout edit changes presentation only. A semantic edit must produce a versioned
            SCL and graph change, validate it, and recompile every affected projection. Playing an
            illustrative flow invokes nothing and proves nothing about execution.
          </p>
          <p className="text-sm text-muted">
            See{' '}
            <Link href={ROUTES.circuits.href} className="text-signal underline">
              capability circuits
            </Link>{' '}
            for how fidelity is reported when the source cannot qualify a full topology.
          </p>
        </div>
      </Section>
    </>
  );
}
