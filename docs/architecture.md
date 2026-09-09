# SideFX Platform Architecture

**Status:** Codified 2026-09-08 from `docs/website-design-spec.md` (Draft v6) and the observed implementation. The spec governs behavior; this document is the architecture doctrine the codebase is judged against. Where the implementation still trails the architecture, that gap is recorded here and in [`visual-integration-audit.md`](visual-integration-audit.md) — the architecture is the target, not a claim that everything below is already live.

---

## 1. The thesis

**One semantic source. Many embodiments. Evidence for every claim.**

SideFX's architecture is built on a single structural decision: *meaning lives in canonical, inspectable semantic authority — not in generated code, not in a provider's platform, not in a rendered page.* Every other artifact — SQL code, a Node adapter, a Python worker, a C# service, a web page, a container image — is an **embodiment**: a projection of that authority into a runnable form, carrying its own verification evidence.

The board thesis that frames the whole platform:

> **A neural network is a learned computational circuit. SideFX is a governed semantic circuit.**

They are not the same architecture — but the comparison defines both.

### 1.1 The neural mirror

Geometrically, both architectures compose small transformation cells whose outputs become inputs to other cells:

```text
Neural neuron          SideFX scenario            one level lower           at the physical edge
inputs                 Input                      Input                     Physical Input
  ↓                      ↓                          ↓                          ↓
weighted aggregation   Event / Responsibility     Mechanic                  Provider Operation
  ↓                      ↓                          ↓                          ↓
activation             Outcome                    Result                    Physical Result
```

The difference is where meaning lives:

```text
NEURAL NETWORK                    SIDEFX CIRCUIT
meaning                          meaning
  ↓                                ↓
distributed into learned weights  explicit semantic authority
  ↓                                ↓
latent, hard to inspect           mechanics/providers underneath,
                                  declared identity at every major cell
```

Neuron 8,492 is not "resolve mortgage eligibility"; it is `Σxᵢwᵢ → activation`. A SideFX scenario *is* `resolve-mortgage-eligibility` with an admitted input, a declared responsibility and a defined outcome. SideFX is therefore close to an **explicit semantic neural architecture** — a computational network organized around human-governable meaning instead of learned latent representation.

### 1.2 Where they meet: inference inside a capability cell

The provider slot is where neural inference enters the circuit:

```text
SIDEFX CIRCUIT → responsibility → "classify image" → PROVIDER SLOT
             → NEURAL NETWORK → testimony → deterministic admission → outcome
```

Inside the slot, the network has maximum freedom to infer. It does not get to define:

- why the inference exists, or what responsibility it serves;
- what input is admissible;
- what output contract matters;
- what confidence and evidence are required;
- whether its answer becomes enterprise truth;
- what happens when it is uncertain;
- what promised experience must ultimately close.

That is the agentic principle, stated as an architecture law:

> **Maximum freedom to discover; minimum freedom to redefine meaning.**

The neural network is a **probabilistic mechanic/provider inside a deterministic semantic circuit** — the same place any other provider sits, with the same contracts, the same evidence obligations, and the same refusal to let implementation define meaning (spec §13.2).

### 1.3 Two intelligences, one estate

Neural networks gain power through composition: one neuron is not intelligent; capability emerges from huge connected topology. SideFX composes the same way — capability products chain into experiences, and thousands of circuits form a semantic backplane for larger assemblies and enterprise behavior. Hence two kinds of intelligence:

| Intelligence | Emergent capability from | Inspectable as |
| --- | --- | --- |
| **Neural** | learned weighted connectivity | weights, activations — latent |
| **Semantic** | governed meaningful connectivity | declared circuits, authority, evidence |

And the platform is their composition:

```text
SIDEFX = semantic intelligence
       + neural intelligence
       + deterministic mechanics
       + physical providers
```

In this architecture a neural network is no longer the architecture. **It is intelligence available to the architecture** — admitted through a provider slot, governed by the semantic cell around it, running where every other embodiment runs (§7). The question the architecture exists to answer is not how backpropagation works, but what a network *becomes* inside a governed capability circuit — and what the semantic circuit learns from neural architecture in return.

Everything the platform is derives from this:

| Property | Consequence |
| --- | --- |
| Capability sovereignty | Authority is downloadable; a customer can operate it with open-source SDA or their own architecture (§1.6) |
| Provider switching | A replacement provider that satisfies the declared contracts and verification obligations preserves meaning (§1.6) |
| Honest inspection | The circuit is a deterministic projection of source facts; unresolved topology renders as unresolved, never invented (§12.2) |
| Neural inference | A network inside a provider slot infers freely; the semantic cell governs admissibility, contract, evidence and admission to truth (§1.2) |
| Governable estate | One publication generation binds every page, circuit, count, download and asset to a single verified snapshot (§11.4) |
| Rebuildable everything | `generated/` is rebuilt from pinned source; the database reconstructs published media; a container is a versioned embodiment, not the authority (§8.4) |

This is the architectural expression of the product story: **Speak it. See the circuit. Own the capability.**

## 2. Architectural principles

1. **Deterministic first.** Canonical topology, labels, status and evidence come from the SCL grammar and the typed graph. Generative pixels (Nano Banana) supply *material* only; they never supply meaning. When a deterministic surface is possible, it is the surface of record (§12.1).
2. **Unknown stays unknown.** Absence of a source value is published as `null` — *not declared*, never *no*. Absence of an edge, a target, a qualification or an image is shown as absence. No adapter may convert absence into a negative claim (§11.3).
3. **One coherent generation.** A publication is a single pinned, validated snapshot. Pages never assemble from mixed reads, and a truncated result is never a complete estate (§11.4).
4. **Boundary before beauty.** If topology cannot be qualified, render the source-backed I/E/O boundary with unresolved slots and a `Boundary view` explanation. A fabricated full graph is the cardinal sin (§12.2).
5. **Build once, promote the same artifact.** One tested container image travels staging → production by digest. Nothing is rebuilt during promotion; nothing unpinned is a release identity (§8.6).
6. **Jobs are not evidence.** Job states (`queued … ready`), SCL evidence values, and capability lifecycle states are distinct namespaces. A completed animation is not a completed execution; `CAN_ATTEMPT_EMBODIMENT` is not an executable artifact (§13.3, §12.3).
7. **Claims bind evidence.** Every factual product claim carries a record: scope, generation, revision, evidence references, limitations, verification date (§1.7). Editorial copy may say only what the evidence establishes.
8. **Availability is a registry, not a habit.** One route registry drives navigation, footers, cards, CTAs and the sitemap. An unavailable route cannot be linked — dead links and silent CTA substitutions are structurally impossible (§4, `lib/routes.ts`).
9. **The web process is disposable.** Durable state (media bytes, drafts, jobs, inquiries, artifacts) lives in external services. A restart loses nothing; local files and caches are never authoritative (§8.7).
10. **Content is generated, not hard-coded.** The platform's data is the content system: pages, cards, counts, circuits, metadata, relationships, selections and images are derived from the publication by declared rules. Editorial copy is reviewed narrative that *selects estate records by identity* — it never restates facts the publication already carries, and it never overrides them (§6, §8.1, §11.3).
11. **Python is the analytical embodiment.** Data science and data analysis leverage — the Python ecosystem — is a first-class platform asset, not an afterthought. Python services consume the pinned generation and publish digest-pinned analysis projections through the same contracts, jobs and honesty discipline as everything else (§7).
12. **Execution is an explicit act, and never a claim.** A capability runs only because a person asked it to; rendering a page, opening a circuit or playing its flow invokes nothing. What comes back is the capability's own disposition — including its refusal of the input — reported as it happened. A completed execution is not managed admission and not conformance evidence; those remain separately unevaluated (§1.7, §5.5).
13. **Maximum freedom to discover; minimum freedom to redefine meaning.** Neural networks enter through provider slots as probabilistic mechanics/providers inside the deterministic semantic circuit. They get freedom to infer, and no power to change why the inference exists, what input is admissible, what evidence is required, or what experience must close (§1.2, spec §13.2).

## 3. System boundaries

The architecture is a stack of strict separations. Each row is a boundary that nothing may smuggle across.

| Boundary | Left side | Right side | Crossed only by |
| --- | --- | --- | --- |
| **Publication boundary** | SQL Server estate (private, mutable) | Immutable public JSON in `generated/` | The publication service, through an explicit allow-list (§11.1) |
| **Semantic boundary** | Semantic authority (source of meaning) | Visuals (pixels, materials, motion) | Reviewed bindings; pixels never write meaning (§12.1) |
| **Contract boundary** | Database columns, conveyor output | Website projection fields | Typed contracts in `contracts/`; validation on every read (§11.3) |
| **Visibility boundary** | Public pages | Private drafts, authority, artifact access | Independent per-resource authorization, never page visibility alone (§11.4) |
| **Determinism boundary** | Compiled SVG / typed graph | Generated art, illustrative flow | The renderer and player; art is labeled illustration (§12.3–12.4) |
| **Inference boundary** | Neural inference (learned weights, latent meaning) | Semantic authority (declared meaning, evidence rules) | The provider contract: admissible inputs, output contract, confidence/evidence obligations. The network infers; it never defines (§1.2) |
| **Execution boundary** | Web process (no connection, no runtime) | Estate runtime (SQL authority, in-memory bodies, Scenario Kernel) | The capability command API beside the web process, over one entity-neutral envelope (§5.5, §11.1) |
| **State boundary** | Web container (stateless, disposable) | Durable services (DB, jobs, media, mail) | Service adapters with their own lifecycles (§8.7) |
| **Configuration boundary** | Build-time constants | Environment-specific secrets/endpoints | Server-side runtime config; `NEXT_PUBLIC_*` is build-embedded only (§8.7) |

## 4. Layers

```
┌─ Source layer ──────────────────────────────────────────────────────────┐
│  C:\lab\sidefx-database (selected model, restricted reader)             │
│  C:\lab\repos\content-creation-mission (SCL grammar, materials, player) │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │ pinned read + allow-list + validation
┌─ Publication layer ──────────▼──────────────────────────────────────────┐
│  scripts/publish-estate.mjs → generated/estate-publication.json         │
│                             → generated/circuit-projections.json        │
│  scripts/publish-input-contracts.mjs → generated/input-contracts.json   │
│  scripts/select-publication.ts → publication-manifest.json (digest pin) │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │ validated on every read
┌─ Contract layer ─────────────▼──────────────────────────────────────────┐
│  contracts/estate.ts — EstatePublication · CapabilityPage · EntityPage  │
│  · CircuitProjection · EntityVisual · SourceState (zod, strict)         │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │ lib/estate.ts · lib/routes.ts · lib/seo.ts
┌─ Application layer ──────────▼──────────────────────────────────────────┐
│  app/ — (marketing) pages, catalogs, /build, sitemap, robots            │
│  components/ — shell, circuit viewer + deterministic geometry, IDE      │
│  server actions — contact (validate → enqueue → receipt), future jobs   │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │ standalone output · pinned base image
┌─ Delivery layer ─────────────▼──────────────────────────────────────────┐
│  Container image (digest-pinned) → ACR → staging slot → production      │
│  /healthz · /readyz · SIDEFX_INDEXING · same-image promotion            │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.1 Reading rules

- The website **never opens a database connection** (§11.1). It reads `generated/`, validated against `contracts/estate.ts` and the manifest digests on every load (`lib/publication-validation.ts`).
- Manifest v2 pins estate, circuits, visuals and input contracts. Input contract v2 verifies canonical schema digests and preserves original source digests separately; snapshot/projection and capability/scenario ownership must match the selected estate before a form is rendered.
- Pages load data at **capability/scenario scope**. The whole-estate graph never reaches a page bundle (§12.4).
- Source states are preserved exactly and paired with a readable explanation. The readable form never replaces the source value (§11.3).
- Python services live **beside** the web process, not inside it — external workers with their own runtimes, job lifecycles and durability (§7, §8.7). The web process never embeds an interpreter and never acts as their scheduler.

## 5. The five pipelines

### 5.1 Estate publication (read path)

```
pinned inventory read → allow-list → join/count validation
→ circuit compilation (boundary lens) → atomic write + digest pin
→ schema validation on every read → pages
```

- Allow-list is explicit: fields not named in `publish-estate.mjs` are dropped, including future upstream additions (§11.4 step 2).
- Declared row counts must match actual rows; truncation or a non-complete disposition aborts (§11.4 step 3).
- Selection is atomic (write-then-rename), and the previous valid publication is retained on failure — never replaced by an empty catalog (§11.4 step 5–6).
- Counts carry their generation identity. A count difference between sources is published as a *finding*, never silently reconciled (§11.2).

### 5.2 Visual production (generative path)

```
semantic subject + reviewed direction → bounded Nano Banana jobs
→ original bytes + provenance committed to SQL media schema
→ review/selection (append-only) → derivatives (card/detail/sharing)
→ EntityVisual publication → hash-addressed CDN copies
```

- Original bytes and derivatives are **content-addressed in the database** with media type, dimensions, SHA-256 and provenance. A provider URL or local file without committed bytes is an incomplete job (§11.5).
- Bindings use real `semantic_object`/`semantic_object_definition` foreign keys — never an unchecked entity-type/text-ID pair (§11.5).
- Every capability, scenario, mechanic and provider carries a **visual requirement record even before an image exists**; the requirement registry is the coverage denominator (§12.7).
- Complete infographic/playback bundles (SCL, graph JSON, base/enhanced SVG, layout anchors, animation plan, material revisions, player assets) are stored the same way, so the database reconstructs published products after local loss (§11.5).
- Generation must never delay circuit inspection: deterministic circuit renders immediately; art shows `Artwork preparing` (§12.5).

### 5.3 Intent-driven authoring (write path)

```
spoken/typed intent → resolve precedents + clarifying questions
→ Gemini Pro conveyor (durable job) → validated candidate SCL/graph
→ deterministic circuit in /workspace → refine (revisioned)
→ verify/realize (explicit provider invocation) → export authority/embodiments
```

- Jobs are durable and owner-bound with request digest, base revision and idempotency. A **late result cannot overwrite newer work**; results bind to their base revision (§13.2–13.3).
- Model output is validated before it is stored or rendered; imported text is data, not instruction (§13.2).
- Authoring, transcription, image, validation and export are **separate jobs** with separate quota/timeout/retry policies. One failure never cascades (§13.3).
- External provider invocation is an explicit user action; designing or playing a circuit invokes nothing (§13.1).
- Exports resolve a pinned manifest with immutable hashes. A missing/unauthorized/stale artifact fails with a recovery action — never a fallback to a different revision (§11.4).

### 5.4 Release (delivery path)

```
commit + lockfile + approved publication → checks + Linux build
→ test final image → push to ACR, record digest → staging slot
→ smoke through Azure ingress → promote same image → www.sidefx.io
```

- One image, promoted by digest. Prior image retained for rollback; an application rollback never auto-reverses database writes (§8.6).
- The image embeds its source commit; `/readyz` exposes the release identity so a starter page or stale healthy release cannot satisfy a new deployment check (§8.5–8.7).
- Staging is noindex at the proxy, but that is not access control — private content requires real authorization before it exists (§8.7).

### 5.5 Capability execution (invocation path)

```
explicit user action -> command envelope { object, operation, subject, input }
-> capability API beside the web process -> sfx SDK -> estate process delivery
-> one restricted read of the retained preparation -> body rebuilt in memory and checked
   against its stored proof -> Scenario Kernel -> disposition, outcome and testimony
```

- The web process holds no connection string, spawns no runtime and embeds no interpreter. The API service is the only thing that crosses the execution boundary (§3, §11.1).
- The surface is **entity-neutral**: one route, with object/operation/subject as data. Adding a capability to the estate adds no route, component or mapping to this repository.
- **Preparation gates execution.** A capability is invocable once the estate has resolved its bindings and proved its retained fixtures into `runtime.capability_preparation`. The site cannot prepare; it can only invoke what is prepared, and reports `CAPABILITY_PREPARATION_REQUIRED` or `_STALE` as the estate's own answer.
- Input is composed from the capability's declared contract — a generated form or raw JSON over one document. The form renders the contract and validates nothing: admission belongs to the capability, and its refusal is a real result (§13.1).
- A generation change invalidates preparations conservatively. A stale preparation is never executed for a newer generation.

Coverage, contracts, refusal vocabulary and open gaps are recorded in
[capability-execution.md](capability-execution.md).

## 6. Content generation architecture

The platform is the content system. The estate data is sufficient to generate the site's substance — its identities, circuits, counts, relationships, statuses, metadata and images — so nothing that is a *fact about the estate* is hard-coded into a page. Hard-coded content is limited to the two things data cannot supply: **brand/positioning copy** and **reviewed editorial narrative**, both centralized, never scattered through components.

### 6.1 Derivation rules

Every content-bearing surface declares where its content comes from. A new surface must define a derivation rule; a copy block is not a derivation rule.

| Surface | Derived from | Rule |
| --- | --- | --- |
| Catalog cards, search text, filters | `CapabilityPage` / `MechanicPage` / `ProviderPage` | Published fields only; a filter never invents a status the source didn't declare |
| Entity detail pages | Full record + scenario faces + circuits | Identity, states, diagnostics preserved verbatim |
| Circuits | `CircuitProjection`, compiled from scenario faces | Boundary lens when topology isn't qualified |
| Counts and inventory | `EstatePublication.coverage` | Carry generation identity; never pasted into copy |
| Featured/hero selection | Source properties only (scenario count, resolved states) | Never an editorial claim about quality |
| Related capabilities | Shared input/outcome contract identities | Computed at publication, capped |
| Sitemap, entity SEO metadata | Publication manifest + route registry | Source-derived, reviewed titles/descriptions |
| Entity images, OG images | `EntityVisual` + media registry | Requirement records exist before pixels do |
| Findings and limitations | `EstatePublication.findings` | Preserved, never smoothed over |
| Solution-page examples | Capability selection by identity/audience tags | Same record reused across marketing pages |
| Status notices (stale/unavailable) | Publication age and validity | One component, one policy |

### 6.2 What may be hard-coded — and where it lives

| Content | Why it can be hard-coded | Where it must live |
| --- | --- | --- |
| Tagline, brand expansion, name rules, CTA labels, product sequence | Brand decisions, not estate facts (§2, §3.3) | `lib/routes.ts` (`SITE`, `CTA`, `ROUTES`) — single source |
| Page titles/descriptions for fixed marketing routes | Reviewed positioning copy (§5, §7) | `lib/seo.ts` + the page's metadata export |
| The two required example intents (quote retrieval, CNCF) | Spec-mandated acceptance journeys (§13.4) | The spec and the single component that renders them |
| Positioning narratives on `/platform/*`, `/solutions/*` | Editorial thesis, not estate facts | The content layer (MDX), selecting estate records by identity |
| Legal copy | Supplied and approved externally (§5.19) | `/legal/*` |
| Teaching sequence in `/docs/*` | Reviewed editorial structure | The content layer; may pin a capability revision, never override its facts |

### 6.3 Rules the editor follows

1. **No parallel catalog.** Editorial content references capabilities, mechanics and providers by stable identity (`urlKey`/`entityId`); it does not maintain its own list of what exists (§8.1).
2. **Facts come from the publication.** A narrative sentence that states a count, a status, a relationship or a capability's behavior is a bug waiting to rot — the surface must render the value, not quote it.
3. **Selection, not duplication.** Marketing pages *select* records (featured, related, audience-tagged) and render them through shared components. The same record appears on Home, a solution page and a catalog with one source of truth.
4. **Editorial cannot override source.** A reviewed title or introduction may be provided; a source status, edge, provider result or limitation may not be changed, and a revision may be pinned for a tutorial only where the content declares the pin (§11.3).
5. **Identity travels with the content.** Every rendered entity keeps its exact identity visible (mono, on demand in the inspector) — readable presentation never replaces the identifier.
6. **Absence has a generated representation.** Missing name, missing summary, missing image, unresolved slot — each has a designed, data-driven empty state. Nothing is filled by a human string where the publication could fill it.

The current implementation already derives catalogs, detail pages, counts, circuits, featured selection, related capabilities and the sitemap from the publication. The remaining hard-coded surface is the reviewed marketing copy in `app/**/page.tsx`, which follows the spec's copy sketches and is the seed of the MDX content layer — narrative is centralized per route, and every estate fact those pages need is already read from `lib/estate.ts` rather than restated.

## 7. Python and the data science layer

Python is the platform's **analytical embodiment** — the same thesis as every other embodiment: it consumes the pinned estate generation and produces digest-pinned, contract-validated projections. The web process stays TypeScript-only; Python runs as external services with their own runtimes, job lifecycles and durability (§8.7). No library is adopted casually: each has a declared strategic role, a platform surface it feeds, and a phase it serves.

### 7.1 The strategic leverage map

Each library below is already present in the content lab (`requirements.txt`) or is an adoption target with an explicit platform role. A library with no role is not adopted; a role with no library is an open investigation.

| Library | Strategic role | Platform surface | Phase |
| --- | --- | --- | --- |
| **polars / duckdb** | High-throughput analytical reads of the pinned generation; coverage, readiness and drift analysis without moving data | Estate analytics projection (`analysis` schema input → `EstateAnalytics` output) | P1 |
| **networkx** | Contract-graph analytics — centrality, communities, provider dependency graphs, cross-apply reachability; already powers the SCL compiler | Circuit system + estate analytics | P1 (existing) |
| **scikit-learn** | Capability clustering by contract signature, duplicate detection, coverage-drift anomaly detection | Publication QA + related-capability recommendations | P1 |
| **statsmodels / scipy** | Statistical receipts: conformance distributions across runs, provider-switch equivalence checks | Evidence layer — receipts are labeled derived analysis, never authority | P1–P2 |
| **pandera / great-expectations + jsonschema** | Data validation gates on every Python-produced projection | Publication QA (jsonschema already in lab) | P1 |
| **sentence-transformers / numpy** | Estate embeddings: capability promises, scenario I/E/O, mechanic responsibilities | Semantic retrieval — intent → precedent matching in the conveyor context builder | P1 |
| **faiss / sql-vector** | Nearest-neighbor precedent lookup at estate scale | Same retrieval service; vector index is a derived, rebuildable artifact | P1 |
| **ragas** | Retrieval evaluation for governed knowledge | `/platform/knowledge` quality gates (P2) | P2 |
| **nltk / spacy** | Contract/responsibility text normalization for facets and search | Catalog search quality + retrieval preprocessing | P2 |
| **faster-whisper** | Speech-to-text for **Speak your intent** — already wired in the lab | Transcription worker (§13) | P1 (existing) |
| **httpx / pydantic / mcp** | The Gemini Pro conveyor adapter; structured SCL candidate validation; MCP protocol boundary | Authoring conveyor (§13.2) | P1 (existing) |
| **Pillow / CairoSVG / svgwrite / numpy** | Media derivatives (responsive crops, sharing images), deterministic SVG rasterization, mask compositing | Media service (§5.2) | P1 (existing) |
| **imagehash** | Perceptual deduplication and review triage of generated art | Media QA — detects redundant generations before they cost money | P1 |
| **gherkin / behave** | Executable acceptance journeys for the §13.4 example paths (quote retrieval, CNCF) | Integration test contracts | P1 |
| **manim** | Illustrative flow and teaching-film rendering | YouTube/lesson assets (P2) | P2 (existing) |
| **plotly / matplotlib** | Evidence and coverage charts — labeled derived analysis | Inspector evidence views + ops consoles | P2 |
| **streamlit** | Internal operations consoles: media coverage dashboard, generation review queue, drift console | Operator tooling (not public) | P2 |
| **FastAPI / uvicorn** | The analytics/serving API surface the website consumes server-side | Analytics + retrieval service boundary | P1 |

### 7.2 Service homes

The libraries are not scattered — they organize into five services, each an independent embodiment with its own job lifecycle:

1. **Estate analytics service** — polars/duckdb + networkx + scikit-learn + statsmodels. Reads the pinned generation, publishes a versioned `EstateAnalytics` projection (coverage, contract clusters, provider dependency graphs, drift findings) through the same atomic selection as §5.1.
2. **Semantic retrieval service** — sentence-transformers + faiss + numpy. Serves intent→precedent matching for the conveyor context builder and, in P2, governed retrieval with ragas evals. The vector index is derived and rebuildable; it is never the source of truth.
3. **Media service** — Pillow + imagehash + CairoSVG + numpy. Derivatives, dedupe, review triage, deterministic rasterization; feeds the SQL media registry (§5.2, §11.5).
4. **Authoring workers** — httpx + pydantic + mcp + faster-whisper + gherkin. Transcription, conveyor adapter, structured candidate validation, acceptance journeys.
5. **Ops consoles** — streamlit + plotly + FastAPI. Operator-only dashboards; never on the public route registry.

### 7.3 Discipline rules

Python outputs obey the same architecture laws as every other artifact:

1. **Projection, not authority.** An analytical result — a cluster, a correlation, a drift flag — is a derived finding with its method, scope and generation attached. It never writes into semantic authority, never becomes a source fact, and never upgrades an evidence state.
2. **Same publication discipline.** Pinned generation in → versioned contract → digest → atomic selection → review. A Python artifact without a digest pin is not publishable (§5.1 applied to analytics).
3. **Separate jobs, separate failure.** Analytics, embedding, image and transcription jobs have their own quotas, timeouts and retries (§13.3). A Python service failure never takes the web process down — the web reads only published outputs.
4. **Receipts say what ran.** Library version, model, input hashes and output digests are recorded per run — a pandas version bump or an embedding model change is a versioned, receipted configuration change, not an invisible drift.
5. **Honest labeling.** Every statistical claim rendered to a user is labeled as derived analysis with its limitations — the §8 honesty invariants apply verbatim.

### 7.4 Current state and adoption order

- **Already in the lab:** the SCL compiler (networkx, pydantic), the infographic pipeline (Pillow, CairoSVG, numpy), whisper transcription, Gemini generation and MCP boundaries all exist as reviewed Python. The content lab is the proving ground.
- **Connected to the website:** the topology compiler uses NetworkX multigraphs, containment validation, connected components and cycle analysis, then Graphviz geometry and the lab's canonical material masks. Its source coverage receipts, complete SVGs, graph data and player are persisted in SQL and exported into the pinned website publication. This is a running media/graph projection, distinct from the broader estate analytics service.
- **Not yet wired to the platform:** the estate analytics service, semantic retrieval, imagehash review and ops consoles do not exist as platform services; the database repo carries no Python reader (the restricted reader remains the boundary).
- **Adoption order:** (1) estate analytics projection into the publication pipeline — it makes every catalog, estate page and inspector richer without touching the web contract; (2) semantic retrieval into the conveyor context builder — intent matching is the single highest-leverage data science surface for the core journey; (3) imagehash media QA into §5.2 — saves billable generation; (4) ragas evals when `/platform/knowledge` ships in P2.

## 8. Honesty invariants

These are non-negotiable, testable rules. The test suite (`tests/`) and validation layers exist to enforce them.

1. No valid publication → **unavailable state and disabled actions**, never an empty catalog (§11.4).
2. Graph cannot be qualified → **boundary view with unresolved slots**, never an invented topology (§12.2).
3. Source state absent → **"not declared"**, never "no", "unsupported", or "inactive" (§11.3).
4. Relationship absent → **zero means undeclared**, never "none exists" (§11.2, contracts).
5. Counts → always carry their generation and scope; managed vs platform identities are never merged (§11.2).
6. Drafts → a failed edit retains the prior valid circuit with a visible mismatch notice (§12.2).
7. CTA → an integration gate that is open means P1 is **reported incomplete**, never a silent contact-form swap or canned draft presented as live (§9).
8. Claims → evidence record or the claim is not published (§1.7).
9. Execution → the capability's own disposition, including a contract rejection, reported as it happened; never corrected, never replaced by another capability's result (§5.5).
10. Cannot execute → the estate's own refusal code, shown as a state; never a silently absent control and never a fabricated outcome (§5.5).
11. Simulated flow → labelled illustration, never styled, worded or timed to read as an observed execution. An observed trace is drawn only from returned kernel testimony; absent testimony is drawn as absent (spec §5.0, §12.4).
12. Authored presentation → an input form or outcome view may present a contract and never redefine it, and never renders a refusal as a success. Presentation is exported as presentation, never as semantic authority (§12.1 applied to forms).

## 9. Contracts

`contracts/invocation.ts` and `contracts/input-contract.ts` carry the execution surface: the command result the estate returns, and the declared input contract the form is generated from. `contracts/estate.ts` is the versioned data contract (§11.3). Field names are **website projection fields** — they do not assert identical database columns. The publication service is the only producer; the site only reads validated bytes.

| Contract | Carries |
| --- | --- |
| `EstatePublication` | Publication identity, source snapshot/digests, observation time, coverage, all pages, preserved findings |
| `CapabilityPage` | Namespace/ID, URL key, scenarios, blueprints, graph fidelity, target availability, download eligibility, related capabilities |
| `EntityPage` → `MechanicPage`/`ProviderPage` | Semantic identity, reviewed presentation, declared relationships, media selection |
| `CircuitProjection` | Source profile/digest, SCL + renderer versions, lens, fidelity, typed nodes/edges, diagnostics |
| `EntityVisual` | Exact semantic binding, purpose, review state, asset/digest dimensions, alt text, generator model as run |
| `CapabilityExport` (future) | Manifest, authority/embodiment artifacts, checksums, licenses, scoped evidence, unresolved requirements |

Availability dimensions are kept **separate throughout**: route published ≠ authority state ≠ evidence basis ≠ graph fidelity ≠ provider binding ≠ target readiness ≠ executable artifact ≠ image production (§11.3).

## 10. Visual system architecture

Two coordinated products per capability, one semantic source (§12):

1. **Interactive circuit** — SCL → typed graph → deterministic SVG + accessible inspector. Server-rendered SVG *and* text outline, so the circuit is readable without JavaScript.
2. **Entity image** — dedicated Nano Banana artwork per capability/scenario/mechanic/provider, bound to exact subject/definition revisions.

The primary workbench renders complete selected SQL blueprints, declared scenario operation/call flow, native execution cells/routes and mechanic expression dependencies. Python compilation produces 1,602 source diagrams: 35 blueprints, 694 operation views, 117 native views and 756 mechanic dependency views. All 35 selected blueprint definitions are represented. The 810 identity-matched scenario entry points across 217 capabilities select from these views; the source compilation also retains one capability whose frozen scenario identities cannot bind to current definitions.

Source nodes and routes retain their identities, contracts, pointers and digest provenance. Coverage and geometry checks reject omitted source components or rendered edges. Branch, fan-out, convergence, return, recurrence, cancellation and dependency relations retain their native vocabulary. Search, zoom, component inspection and silver-ball route tracing operate on this complete graph. Tracing is an illustration of declared relationships, with automatic continuation across branches and joins, one visit per cyclic route, and a visible completion count; it never invokes providers or establishes execution testimony. Reviewed authored films and circuit editions remain separate teaching surfaces. The boundary renderer remains the readable fallback and contract summary; it cannot stand in for an available complete blueprint. The full dedicated-image backfill remains open; see `visual-integration-audit.md` and `media-operations.md`.

## 11. What makes this cutting edge

The architectural bet, stated plainly:

1. **Executable meaning as the spine** — the semantic authority is the product; every embodiment (SQL, Node, Python, C#, the website, the container) is a projection with conformance evidence. This is what makes provider switching, inspection and ownership real instead of marketing.
2. **Deterministic-first rendering** — topology, labels, status and evidence are compiled from source; generative models decorate, they don't decide. This inverts the AI-slop default where pixels and tokens fill the gaps.
3. **Publication as an atomic, digest-pinned snapshot** — the entire site binds to one verified generation; staleness, truncation and count drift are surfaced, never absorbed.
4. **Database-as-media-registry** — generated bytes, provenance and semantic bindings live with the estate, so art is rebuildable, auditable and revisable — the same governance applied to code.
5. **Honesty as a testable invariant** — unknown stays unknown, boundaries stay visible, jobs stay separate from evidence. The platform earns the "governed" claim by refusing to overclaim.
6. **The data generates the product** — pages, circuits, counts, metadata, relationships, selections and images are derived from the estate by declared rules; editorial copy selects and narrates, it never restates or overrides. As the estate grows, the site grows with it — no hand-maintained catalog, no copy that rots when the data changes (§6).
7. **The data science layer is a product feature, not an internal tool** — analytics, graph science, embeddings and retrieval are strategic embodiments that make the estate inspectable, searchable and recommendable at scale, published with the same digest discipline as everything else. The platform doesn't bolt Python on; it treats the Python ecosystem as part of the capability estate's own intelligence (§7).
8. **Neural networks as intelligence, not architecture** — the governed circuit composes neural, semantic, deterministic and physical capability; networks infer inside provider slots while the semantic cell owns meaning, admissibility and evidence. This is the architecture that keeps generative AI powerful *and* governable at once (§1.1–1.3).

## 12. Open integration gates

The architecture is established; portions remain unimplemented. Per §10 and the audit, the gates are:

| Gate | Architecture layer | Status |
| --- | --- | --- |
| Gemini Pro authoring conveyor + auth + durable jobs | 5.3 | Not connected; `/build` retains intent only, and says so |
| Capability export adapter, verified SDA release | 5.3, 9 | Not connected; no downloads offered anywhere |
| SQL media schema + Nano Banana production + ingest | 5.2 | Schema installed; originals, derivatives and exact bindings persisted. 10 reviewed subject images / 20 selections; 1,383 further jobs queued |
| Content-lab grammar/material/player integration | 10 | Connected: 15 materials, complete source topology, 35 SQL blueprints, mechanic dependency graphs, 810 scenario workbench entries and reviewed teaching editions. Unmatched definitions retain explicit gaps |
| Durable inquiry store + mail worker | 4, spec §8.7 | Hosted builds reject submissions with values preserved |
| Legal entity, analytics config, workspace routes | 4, 5.4 | Registered unavailable; unlinked, noindex |
| Estate analytics, semantic retrieval, media QA services | 7 | Lab assets exist; platform services not wired (§7.4) |
| Capability execution service deployment and authorization | 5.5 | Connected locally: 94 of 219 capabilities prepared and invocable, refusals reported with the estate's own codes. The command API is unauthenticated and not deployed to any environment, so hosted builds report execution unavailable |

While a gate is open, the site reports P1 incomplete rather than substituting behavior (§9). This document is updated when a gate closes — the architecture is the contract, the audit is the ledger.

## 13. Decisions

Settled in the spec (§10): **Own your capabilities** is the tagline; the estate drives content; Gemini Pro authors candidates; Nano Banana supplies imagery; SCL supplies semantics; Container + Linux on Azure App Service with one tested image promoted between environments; Plausible is the analytics default; `/build` is the launch CTA. Hosting facts, references and remaining dependencies are recorded in `website-design-spec.md` §§8.5, 10, 14.4 and `docs/azure-deployment.md`.
