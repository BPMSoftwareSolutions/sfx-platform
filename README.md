# sfx-platform

The SideFX website — `www.sidefx.io`. Next.js App Router, TypeScript strict, Tailwind CSS v4.

Built against [`docs/website-design-spec.md`](docs/website-design-spec.md). That spec governs; this
README records how the implementation satisfies it and, just as importantly, where it does not yet.
[`docs/architecture.md`](docs/architecture.md) codifies the architecture doctrine — pillars,
boundaries, pipelines, contracts and honesty invariants — that the codebase is judged against.
[`docs/visual-integration-audit.md`](docs/visual-integration-audit.md) is the ledger of open gates.
[`docs/capability-execution.md`](docs/capability-execution.md) documents capability execution — the
surface that runs a capability from the database, and the platform's centre of gravity.

## Running it

```bash
npm ci
npm run restore:media      # fetch public/media from SQL (see below)
npm run validate:estate    # validate the committed, selected publication
npm run dev                # http://localhost:3000
```

### `public/media` is not in the repository

The media publication — capability artwork, materials, editions and the 168 MB of compiled
topology diagrams — is generated content that SQL retains in full and can rebuild byte for byte.
It is therefore not committed. `npm run restore:media` writes it into `public/media` from the
selected publication, and `npm run validate:media` checks every file against its SQL hash.

It needs a database connection string in the environment (`SIDEFX_CONNECTION_STRING`, or
`sidefx-connection-string`) and a checkout of
[`sidefx-database`](https://github.com/BPMSoftwareSolutions/sidefx-database), which owns the media
schema and the only SQL client. Point `SIDEFX_DATABASE_ROOT` at it if it is not a sibling
directory. CI restores the same way before building the image.

**If you already had this repository checked out**, pulling the commit that untracked these files
will delete them from your working copy. Run `npm run restore:media` and the build works again.

Other scripts:

| Script | What it does |
| --- | --- |
| `npm run publish:estate` | Reads one pinned generation of the estate and writes `generated/` |
| `npm run publish:contracts` | Publishes each capability's declared input contract schema for the input form |
| `npm run restore:media` | Restores `public/media` from the selected SQL publication |
| `npm run validate:media` | Verifies every restored media file against its SQL publication hash |
| `npm run select:estate` | Validates estate/circuits and input contracts, then pins all four generated artifacts in a digest manifest |
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

After refreshing source content, run `npm run publish:estate`, `npm run publish:contracts`, then
`npm run select:estate`. Review and commit the estate, circuit, visual and input-contract artifacts
with their manifest in `generated/`. Selection
records exact bytes; it is not evidence of editorial approval or upstream database verification.
Production builds fail on absent, altered, mixed, empty or incomplete artifacts.

The current generation publishes **218 capabilities, 824 scenario faces, 191 mechanics, 74
providers and 314 declared provider–mechanic relationships**, plus four preserved findings — see
`/platform/capability-estate`.

## Executing a capability

Every published capability page offers **Run this capability**. The command goes to a capability
API running beside the web process, which reads the capability's prepared authority from SQL,
rebuilds its body in memory and executes it there. Typical round trip is about three seconds.

```
browser  ->  server action  ->  services/capability-api  ->  sfx SDK  ->  SQL preparation
                                (holds the connection)                    -> body in memory
                                                                          -> Scenario Kernel
```

The website itself still opens no database connection, spawns no runtime and holds no
credential (§11.1). The API service is the boundary that does, exactly as the Python services
sit beside the web process in §7 and §8.7.

The service exposes **one** route, `POST /commands`, taking the same closed envelope the CLI
uses — `{ object, operation, subject, namespace?, input }`. That is `sidefx-cli`'s Entity Neutrality Law
observed literally: no capability, verb or vendor appears in a path or a branch, so adding a
capability to the estate adds nothing to this repository.
The committed web policy permits only `capability invoke`; preparation and other project
commands are blocked before dispatch. The service defaults to loopback.

```bash
cd services/capability-api && npm install
SIDEFX_PROJECT_DIR=../../../sfx-embody npm start        # needs the database connection string
SIDEFX_INVOCATION_ENDPOINT=http://127.0.0.1:8787 npm run dev
```

### Composing the input

The input is composed one of two ways, switched like the body modes of a request tool:

- **form** — fields generated from the capability's own declared input contract. A value the
  contract fixes (`const`) is shown as fixed rather than editable, enums become selects, arrays
  get item builders, and nested objects nest. A shape the form cannot render faithfully is
  edited as JSON rather than approximated by a control that would misrepresent it.
- **raw** — the JSON document directly.

Both are views of the same document, so switching carries the value across. Across the 215
published schemas, 1,142 of 1,152 declared properties render as controls and 10 fall back to raw.

The schemas come from `npm run publish:contracts`, which reads each capability's root-scenario
input contract and the retained JSON Schema it references from one pinned generation into
`generated/input-contracts.json` — 216 of 218 capabilities declare one. A capability with no
declared contract gets raw input and no claimed shape.
Run `npm run select:estate` after publication. Manifest v2 includes the input contracts;
builds and page reads verify their hashes, schema references and selected estate generation.

Where the estate workspace publishes example requests, `SIDEFX_CAPABILITY_EXAMPLES` seeds the
form with one. Examples are matched by the `contractId` the example itself declares against the
contract the capability declares — never by filename, which is not evidence of applicability.
Examples are read while pages are prerendered, so the variable belongs to the build, unlike
`SIDEFX_INVOCATION_ENDPOINT`, which is read per request.

The form checks JSON syntax and preserves invalid drafts with an error, blocking Run and mode
switching until corrected. Semantic admission belongs to the capability's contract.

### What a run reports

The page renders what the estate returned and nothing else:

| State | Meaning |
| --- | --- |
| `terminated` | The capability executed and produced its outcome |
| `rejected` | The capability's own contract refused the input, or its outcome; a real execution with its own kernel testimony |
| `failed` | The event executed and threw |
| `CAPABILITY_PREPARATION_REQUIRED` | No preparation is retained for the current estate generation, so it cannot execute yet |
| `CAPABILITY_PREPARATION_STALE` | A preparation exists but was made against a different generation or toolchain |
| `CAPABILITY_NOT_FOUND` | The estate resolved no declared root for that capability |
| `NOT_CONFIGURED` / `RATE_LIMITED` / `INVALID_JSON` | The site did not dispatch a request |
| `UNKNOWN` | Execution could not be confirmed after a timeout, lost/unreadable response or unclassified error. Confirm whether it completed before retrying |

A refusal is never filled in with another capability's result, and a rejected input is reported
as rejected rather than corrected. Execution is an explicit user action: opening a capability,
inspecting its circuit or playing its flow invokes nothing (§13.1).
Failed executions retain their full kernel record even when returned inside an SDK error.
The client defaults to a 630-second response deadline, beyond the API's 600-second command
deadline; losing the response does not establish cancellation.

### Preparation is what gates coverage

A capability is executable once the estate has resolved its bindings and proved its retained
fixtures into `runtime.capability_preparation`. Of the current generation's 219 capabilities,
**94 are prepared and 125 are held**, each with a declared reason. The site cannot prepare a
capability — only invoke one that is prepared — and reports the estate's own refusal when it is
not.

A completed execution is not managed admission and not a conformance result; both remain
separately unevaluated (§1.7).

Coverage, the refusal vocabulary, the schema-driven form, operations and the open gaps —
including that the command API is unauthenticated and not yet deployed — are documented in
[`docs/capability-execution.md`](docs/capability-execution.md).
[`docs/capability-readiness.md`](docs/capability-readiness.md) records why the held capabilities are
held, where each fix belongs, and how to rank the work from the database.

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
- **Capability execution** (§13.1): every capability page can run its capability through the
  estate command surface, reporting the kernel's own disposition or the estate's own refusal.
  See [Executing a capability](#executing-a-capability).
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
| Preparation coverage across the estate | 94 of 219 capabilities are prepared; the rest report their declared reason when run and are never presented as executable. |
| Capability command API authorization and deployment | The API is unauthenticated and runs only locally; no hosted environment configures it, so hosted builds report execution unavailable. |
| Conformance and managed admission for executed capabilities | Results are reported as execution only; both remain separately unevaluated. |
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
| `SIDEFX_INVOCATION_ENDPOINT` | Capability command service; without it the site reports execution unavailable |
| `SIDEFX_INVOCATION_TIMEOUT_MS` | Bound on one invocation (default 30000) |
| `SIDEFX_CAPABILITY_EXAMPLES` | Build-time directory of example requests, matched to capabilities by their declared `contractId` |
| `SIDEFX_INQUIRY_RECIPIENT`, `SIDEFX_MAIL_API_KEY` | Reserved for the future delivery adapter; not sufficient to enable contact submission |

## Azure container delivery

The current target is the existing Azure App Service `sidefx` in East US 2, classic Docker mode,
on `ASP-sidefxgroup-ad2e`. A dedicated `sidefx/sfx-platform` image repository uses the existing
`bpmaiengineacr` registry. Configuration is in [`infra/azure.json`](infra/azure.json).

See [`docs/azure-deployment.md`](docs/azure-deployment.md) for local image verification, the
GitHub OIDC staging workflow, runtime settings, receipts and promotion/rollback prerequisites.
P1 remains incomplete; staging infrastructure does not satisfy the outstanding product gates.
