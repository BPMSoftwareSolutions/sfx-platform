# sfx-platform

The SideFX website — `www.sidefx.io`. Next.js App Router, TypeScript strict, Tailwind CSS v4.

Built against [`docs/website-design-spec.md`](docs/website-design-spec.md). That spec governs; this
README records how the implementation satisfies it and, just as importantly, where it does not yet.
[`docs/architecture.md`](docs/architecture.md) codifies the architecture doctrine — pillars,
boundaries, pipelines, contracts and honesty invariants — that the codebase is judged against.
[`docs/visual-integration-audit.md`](docs/visual-integration-audit.md) is the ledger of open gates.

## Running it

```bash
npm ci
npm run validate:estate    # validate the committed, selected publication
npm run dev                # http://localhost:3000
```

Other scripts:

| Script | What it does |
| --- | --- |
| `npm run publish:estate` | Reads one pinned generation of the estate and writes `generated/` |
| `npm run select:estate` | Validates and pins both generated artifacts in a digest manifest after a deliberate publication refresh |
| `npm run validate:estate` | Checks the selected bytes, schema, identities, coverage and circuit integrity |
| `npm run build` | Requires the selected valid publication, then builds standalone output; never reads the development database |
| `npm run build:preview` | Development preview allowing missing source data; never used by the release workflow |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Publication integrity, route/phase and circuit geometry checks |
| `npm run check` | ESLint, typecheck and tests |
| `npm run smoke -- <origin> --noindex` | Checks a running staging image through HTTP, including static assets, probes and circuit pages |

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

After refreshing source content, run `npm run publish:estate`, then `npm run select:estate`,
review the publication diff, and commit all three `generated/*.json` artifacts together. Selection
records exact bytes; it is not evidence of editorial approval or upstream database verification.
Production builds fail on absent, altered, mixed, empty or incomplete artifacts.

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

Python services live beside the web process, never inside it — estate analytics, semantic
retrieval, media QA and authoring workers, codified in `docs/architecture.md` §7. The content
lab's Python stack (polars, networkx, numpy, pydantic, Pillow, faster-whisper, mcp) is the
proving ground for those services.

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
- **Contact** with a server action: validation, rate limiting, honeypot, and preserved values plus
  a focused error summary. Hosted submissions report unavailable until durable delivery exists;
  development-only receipts support an idempotency key and temporary reference.
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
| Durable inquiry store and mail worker | Hosted builds reject submissions with values preserved. Development receipt is process-local only. Environment variables alone do not enable delivery. |
| Analytics configuration | No provider is loaded. |
| P2/P3 routes (`/training`, `/latest`, `/platform/knowledge`, `/pricing`) | Described as planned text where relevant; never linked. |

Per §9: while an integration gate is open, P1 is reported as incomplete rather than the CTA being
quietly replaced or a draft presented as live authoring.

## Environment

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SITE_ORIGIN` | Build-time canonical origin (default `https://www.sidefx.io`); shared across staging and production |
| `SIDEFX_INDEXING` | Runtime slot setting; `disabled` applies noindex headers to every response and disallows all robots |
| `SIDEFX_ESTATE_SOURCE` | Path to the estate inventory read by the publication service |
| `SIDEFX_MAX_PUBLICATION_AGE_DAYS` | Age after which the site shows its stale-publication notice (default 30) |
| `SIDEFX_INQUIRY_RECIPIENT`, `SIDEFX_MAIL_API_KEY` | Reserved for the future delivery adapter; not sufficient to enable contact submission |

## Azure container delivery

The current target is the existing Azure App Service `sidefx` in East US 2, classic Docker mode,
on `ASP-sidefxgroup-ad2e`. A dedicated `sidefx/sfx-platform` image repository uses the existing
`bpmaiengineacr` registry. Configuration is in [`infra/azure.json`](infra/azure.json).

See [`docs/azure-deployment.md`](docs/azure-deployment.md) for local image verification, the
GitHub OIDC staging workflow, runtime settings, receipts and promotion/rollback prerequisites.
P1 remains incomplete; staging infrastructure does not satisfy the outstanding product gates.
