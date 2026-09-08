# SideFX Website — Design & Content Specification

**Product:** SideFX — Semantic Intent-Driven Engineering Effects; capability management and engineering platform
**Domain:** https://www.sidefx.io
**Owner:** BPM Intelligence (formerly BPM Software Solutions LLC), founded by Sidney Jones
**Planned stack:** Next.js (App Router) · TypeScript · Tailwind CSS · MDX content layer
**Status:** Draft v5 — existing Azure app and East US 2 deployment target recorded 2026-09-08; implementation and evidence gates remain to be satisfied
**Deployment:** Next.js standalone → tested Linux container → Azure Container Registry → Azure App Service
**Azure target:** Existing `sidefx` app in `sidefx_group`, East US 2, on Linux plan `ASP-sidefxgroup-ad2e` (P0v3; one instance), as reported in the supplied portal summary
**Content source:** Selected capability estate in `C:\lab\sidefx-database`, including mechanics, providers, scenarios and blueprints, projected through a publication service
**Image storage:** Generated originals, derivatives, provenance and entity bindings retained in the database; published web copies are rebuildable
**Primary experience:** Speak or type intent → inspect a candidate capability circuit → refine and verify → download semantic authority and available embodiments

This specification defines required website behavior. Source documentation establishes the reusable baseline; it does not establish that the website integration already exists. §11 defines the data contract, §12 the SCL and visual system, and §13 the IDE workflow.

---

## 1. Vision & Positioning

### 1.1 Elevator pitch

SideFX lets people describe the capability they need, inspect its visual circuit, and build it in an intent-driven environment. They can download the capability's semantic authority and available embodiments, then manage, invoke, and use it with the open-source SDA architecture or their own architecture.

**SideFX stands for Semantic Intent-Driven Engineering Effects.** The product story follows that sequence: intent expresses the need, engineering makes the capability inspectable and executable, and effects deliver the intended experience.

### 1.2 The category story

- BPM Intelligence positions itself as a **Managed Capability Provider**: customers own the capability authority and choose who operates it. This is SideFX's category thesis. A public first-mover claim requires the evidence record in §1.7.
- The SaaS era outsourced capabilities. The generative AI agency era inverts that: companies want **capability sovereignty** — capabilities they own — and the freedom to switch providers as quickly as conditions change.
- AI coding platforms produce sprawl. Sprawl is a governance liability, a cost-of-ownership trap, and a lock-in vector. Managing, inspecting, and governing AI sprawl is the problem companies are trying to solve today without acceptable cost or lock-in.
- SideFX answers with a capability estate built on executable meaning, an IDE for authoring capabilities, and downloadable authority and embodiments.

### 1.3 Core differentiators (must appear on Home)

| Differentiator | Plain-language claim |
| --- | --- |
| Intent-driven authoring | Speak or type what you need; inspect and refine the candidate circuit in the SideFX IDE |
| Executable meaning | Download the semantic authority that defines the capability's behavior |
| Capability ownership | Download your authority and available embodiments; manage, invoke, and use them with open-source SDA or your own architecture |
| One meaning, many embodiments | Select from the targets available for that capability; inspect each target's actual build and conformance evidence |
| Visual engineering | SCL projects capability meaning into an interactive circuit with explicit inputs, events, outcomes, providers, and evidence |
| Estate-driven discovery | Explore capability pages, scenarios, and relationships derived from the selected estate |

SQL, Node, Python, and C# are target families in the platform story. Availability and verification are recorded per capability, scenario, target, and revision. Governed RAG remains P2 content until its website integration and evidence are ready.

### 1.4 Tagline candidates

1. **"Own your capabilities."** (primary)
2. "Executable meaning. Sovereign capabilities."
3. "From AI coding to agentic engineering."
4. "One meaning. Every embodiment."

Primary tagline on Home hero. Use the other lines in sections where the page demonstrates their meaning; metadata must describe the actual page. The supporting product sequence is **Speak it. See the circuit. Own the capability.**

### 1.5 Positioning statements by audience

- **Engineers:** Build agentic capability circuits for agentic applications, robotics, and machine learning.
- **Domain experts:** Describe a domain goal and inspect the proposed inputs, actions, and outcome before choosing how to use the capability.
- **Entrepreneurs:** Build your startup's capabilities on a foundation you own.
- **SMBs:** Build new business capabilities and migrate existing ones to the platform.
- **Enterprises:** Manage, inspect, and govern your capability estate at scale.

### 1.6 Ownership contract

Users build capabilities through the SideFX IDE, download their semantic authority and available embodiments, and choose the architecture that manages and invokes them. The site must demonstrate this through an actual export and an independent use example.

The download manifest identifies the capability and revision, semantic authority files and digests, contracts, dependency references, selected embodiment targets, invocation instructions, provenance, and available verification evidence. Include applicable licenses and runtime requirements. Export dependency authority where redistribution permits; explicitly list dependencies that must be acquired separately. Credentials are supplied in the user's environment and are excluded from the bundle.

Offer **Download authority**, **Download embodiments**, and **Download bundle** with target selection. Draft exports remain available as clearly labeled candidate design artifacts; an executable download requires the corresponding embodiment artifact. A download must be usable without an ongoing SideFX website session. Independent use may still require the declared runtimes, provider accounts, credentials, and dependencies.

Provider changes preserve meaning when the replacement satisfies the declared contracts and verification obligations. Explain the binding or adapter work that remains. Prefer this concrete ownership promise over an unqualified "no lock-in" guarantee.

### 1.7 Claims and evidence

Every factual product claim binds a record containing: claim text, capability/scenario/target scope, source generation and revision, availability, evidence references, limitations, verification date, and publication owner. Editorial review checks that the copy says only what the evidence establishes.

| Claim | Required support before publication |
| --- | --- |
| Download and use independently | Reviewed bundle; documented import/invocation using SDA; documented integration with a customer-owned architecture; results tied to the exact export |
| Conformant embodiment | Target-specific compilation, execution, and applicable Reveal/Compare/Cross-Apply evidence; missing results remain explicit |
| Provider switching | A named replacement and recorded contract/behavior checks, with configuration or adapter changes disclosed |
| First Managed Capability Provider | Dated category definition and substantiated competitive research; otherwise publish the category thesis without "first" |
| Invented engineering principles | Specific contribution, attributable source, and date; describe SideFX's implementation without attributing all underlying techniques to the founder |
| Low burn, lower cost, easy migration | Scoped cost or migration example with assumptions; otherwise describe the workflow without a guaranteed saving |

Keep release availability, source evidence, provider binding, and execution results separate. `CAN_ATTEMPT_EMBODIMENT` does not mean an executable artifact exists or that conformance passed. A completed animation does not establish a completed capability execution.

---

## 2. Brand System

### 2.1 Name rules

- **SideFX** — one word, capital S, capital FX. Never "Side FX", "sidefx" in prose (URL paths lowercase).
- **Semantic Intent-Driven Engineering Effects** — the expansion of SideFX. Use on About, the IDE introduction, and the YouTube series; do not require visitors to learn the expansion before using the product.
- **IDE** — expand as **intent-driven environment** on first use. **Intent-design environment** is an accepted explanatory variant for the circuit-design experience. Use "SideFX IDE" in product navigation.
- **BPM Intelligence** — parent brand, credited in footer and About. Legal pages must identify the actual contracting entity once supplied; brand naming does not determine legal identity.
- **Managed Capability Provider** — use the full phrase in public navigation, headings, and metadata. Canonical page: `/managed-capability-provider`; `/mcp` redirects there. If the acronym is necessary, explain that this category term is distinct from Model Context Protocol, which also uses MCP. See the [protocol definition](https://modelcontextprotocol.io/specification/2024-11-05/index).
- **SCL** — SideFX Circuit Language; the language of executable capability circuits. Its current website authoring baseline is the content lab's 0.2 candidate language, with 0.1 compatibility.
- **SDA** — Scenario-Driven Architecture. Ownership guidance must link to the verified public open-source project and the specific compatible release; do not invent a repository URL.

### 2.2 Voice

- Confident, precise, engineering-forward. Short declarative sentences.
- Claims are always paired with mechanism: "we do X **because** of Y" (e.g., "provider independence **because** meaning lives in canonical authority, not in generated code").
- Lead with a concrete need, an inspectable circuit, and the resulting experience. Define terms when introduced. Reserve "conformant", "governed", and similar status claims for their supported scope; use "monotonic" only with its declared circuit rule.
- Humor: none in product copy; light where founder voice is appropriate (About, blog).

### 2.3 Recurring motifs

- **Circuit traces** — capability circuits rendered as node-and-trace diagrams.
- **Projection fan-out** — one canonical node projecting to many target nodes (SQL, Node, Python, C#).
- **Semantic progress** — use SCL's explicit transition, selection, join, and bounded-retry semantics. An audit history is a separate evidence view; monotonic circuit design does not by itself establish an append-only audit trail.
- **Blueprint grid** — graph-paper backdrop for canonical blueprint content.
- **Flow and telemetry** — illustrative flow is opt-in and labeled. Observed telemetry requires a bound execution record and timestamp.
- **Material circuit surfaces** — reviewed Nano Banana artwork enhances the deterministic SCL/SVG layer. §12 defines the shared website, IDE, and YouTube visual language.

---

## 3. Audience Model

### 3.1 Launch audience and supporting personas

The primary P1 audience is the **hands-on capability builder**: an engineer or technical founder who can evaluate an integration and take a downloaded capability into use. Domain experts can start from plain-language intent and collaborate on the same visual circuit. Enterprise buyers have a separate inquiry route. This ordering governs Home copy and demonstration selection.

| Persona | Pain | Pitch | Primary CTA |
| --- | --- | --- | --- |
| Software/agentic engineer | AI-generated code sprawl; no authority over meaning | Describe, inspect, verify, and export a capability | Build a capability |
| Domain expert | Depends on engineering for capability changes | Describe the goal and inspect its proposed circuit | Explore capabilities |
| Entrepreneur | Provider dependency at founding | Build capabilities whose authority you can take with you | Build a capability |
| SMB owner/operator | Migration risk, provider dependency | Assess one existing capability and its migration path | Discuss a migration |
| Enterprise platform/architecture leader | AI governance gaps; sprawl; cost of ownership | One governed capability estate with telemetry and conformance | Talk to us |
| Learning audience | Agentic engineering boom, no accessible path | Structured courses: agentic, platform, capability engineering, AI governance | Enroll |

### 3.2 Persona→page mapping

The five product audiences have `/solutions/*` pages, following problem → mechanism → outcome → proof → CTA in §5.11. The learning audience uses `/training` in P2. P1 provides the quickstart and SCL guide under `/docs`.

### 3.3 CTA destinations

| Label | Destination | Completion |
| --- | --- | --- |
| Build a capability | `/build` | Intent submitted, candidate circuit shown, draft retained (§13) |
| Explore capabilities | `/capabilities` | Search/filter and open a capability circuit |
| Use this as a starting point | `/build?from={publicCapabilityKey}` | Create a separate draft with source lineage; preserve the source capability |
| Download authority / embodiments / bundle | Capability detail or private workspace export action | Versioned artifact delivered with its manifest |
| Talk to us | `/contact?intent=enterprise` | Inquiry accepted with a delivery reference |
| Discuss a migration | `/contact?intent=migration` | Migration inquiry accepted |
| Enroll | Published P2 course's configured checkout | Confirmed enrollment; absent before commerce is ready |

`publicCapabilityKey` is an encoded, stable public identity resolved by the server. All CTA labels and destinations come from one route/availability registry. "Start building" is replaced by the explicit "Build a capability" label.

---

## 4. Site Architecture (Sitemap)

Next.js App Router route table. Routes marked **P1** ship in the launch site; **P2**/P3 are phased.

| Route | Page | Phase |
| --- | --- | --- |
| `/` | Home | P1 |
| `/platform` | Platform overview | P1 |
| `/platform/executable-meaning` | Executable meaning | P1 |
| `/platform/capability-estate` | Capability estate management | P1 |
| `/platform/circuits` | Agentic capability circuits | P1 |
| `/platform/projections` | Projection & embodiment (Cross-Apply) | P1 |
| `/platform/blueprints` | Canonical blueprint, telemetry, monotonic circuits | P1 |
| `/platform/governance` | AI governance | P1 |
| `/platform/knowledge` | Governed RAG knowledge | P2 |
| `/managed-capability-provider` | Managed Capability Provider — the category | P1 |
| `/mcp` | Permanent redirect to `/managed-capability-provider` | P1 |
| `/capabilities` | Searchable capability estate | P1 |
| `/capabilities/[namespace]/[capabilityId]` | Estate-driven capability detail and visual circuit | P1 |
| `/mechanics` | Searchable mechanic library | P1 |
| `/mechanics/[namespace]/[mechanicId]` | Mechanic image, meaning, providers and declared usage | P1 |
| `/providers` | Searchable provider library | P1 |
| `/providers/[namespace]/[providerId]` | Provider image, declared implementations and evidence | P1 |
| `/build` | SideFX IDE: spoken/typed intent and candidate circuit | P1 |
| `/workspace/capabilities/[draftId]` | Authenticated private capability workspace and downloads | P1 |
| `/sign-in`, `/auth/callback` | Authentication and return to the retained intent/workspace | P1 |
| `/healthz`, `/readyz` | Operational probes; excluded from navigation and sitemap | P1 |
| `/governance` | Permanent redirect to `/platform/governance` when campaign launches | P2 |
| `/solutions/engineers` | For engineers | P1 |
| `/solutions/domain-experts` | For domain experts | P1 |
| `/solutions/entrepreneurs` | For entrepreneurs | P1 |
| `/solutions/smb` | For SMBs | P1 |
| `/solutions/enterprise` | For enterprises | P1 |
| `/training` | Training hub | P2 |
| `/training/agentic-engineering` | Agentic engineering course | P2 |
| `/training/platform-engineering` | Platform engineering course | P2 |
| `/training/capability-engineering` | Capability engineering course | P2 |
| `/training/ai-governance` | AI governance course | P2 |
| `/ecosystem` | Open API ecosystem (CNCF, RapidAPI, OSS) | P1 |
| `/about` | About — founder, BPM Intelligence | P1 |
| `/latest` | News & writing | P2 |
| `/latest/[slug]` | Article or YouTube companion page | P2 |
| `/pricing` | Plans (deferred until packaging decided) | P3 |
| `/contact` | Contact / enterprise inquiry | P1 |
| `/docs` | Launch documentation index | P1 |
| `/docs/quickstart` | Intent → circuit → download → independent use | P1 |
| `/docs/ownership` | Bundle contents, SDA and own-architecture integration | P1 |
| `/docs/scl` | SCL guide, legend, examples, and compatibility | P1 |
| `/docs/glossary` | Plain-language definitions linked from product pages | P1 |
| `/legal/privacy`, `/legal/terms` | Legal | P1 |

P1 global nav: **Explore ▾ · Platform ▾ · Solutions ▾ · Docs · About** + primary **Build a capability**, secondary **Talk to us**. Explore contains Capabilities, Mechanics and Providers. Ecosystem and the full Managed Capability Provider name appear in the Platform menu and footer. Signed-in users can return to their workspace.

Footer: available platform/solution pages, Capabilities, Mechanics, Providers, Docs, Ecosystem, category page, About, Contact, Legal, BPM Intelligence attribution, and verified social destinations. Add Training and Latest only after their pages ship.

**Phase rule:** P1 cards, navigation, cross-links, structured data, and sitemap include only available destinations. P2 teasers may explain planned work as plain text; they cannot contain dead links or active enrollment actions. `/platform/knowledge` is excluded from linked card sets until available. The canonical origin is `https://www.sidefx.io`; the apex redirects there. Private/auth routes are excluded from search indexing and public sitemaps.

---

## 5. Page-by-Page Content Specification

Each page spec lists: purpose, hero (H1 + subhead + CTA), section blocks with direction (real copy sketches where stable), SEO meta direction, and links.

### 5.1 Home (`/`)

**Purpose:** Show a builder what they can create, inspect, and take into use; demonstrate the ownership promise with an estate-backed example.

**Hero**
- Eyebrow: `The SideFX intent-driven environment` (linked to `/build`)
- H1: `Own your capabilities.`
- Subhead: `Describe what you need. See the capability as a circuit. Download its semantic authority and available embodiments to use with open-source SDA or your own architecture.`
- CTA primary: `Build a capability` → `/build` · secondary: `Explore capabilities` → `/capabilities`
- Visual: a real, selected capability's SCL circuit and reviewed Nano Banana image. Begin with its input, action, and outcome; offer scenario drill-down and opt-in flow. Clearly label a draft or illustrative example. Target badges reflect that capability's artifact and evidence records.

**Blocks**
1. **Try an intent** — editable typed/voice prompt leading to `/build`; the same transcript and provider context carry into the IDE. Use the quote-retrieval and CNCF examples in §13.4.
2. **See the circuit** — one source-bound example: need → input/event/outcome → provider responsibility → expected experience. Link to its actual capability detail page.
3. **Take it with you** — show the authority and embodiment bundle, supported targets, and the independent-use quickstart. Link `/docs/ownership`.
4. **Explore the estate** — featured capability images, promises, scenarios, and availability queried from the published estate projection. Every capability card opens its circuit. Related mechanic/provider cards show the reusable parts and declared implementers, linking to their own images and detail pages.
5. **How SideFX works** — IDE, executable meaning, SCL, and the five P1 platform pillars (estate, circuits, projections, blueprints, governance). Knowledge joins the linked set in P2.
6. **Why ownership matters** — explain inspection, export, and provider choice through their concrete mechanisms. Link `/managed-capability-provider` for the category thesis.
7. **Audience and ecosystem** — compact audience links and source-bound provider examples, with `/ecosystem` for detail. Marketplace references identify discovery sources; they do not imply a working integration or partnership.
8. **Learn the method** — P1 quickstart/SCL links and a YouTube feature only when a reviewed video and channel URL are available. P2 adds the four-course rail.
9. **Final CTA** — `Build a capability` → `/build`; `Talk to us` → `/contact?intent=enterprise`.

**SEO:** title `SideFX — Capability Management & Engineering Platform`, meta description using tagline 1 + differentiator 3.

### 5.2 `/platform` (overview)

**Hero:** `One platform for your entire capability estate.` Subhead: sovereignty, ownership, flexibility to scale.
**Blocks:** IDE journey; five P1 platform pillars; estate-backed examples; ownership/download demonstration; architecture diagram (intent → candidate → verified authority → available embodiments → execution evidence, with estate discovery as input and published inspection as a read projection); approved founder quote; `/build` CTA. Add the knowledge pillar when its route is available.

### 5.3 `/platform/executable-meaning`

**Purpose:** Lead with the differentiator; define the term; own it in search.

- Hero: `Meaning you own. Meaning that executes.`
- Blocks: (1) plain-language definition with a real capability; (2) inspect the downloadable authority and its contracts; (3) authority → target projection → embodiment → scoped conformance checks; (4) Cross-Apply example with exact target evidence; (5) refine the same capability in the IDE; (6) FAQ covering ownership, dependencies, and limitations.
- SEO: target "executable meaning", "semantic ontology for software".

### 5.4 `/platform/capability-estate`

- Hero: `Every capability. One estate.`
- Blocks: live-site inventory from the selected published database generation; capability/scenario lineage; download and independent use; provider replacement requirements; `/capabilities` search; scoped migration example linking `/solutions/smb`. Add the governed-retrieval link only in P2. Counts carry their generation and coverage; search availability is separate from RAG readiness.

### 5.5 `/platform/circuits`

- Hero: `See what your capability will do.`
- Blocks: interactive SCL example; input/event/outcome; scenario-to-mechanic/provider drill-down; typed composition; branches, joins, bounded retries and terminal states; evidence inspector; blueprint relationship. Application domains such as robotics and machine learning require an appropriately scoped example. Link `/docs/scl`, `/platform/blueprints`, and `/build`.

### 5.6 `/platform/projections`

- Hero: `One meaning. Choose its embodiment.`
- Blocks: target matrix derived per capability/scenario/revision; SQL/database bindings and native Node/Python/C# where available; artifact previews; compilation versus execution versus conformance results; inverse checks; download and independent invocation. Missing or declaration-only target support stays labeled. Link `/docs/ownership`.

### 5.7 `/platform/blueprints`

- Hero: `Build against the blueprint.`
- Blocks: blueprint as design authority; SCL candidate authoring and validated projection; explicit topology, progress rules, provider slots and evidence obligations; preservation of source identity; conformance evidence. Distinguish a design blueprint from a runtime plan and from an image; show the selected profile and unresolved findings.

### 5.8 `/platform/governance`

- Hero: `AI governance, engineered in — not bolted on.`
- Blocks: inspection through Reveal/Compare; scoped conformance receipts; attributable version/change history; capability ownership and access; unresolved obligations. Auditability requires retained evidence and history. Add knowledge-governance and training links when their P2 content ships. P1 links to `/solutions/enterprise` and an available evidence example. Include visible FAQs before emitting FAQ structured data.

### 5.9 `/platform/knowledge` (P2)

- Hero: `Governed knowledge across the estate.`
- Blocks: RAG retrieval over capability knowledge; semantic authority as the retrieval spine; access control; retrieval receipts.

### 5.10 `/managed-capability-provider`

**Purpose:** Explain the Managed Capability Provider category through customer ownership and provider responsibilities.

- Hero: `Your capabilities. Your choice of operator.` Subhead: `BPM Intelligence's Managed Capability Provider model puts downloadable capability authority in your hands.`
- Blocks: ownership bundle; what the provider manages; what the customer controls; operation through SDA or a customer architecture; comparison of explicit ownership/export/operation terms for named offerings; attributed category thesis; `/build` and enterprise CTAs.
- SEO: full "Managed Capability Provider" phrase and "capability ownership". Explain the distinction from Model Context Protocol if using MCP in body text. `/mcp` permanently redirects here and has no duplicate indexable content.

### 5.11 `/solutions/*` (five pages, one skeleton)

Skeleton: problem block → SideFX mechanism block → outcome block (3 bullets) → proof block (quote/telemetry/conformance) → persona CTA.

- **engineers** — describe intent, inspect the circuit and contracts, verify selected targets, and download. CTA: Build a capability.
- **domain-experts** — describe the desired experience, review inputs/actions/outcomes, and collaborate on provider choices. CTA: Explore capabilities.
- **entrepreneurs** — build and export a first business capability. Show a scoped cost example only when available. CTA: Build a capability.
- **smb** — assess one existing capability, identify retained dependencies, plan a staged migration, and validate the result. CTA: Discuss a migration.
- **enterprise** — pitch: manage and govern the capability estate at scale. Outcomes: sprawl control; conformance receipts; switching leverage. CTA: Talk to us (not self-serve).

Every solution page selects real published capability examples by identity and audience tags. A quote illustrates a user's account; it cannot substitute for technical conformance evidence. If a proof asset is unavailable, describe the intended outcome as a target and expose that limitation.

### 5.12 `/training` hub + four course pages (P2)

Hub: four course cards (agentic engineering, platform engineering, capability engineering, AI governance) with level, duration, outcome, enroll CTA.
Course page skeleton: who it's for → curriculum → estate-backed capability exercise → assessment and completion credential → enroll. A course completion credential is separate from capability conformance evidence.
Messaging: `Learn to turn intent into capabilities you own.` Teach IDE authoring, SCL, authority, embodiments, and evidence using the same capability IDs and visual system as the product. Publish enrollment only with an operating checkout, price, curriculum, and confirmation path.

### 5.13 `/ecosystem`

- Hero: `Off-the-shelf capabilities. Your semantic authority.`
- Blocks: estate-derived provider responsibilities and declared implementations; discovery through RapidAPI and the CNCF landscape; provider selection and contract checks; credentials and environment setup; creating an integration draft through `/build`. Separate a discovered project, candidate provider, bound provider, and verified execution. A marketplace or landscape entry alone establishes none of the later states. Public contribution/publishing programs remain P3.

Include the existing mechanic/provider library before external marketplace discovery: `/mechanics` explains reusable responsibilities, and `/providers` reveals declared implementations. Link exact selected relationships. Avoid presenting internal providers as marketplace services or treating similar mechanic names as interchangeable contracts.

### 5.14 `/about`

- Sidney Jones, founder of BPM Intelligence (formerly BPM Software Solutions LLC), inventor of SideFX.
- Story: BPM → capability ownership → Semantic Intent-Driven Engineering Effects → IDE and SCL → embodiments and independent operation.
- Timeline: use verified dates for the company history, rebrand, SideFX milestones, and released courses. Future items are labeled planned.
- Credibility block: specific SideFX contributions with attributable sources and demonstrations under §1.7. Founder wording and portrait require editorial approval; the site does not ascribe invention of all underlying methods.
- YouTube story: **Semantic → Intent-Driven → Engineering → Effects**. A recurring episode starts with a spoken need, reveals the circuit, demonstrates the supported result, and shows the ownership/download step. Bind each episode to the same capability revision and visual artifacts used on the site.

### 5.15 `/contact`

- Required: name, email, inquiry type, message. Optional: company, role, capability estate size (including **Not sure**). Inquiry types: enterprise, migration, training, partnership, general. Query-string preselection remains editable.
- Server action performs schema validation, input length limits, rate limiting and spam checks. Keep values on failure; associate inline errors with fields and focus an error summary. Use a validated reply-to address and a configured delivery recipient.
- Persist an inquiry ID and durable delivery job before acknowledging acceptance. UI states: editing, submitting, accepted, retryable failure, validation failure. Acceptance says the inquiry was received; it does not claim email delivery before the mail provider confirms it.
- Idempotent retries reuse the inquiry ID; delivery failures are retried within a bounded policy and surfaced to the operator. Test a real staging delivery and a failure/recovery path before launch. Provide a verified fallback contact address.

### 5.16 `/latest` (P2)

- News and writing: Managed Capability Provider commentary, engineering deep dives (projection/embodiment/Cross-Apply), course announcements, founder notes.

Use the full category name in titles. Articles and YouTube companion pages bind reviewed estate content, capability links, and visual assets; article or video publication does not alter capability authority.

### 5.17 `/capabilities` and capability detail

The catalog is generated from the published capability estate (§11). Search name, promise, domain, and scenario summaries; filter by declared provider, available embodiment target, and readiness. Results include the capability-specific Nano Banana image, promise, availability, and an accessible Open circuit link. Empty, filtered-empty, loading, stale-data, and unavailable states are explicit.

Every capability click opens `/capabilities/[namespace]/[capabilityId]` with its circuit displayed. The page contains: name/promise → visual circuit → scenarios → provider responsibilities/bindings → authority and embodiments → evidence/limitations → related capabilities → downloads and Use this as a starting point. Images complement the interactive circuit. A source-faithful boundary view remains available when deeper topology is unresolved (§12.2).

Scenario and node selections have shareable URL state. The inspector shows readable meaning first; identifiers, source revision, and evidence are available on demand. Existing capabilities are opened for inspection; editing creates an owned draft with lineage. Private created capabilities appear only in the authenticated workspace until explicitly published through an authorized publication path.

### 5.18 `/build` and private workspace

Hero: `What capability do you need?` Offer a multiline intent field, **Speak your intent**, source/provider context, example prompts, and **Design circuit**. Render the candidate's SCL circuit as soon as a valid revision is available. The workspace combines conversation, circuit, diagnostics, provider/target choices, and downloads. Full state and integration requirements are in §13.

### 5.19 Launch documentation and legal pages

`/docs/quickstart` walks through an actual supported example from intent to circuit to export and independent invocation. `/docs/ownership` documents bundle contents, compatible SDA release, own-architecture contract, dependencies, and target limitations. `/docs/scl` supplies the canonical symbol legend, a complete valid 0.2 example, 0.1 compatibility, and the distinction between design and execution. `/docs/glossary` defines the terms used on P1 pages.

`/legal/privacy` and `/legal/terms` require supplied entity identity and approved copy covering the implemented service, export rights, and actual data processing. Link privacy information beside contact and microphone controls. The legal content owner must resolve the entity name before P1; the brand name is insufficient.

### 5.20 `/mechanics` and `/providers`

Both libraries are generated from exact selected estate definitions and share catalog search, filtering, responsive entity cards and database-backed imagery. A mechanic page explains its declared responsibility, inputs/results where specified, dedicated illustration, provider implementations and source-backed usage. A provider page shows its dedicated portrait, declared mechanics/ports/capabilities, target/profile metadata and qualification/execution evidence where present.

Every capability, mechanic and provider has its own image requirement. Images follow the entity's identity across catalog cards, circuit inspectors, docs, IDE suggestions and YouTube teaching material. A mechanic/provider click in a circuit opens its entity inspector or detail page with the same selected revision. Repeated appearances reuse that entity's art; they do not trigger generation for every node occurrence.

The live inspection found 137 platform-provided mechanics without display names. Provide readable editorial names/descriptions through reviewed presentation metadata with source references; preserve exact IDs and do not fill semantic authority fields with generated claims. A name-only declaration supports an identity card until richer meaning has been sourced. Show an explicit absence when a required relationship has not been declared.

---

## 6. Visual Design System

### 6.1 Direction

Dark, technical, and legible. Reuse the SideFX glass/material circuit references: restrained grid, luminous semantic edges, dark quiet label surfaces, and visible input/event/outcome structure. Capability pages and the IDE use the same SCL renderer and symbol vocabulary as content production.

Nano Banana creates a distinct image for every capability, mechanic and provider, and enhances canonical component materials. Scenarios, blueprints and other entities extend the same registry under §12.7. Generated environments or human scenes may illustrate a capability's intended experience when their content contract supports it. Circuit topology, labels, status, and evidence always come from the deterministic projection. Founder photography remains an approved real portrait. §12 resolves differences among the supplied visual references.

### 6.2 Palette

| Token | Value | Use |
| --- | --- | --- |
| `ink` | `#0A0E14` | Page background |
| `ink-2` | `#101724` | Card background |
| `grid-line` | `#1C2735` | Blueprint grid, borders |
| `signal` | `#33E0C8` | Primary accent, CTAs, active traces |
| `authority` | `#7AA2FF` | Semantic authority nodes, links |
| `projection` | `#B48CFF` | Projection/embodiment accents |
| `telemetry` | `#FFC24B` | Telemetry ticks, warnings |
| `failure` | `#FF8A6B` | Failed/held state accents, paired with text and icon |
| `text` | `#E6EDF5` | Body text |
| `muted` | `#8B98A9` | Secondary text, captions |

These are website shell tokens. SCL semantic colors come from the versioned circuit grammar and are mapped explicitly; the website palette cannot silently recolor semantic types. CTA buttons use signal fill with ink text. Verify all actual text/background, focus, state and control pairs; decorative grid lines cannot serve as the sole control boundary.

### 6.3 Typography

- Display: **Space Grotesk** — headlines, taglines.
- UI/body: **Inter** — navigation, body, forms.
- Mono: **IBM Plex Mono** — code, meaning fragments, diagrams labels, data.
- Scale: display 56/40/28 px with responsive sizing; body 16–18 px with 1.5–1.7 line height; caption 13 px mono. Load only required font weights. Circuit text remains readable through zoom, scenario focus, and an equivalent text inspector.

### 6.4 Component inventory (design system v1)

Shared shell: responsive nav, hero, eyebrow, section header, capability card, persona tile, comparison table, quote, CTA band, footer, forms, status badge, callout, FAQ and logo rail. Catalog: filters, pagination, availability and image states. IDE: voice recorder, editable transcript, intent composer, job progress, source diagnostics, revision selector, provider/target selector and export panel. Circuit: viewport, scenario switcher, text outline, node inspector, legend, flow controls, Base/Material toggle and evidence drawer. P2 adds course/article components.

### 6.5 Motion rules

- Circuit motion reuses the silver-ball player in `CIRCUIT-FLOW.md`; exact paths and join arrival rules drive illustrative playback. Start static and play only on request. No decorative loop suggests live telemetry.
- Respect `prefers-reduced-motion` with stepwise events; pause/resume, replay and speed controls remain accessible. Stop playback when inspecting a node, switching circuits, hiding the tab or leaving the page. Detailed semantics are in §12.4.

### 6.6 Responsive and accessible interaction

- Test layouts at 320, 375, 768, 1024, and 1440 CSS px, with zoom/reflow. Page content reflows without horizontal scrolling; the circuit has its own labeled pan/zoom region and equivalent structured text view.
- Desktop may show conversation, circuit and inspector together. Narrow screens use tabs or stacked panels, retain selection, and present node details in an accessible drawer. Never shrink an estate graph until its labels become the only unreadable explanation.
- Navigation and accordions use semantic controls, visible focus, keyboard activation, appropriate expanded state, and Escape/focus return for overlays. Sticky navigation cannot cover focused content. Provide a skip link.
- Circuit nodes have names and roles, keyboard selection, a navigable text outline, and inspector focus behavior. Status uses words and shapes as well as color. Decorative material/flow layers are hidden from assistive technology and ignore pointer events.
- Label forms, microphone state, target controls and downloads; announce meaningful progress and errors without reading every animation frame. Support denied microphone permission and typed input with equal functionality.
- Target WCAG 2.2 AA, with manual keyboard, screen-reader, reflow and contrast checks alongside automated tooling. See [W3C evaluation guidance](https://www.w3.org/WAI/test-evaluate/). A Lighthouse score is one check, not the accessibility acceptance decision.

---

## 7. Content Strategy & SEO

- **Keyword clusters:** capability ownership · Managed Capability Provider · intent-driven environment · Semantic Intent-Driven Engineering Effects · SideFX Circuit Language · agentic engineering · executable meaning · capability estate · API integration.
- **Glossary:** `/docs/glossary` ships in P1 with contextual definitions. Include Capability, Estate, IDE, SCL, SDA, Semantic Authority, Scenario, Input, Event, Outcome, Experience, Provider, Embodiment, Projection, Blueprint, Conformance, Cross-Apply, Evidence, Telemetry, and Monotonic Progress. Define advanced terms on the page where they matter.
- **Structured data:** `Organization` for the confirmed company identity and `WebSite`; `DefinedTerm` for visible glossary entries; `FAQPage` only for visible question/answer content. Add `Course`, `Article`, and `VideoObject` only for actual published courses, articles, and videos. Markup is descriptive and carries no promise of search-result enhancements.
- **Metadata rules:** every indexable public page gets a unique title targeted at ≤60 characters, description targeted at ≤155 characters, canonical URL and reviewed page/capability OG image. Private/auth pages use generic metadata that exposes no private capability facts; they remain noindex.
- **Estate SEO:** public capability, mechanic and provider pages receive source-derived, reviewed titles and descriptions, an entity-specific image, and canonical identity URLs. Generate sitemaps only from the publication manifest; auth/workspace routes are noindex. Redirect renamed slugs using retained identities and history; unknown public identities return 404.
- **Analytics:** use Plausible as the implementation default, with the final data/consent configuration recorded before launch. Events: capability opened, circuit inspected, intent submitted, candidate displayed, download completed, and inquiry accepted. Add enrollment events in P2. Do not send voice recordings, transcripts, prompts, credentials, private capability names, or contact messages to analytics.
- **YouTube:** use the brand expansion as the recurring teaching structure. Each published episode links to its capability/circuit page and retained revision; the website links back to the reviewed episode. Thumbnail and circuit imagery share the capability asset manifest. Historical episode imagery retains its source revision when the estate changes.

---

## 8. Technical Specification (Next.js)

### 8.1 Stack

- Next.js App Router, TypeScript strict; select and pin a supported stable release at implementation time.
- Tailwind CSS with the §6 design tokens; no component library at launch (custom per §6.4 to protect the blueprint aesthetic).
- MDX for editorial narrative (`/platform/*`, category, guides, courses, articles). Capability facts, scenarios, providers, evidence, target availability and relationships come from the estate projection (§11), referenced by ID in editorial content. Do not maintain a parallel handwritten capability catalog.
- Reuse the content-lab SCL compiler/renderer and circuit-flow player through versioned artifacts/adapters. Long-running Gemini authoring and Nano Banana generation run in durable backend jobs; server actions only validate requests, enqueue work, and return job identity.
- Add a media persistence service backed by the SQL database (§11.5). Retain original image bytes, versioned derivatives, generation metadata, semantic entity bindings and review/selection history there. Web/CDN copies are delivery artifacts; an external URL alone is not the stored image.
- Forms: server actions, durable inquiry delivery, Resend or equivalent, bounded retries and rate limits. Authentication protects owned drafts, private artifacts and authoring jobs.
- Deployment: **Container + Linux on Azure App Service**, with images in Azure Container Registry (ACR). Serve `www.sidefx.io`, redirect the apex, and use `staging.sidefx.io` for validation. §§8.4–8.7 define the package, Azure binding, delivery and operations. The production publication/authoring/media services must be reachable from deployment; a local Windows database path is a development source, not a cloud connection method.
- The P1 IDE lives at `/build` and `/workspace/*`. `console.sidefx.io` may host expanded operations in P3; it is not a dependency for launch authoring, circuit display or downloads.

### 8.2 Proposed repo layout

```
sfx-platform/
  app/
    (marketing)/          # layout.tsx: shared nav, footer, SEO
      page.tsx
      platform/ managed-capability-provider/ capabilities/ mechanics/ providers/
      solutions/ ecosystem/ about/ contact/ docs/ legal/
    (ide)/                # layout.tsx: composer, circuit workspace
      build/ workspace/ sign-in/ auth/
    mcp/                  # redirect only
    api/                  # authenticated job/export endpoints
    healthz/ readyz/       # minimal operational route handlers
    sitemap.ts robots.ts
  components/             # shell, catalog, IDE, shared circuit viewer
  content/                # editorial MDX and reviewed source-ID selections
  lib/                    # estate reader, publication, jobs, auth, SEO, analytics
  contracts/              # publication, capability page, circuit, asset, export, job
  generated/              # validated public estate projection; rebuildable
  public/                 # versioned reviewed assets, favicons, OG images
  tests/                  # focused data, interaction, ownership and route checks
  Dockerfile              # Linux dependency/build/runtime stages
  .dockerignore           # exclude secrets, local data and development artifacts
  next.config.ts          # standalone production output
  .github/workflows/      # test, build, publish and deploy the same image
  infra/                  # versioned Azure provider binding and environment parameters
  docs/website-design-spec.md   # this document
```

### 8.3 Quality gates

- Public pages: unique metadata, canonical, capability-specific or page-specific OG image, and zero broken internal links. Private pages have correct access controls/noindex and do not leak metadata.
- Performance: Lighthouse ≥95 performance and 100 automated accessibility on agreed mobile/desktop representative fixtures (Home, large catalog, largest launch circuit, IDE). Record device/throttling and dataset. Every route receives automated link/metadata/a11y checks; manual checks in §6.6 remain required.
- CI: TypeScript, lint, route/phase checks, publication schema and source-digest validation, deterministic circuit checks, and critical workflow tests. Add tests for behavior and integrity boundaries rather than restating static copy.
- Integration: capability click opens the correct graph; voice and typed intent produce an inspectable candidate; invalid output preserves the draft and exposes diagnostics; cancellation/resume cannot duplicate jobs; exports match the selected revision and target.
- Ownership: execute the launch example from the downloaded bundle in the documented SDA environment and in a documented own-architecture adapter environment. Record actual scope and dependencies; do not turn an example into a universal target claim.
- Data/visuals: enforce one coherent estate generation per publication; protect private data; refuse stale artifacts; show unresolved graph/target state honestly; verify every published capability has its own reviewed Nano Banana image and a source-faithful circuit view. Every published mechanic/provider also requires its own reviewed image. Coverage includes missing requirements, and database byte round trips preserve image digests and exact subject bindings (§11.5).
- Delivery: staging inquiry reaches the configured recipient; simulate retryable failure and duplicate submission. Verify microphone denial, keyboard-only use, reduced motion, narrow layout, and screen-reader progress/error feedback.
- Container: test the final runtime image locally and in Azure staging, including static assets, MDX, circuit artifacts, media retrieval, server actions, sign-in return, job reconnect, health checks and graceful restart. Release evidence records the image digest, source commit, dependency lock, website contract and estate publication identity. Validate promotion and rollback using the same stored image (§8.6).

### 8.4 Container embodiment

**The container is an embodiment, not the authority.** Website requirements, semantic source bindings, content contracts and release evidence remain inspectable outside the package. Docker supplies a versioned executable artifact; Azure supplies an environment and provider binding. Portability requires compatible CPU/OS, configuration, dependencies and behavior checks on the replacement host. Container packaging alone does not establish Cross-Apply conformance.

```text
Website authority and source-bound content
  → Next.js embodiment
  → tested Linux container image
  → Azure Container Registry
  → Azure App Service provider binding
  → www.sidefx.io
```

Use Next.js standalone output:

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
};

export default nextConfig;
```

The standalone directory includes the generated server and traced runtime dependencies. Copy `public` and `.next/static` explicitly into the runtime image alongside `.next/standalone`; they are not automatically included. Start the resulting package with `node server.js`, with the working directory matching the copied layout. Check any dynamically loaded MDX, schemas and circuit assets against output-file tracing. See [Next.js standalone output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output).

The Dockerfile uses separate dependency, build and runtime stages. Build on Linux with a committed lockfile, `npm ci`, and the production build; pin the tested Node version, base-image digest and target architecture. Copy only required runtime output into the final stage and run under a non-root user. The final image must not contain the development workspace, local SQL captures, credentials or image-generation work queues. Compile native dependencies for the runtime platform.

Production builds require a valid, explicitly selected public estate publication. Missing-data allowances may support local preview but cannot make an empty or unvalidated estate a deployable release. Keep private authority, original media bytes and mutable workspace data in their services; only approved public artifacts may be packaged.

### 8.5 Azure provider binding

**Existing deployment target — user-supplied Azure portal summary, recorded 2026-09-08.** Use this app for the website deployment. These values describe the supplied resource snapshot; this documentation update has not independently inspected Azure configuration or deployed a website image.

| Resource / state | Reported value |
| --- | --- |
| Subscription | BPM Software Solutions |
| Subscription ID | `878efc24-f06f-4255-83c0-2d38e71dc51c` |
| Resource group | `sidefx_group` |
| Web app | `sidefx` |
| Region | East US 2 |
| App Service Plan | `ASP-sidefxgroup-ad2e` |
| Plan SKU / instance count | P0v3 / 1 |
| Publish / OS | Container / Linux |
| App status / container runtime status | Running / Healthy |
| Current image | `mcr.microsoft.com/appsvc/staticsite:latest` |
| Default domain | [sidefx-g7hac9eqb0frhubx.eastus2-01.azurewebsites.net](https://sidefx-g7hac9eqb0frhubx.eastus2-01.azurewebsites.net/) |
| App Service Health Check | Not Configured |
| Custom domain | None shown; portal offers Add custom domain |

The current Microsoft static-site image is the starter deployment. Replace it with the tested SideFX Next.js image through the release workflow. Reported runtime health describes that current container; it does not establish that SideFX pages, estate publication, circuits, authoring or exports are deployed. App Service Health Check still needs an explicit route after the application implements its probes (§8.7).

**Required application binding:**

| Setting | Required configuration |
| --- | --- |
| Publish / OS | Container / Linux |
| Runtime contract | `NODE_ENV=production`, `HOSTNAME=0.0.0.0`, `PORT=3000`; image command `node server.js` |
| Container mode | Inspect the existing `sidefx` app's actual mode before configuring deployment; the supplied summary does not identify classic Docker versus enhanced `sitecontainers`. Preserve that mode unless a tested migration is part of implementation. For enhanced mode, use one main Next.js container; extra sidecars are optional. |
| Enhanced port routing | Main container has `isMain=true` and `targetPort="3000"`. Record the actual resource/API configuration. |
| Existing classic Docker mode | Set App Service `WEBSITES_PORT=3000` as well as the application's own `PORT=3000`; do not mix classic settings into the enhanced configuration. |
| Registry | Private ACR repository; unique release/commit tag, retained manifest digest and immutable release policy |
| Image pull | App Service managed identity with the pull permission appropriate to the registry's configured permission mode; verify image pull for each deployed slot |
| Domain | `www.sidefx.io` canonical; apex redirect; HTTPS; explicit authentication callback/allowed-origin configuration |
| Environment | Server configuration and secret references supplied by the deployment binding; preserve the image command rather than running a build on App Service startup |

Enhanced containers use `sitecontainers` resource configuration; classic registry/`WEBSITES_PORT` app settings do not apply there. See [container modes](https://learn.microsoft.com/en-us/azure/app-service/configure-sidecar), [main-container target port](https://learn.microsoft.com/en-us/azure/templates/microsoft.web/sites/sitecontainers), and [classic container configuration and registry identity](https://learn.microsoft.com/en-us/azure/app-service/configure-custom-container).

**Plan and region:** East US 2 and the existing Linux plan `ASP-sidefxgroup-ad2e` are the selected deployment baseline. The earlier West US 3 discussion is superseded by this supplied resource summary. Resolve and verify the app's actual `serverFarmId`, plan configuration and capacity during infrastructure setup; creating another plan or moving regions is not a prerequisite specified here. See [App Service Plan regions](https://learn.microsoft.com/en-us/azure/app-service/overview-hosting-plans).

Keep provider-specific infrastructure parameters versioned under `infra/`, starting with the supplied subscription, resource group, app, region and plan names. ACR, container mode/port, app/slot managed identities, staging slot, deployment identity, networking, domain bindings, health routes and environment references still require inspection or configuration. Do not infer those settings from the default domain or the starter image. Azure identifiers belong in infrastructure configuration and release evidence, not public website content.

### 8.6 Build, test, promote and roll back

```text
GitHub commit + lockfile + approved public content inputs
  → checks and Linux container build
  → test final image
  → push release image to ACR; record digest
  → deploy that image to staging
  → smoke/integration checks
  → promote the same image to production
```

Use a GitHub Actions workflow with a scoped federated deployment identity. Build once per release and promote the exact tested package; never rebuild from source during promotion or use an unpinned `latest` tag as release identity. Prefer a digest reference where supported; otherwise use a write-protected unique tag whose resolved digest matches the release record. Retain prior release images and their environment/configuration records.

Use an App Service staging slot when the selected plan supports it; Standard, Premium and Isolated tiers support deployment slots. Otherwise define a separate staging app. Validate the selected release before production promotion, preserve environment-specific settings and verify slot identities/network access independently. Retain the prior image/configuration for rollback; an application rollback must not attempt to reverse database writes automatically. See [App Service staging slots](https://learn.microsoft.com/en-us/azure/app-service/deploy-staging-slots).

Release checks cover the actual container through Azure ingress: CSS/fonts/images, source-bound capability/mechanic/provider pages, SCL drill-down, authorized media delivery, form submission, authenticated server actions, spoken-intent submission and job reconnection. Staging is excluded from indexing and uses controlled accounts/data. A deployment receipt records source commit, image digest, build/test results, publication schema and tested generation, provider binding, deployed release and rollback target. A successful push to ACR alone is not a successful deployment.

### 8.7 Runtime configuration, state and service boundaries

Environment-specific service URLs, credentials and storage endpoints are resolved on the server at runtime. `NEXT_PUBLIC_*` values are embedded during the Next.js build, so use relative URLs or an explicit nonsecret runtime configuration response when values must differ between staging and production. This preserves one-image promotion. All instances use the same build; coordinate cache invalidation and server-action key/version behavior before scale-out. Keep authenticated pages uncached and test client recovery across deployments. See [Next.js self-hosting](https://nextjs.org/docs/app/guides/self-hosting).

SQL remains the durable store for generated image bytes and their bindings. Drafts, sessions, generation jobs, inquiry delivery and artifacts use durable services outside the web container. Local files/cache are disposable; a restart must not lose a draft, generated original or job. Gemini/SCL/Nano Banana workers have independently managed runtimes and job lifecycles; the web process does not become their durable scheduler. Validate production network/DNS/auth access to those services without relying on `C:\lab` paths.

`/healthz` reports process health with no secrets, redirects or sign-in requirement. `/readyz` reports whether the web process has a usable validated publication/configuration; it does not call an LLM or run capability effects. Wire the appropriate Azure health/warm-up checks explicitly. Monitor authoring, media and database dependencies separately so a provider outage does not erase usable public content. Emit structured logs to stdout/stderr, retain deployment/job correlation IDs, and verify graceful termination plus bounded request/job handoff on restart. Test event streaming through ingress or use the existing bounded-polling fallback.

---

## 9. Phased Roadmap

| Phase | Scope | Exit criteria |
| --- | --- | --- |
| P1 — Estate and IDE launch | All P1 routes in §4; capability/mechanic/provider catalogs and detail; voice/text IDE; candidate circuit; authority/available-embodiment downloads; launch docs; database media storage and entity images; responsive design; Linux container via ACR and App Service | Published generation/assets and container validated; every public capability opens its circuit; core images round-trip through SQL; intent/export and independent-use checks pass; forms deliver; accessibility/metadata pass; staging promotion and rollback verified |
| P2 — Learning and knowledge | Training hub + four courses, `/latest`, `/platform/knowledge`, governance campaign redirect; linked YouTube/lesson content | Courses enrollable; six reviewed articles; knowledge integration demonstrated; navigation/structured data enable only published destinations |
| P3 — Growth | `/pricing`, expanded reference docs, operations console bridge, partner/contributor pages, advanced SCL editing/lenses | Packaging and pricing live; expanded integrations have their own evidence and migration paths |

P1 sequencing: (1) publication adapter, source contracts, additive media storage and container build contract; (2) capability/mechanic/provider browsing, circuit inspection and launch docs; (3) Gemini conveyor, spoken input, draft persistence and exports; (4) core entity artwork, accessibility, ACR/App Service staging and deployment evidence. Core circuit display must work before enhanced images finish generating. These are implementation milestones within P1, not separate claims that launch functionality is already available.

Website launch depends on the documented integration contracts and compatible runtime artifacts. If an integration gate remains open, report P1 as incomplete rather than silently changing the CTA into a contact form or presenting a canned draft as live authoring.

---

## 10. Decisions and Release Dependencies

Settled for this revision: **Own your capabilities** is the primary tagline; **Semantic Intent-Driven Engineering Effects** is the brand expansion; IDE uses **intent-driven environment** with the design variant explained; `/build` is the launch CTA; catalog, circuits, exports and minimum docs are P1; pricing is P3; Plausible is the analytics default; the estate drives capability content; Gemini Pro authors candidate circuits; Nano Banana supplies capability imagery; SCL supplies circuit semantics and deterministic visual projection.

Hosting is settled as **Container + Linux on Azure App Service**, with Next.js standalone output, ACR distribution and one tested image promoted between environments. Semantic authority, durable media and provider configuration retain their distinct identities. Formal admission of a Website Capability and cross-provider Cross-Apply evidence remain future capability work; this hosting decision does not assert those results.

The supplied portal summary establishes the intended existing app: **`sidefx` → `sidefx_group` → East US 2 → `ASP-sidefxgroup-ad2e` (P0v3, one instance)** in the BPM Software Solutions subscription (§8.5). Its current image is the Microsoft static-site starter. Website image deployment, configured health checks and the `sidefx.io` / `www.sidefx.io` domain setup remain release work.

| Remaining dependency | Owner role | Required by |
| --- | --- | --- |
| Public capability scope and claim/evidence records, with private fields excluded | Product/content owner | P1 publication |
| Production estate publication service, artifact store, network access and refresh ownership | Platform engineering | P1 integration |
| Verify the supplied Azure app/plan binding and container mode; configure ACR, app/slot identities and staging, DNS/HTTPS, health checks, deployment identity and service connectivity | Platform engineering | P1 staging deployment |
| Production Dockerfile, lockfile/base-image pins, standalone asset closure, tested image digest, promotion/rollback workflow and runtime configuration | Website/release engineering | P1 deployment |
| Existing Gemini Pro conveyor endpoint/identity, input/output contract and exact deployment model; speech adapter and account quotas | Authoring platform owner | P1 integration |
| Candidate-to-authority/export and target realization adapters; verified SDA public URL/license/release; own-architecture example | Capability/runtime owner | P1 ownership proof |
| Authentication/session implementation, authorized artifact access and configured sign-in callback | Website engineering | P1 private workspace |
| Exact Nano Banana model availability, batch budget, asset review and publication coverage | Visual production owner | P1 public capability images |
| Additive SQL media schema/service, semantic-object bindings, byte storage/retrieval and restore proof | Data/platform engineering | P1 capability/mechanic/provider imagery |
| Legal entity identity, approved legal copy, data retention/consent configuration, sales recipient and fallback address | Business owner | P1 release |
| Founder portrait, attributed quotes, verified YouTube channel and episode destinations | Brand/content owner | Before those assets publish |
| Training checkout, curriculum, assessment and completion credential | Training owner | P2 |

These are concrete implementation/release dependencies, not permission requests to edit this specification. None is treated as already resolved by this document.

---

## 11. Capability Estate as the Website Content Source

### 11.1 Source and publication boundary

`C:\lab\sidefx-database` contains a normalized SQL Server inspection projection of the estate. Its `model`, `source`, `analysis`, and `sidefx` schemas preserve identities, definitions, lineage, findings, and selected-model views. The underlying capability authorities remain the semantic source; the inspection database supplies the website's estate content.

The website must consume a versioned publication projection of that selected model. Public browsers never connect directly to SQL Server. A deployment build or trusted publication service reads through the restricted reader boundary, applies the publication allow-list, validates the complete artifact set, and publishes immutable JSON plus approved media copies to a web-accessible store. The database retains the generated originals, derivatives and bindings under §11.5. Pages can render published copies without a live local database connection.

Creation follows a separate path: authenticated IDE → existing authoring conveyor → candidate workspace → applicable authority/realization lifecycle → estate ingestion → selected inspection model → reviewed website publication. Website CRUD must not edit normalized authority tables or advance the database's selected-model pointer. Private drafts are visible immediately in their own workspace and do not wait for the public estate refresh.

### 11.2 Data mapping

The following existing surfaces are inspected integration inputs. The web projection and adapters are new implementation work.

| Website content | Database source | Projection rule |
| --- | --- | --- |
| Capability identity, name, namespace, revision | `sidefx.v_capability`, `model.identity_namespace`, retained capability definition and version labels | One record per selected capability definition; resolve the namespace key explicitly and preserve semantic ID |
| Scenarios and input/event/outcome | `sidefx.v_scenario`, `sidefx.v_complete_scenario`, normalized scenario members | Join through exact scenario version ownership; expose incomplete references |
| Mechanics, definition profiles and readable presentation | `sidefx.v_mechanic`, `sidefx.v_mechanic_version`, selected semantic definitions plus reviewed editorial metadata | Preserve identity/definition grain, distinguish atomic mechanics from provider-declared vocabulary, and keep source naming gaps visible |
| Providers and declared implementation | `sidefx.v_provider`, `sidefx.v_provider_implementation` for ports/mechanics; `model.provider_capability_implementation` scoped through selected definitions | Distinguish provider identity from capability identity and from an operating binding; preserve the implementation relationship's exact grain |
| Bindings and qualifications | `sidefx.v_provider_binding`, `sidefx.v_provider_qualification_assessment` | Absence means unknown/unassessed; never default to active or qualified |
| Blueprint nodes/routes and integrity | `sidefx.v_circuit_cell`, `sidefx.v_circuit_route`, `sidefx.v_circuit_integrity_findings` | Use the exact source profile; missing authority or endpoint resolution prevents a full qualified graph |
| Target requirements and resolution | `analysis.v_scenario_embodiment_requirement`, `analysis.v_scenario_language_resolution`, `analysis.v_scenario_embodiment_readiness` | Scope to selected capability/scenario/target; readiness is distinct from executable artifact and proof |
| Lineage, assessment and coverage | `sidefx.v_definition_lineage`, `sidefx.v_assessment_coverage`, `sidefx.v_load_completeness`, `sidefx.v_source_reference_gap` | Preserve generation, findings, and evidence scope; expose only approved public fields |
| Exact authority for export/adapter input | Retained source bytes through the documented capability-embodiment query | Verify original identity/digest semantics; retain required dependency closure |
| Generated images and derivatives | Proposed `media` schema (§11.5), keyed through real semantic object/definition FKs | Persist bytes and lineage in SQL; publish only reviewed, authorized exact-revision copies |
| Art direction, narrative, videos and learning material | Reviewed content-creation contracts and asset manifests keyed by entity identity/revision | Supplement source facts without replacing authority; ingest generated image bytes/provenance through the media service |

The database documents a 219-capability managed estate and 824 scenarios, while the content-lab SCL corpus documents 219 capabilities and 823 scenarios for its frozen scope. These are reference observations, not live website counters. The adapter must reconcile exact identities, scope and hashes before reusing a circuit or asset. It cannot assume that equal capability counts imply equal generations.

Database coverage also documents unresolved blueprint authority references and incomplete scenarios. Preserve those findings. A normalized table load or `CAN_ATTEMPT_EMBODIMENT` result cannot fill missing topology or upgrade evidence. Query the selected model at publication time; do not hardcode the documented historical counts into copy.

The 2026-09-08 live inspection confirmed **191 mechanics, 74 providers and 314 declared provider–mechanic relationships**; all 191 pasted mechanic IDs matched. The source breaks down into 36 semantic-value mechanics, 18 effect mechanics and 137 platform-provided mechanics. The last group has provider relationships but lacks display names. Atomic language-registry resolution remains a distinct surface; zero rows in this relationship table does not establish that an atomic mechanic has no implementation.

There are 219 selected managed capabilities and another 70 selected platform capability identities: 289 capability identities across 304 definitions. Keep these scopes separate in counters and publication selection. This produces 484 core image subjects for managed capabilities + mechanics + providers, or 554 including platform capability identities. Selected scenario face members total 824; 35 blueprints have 449 normalized nodes and zero normalized edges. These observations inform production coverage and boundary-view behavior, not universal execution claims. The [inventory and storage design](C:/lab/sidefx-database/docs/website-visual-assets.md) retains scope, query and generation details.

### 11.3 Proposed publication contracts

Define strict, versioned contracts under `contracts/`. Field names below are website projection fields, not assertions that identical database columns already exist.

| Contract | Required content |
| --- | --- |
| `EstatePublication` | Publication ID; selected model/snapshot/mapping identity; source and generation timestamps; schema/adapter versions; capability/mechanic/provider indexes; source and visual coverage; database asset revision IDs/hashes; publication review; atomic release manifest |
| `CapabilityPage` | Namespace/capability ID; stable URL key; definition revision/digest; title/promise/domain; scenarios with exact ownership; provider responsibilities; target availability; source/claim/evidence references; related identities; circuit and visual manifests; public download eligibility |
| `CircuitProjection` | Capability/scenario identity; source profile and exact source digest; SCL version; graph digest; renderer/grammar versions; selected lens; node/edge identities; diagnostics; evidence basis; clean SVG; optional enhanced SVG and illustrative motion bindings |
| `EntityPage` | Object kind, namespace, semantic identity and exact definition; readable presentation and provenance; kind-specific mechanics/provider relationships; source evidence/availability; media selection. CapabilityPage specializes this with scenarios, circuits and exports. |
| `EntityVisual` | Semantic object/definition identity (or explicit private draft binding); visual purpose; source content-contract digest; database asset/revision/blob IDs; actual Nano Banana provider/model and request lineage; original/derivative hashes; alt text; dimensions; review/generation state. This generalizes the earlier capability-only visual contract. |
| `CapabilityExport` | Capability/revision; candidate or authority status; authority and dependency manifest; target artifacts; invocation/setup instructions; checksums; licenses; scoped evidence; unresolved requirements |

Preserve availability dimensions separately: website route/content published, authority state, source evidence basis, graph fidelity, provider binding/operation, target readiness, executable artifact availability, and image production status. Map source status to a readable explanation while retaining its exact value in the inspector. Unknown stays unknown.

Editorial MDX selects records by stable identity, optionally pinning a revision for a tutorial. It may provide a reviewed title, introduction, or teaching sequence; it cannot override a source status, invent an edge, or change a provider result. No giant embedded JSON blob or raw source dump is sent to every page: catalog summaries, detail records, scenario lenses, and evidence are loaded at their appropriate scope.

### 11.4 Publication, refresh and failures

1. Resolve the selected model and read one consistent generation using the existing pinned reader or equivalent snapshot transaction. Do not assemble a page from separate unpinned reads of a changing current-model view.
2. Resolve the explicit public capability/field allow-list. Exclude private drafts, contact data, prompts, recordings, credentials, internal source paths, and restricted authority/provider material. Artifact access is checked independently of page visibility.
3. Validate joins, source hashes, scenario ownership, evidence scope, graph profile support, export eligibility, and asset bindings. Inspect row-limit/truncation flags; a truncated result is never a complete estate.
4. Compile source-bound SCL/circuit artifacts and select reviewed capability art. Invalid records retain diagnostics in the production report; a public record needs the permitted boundary/full view described in §12.2.
5. Build the complete release manifest and atomically select it. Routes, metadata, cards, counts, assets and downloads bind to that publication. Retain the previous valid release for rollback.
6. Refresh after an estate publication event, with a periodic reconciliation job for missed events. Pin the generation during each build. Refresh cadence and maximum acceptable age are deployment configuration, monitored and recorded with the release.

On source or build failure, retain the last valid publication and record its actual observation date; do not replace it with an empty catalog or silently merge generations. Surface stale-data status when the configured age is exceeded. With no valid publication, show an unavailable state and disable dependent actions. Treat removal or access revocation urgently: withdraw public routes/artifacts and invalidate caches rather than preserving access through stale content. A permitted withdrawal returns an appropriate 404/410; avoid revealing private identity existence.

Independent-use downloads resolve a pinned export manifest and immutable artifact hashes. A selected artifact that is missing, unauthorized or stale fails with a clear recovery action; it never falls back to a different revision. Owned private exports require authentication and per-resource authorization.

### 11.5 Database-backed visual assets

**Store generated image bytes in the database.** Retain original provider outputs and each reviewed derivative as content-addressed binary objects, with media type, decoded dimensions, byte length, SHA-256 and provenance. Use an additive `media` schema; generated art does not become captured source testimony or an amendment to immutable semantic definitions. A provider URL, local path or CDN URL without committed bytes is an incomplete image job.

Bind images through the existing `model.semantic_object` and exact `model.semantic_object_definition` keys. Capabilities, mechanics, providers, scenarios, blueprints and other modeled subjects already share these identities. Enforce definition-to-object ownership with real foreign keys; do not use an unchecked entity-type/text-ID pair. Private draft bindings belong to the implemented workspace revision store until an exact semantic binding exists.

The [storage design](C:/lab/sidefx-database/docs/website-visual-assets.md) specifies proposed blob, generation request, asset/revision, typed source/derivation, entity binding, review, visual requirement and approved-selection relations. A versioned `varbinary(max)` blob retains the bytes; append-only review and transactional current selection retain publication history. Store prompt/model/reference provenance without secrets. The media schema is proposed implementation work, not an existing image store verified by this review.

Track a visual requirement before an image exists, so every capability/mechanic/provider appears in coverage totals. Original, composite, catalog crop and sharing image are related revisions with exact parent/source bindings. Shared component material can be reused while each core entity retains its own illustration. Meaning changes mark affected bindings stale; historical posts/videos retain their pinned image revisions.

Catalog endpoints return metadata and approved media identity; binary streaming is separate and authorized. Publish hash-addressed CDN copies from SQL as needed, with correct type, caching and revocation. The database remains sufficient to reconstruct published images. Atomic ingestion/selection, idempotent requests, scoped access and existing-image fallback prevent broken or cross-workspace media on failure.

Acceptance includes exact-byte round trips for originals, derivative lineage, wrong-entity binding rejection, duplicate slot/race handling, failure recovery, and a backup/restore that preserves bytes and portable semantic identity. Estate refresh must not purge media or cascade-delete its history. Validate the exact required generation and review state before marking a production image ready.

---

## 12. SCL and the Estate Visual Product System

### 12.1 One semantic source, coordinated visual products

Every capability has two linked visual deliverables:

1. **Interactive circuit:** SCL projected into deterministic SVG and an accessible inspector, displayed whenever an existing capability is opened or a new valid candidate is created.
2. **Capability-specific image:** generated through Gemini Nano Banana from the capability's reviewed visual direction, used in the catalog, detail hero, sharing, and related content. It is distinct artwork for that capability, even when canonical component materials are reused.

Every mechanic and provider also has a dedicated generated image, stored through the same database media registry. Mechanic images express a declared responsibility; provider images identify the declared implementer and role. Their inspectors retain typed SCL symbols when embedded in circuits. Additional subject types and reuse rules are defined in §12.7.

The production sequence is:

```text
Source capability authority OR versioned candidate design
  → verified source adapter / SCL candidate graph
  → validated typed graph and selected lens
  → deterministic SVG topology, labels, status and evidence
  + capability-specific Nano Banana art and reviewed component materials
  → reviewed composite, responsive image derivatives and circuit viewer
  → optional illustrative flow / source-bound YouTube and lesson assets
```

The Gemini Pro **authoring conveyor** proposes circuit meaning. The Nano Banana **image workflow** supplies visual material. Their jobs, output contracts and evidence are separate. Generated pixels never supply the canonical graph. The original authority and clean SVG remain recoverable independently of the image treatment.

### 12.2 Language and fidelity

Adopt the content lab's implemented **SCL 0.2** Lite and canonical forms for new candidate authoring; preserve **SCL 0.1** for compatible estate reveals. Pin parser, JSON Schema, graph, grammar, renderer, and source versions. Preserve authored text and exact diagnostics through edits; do not silently migrate saved drafts.

Existing capsule/blueprint/runtime testimony remains source authority. An SCL reveal is a source projection; authored SCL is a candidate design until the applicable capability authority boundary accepts it. A visual layout edit changes presentation only. A semantic edit must produce a versioned SCL/graph change, validate it, and recompile all affected projections. Free-form visual semantic editing and richer lenses require their own adapters and are P3; conversation and supported SCL editing are P1.

| Lens | Required behavior |
| --- | --- |
| Capability overview | Show the capability promise and owned scenarios; summarize I/E/O and declared relationships without inventing an order between scenarios |
| Scenario | Default detailed view: Input → Event → Outcome, with expected human experience separate from the data product |
| Execution/mechanic/provider | Descend only through explicit source membership or a supported adapter; show native records and profile when deeper visualization is unsupported |
| Evidence | Show attributable sources and unresolved obligations, with their actual declared/observed/target/gap/staging basis |
| Draft revision | Show the latest valid candidate and its source revision; a failed edit retains the prior valid circuit with a visible revision mismatch notice |

**Every open capability gets a circuit view.** If full topology cannot be qualified, render its source-backed I/E/O boundary lens, retaining unresolved references and a clear **Boundary view — detailed topology incomplete** explanation. Draw known members and valid declared edges only. If even a boundary member is missing, show a partial boundary with an unresolved slot, not an invented mechanic. Do not substitute another capability's picture or a generic graph.

For a newly submitted intent with no valid candidate yet, keep the circuit pane visible with the retained intent and **Designing circuit** state. A parser failure shows diagnostics and retry/edit controls. Render the actual candidate as soon as validation produces a supported graph; do not animate speculative streaming fragments as valid topology.

### 12.3 Semantic and geometric laws

- Use the existing fifteen canonical primitives and seven typed route families from the grammar. Capability cards and inspector panels compose these primitives; new composite visual profiles must identify their supported semantic carrier.
- Keep Input/Event/Outcome and responsibility/experience visible across supported altitudes. In 0.2, altitude and visual plane are independent; do not claim that all five planes already have separate rendered bands.
- Distinguish single-choice branch/decision, all-branch fan-out, and convergence with explicit all/any/quorum policy. Match actual arm counts, endpoints and route identities.
- Product transfer requires matching outcome/input contract identities. Provider binding, authority, dependency and evidence links retain their types and cannot be inferred as execution flow.
- Validate reachability, endpoint identity, ownership, guards, joins and explicit bounded retries under the supported SCL profile. Native recurrence/cancellation outside that profile stays inspectable and unsupported for motion rather than being flattened into a fabricated DAG.
- A terminal has no outgoing execution or product-transfer route. Its inspector can link to evidence without continuing the circuit. Failure and fulfillment captions display the actual disposition; color, a check icon or a reached outcome cannot establish proof.
- Use the compiler's shared port/junction geometry for both glyphs and routes. Preserve contact and tangent checks, clear crossing treatment, label clearance, graph bounds, and source IDs across base/enhanced renderings.
- Keep evidence basis distinct from lifecycle labels. New workspace job states do not become new SCL evidence enums. A candidate provider is not an active provider; an unassessed embodiment is not conformant.

The supplied PNGs guide depth, material, hierarchy and drill-down affordances. Their example IDs, metric values, `READY`, `ACTIVE`, `PROVED`, and `VERIFIED` labels are not source facts. Resolve specific reference conflicts in favor of the typed graph: the failure-terminal image's **CONTINUES GRAPH** cue must not become outgoing terminal flow; the provider-node image's flow cue must not convert a provider-binding relation into execution. The junction reference must not collapse branch, fan-out and decision into one interchangeable glyph. Reuse the compiled symbol atlas's canonical masks over raw generated silhouettes.

### 12.4 Viewer and flow interaction

Opening a capability selects its overview and a meaningful initial scenario. Selecting a scenario, node or supported altitude preserves capability identity, revision and evidence context. Supply fit, zoom, pan, search within the circuit, a text outline, legend, node details, source inspection, Base/Material appearance and SVG/PNG export. Back navigation restores catalog filters and scroll.

Reuse `templates/circuit-flow.js` from the content lab through a pinned integration. The silver sphere follows exact compiled edge paths and junction arms. Fan-out emits the declared branches; joins wait for the required arrivals; decisions take only the selected illustrative alternative. Support links do not carry execution spheres. Refuse unsupported retries or traces rather than inventing their iteration or timing.

Playback begins only on **Play flow**. Pause/resume, replay, seek and speed preserve deterministic viewer state. Base/Material switching retains selection, zoom and flow time. Reduced motion advances to event boundaries. Hiding/leaving the page stops motion; node inspection pauses it. Label this mode **Illustrative flow**. A future observed-execution overlay requires a trace bound to actual execution evidence and timestamps, with clear missing-event handling.

Public reading and the text explanation remain available without JavaScript. The IDE's interactive functions can require JavaScript, with a clear explanation and access to the read-only example/docs when it is unavailable. Large graphs load at capability/scenario scope and use drill-down rather than rendering the entire estate in the homepage bundle.

### 12.5 Nano Banana image production

Use the existing `content-creation-mission` preparation, generation, review, compositing and receipt pattern. The local component generator currently selects `gemini-3-pro-image`; record the actual configured model and verify account availability when implementing production. Nano Banana remains the requested image provider; a model change is an explicit production configuration change, not an invisible fallback.

Maintain a dedicated visual requirement and asset binding for every capability, mechanic and provider in the selected estate, plus every created capability draft, including nonpublic subjects. Publication eligibility controls visibility, not whether the entity needs its own image. External image requests use only fields authorized for that generation job. The same registry supports scenarios, blueprints, contracts and ports when their presentation requires distinct art.

For every capability in that inventory:

1. Bind the exact semantic subject and definition (or private draft revision), audience, visual role, permitted claims and source content contract. For capabilities, include the promise and selected scenario; for mechanics, the declared responsibility; for providers, their declared implementations. Author distinct visual direction for each core entity; a shared atlas alone does not satisfy its image requirement.
2. Prepare a request with the visual purpose, reference image hashes, semantic exclusions, composition and aspect ratio. Generate capability art separately from reusable component material plates. Do not ask the image model to invent executable wiring, provider state, proof badges, metrics or lettering.
3. Run durable, bounded Nano Banana jobs. Persist request identity, actual model, source/direction hashes, original image bytes and digest through the database media service (§11.5). A provider response or temporary file is not completion until storage commits. Reuse an identical completed request only after verifying the stored bytes. Handle quota/429 and retryable server failures within a bounded policy; reconcile uncertain outcomes before reissuing a billable request.
4. Inspect source fidelity and visual quality; retain rejection reasons and approved image hashes. Composite materials through canonical masks and keep deterministic labels, symbols and evidence markings on top. Keep decorative overlays outside text exclusions and remove them to recover the base SVG.
5. Produce the subject's required formats: 1:1 entity card, detail portrait/explainer, and 16:9 or 1200×630 teaching/sharing derivative where used. Store derivative bytes and parent revision links in the database, plus responsive dimensions and alt text. Crops preserve the intended meaning and never sever semantic graph relationships; use a different composition where needed.
6. Publish `EntityVisual` with the matching capability, mechanic or provider record. Track coverage by subject kind, definition, purpose and format across required, queued, generating, review required, ready, failed and stale states. All published core entities require their own reviewed image. Created private capabilities enqueue their own image after the first valid candidate; later meaning changes invalidate affected bindings.

Image generation must not delay circuit inspection or semantic editing. Show the deterministic circuit and **Artwork preparing** while generation is pending; on failure retain the circuit, status and retry action. A placeholder is a transient state, not fulfillment of the dedicated image requirement. Private candidate art remains private until its publication is authorized and reviewed. Changing a private draft must not update a public page's image.

For a mechanic/provider with no circuit of its own, show its typed symbol, source-derived details and artwork state while generation runs. Reuse the approved entity image across its appearances; a click loads its existing asset instead of launching a new generative request. Generated provider art is labeled illustration and cannot substitute for an official logo or imply affiliation.

### 12.6 SCL refinement and acceptance

Perfect the website's visual language through a shared reference suite, with compatibility preserved:

| Fixture | Acceptance |
| --- | --- |
| Simple I/E/O and a complete SCL 0.2 Lite draft | Clear reading order, responsibility/experience preserved, text/JSON round trip |
| Selection, fan-out, ALL/ANY/quorum convergence | Correct typed glyphs, exact arms, guards, arrival policies and readable branches |
| Fulfillment and failure terminals | Distinct dispositions, no outgoing execution, evidence links inspectable |
| Provider requirement, candidate, bound/unknown state | Port/fulfiller distinction and no fabricated operating state |
| Legacy or unresolved estate source | Honest boundary view, retained source records and repair findings |
| Existing SCL 0.1 and 0.2 references | Preserved canonical identities, source hashes and meaning after integration |
| Large capability on narrow screen | Navigable scenario view, zoom, outline, keyboard inspector, readable labels |
| Base/enhanced/image exports | Same IDs, topology, status and evidence; masks preserve text and source geometry |
| Voice-generated draft and invalid revision | Valid circuit appears, diagnostics locate errors, prior valid revision and user intent survive |

Release the grammar/renderer integration with explicit versions, visual reference comparisons, semantic and geometry checks, and manual accessibility review. Improving materials or layout cannot silently revise language semantics. Broader visual editing, C4 lenses and full native execution animation remain separately specified extensions.

### 12.7 Visual coverage by entity kind

| Entity kind | Required image/view | Reuse and fidelity |
| --- | --- | --- |
| Capability | Dedicated Nano Banana image plus deterministic SCL circuit | Exact authority/draft revision; retain source-backed boundary view when topology is unresolved |
| Mechanic | Dedicated responsibility/transformation image and readable detail | One reusable image per approved subject/definition binding; show concrete I/O only when its contract supports it |
| Provider | Dedicated provider portrait/tile and declared implementation detail | Reuse across every bound/declared occurrence while keeping status independent of the art |
| Scenario | I/E/O circuit and an image when featured in teaching/detail | Exact capability owner and scenario revision; share the capability image only as an explicitly related image |
| Blueprint | Source-derived graph, optionally with generated material | Geometry is deterministic; zero normalized edges is not a blank check for image-generated wiring |
| Port, contract, input/event/outcome, authority, evidence, profile | Typed symbol plus an entity-specific image where a page or lesson requires one | Extend through the shared semantic identity registry; repeated primitive occurrences do not each require an AI job |

The requirement registry is the coverage denominator, including missing images. Capability/mechanic/provider images are mandatory; further kinds have explicit art requirements when surfaced. Derivative counts and repeated circuit occurrences are reported separately from unique subjects. This keeps the estate's reusable parts visible without multiplying identical generation requests.

---

## 13. Spoken Intent, Gemini Pro Conveyor, and Ownership Workflow

### 13.1 User journey

1. **Describe:** open `/build`, type or press **Speak your intent**, and describe the capability. Show a visible recording indicator, stop/cancel controls, and an editable transcript. Ask for microphone access only when activated; typed input remains available. Do not retain raw audio by default; explain the configured transcription processing and retention before capture.
2. **Resolve the need:** retain the transcript and any user-selected marketplace/project context. Search permitted estate precedents and show reuse/composition candidates. Resolve ambiguous company/project identity, expected outcome, data freshness, provider and environment requirements through focused questions. The user can revise the intent without losing context.
3. **Design:** **Design circuit** submits the reviewed intent to the Gemini Pro authoring conveyor. An authenticated account is required before persistent/billable authoring; sign-in preserves locally held input and returns to the same composer. Do not put prompts or recordings in the sign-in URL. Existing users continue directly.
4. **Inspect:** the first valid candidate opens in `/workspace/capabilities/[draftId]` and displays its circuit. Show inputs, actions, outcomes, provider responsibilities, dependencies and unresolved obligations in plain language. A new owned capability draft and its image job are created with stable identity.
5. **Refine:** speak/type a change or edit supported SCL, retaining a revision history. Each change is a candidate revision; validation diagnostics explain required repairs. Apply only responses bound to the intended base revision; a late job result cannot overwrite newer work.
6. **Verify and realize:** select intended targets and providers, supply authorized credential references through dedicated controls, and invoke the existing lifecycle/realization boundaries where supported. Show source-derived readiness and exact results. Designing or playing a circuit does not invoke the external provider.
7. **Own:** download candidate design artifacts at any time after valid compilation, or semantic authority and available embodiments once produced through their applicable boundaries. Follow `/docs/ownership` to manage, invoke and use the capability with SDA or a customer-owned architecture. Public publication is a separate explicit action and is not automatic on creation.

### 13.2 Authoring service contract

Reuse the user's existing **Gemini Pro LLM conveyor** through a backend adapter. Resolve its actual capability/endpoint identity and protocol during implementation; this document does not invent a command or claim the website binding exists. The configured model can evolve, but every result records the actual provider/model and request lineage.

| Boundary | Proposed website requirement |
| --- | --- |
| Request | Authenticated owner/workspace; idempotency key; intent/transcript; draft/base revision; requested outcome; selected precedent/provider references; pinned permitted estate generation; target preferences; supported SCL/schema versions |
| Context | Minimum authorized source contracts, scenarios, provider requirements, relevant examples and open obligations; never indiscriminate estate dumps or embedded secrets |
| Response | Job/draft/revision identity; candidate SCL or a supported candidate graph carrier; promise/scenarios; source references; provider slots/candidates; unresolved questions; model/provenance; structured diagnostics |
| Validation | Parse/schema checks; typed graph and reference validation; source ownership and access; supported profile/target checks; separate evidence basis and lifecycle state |
| Outcome | Valid candidate and deterministic circuit, clarification request, repairable failure, unsupported request, or cancelled job; no silent rewrite into an unrelated capability |

Validate model output before storing it as a usable candidate or rendering inline SVG. Treat provider descriptions and imported text as data, not instructions granting authority. Unsupported output retains a diagnostic and bounded repair context; the integration cannot repair source facts by inventing them. The server obtains artifact bytes from trusted compiler output, sanitizes active content at the web boundary, and restricts external resource loading.

The web adapter may enqueue jobs, format supported requests, normalize responses and enforce access. Capability-specific semantic authoring, provider integration and realization belong to the existing capability system; do not implement separate scenario logic in Next.js server actions or infer executable code from an image.

### 13.3 Jobs, state and recovery

Define durable job records with owner, operation, request digest, base revision, phase, progress, result references, attempts, timestamps and cancellation state. Suggested website job phases are **queued → resolving → authoring → validating → rendering → ready**, with **needs input**, **failed**, and **cancelled** branches. These are job states, not SCL evidence values or capability admission claims.

Progress arrives through authenticated events or bounded polling. Reopening a workspace resumes the same job. Identical idempotent requests return the existing result/job; retry behavior follows the conveyor's contract. Preserve edits during network loss and warn about conflicting revisions before applying results. Cancellation stops further stages where possible and records any already completed external operation without claiming it was undone.

Separate authoring, transcription, image, validation/realization and export jobs. Each has its own quota, timeout, result, and retry policy. A Nano Banana failure does not discard a valid circuit; an export failure does not change authority; a missing provider credential does not erase intent. Show a useful next action for microphone denial, sign-in failure, expired credentials, quota limits, unsupported provider, malformed model output, unresolved contract, network timeout and unavailable artifact.

External-provider invocation is an explicit user action scoped to the selected capability, revision, input and environment. Present the requested action and required provider account/configuration; invoke through the existing authorized runtime. Keep design preview and illustrative flow usable without invoking a provider. Retain only permitted request/evidence fields and never expose secret values in graph labels, logs, URLs, downloads or analytics.

### 13.4 Required example journeys

**Quote retrieval**

Spoken example: **"Connect to Yahoo Finance and retrieve stock prices for company X via RapidAPI marketplace."** Preserve this as the user's desired integration. Resolve the company to an explicit symbol/exchange and clarify the needed quote fields and freshness. Look up an actual eligible marketplace listing and its documented provider identity; a Yahoo-related name does not establish official Yahoo affiliation or available access.

The candidate expresses symbol/exchange input, a quote-retrieval responsibility and provider port, response validation, a quote product with timestamp/currency/provenance, and an experience such as **The user can inspect the requested company's quoted price and its freshness**. Auth, quota, unavailable symbol and provider failure paths must reflect the selected contract. Leave unknown behavior as an open obligation. Do not fabricate prices, endpoints, credentials, a working subscription or a completed integration. This example requests retrieval only; no trading action is implied.

**CNCF component integration**

Spoken example: **"Connect to X component on landscape.cncf.io."** Resolve the actual project and the action the user wants; a project name alone is insufficient capability intent. Use the project's own API/interface and deployment documentation to identify a provider responsibility, contracts and environment requirements. The CNCF landscape is a discovery source, not a universal callable API or evidence that every listed component is remotely hosted.

Both examples must demonstrate typed and spoken entry, retained transcript, precedent/provider resolution, visible candidate circuit, unresolved requirements, revision, and a source-bound image job. They remain target acceptance scenarios until the real website/conveyor path is demonstrated. The ownership quickstart uses whichever supported example has an actual export and independent-use evidence; do not publish an unverified example as operational.

---

## 14. Source References and Review Closure

### 14.1 Local references

Read during the 2026-09-08 specification update. Recheck versions and source hashes during implementation; local documentation and observations are not a live product verification.

| Reference | Role |
| --- | --- |
| [SideFX Database README](C:/lab/sidefx-database/README.md) | Normalized source, restricted reader, selected model and mutation boundary |
| [Data load and coverage](C:/lab/sidefx-database/docs/data-load-status.md) | Documented inventory, generations, target declarations and remaining gaps |
| [Scenario embodiment](C:/lab/sidefx-database/docs/scenario-embodiment.md) | Source-to-target inspection, readiness/proof distinction, observed lab scope |
| [Capability authority query](C:/lab/sidefx-database/sql/diagnostics/capability-embodiment.sql) | Retained source export for existing SDA adapters |
| [Live visual inventory query](C:/lab/sidefx-database/sql/diagnostics/website-visual-inventory.sql) | Executed selected-model counts, mechanic/provider relationships, scenario faces and blueprint coverage |
| [Database visual asset design](C:/lab/sidefx-database/docs/website-visual-assets.md) | Observed inventory and proposed binary image storage, semantic bindings, provenance, selection and recovery |
| [Content creation mission](C:/lab/repos/content-creation-mission/README.md) | Reusable content and media production system |
| [SCL design brief](<C:/lab/repos/content-creation-mission/docs/sidefx-circuit-language (SCL).md>) | Intent → circuit → effect direction; proposed broader language surfaces |
| [SCL 0.1 compatibility specification](C:/lab/repos/content-creation-mission/docs/SCL-SPECIFICATION.md) | Frozen estate reveal, semantic rules, native retention and limitations |
| [SCL 0.2 specification](C:/lab/repos/content-creation-mission/docs/SCL-0.2-SPECIFICATION.md) | Implemented Lite/canonical candidate authoring and diagnostics |
| [Infographic compiler](C:/lab/repos/content-creation-mission/docs/INFOGRAPHIC-COMPILER.md) | Deterministic grammar, geometry, source validation and exports |
| [Circuit flow](C:/lab/repos/content-creation-mission/docs/CIRCUIT-FLOW.md) | Exact path playback, join semantics and illustrative timing |
| [Capability visual product system](C:/lab/repos/content-creation-mission/docs/CAPABILITY-VISUAL-PRODUCT-SYSTEM.md) | Content/circuit/material composition contracts and page behavior |
| [Material enhancement workflow](C:/lab/repos/content-creation-mission/docs/INFOGRAPHIC-ENHANCEMENTS.md) | Nano Banana preparation, generation, masks, review and receipts |
| [Gemini generation strategy](C:/lab/repos/content-creation-mission/docs/gemini-generation-strategy.md) | Provider configuration, source fidelity, resumability and review |
| [Component generator](C:/lab/repos/content-creation-mission/scripts/generate_component_assets.py) | Existing Nano Banana component-material generation boundary |
| [Section asset adapter](C:/lab/repos/content-creation-mission/scripts/production_section_assets.py) | Source-bound per-content art direction and generation pattern |

The supplied `docs/CIRCUIT-FLOW/.md` path does not exist. The matching reference is `docs/CIRCUIT-FLOW.md`, linked above. SCL 0.1 explicitly points to 0.2 as the current authoring specification.

### 14.2 Visual references inspected

All eight images are style and interaction references; §12 governs their semantic use.

- [Capability circuit composition](C:/lab/repos/content-creation-mission/docs/visual-assets/sidefx-capability-circuit.png)
- [Enhanced visual alphabet](C:/lab/repos/content-creation-mission/docs/visual-assets/sidefx-visual-alphabet-enhanced.png)
- [Compiled enhanced symbol atlas](C:/lab/repos/content-creation-mission/docs/visual-assets/symbol-atlas-enhanced.png)
- [Capability node](C:/lab/repos/content-creation-mission/docs/visual-assets/capability-node.png)
- [Provider node](C:/lab/repos/content-creation-mission/docs/visual-assets/provider-node.png)
- [Junction node](C:/lab/repos/content-creation-mission/docs/visual-assets/junction-node.png)
- [Fulfillment terminal](C:/lab/repos/content-creation-mission/docs/visual-assets/fulfillment-terminal.png)
- [Failure terminal](C:/lab/repos/content-creation-mission/docs/visual-assets/failure-terminal.png)

### 14.3 Findings addressed in this revision

| Review finding | Specification resolution |
| --- | --- |
| Undefined Start building destination | `/build`, authenticated draft workspace, explicit CTA map and full candidate/export journey (§3.3, §4, §13) |
| Ownership and unsupported claims | Downloadable authority/embodiments, SDA or own architecture, scoped claim evidence and independent-use gate (§1.6–1.7, §8.3) |
| Missing contact email and recovery | Required email, validation, durable delivery, idempotency and tested failure recovery (§5.15) |
| P1 links to P2 content | Shared availability registry, phase-aware nav/cards/sitemap, P1 minimum docs (§4, §7, §9) |
| Audience and terminology overload | Primary hands-on builder, concrete hero/demo, progressive definitions (§3.1, §5.1, §7) |
| MCP acronym ambiguity | Full category name and canonical route, acronym distinction and redirect (§2.1, §5.10) |
| Missing responsive/accessibility behavior | Explicit screen sizes, keyboard/focus/voice/form/circuit behavior and manual gates (§6.6, §8.3, §12) |
| Persona cross-reference and learner mismatch | Five solutions pages in §5.11; learning audience routed to Training and P1 docs (§3.2) |

New requirements are covered by the estate publication contract (§11), per-capability Nano Banana imagery and SCL refinement (§12), and spoken intent through the Gemini Pro conveyor (§13). This closes the documentation review findings; implementation acceptance remains governed by the P1 exit criteria.

Draft v3 extends that resolution with live mechanic/provider inspection, their own catalogs and dedicated imagery, database retention of generated bytes and derivatives, and a common semantic-object media binding for scenarios, blueprints and further estate subjects (§5.20, §11.5, §12.7). The schema design is additive and remains to be implemented; the new read-only inventory query has been executed successfully.

Draft v4 specifies Next.js standalone packaging in a Linux container, ACR distribution, Azure App Service hosting, container-mode-specific port configuration, same-image staging/production promotion, health checks and durable external state (§8.4–8.7). Draft v5 records the user's Azure portal summary for the existing `sidefx` app in East US 2, superseding the earlier West US 3 discussion. It distinguishes the running starter image from the required website release, records the unconfigured Health Check/custom domain, and narrows the remaining infrastructure dependencies. Azure resources have not been independently inspected or changed in this documentation update.

### 14.4 Deployment references

Official deployment documentation checked during this revision; reconfirm against the pinned framework version and actual Azure container mode during implementation.

- [Next.js standalone output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output): traced runtime package, generated server and explicit static/public asset handling.
- [Next.js self-hosting](https://nextjs.org/docs/app/guides/self-hosting): runtime configuration, multi-instance behavior and cache coordination.
- [Azure container modes](https://learn.microsoft.com/en-us/azure/app-service/configure-sidecar): enhanced versus classic configuration.
- [Azure sitecontainers resource](https://learn.microsoft.com/en-us/azure/templates/microsoft.web/sites/sitecontainers): main-container identity, target port and environment references.
- [Azure custom container configuration](https://learn.microsoft.com/en-us/azure/app-service/configure-custom-container): registry identity and classic port settings.
- [App Service Plans](https://learn.microsoft.com/en-us/azure/app-service/overview-hosting-plans): regional hosting resources.
- [App Service staging slots](https://learn.microsoft.com/en-us/azure/app-service/deploy-staging-slots): tier requirements, promotion and rollback behavior.
