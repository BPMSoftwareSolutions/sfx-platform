# sfx-platform

The SideFX website — `www.sidefx.io`. Next.js App Router, TypeScript strict, Tailwind CSS v4.

Built against [`docs/website-design-spec.md`](docs/website-design-spec.md). That spec governs; this
README records how the implementation satisfies it and, just as importantly, where it does not yet.

## Running it

```bash
npm install
npm run publish:estate     # builds generated/ from the estate source
npm run dev                # http://localhost:3000
```

Other scripts:

| Script | What it does |
| --- | --- |
| `npm run publish:estate` | Reads one pinned generation of the estate and writes `generated/` |
| `npm run build` | Publishes the estate (tolerating a missing source), then builds |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Publication integrity, route/phase and circuit geometry checks |
| `npm run check` | Typecheck plus tests |

## Where the content comes from

The website never opens a database connection (§11.1). A publication service reads one pinned,
consistent generation and writes immutable JSON that the site consumes:

```
C:\lab\sidefx-database\data\website-visuals\inventory-2026-09-08.json   (selected-model read)
        │
        │  scripts/publish-estate.mjs — allow-list, join validation, circuit compilation
        ▼
generated/estate-publication.json    validated by contracts/estate.ts on every read
generated/circuit-projections.json   one boundary-lens circuit per scenario face
        │
        ▼
lib/estate.ts  →  pages
```

Override the source with `--source <file>` or `SIDEFX_ESTATE_SOURCE`. With no source and no
existing publication, the site renders its unavailable state and disables dependent actions rather
than showing an empty catalog (§11.4).

The current generation publishes **218 capabilities, 824 scenario faces, 191 mechanics, 74
providers and 314 declared provider–mechanic relationships**, plus four preserved findings — see
`/platform/capability-estate`.

### Contracts

`contracts/estate.ts` defines `EstatePublication`, `CapabilityPage`, `EntityPage`
(`MechanicPage` / `ProviderPage`), `CircuitProjection` and `EntityVisual` (§11.3). Availability
dimensions are kept separate throughout, and an absent source value is published as `null` —
meaning *unknown*, never *no*.

## Layout

```
app/           routes; (marketing) pages, catalogs, /build, sitemap.ts, robots.ts
components/    shell, ui primitives, circuit viewer, catalog, IDE composer, contact form
contracts/     publication contracts (zod)
lib/           estate reader, route registry, SEO, inquiries
generated/     the published estate — rebuildable, not hand-edited
scripts/       the publication service
tests/         publication integrity, route/phase, circuit geometry
```

`lib/routes.ts` is the single route and availability registry (§4). Navigation, footer, cards,
CTAs and the sitemap all read from it, and a route marked `available: false` is never linked. A
test enforces this.

## Implemented

- **All P1 marketing routes** with spec copy: home, `/platform` + five pillars,
  `/platform/executable-meaning`, `/managed-capability-provider` (with `/mcp` → 308),
  five `/solutions/*`, `/ecosystem`, `/about`, `/contact`, four `/docs/*`, two `/legal/*`.
- **Estate catalogs and detail pages** for capabilities, mechanics and providers — 515 pages
  prerendered from the publication, with search, filtering, and explicit empty, filtered-empty,
  stale and unavailable states.
- **Circuit viewer** (§12): deterministic geometry, typed route families, keyboard-selectable
  nodes, text outline, node inspector, legend, opt-in illustrative flow that respects
  `prefers-reduced-motion` and stops on tab hide or node inspection. The SVG *and* the outline are
  server-rendered, so the circuit is readable without JavaScript.
- **Boundary-view fidelity**: the current generation's blueprints carry nodes and no normalized
  edges, so circuits render the source-backed Input → Event → Responsibility → Outcome boundary
  with unresolved members shown as unresolved. Nothing is inferred to fill a gap.
- **Contact** with a server action: validation, rate limiting, honeypot, idempotency key, an
  inquiry reference, and preserved values plus a focused error summary on failure.
- **Intent composer** at `/build`: typed and spoken input with equal functionality, retained
  intent, and full handling of denied or unsupported microphone access.
- **Accessibility**: skip link, semantic menus with expanded state and Escape/focus return,
  visible focus, labelled regions, status carried by words as well as color. Every palette pair
  in §6.2 passes WCAG AA contrast.
- **SEO**: per-page unique titles/descriptions/canonicals, `Organization`/`WebSite` and
  `DefinedTerm` structured data, `FAQPage` emitted only where visible Q&A renders, and a sitemap
  built from the route registry plus the publication manifest.

## Not implemented — open dependencies

These are §10 release dependencies, not omissions of taste. Each is stated on the page that would
otherwise imply it works:

| Gap | Effect on the site |
| --- | --- |
| Gemini Pro authoring conveyor; auth and durable jobs | `/build` accepts and retains an intent but designs no circuit, and says so. No canned draft is shown. |
| Capability export adapter; verified SDA release; own-architecture example | No download is offered anywhere. `/docs/ownership` documents the contract instead. |
| Nano Banana production and the SQL media service (§11.5) | Every capability, mechanic and provider carries an open visual requirement; no placeholder stands in for a missing image. |
| Target requirement/readiness records | No capability claims a target. Absence is shown as undeclared, not as "unsupported". |
| Authenticated workspace | `/workspace/*` and `/sign-in` are registered as unavailable and are unlinked and noindex. |
| Legal entity identity and approved copy | `/legal/*` describe implemented behavior and state plainly that they are not yet in force. |
| Mail recipient and provider | An accepted inquiry is recorded with a reference; it never claims delivery. Set `SIDEFX_INQUIRY_RECIPIENT` and `SIDEFX_MAIL_API_KEY`. |
| Analytics configuration | No provider is loaded. |
| P2/P3 routes (`/training`, `/latest`, `/platform/knowledge`, `/pricing`) | Described as planned text where relevant; never linked. |

Per §9: while an integration gate is open, P1 is reported as incomplete rather than the CTA being
quietly replaced or a draft presented as live authoring.

## Environment

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SITE_ORIGIN` | Canonical origin (default `https://www.sidefx.io`) |
| `SIDEFX_ESTATE_SOURCE` | Path to the estate inventory read by the publication service |
| `SIDEFX_MAX_PUBLICATION_AGE_DAYS` | Age after which the site shows its stale-publication notice (default 30) |
| `SIDEFX_INQUIRY_RECIPIENT`, `SIDEFX_MAIL_API_KEY` | Contact delivery; without both, delivery reports as unconfigured |
