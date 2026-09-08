'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';

import { CTA, DOC_ROUTES, PLATFORM_PILLARS, ROUTES, SOLUTION_ROUTES, linkable } from '@/lib/routes';

/**
 * P1 global navigation — §4.
 *
 * Explore / Platform / Solutions / Docs / About, plus the primary and secondary CTAs.
 * Menus are semantic buttons with expanded state, keyboard activation, Escape to close and
 * focus return (§6.6). Only available routes are rendered.
 */

const EXPLORE: readonly (keyof typeof ROUTES)[] = ['capabilities', 'mechanics', 'providers'];
const PLATFORM: readonly (keyof typeof ROUTES)[] = [
  'platform',
  ...PLATFORM_PILLARS,
  'executableMeaning',
  'managedCapabilityProvider',
  'ecosystem',
];

interface MenuProps {
  label: string;
  items: { href: string; label: string; description?: string }[];
}

function Menu({ label, items }: MenuProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded px-2 py-2 text-sm text-text hover:text-signal"
      >
        {label}
        <span aria-hidden="true" className="text-xs text-muted">
          ▾
        </span>
      </button>
      <ul
        id={id}
        hidden={!open}
        className="absolute left-0 top-full z-50 mt-1 w-72 rounded-md border border-grid-line bg-ink-2 p-2 shadow-xl"
      >
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={() => setOpen(false)}
              className="block rounded px-3 py-2 text-sm hover:bg-ink"
            >
              <span className="block text-text">{item.label}</span>
              {item.description ? (
                <span className="block text-xs text-muted">{item.description}</span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SiteNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close the narrow-screen panel on navigation so focus never lands behind an overlay.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const explore = linkable(EXPLORE);
  const platform = linkable(PLATFORM);
  const solutions = linkable(SOLUTION_ROUTES);

  return (
    <header className="sticky top-0 z-40 border-b border-grid-line bg-ink/95 backdrop-blur">
      <nav aria-label="Primary" className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
        <Link href="/" className="font-display text-lg font-bold tracking-tight text-text">
          Side<span className="text-signal">FX</span>
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          <Menu label="Explore" items={explore} />
          <Menu label="Platform" items={platform} />
          <Menu label="Solutions" items={solutions} />
          <Link href={ROUTES.docs.href} className="rounded px-2 py-2 text-sm hover:text-signal">
            {ROUTES.docs.label}
          </Link>
          <Link href={ROUTES.about.href} className="rounded px-2 py-2 text-sm hover:text-signal">
            {ROUTES.about.label}
          </Link>
        </div>

        <div className="ml-auto hidden items-center gap-2 lg:flex">
          <Link href={CTA.talkToUs.href} className="rounded px-3 py-2 text-sm text-muted hover:text-text">
            {CTA.talkToUs.label}
          </Link>
          <Link
            href={CTA.build.href}
            className="rounded bg-signal px-4 py-2 text-sm font-semibold text-ink hover:brightness-110"
          >
            {CTA.build.label}
          </Link>
        </div>

        <button
          type="button"
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav"
          onClick={() => setMobileOpen((v) => !v)}
          className="ml-auto rounded border border-grid-line px-3 py-2 text-sm lg:hidden"
        >
          {mobileOpen ? 'Close' : 'Menu'}
        </button>
      </nav>

      <div
        id="mobile-nav"
        hidden={!mobileOpen}
        className="border-t border-grid-line bg-ink-2 px-4 py-4 lg:hidden"
      >
        {[
          { heading: 'Explore', items: explore },
          { heading: 'Platform', items: platform },
          { heading: 'Solutions', items: solutions },
          { heading: 'Docs', items: linkable(['docs', ...DOC_ROUTES]) },
          { heading: 'Company', items: linkable(['about', 'contact']) },
        ].map((group) => (
          <div key={group.heading} className="mb-4">
            <h2 className="mb-1 font-mono text-xs uppercase tracking-widest text-muted">{group.heading}</h2>
            <ul>
              {group.items.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="block py-2 text-sm">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <Link
          href={CTA.build.href}
          className="block rounded bg-signal px-4 py-2 text-center text-sm font-semibold text-ink"
        >
          {CTA.build.label}
        </Link>
      </div>
    </header>
  );
}
