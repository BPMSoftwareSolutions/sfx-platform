/**
 * Route and availability registry — §4 phase rule, §3.3 CTA map.
 *
 * One registry drives navigation, footer, cross-links, the sitemap and every CTA. A route that
 * is not `available` is never linked: P2/P3 work may be described as plain text but cannot
 * appear as a dead link or an active action.
 */

export type Phase = 'P1' | 'P2' | 'P3';

export interface RouteEntry {
  href: string;
  label: string;
  phase: Phase;
  /** Whether the destination exists in this build. Only available routes may be linked. */
  available: boolean;
  /** Excluded from the public sitemap and search indexing. */
  indexable: boolean;
  description?: string;
}

export const ROUTES = {
  home: { href: '/', label: 'Home', phase: 'P1', available: true, indexable: true },

  platform: { href: '/platform', label: 'Platform', phase: 'P1', available: true, indexable: true },
  executableMeaning: {
    href: '/platform/executable-meaning',
    label: 'Executable meaning',
    phase: 'P1',
    available: true,
    indexable: true,
    description: 'Meaning you own. Meaning that executes.',
  },
  capabilityEstate: {
    href: '/platform/capability-estate',
    label: 'Capability estate',
    phase: 'P1',
    available: true,
    indexable: true,
    description: 'Every capability. One estate.',
  },
  circuits: {
    href: '/platform/circuits',
    label: 'Capability circuits',
    phase: 'P1',
    available: true,
    indexable: true,
    description: 'See what your capability will do.',
  },
  projections: {
    href: '/platform/projections',
    label: 'Projection & embodiment',
    phase: 'P1',
    available: true,
    indexable: true,
    description: 'One meaning. Choose its embodiment.',
  },
  blueprints: {
    href: '/platform/blueprints',
    label: 'Blueprints',
    phase: 'P1',
    available: true,
    indexable: true,
    description: 'Build against the blueprint.',
  },
  governance: {
    href: '/platform/governance',
    label: 'AI governance',
    phase: 'P1',
    available: true,
    indexable: true,
    description: 'AI governance, engineered in — not bolted on.',
  },
  // §4 — excluded from linked card sets until available.
  knowledge: {
    href: '/platform/knowledge',
    label: 'Governed knowledge',
    phase: 'P2',
    available: false,
    indexable: false,
    description: 'Governed knowledge across the estate.',
  },

  managedCapabilityProvider: {
    href: '/managed-capability-provider',
    label: 'Managed Capability Provider',
    phase: 'P1',
    available: true,
    indexable: true,
  },

  capabilities: { href: '/capabilities', label: 'Capabilities', phase: 'P1', available: true, indexable: true },
  mechanics: { href: '/mechanics', label: 'Mechanics', phase: 'P1', available: true, indexable: true },
  providers: { href: '/providers', label: 'Providers', phase: 'P1', available: true, indexable: true },

  build: { href: '/build', label: 'Build a capability', phase: 'P1', available: true, indexable: true },
  /**
   * §5.0 — the Capability Workbench, the product's centre of gravity. Registered and unavailable:
   * composition, contract-checked wiring and solution-level execution are unbuilt, so nothing may
   * link to it and the primary CTA falls back through this registry rather than leading somewhere
   * that cannot do what the page implies.
   */
  workbench: {
    href: '/workbench',
    label: 'Workbench',
    phase: 'P1',
    available: false,
    indexable: false,
    description: 'Compose, inspect and run capabilities on one canvas.',
  },

  workspace: { href: '/workspace', label: 'Workspace', phase: 'P1', available: false, indexable: false },
  signIn: { href: '/sign-in', label: 'Sign in', phase: 'P1', available: false, indexable: false },

  solutionsEngineers: { href: '/solutions/engineers', label: 'For engineers', phase: 'P1', available: true, indexable: true },
  solutionsDomainExperts: { href: '/solutions/domain-experts', label: 'For domain experts', phase: 'P1', available: true, indexable: true },
  solutionsEntrepreneurs: { href: '/solutions/entrepreneurs', label: 'For entrepreneurs', phase: 'P1', available: true, indexable: true },
  solutionsSmb: { href: '/solutions/smb', label: 'For SMBs', phase: 'P1', available: true, indexable: true },
  solutionsEnterprise: { href: '/solutions/enterprise', label: 'For enterprises', phase: 'P1', available: true, indexable: true },

  ecosystem: { href: '/ecosystem', label: 'Ecosystem', phase: 'P1', available: true, indexable: true },
  about: { href: '/about', label: 'About', phase: 'P1', available: true, indexable: true },
  contact: { href: '/contact', label: 'Contact', phase: 'P1', available: true, indexable: true },

  docs: { href: '/docs', label: 'Docs', phase: 'P1', available: true, indexable: true },
  quickstart: { href: '/docs/quickstart', label: 'Quickstart', phase: 'P1', available: true, indexable: true },
  ownership: { href: '/docs/ownership', label: 'Ownership', phase: 'P1', available: true, indexable: true },
  scl: { href: '/docs/scl', label: 'SCL guide', phase: 'P1', available: true, indexable: true },
  glossary: { href: '/docs/glossary', label: 'Glossary', phase: 'P1', available: true, indexable: true },

  privacy: { href: '/legal/privacy', label: 'Privacy', phase: 'P1', available: true, indexable: true },
  terms: { href: '/legal/terms', label: 'Terms', phase: 'P1', available: true, indexable: true },

  training: { href: '/training', label: 'Training', phase: 'P2', available: false, indexable: false },
  latest: { href: '/latest', label: 'Latest', phase: 'P2', available: false, indexable: false },
  pricing: { href: '/pricing', label: 'Pricing', phase: 'P3', available: false, indexable: false },
} as const satisfies Record<string, RouteEntry>;

export type RouteKey = keyof typeof ROUTES;

/** Only linkable routes reach navigation, cards and the sitemap. */
export function linkable(keys: readonly RouteKey[]): RouteEntry[] {
  return keys.map((k) => ROUTES[k]).filter((r) => r.available);
}

export function isAvailable(key: RouteKey): boolean {
  return ROUTES[key].available;
}

/** §4 — the five P1 platform pillars. Knowledge joins this set when its route ships. */
export const PLATFORM_PILLARS: readonly RouteKey[] = [
  'capabilityEstate',
  'circuits',
  'projections',
  'blueprints',
  'governance',
  'knowledge',
] as const;

export const SOLUTION_ROUTES: readonly RouteKey[] = [
  'solutionsEngineers',
  'solutionsDomainExperts',
  'solutionsEntrepreneurs',
  'solutionsSmb',
  'solutionsEnterprise',
] as const;

export const DOC_ROUTES: readonly RouteKey[] = ['quickstart', 'ownership', 'scl', 'glossary'] as const;

/** §3.3 — every CTA label and destination comes from here. */
export const CTA = {
  build: { label: 'Build a capability', href: ROUTES.build.href },
  explore: { label: 'Explore capabilities', href: ROUTES.capabilities.href },
  talkToUs: { label: 'Talk to us', href: '/contact?intent=enterprise' },
  discussMigration: { label: 'Discuss a migration', href: '/contact?intent=migration' },
  ownership: { label: 'Read the ownership guide', href: ROUTES.ownership.href },
} as const;

export const SITE = {
  name: 'SideFX',
  expansion: 'Semantic Intent-Driven Engineering Effects',
  owner: 'BPM Intelligence',
  /** §4 — canonical origin; the apex redirects here. */
  origin: process.env.NEXT_PUBLIC_SITE_ORIGIN ?? 'https://www.sidefx.io',
  tagline: 'Own your capabilities.',
  sequence: 'Speak it. See the circuit. Own the capability.',
} as const;

/** Reviewed brand copy; estate facts and featured records are derived separately. */
export const HOME_COPY = {
 eyebrow:'SideFX / Capability engineering', headline:['Own the meaning.','Build what follows.'],
 introduction:'Give intent a precise shape. Explore the capability, follow its scenarios, and see the mechanics that make the work possible.',
 footnote:'Semantic authority. Inspectable circuits. Reusable mechanics.',
 explore:'Explore the estate', start:'Start with your intent', inside:'Inside a capability',
 stories:{eyebrow:'The work, made visible',title:['A capability has','a story to tell.'],description:'Start with the human experience. Then open the circuit and inspect what each part is responsible for.',open:'Open the capability'},
 circuit:{eyebrow:'The SideFX visual language',title:['Every connection','means something.'],description:'Open the blueprint. Follow the declared routes through its responsibilities, decisions and mechanics. Inspect the exact contracts and sources behind every component.'},
 mechanics:{eyebrow:'Below the surface',title:['Precise responsibilities.','Reusable parts.'],explore:'Explore all mechanics',empty:'A mechanic carries one declared responsibility. Providers supply implementations. The capability keeps its meaning.',open:'Open the mechanic library'},
 closing:{eyebrow:'From intent to capability',title:['What should your','system be able to do?'],start:'Describe your intent',docs:'Understand the system'},
} as const;
