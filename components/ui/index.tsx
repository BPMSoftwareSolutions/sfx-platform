import Link from 'next/link';
import type { ReactNode } from 'react';

/** Design system v1 shell components — §6.4. */

export function Section({
  children,
  className = '',
  labelledBy,
}: {
  children: ReactNode;
  className?: string;
  labelledBy?: string;
}) {
  return (
    <section aria-labelledby={labelledBy} className={`site-section mx-auto max-w-7xl px-4 py-16 ${className}`}>
      {children}
    </section>
  );
}

export function Eyebrow({ children, href }: { children: ReactNode; href?: string }) {
  const content = <span className="font-mono text-xs uppercase tracking-widest text-signal">{children}</span>;
  return href ? (
    <Link href={href} className="inline-block hover:brightness-125">
      {content}
    </Link>
  ) : (
    content
  );
}

export function SectionHeader({
  id,
  eyebrow,
  title,
  lede,
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  lede?: string;
}) {
  return (
    <div className="mb-8 max-w-3xl">
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <h2 id={id} className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
        {title}
      </h2>
      {lede ? <p className="mt-3 text-lg text-muted">{lede}</p> : null}
    </div>
  );
}

export function Hero({
  eyebrow,
  eyebrowHref,
  title,
  subhead,
  actions,
  children,
  media,
}: {
  eyebrow?: string;
  eyebrowHref?: string;
  title: string;
  subhead?: string;
  actions?: ReactNode;
  children?: ReactNode;
  media?: ReactNode;
}) {
  if(media)return <section className="capability-hero page-width"><div>
    {eyebrow?<Eyebrow href={eyebrowHref}>{eyebrow}</Eyebrow>:null}
    <h1>{title}</h1>{subhead?<p className="hero-lede">{subhead}</p>:null}
    {actions?<div className="action-row">{actions}</div>:null}
    {children?<div className="mt-7">{children}</div>:null}
  </div>{media}</section>;
  return (
    <div className="site-hero relative border-b border-grid-line">
      <div className="relative mx-auto max-w-7xl px-4 py-16 sm:py-24">
        {eyebrow ? <Eyebrow href={eyebrowHref}>{eyebrow}</Eyebrow> : null}
        <h1 className="mt-3 max-w-4xl font-display text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
          {title}
        </h1>
        {subhead ? <p className="mt-5 max-w-2xl text-lg text-muted sm:text-xl">{subhead}</p> : null}
        {actions ? <div className="mt-8 flex flex-wrap gap-3">{actions}</div> : null}
        {children ? <div className="mt-12">{children}</div> : null}
      </div>
    </div>
  );
}

export function PrimaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded bg-signal px-5 py-3 text-sm font-semibold text-ink hover:brightness-110"
    >
      {children}
    </Link>
  );
}

export function SecondaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded border border-grid-line px-5 py-3 text-sm font-semibold text-text hover:border-signal hover:text-signal"
    >
      {children}
    </Link>
  );
}

export function Card({
  href,
  title,
  children,
  footer,
}: {
  href?: string;
  title: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  const body = (
    <>
      <h3 className="font-display text-lg font-semibold text-text">{title}</h3>
      {children ? <div className="mt-2 text-sm text-muted">{children}</div> : null}
      {footer ? <div className="mt-4">{footer}</div> : null}
    </>
  );
  return href ? (
    <Link
      href={href}
      className="block rounded-lg border border-grid-line bg-ink-2 p-5 transition-colors hover:border-signal"
    >
      {body}
    </Link>
  ) : (
    <div className="rounded-lg border border-grid-line bg-ink-2 p-5">{body}</div>
  );
}

/**
 * Status badge — §6.6. Status is carried by words and shape, never by color alone.
 * `tone` only tints an already-legible label.
 */
export function StatusBadge({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'signal' | 'authority' | 'telemetry' | 'failure';
  children: ReactNode;
}) {
  const tones = {
    neutral: 'border-grid-line text-muted',
    signal: 'border-signal/50 text-signal',
    authority: 'border-authority/50 text-authority',
    telemetry: 'border-telemetry/50 text-telemetry',
    failure: 'border-failure/50 text-failure',
  } as const;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 font-mono text-xs ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/**
 * Callout for a limitation, an open obligation or an unavailable integration.
 * The site states these plainly rather than implying a capability it does not have.
 */
export function Callout({
  tone = 'note',
  title,
  children,
}: {
  tone?: 'note' | 'limitation' | 'unavailable';
  title: string;
  children: ReactNode;
}) {
  const tones = {
    note: 'border-authority/40',
    limitation: 'border-telemetry/40',
    unavailable: 'border-failure/40',
  } as const;
  const labels = { note: 'Note', limitation: 'Limitation', unavailable: 'Not available' } as const;
  return (
    <div className={`rounded-lg border bg-ink-2 p-5 ${tones[tone]}`} role="note">
      <p className="font-mono text-xs uppercase tracking-widest text-muted">{labels[tone]}</p>
      <h3 className="mt-1 font-display text-base font-semibold">{title}</h3>
      <div className="mt-2 text-sm text-muted">{children}</div>
    </div>
  );
}

/**
 * FAQ built from real visible content.
 *
 * §7 — FAQPage structured data is emitted here and only here, so it can never describe a
 * question that is not rendered on the page. Answers must be plain strings for the markup;
 * richer answers can still be passed and simply carry no structured data.
 */
export function Faq({ items }: { items: { question: string; answer: ReactNode }[] }) {
  const answerable = items.filter(
    (item): item is { question: string; answer: string } => typeof item.answer === 'string',
  );
  const jsonLd =
    answerable.length === items.length
      ? {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: answerable.map((item) => ({
            '@type': 'Question',
            name: item.question,
            acceptedAnswer: { '@type': 'Answer', text: item.answer },
          })),
        }
      : undefined;

  return (
    <div className="divide-y divide-grid-line rounded-lg border border-grid-line bg-ink-2">
      {jsonLd ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      ) : null}
      {items.map((item) => (
        <details key={item.question} className="group p-5">
          <summary className="cursor-pointer list-none font-display text-base font-semibold marker:content-none">
            <span className="mr-2 text-signal group-open:hidden" aria-hidden="true">
              +
            </span>
            <span className="mr-2 hidden text-signal group-open:inline" aria-hidden="true">
              −
            </span>
            {item.question}
          </summary>
          <div className="mt-3 text-sm text-muted">{item.answer}</div>
        </details>
      ))}
    </div>
  );
}

export function CtaBand({
  title,
  children,
  actions,
}: {
  title: string;
  children?: ReactNode;
  actions: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden border-y border-grid-line">
      <div aria-hidden="true" className="blueprint-grid pointer-events-none absolute inset-0" />
      <div className="relative mx-auto max-w-7xl px-4 py-16 text-center">
        <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
        {children ? <p className="mx-auto mt-3 max-w-2xl text-muted">{children}</p> : null}
        <div className="mt-8 flex flex-wrap justify-center gap-3">{actions}</div>
      </div>
    </div>
  );
}

/** A key/value list for source-derived facts. Absent values read as an explicit absence. */
export function FactList({ facts }: { facts: { term: string; value: ReactNode }[] }) {
  return (
    <dl className="divide-y divide-grid-line rounded-lg border border-grid-line bg-ink-2">
      {facts.map((fact) => (
        <div key={fact.term} className="grid gap-1 p-4 sm:grid-cols-3">
          <dt className="font-mono text-xs uppercase tracking-widest text-muted">{fact.term}</dt>
          <dd className="text-sm sm:col-span-2">{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Renders an absent source value as an explicit absence, never as a negative claim (§11.3). */
export function NotDeclared({ what = 'Not declared in this generation' }: { what?: string }) {
  return <span className="text-muted italic">{what}</span>;
}
