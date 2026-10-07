# Lane 5: prior art, visual system and reusable assets

Scope: extract the decisions, constraints, visual system and reusable assets from the
design surface (E1, L1, V1, V2, P1, plus the H1/H2 home and the comprehension foundation)
and the platform docs, so a declarative UI strategy honors what already exists. Research
only; every claim cites `file:line` or a file name; proposals are labelled `[proposal]`.

Design-surface locations:

- `C:\lab\repos\sfx-providers\outputs\capability-estate\live-circuit-platform-explorer\`
  holds E1, L1, V1, V2 and P1. Each has `generator/` (Python builders + a PowerShell
  renderer), `sources/` (markdown/JSON read from real runs), `render/slide-NN.png`
  (PowerPoint exports), a `.pptx`, and `SHA256SUMS`. No README or notes file exists in any
  of the five. The `.pptx` files were not opened (binaries): E1 `run-evidence-E1.pptx`,
  L1 `linear-L1.pptx`, V1 `voice-to-value-V1.pptx`, V2 `voice-to-value-V2.pptx` plus
  `pieces/mic-*.html|png`, P1 `provider-details-P1.pptx`.
- `...\capability-estate\comprehension-design-foundation\` holds `master.pptx`,
  `generator/build_master.py` (the foundation: tokens, type, grid, chrome, states,
  relations, responsive, accessibility) and the draft declared projection policies.
- `...\capability-estate\live-circuit-platform-home\` holds H1 and H2 home designs;
  H2 was implemented as `live-circuit/circuit/home.html|home.js` (home.js:1).
- `sfx-providers/outputs/capability-estate/sda-cli-invoke-*` and
  `outputs/capability-presentation-review[-v2]` are data-driven presentation runs
  (`storyboard.json`, `presentation.json`, `google-batch.json`, per-slide SVG, receipts).

## Visual system (observed)

### One shared design system, not five

All five E1/L1/V1/V2/P1 `generator/design_system.py` files are byte-identical (SHA-256
`7C2ED573…`); the H1 home generator and the comprehension foundation use the same file
(verified by hash). It is the single source of the deck visual system: `design_system.py:1-5`
("Comprehension design system: tokens, chrome and components shared by the foundation
master and the specimen decks. Every shape is editable PowerPoint … nothing is
rasterised. Values come from the running viewer's CSS tokens … and its scene SVG palette").
`DESIGN_REVISION = 'D1'`, `FONT = 'Arial'` (`design_system.py:15-16`).

### Typography (design system and live CSS)

- Foundation type scale (`build_master.py:63-64`): page title 22 pt bold, question 11,
  card title/key value 12 bold, body 9, section label 7.5 bold blue, table cell 7,
  locator 7 observation, footer/provenance 6.5 dim.
- Deck chrome variants: page title 26 pt with kicker 11 and question in `observation`
  (`P1 build_provider.py:35-38`, `V2 build_voice2.py:39-42`); cover headline 40 pt
  (`V2 build_voice2.py:190`, `V1 build_voice.py:222`); section title 22 pt
  (`design_system.py:216`); table `size=7.5` default (`design_system.py:149`).
- Live CSS: `font: 16px/1.5 Arial, Helvetica, sans-serif` (`site.css:11`); display
  `clamp(38px, 5.2vw, 66px)` (`site.css:53`), lede `clamp(17px, 1.6vw, 22px)`
  (`site.css:54`), section title `clamp(26px, 2.6vw, 34px)` (`site.css:56`), eyebrow 13 px
  uppercase (`site.css:52`).
- Canvas mapping: deck canvas 13.333 × 7.5 in (`design_system.py:63`) is treated as the
  scene's 960 × 540 viewBox (`build_master.py:62`); Arial throughout, matching the viewer.
  Conversion for a web layer: 1 pt in the deck = 4/3 px at 96 dpi, so a 22 pt title ≈ 29 px,
  inside the CSS `clamp(26-34)` band.

### Palette and colour meaning

Tokens (`design_system.py:21-25`) vs the live page tokens (`site.css:4-12`):

| role | design system | live CSS | note |
| --- | --- | --- | --- |
| background | `bg 06111F` | `--bg #06111F` | same |
| primary text | `white F4F7FB` | `--white #F4F7FB` | same |
| secondary text | `muted A8B8CA` | `--muted #B3C5D8` | differ |
| labels | `dim 6F8299` | `--dim #829AB2` | differ |
| accent | `observation 72D7EE` | `--cyan #72D7EE` | same value, different name |
| bright cyan | `cyan 22BEFF` | — | deck-only; almost unused in the decks |
| execution | `blue 45A7FF` | `--blue #45A7FF` | same |
| input/warn/tension | `amber F6B94D` | `--amber #F6B94D` | same |
| outcome | `green 4DE0B0` | `--green #4DE0B0` | same |
| failure | `red FF5F70` | `--red #FF5F70` | same |
| provider/unresolved | `violet A98AF2` | `--violet` (Explorer only) | `explorer.html:14` adds it |
| panel/rules | `panel 102238`, `panel_deep 0A1A2C`, `grid 263A51` | `--panel rgba(5,21,34,.94)`, `--panel-solid #0A1C2E`, `--line #29435B` | differ |

Semantic hues are declared once: Purpose = observation, Promise = green, Causal execution =
blue, Physical realization = violet, Truth and tension = amber (`design_system.py:26-29`),
and restated as a rule ("Presentation decides layout and disclosure only. Status, severity,
classification, routing and narrative come from declared authority and are rendered, never
recomputed", `build_master.py:30-34`). The live circuit renderer uses the same mapping:
completed green, failed red, traversed violet, input amber (`circuit-canvas.css:17-22`).

### Spacing, grid and page chrome

- Foundation grid (`build_master.py:70-78`): margins 0.5 in, top bar 0.42 in, section nav
  0.38 in, header 0.98 in, main `8.85 × 4.85` at (0.5, 2.0), evidence drawer `3.28 × 4.85`
  at (9.55, 2.0), footer 0.35 in; 0.2 in gutter; main never runs under the drawer
  (`design_system.py:64-65`).
- `design_system.chrome()` (`design_system.py:191-227`) draws: top bar with product name and
  STATIC/REPLAY/LIVE mode chips; eight declared sections with the current one blue and
  underlined; breadcrumb `SECTION · page key · page title`; title; question; GENERATION and
  EVALUATION SCOPE blocks; footer with source and `page · frame · design · slide`; an
  ILLUSTRATIVE chip when content is not evidence. `SECTIONS` are Overview, Promise,
  Scenarios, Circuit, Providers, Evidence, Conformance, History (`design_system.py:30`); the
  foundation maps 41 pages to those sections plus a History cross-sheet (`build_master.py:132-140`).
- The evidence drawer (`design_system.py:229-242`) is a claim-plus-locator list: `claims:
  list of (claim, locator)` in `observation`, with a count in the header and an optional
  note.
- E1/L1/P1/V2 use a lighter per-deck chrome: global bar 0.44-0.5 in with the SideFX logo,
  a running title (`Provider details · design P1 · for review`), page number, title 26,
  kicker, question in `observation`, source footer at y≈7.08-7.27
  (`E1 build_evidence.py:131-149`, `P1 build_provider.py:29-41`, `L1 build_linear.py:63-70`).

### Slide/page grammar and recurring patterns

1. **Cover.** 40 pt headline, subtitle, three colour-keyed cards (label, head, bullets),
   then a specimen/basis footnote (`V1 build_voice.py:219-240`, `V2 build_voice2.py:186-208`,
   `P1 build_provider.py:116-139`).
2. **Today → target.** Two mock columns, unchanged vs proposed, with the exact diff called
   out ("One reader change: `"procedure": "analysis.read_provider_details"…`",
   `P1 build_provider.py:141-163`).
3. **The reading is the model.** A grid of named result sets with their returned columns and
   a screen mapping (`P1 build_provider.py:165-185`).
4. **In-place mock with numbered markers and a rail.** A browser/Explorer mock
   (`P1 build_provider.py:68-97`, `V2 build_voice2.py:93-107`) plus circular numbered
   markers and a right-hand rail of rules; `marker()` is copy-pasted per deck
   (`E1:109-111`, `P1:49-52`, `V1:54-57`, `V2:52-55`).
5. **Decision/comparison table.** Columns Decision / Options / Recommendation, or a scored
   comparison with explicit criteria and a RECOMMENDED banner
   (`V1 build_voice.py:394-409,440-446`, `V2 build_voice2.py:378-384`,
   `E1 build_evidence.py:649`, `P1 build_provider.py:351-357`).
6. **Boundaries and limits.** The designed-in limits are slides, not footnotes: dashed amber
   "NOT CAPTURED TODAY" panels (`E1 build_evidence.py:123-126`; CSS
   `.not-captured { border: 1px dashed var(--amber) }`, `run-evidence.css:8-10`),
   "read is not a receipt" (`P1 sources/live-circuit-provider-details.md:279-282`),
   attribution limits "timing-attributed … NOT_VERIFIED" (`V2 build_voice2.py:344-373`).
7. **Status and evidence states.** One shared table: state → (border colour, text colour,
   dash, fill, label prefix), including EMPTY, ABSENT, NOT_DECLARED, NOT_AUTHORED, NOT_READ,
   UNAVAILABLE, UNRESOLVED, STALE, DISCREPANCY, DECLARED, success, failure, ILLUSTRATIVE
   (`design_system.py:33-52`; restated with meanings in `build_master.py:98-113`).
   Colour never carries meaning alone: every chip has a word and dashed vs solid
   distinguishes absence (`build_master.py:99,212`).
8. **Relation line styles.** declared order (blue dashed), supported state read (green),
   declared routing (violet), observed transition (observation, the only one that may
   animate) (`design_system.py:54-59`, `build_master.py:115-128`).
9. **States-of-a-component table.** "State / What the user sees / What the platform refuses
   to do" (`V1 build_voice.py:324-329`); the same honesty shape recurs in V2's honest
   attribution and P1's refusals (`P1 build_provider.py:281-284`).
10. **Timeline.** Events on a rule, alternating labels, T+n timestamps, with
    retained-behaviour vs client-addition legends (`V1 build_voice.py:271-298`,
    `V2 build_voice2.py:288-307`).

### Where the design system conflicts with live-circuit CSS

- Token drift on `muted`, `dim`, `grid`/`line`, and panel fills (table above). A component
  styling layer cannot import both; one must be chosen and the other aliased.
- `run-evidence.css` already uses `--cyan` where the decks mean `observation`; the live
  token set calls the accent `--cyan` while the decks call it `observation`
  (`site.css:7`, `design_system.py:24`). `[proposal]` Name the web accent `--observation`
  and keep `--cyan` as a deprecated alias, so deck semantics and product semantics agree.
- `design_system.py:4-5` cites its source as `demo/circuit/index.html`, a path the P1
  move and P5 removal retired; the live sources today are `site.css:4-12` and
  `explorer.html:14`. The comment (and therefore the deck provenance story) is stale.
- The deck includes a bright `cyan #22BEFF` that the product never adopted; the decks
  themselves mostly render `observation` as the accent (`E1:27` sets `CYAN =
  T['observation']`; `P1:27` uses `OBS`). Do not inherit the unused token.
- Radius/format differ: decks use 0.05-0.06 in corner radii on a print canvas; the live CSS
  uses 10 px `--radius`, 7 px buttons, 6-8 px small controls (`site.css:8,42-49`,
  `explorer.html:28-32`). `[proposal]` Keep spacing and radius values in CSS, import only
  palette/type/state/relation semantics from the design system.

## Binding decisions and constraints

Decisions that bound any declarative UI strategy:

1. **Repository ownership.** D1: the Explorer and Live Circuit live in `sfx-platform`;
   `sfx-embody` keeps database authority, inspect evidence and contracts
   (`docs/live-circuit-platform-revamp.md:184`). D2: Next.js retires entirely
   (`…revamp.md:185`, executed as P5 `…revamp.md:392-408`). D4: **one circuit renderer**;
   the Explorer surrounds the database-authored scene and no client re-draws capability
   meaning (`…revamp.md:187`; the second-renderer risk is restated at `…revamp.md:449-451`).
2. **Host-declared home composition today.** `live-circuit/circuit/circuit-host.json:6`
   declares `home.hero` (capability + scenario page) and `home.featured` (titles, body,
   promise) and states: "editorial titles and summaries of each capability's catalog
   userStory and promise. Host data until the list is declared as database authority
   (revamp P3)." `identity.circuit` (`circuit-host.json:5`) likewise declares the sign-in
   circuit. The host serves these unchanged at `GET /api/circuit/v1/home`
   (`README.md:169-172`); the page reads, never embeds, them (`home.js:83-96`).
3. **Editorial data is explicitly temporary.** README repeats the copyBasis line
   (`README.md:181-182`). A declarative page system should move the featured list (and
   eventually other editorial page content) to declared authority rather than deepen the
   host-JSON workaround. `[proposal]`
4. **Explorer-only surfaces / one workspace.** `/circuit` and `/circuit/` redirect to
   `/circuit/explorer`; the old page, its `app.js` and `session-status.js` were removed
   (`…revamp.md:88-99`). V1 option D (a dedicated voice console) was explicitly rejected as
   "a second surface to maintain; the revamp's decision is one workspace"
   (`V1 build_voice.py:353-358`). Any new story page is a new surface and needs a decision.
5. **Navigation is data.** Tree, tabs, counts, badges and per-scenario attribution come
   from `capability_navigation` rows and the declared `capability-explorer-projection.v1`
   policy; "Client code names no capability, scenario, provider, result set or section"
   (`…revamp.md:226-229`; `README.md:62-65`).
6. **Sections render by declared presentation.** Every section renders its rows by declared
   presentation (`…revamp.md:67-69`); specialized renderers for the presentation kinds
   remain outstanding, "All kinds render as tables or fields today" (`…revamp.md:80-87`).
   The r3 draft policy names 22 kinds (`explorer-policy.r3.draft.json`: capability-overview,
   field-list, level-ladder, record-table, promise-flow, contract-fan, scenario-portfolio,
   given-when-then, operation-sequence, operation-detail, routing-map, provider-catalog,
   boundary-chain, finding-list, verdict, profile-catalog, evidence-explorer,
   narrative-table, identity-digests, source-snapshot, story-compare, version-list), and the
   revamp notes 21 kinds in installed policy r4 (`…revamp.md:85`).
7. **Failure is visible, never empty.** A failed reading renders as a visible failure
   (`…revamp.md:368-369`; `README.md:47-52,110-111`; `P1 sources/live-circuit-provider-details.md:277-281`).
8. **Reads are reads.** Retrieval is read-only; a writer is never added to
   `retrieval-policy.json` (`P1 sources/live-circuit-provider-details.md:123-127`).
   Provider edits stage a change document guarded by `expectedDigest`; the browser never
   writes (`README.md:147-151`; `provider-profile.js:1-10`).
9. **Selection integrity.** Stale selections refuse with 409 (`PROVIDER_DEFINITION_CHANGED`;
   `P1 sources/…:87-91`); navigation cancels superseded responses (`README.md:133-134`);
   moving between pages preserves the selected run and replay position
   (`…revamp.md:382-384`).
10. **Prompt shell.** The objective-row mic is the prompt shell's inline SVG (two paths,
   20 px in a 42 px button), its status copy is verbatim ("Voice ready / Listening… /
   Voice captured. Review or Run.") and the action is Run, not Ask
   (`V2 build_voice2.py:196-197,253-256`; implemented in `README.md:72-78`; lane 2 also
   cites `objective-run.js:93-236` in `analysis/02-rendering-inventory.md:141`).
11. **Deploy economics and acceptance.** Automatic staging on pushes to watched paths
   (`docs/automatic-staging-deployment.md:1-17`). Every new client module must be added to
   the `CIRCUIT_FILES` map in `live-circuit/dispatch-pair/observe-server.mjs:13-44` and to
   the staging acceptance routes, or the deploy rolls back (`research-brief.md:84-90`).
   A failed deployment/browser/replay/restart/external/CLI gate restores the prior exact
   digest (`automatic-staging-deployment.md:224-241`). Acceptance drives real element ids
   (`#viewer`, `#slide`, `#mode`, `#follow`, `#speed`, `#replay`; `README.md:83-85`).
   Live acceptance "never substitutes synthetic events or API responses"
   (`automatic-staging-deployment.md:125`, and 145-152).
12. **Platform rules.** SDA behaviour changes only by request to
   `scenario-driven-architecture`; capability meaning only through `sfx-embody` migration
   pairs; identity schema only through `sfx-dal` migrations and DAL regeneration
   (`AGENTS.md`; restated `E1 build_evidence.py:639`).
13. **Public surface.** `/` serves the platform home page; retired website paths answer
   404; `robots.txt` disallows all when indexing is disabled; no legal/privacy pages exist
   yet (`automatic-staging-deployment.md:84-87`; open question at `…revamp.md:460-466`).

## Lessons from V2 and P1

### V2 (voice-to-value)

- **Designed.** V1 studied six placements (A home bar, B Explorer Ask tab, C run bar,
  D dedicated console, E objective picker, F global mic) with a scored comparison and
  recommended B + C, rejecting D as a second surface (`V1 build_voice.py:333-409`).
  V2 superseded V1 and fixed the component and location: objective row **above the run bar**
  (P1 placement), the prompt-shell mic, Run executes
  `request-capability-from-objective-v3`, a requested-capabilities strip under the circuit,
  and a compact + report summary player; all client work, no estate change for v1
  (`V2 build_voice2.py:1-8,212-227,375-391`). Success criteria were stated as an honest
  story: retained behaviour (admit, select, run, outcome) vs client additions (mic,
  dictation copy, Run placement, audio playback) (`V2 build_voice2.py:283-287`).
- **Implemented.** `README.md:72-78` records exactly the V2 features: objective row above
  the run bar, prompt-shell mic and voice status, Run, requested-capabilities strip with
  honest attribution, summary player that "speaks the summary's spoken text: tool-result
  JSON and machine payloads are never read aloud, while the on-screen text stays verbatim",
  text fallback. The module is `live-circuit/circuit/objective-run.js` and is mapped in
  `observe-server.mjs:34`.
- **Reusable:** one self-contained component with explicit states and honest limits;
  "retained vs addition" labelling; placement study with a recommendation; fallback rules.
- **One-off:** the three placement mocks, mic PNG pieces, waveform, timeline.

### P1 (provider details)

- **Designed.** A provider involvement profile rendered only from
  `analysis.read_provider_details`'s eight sets, nothing interpreted; the reader switch is
  one declared line in `circuit-host.json`; the inspector stays read-only; edits stage an
  exact change document (recommendation A, copy/download now; B, operator route next);
  boundaries include the platform-catalog >30 s read and a canonical fallback; credentials
  are references and injection rules, never rendered; fixture/projected instruction copies
  stay labelled by `instruction_kind` (`P1 build_provider.py:1-14,141-163,262-287,313-335,337-359`;
  `P1 sources/live-circuit-provider-details.md`).
- **Implemented.** `circuit-host.json:13-15` declares the details reader with
  `identityResultSet` and `canonicalProviders: ["sda-authority-transformation-port.v1"]`;
  `README.md:136-158` records the profile, the raw-set fold, the canonical fallback with a
  reason (`readerFallback`) and the staged-document behaviour; `provider-profile.js:1-10`
  is the profile layer and `:30-80` the `instructionChange`/`engagementChange` document
  builders and the copy/download fold ("Nothing is applied here"). The recommendation was
  followed almost verbatim.
- **Reusable:** "the reading is the profile / nothing is recomputed"; declared reader as
  data (`procedure` + `identityResultSet`); typed refusals; digest guards; canonical
  fallback for heavy selections; staged change documents; boundaries as a first-class slide.
- **One-off:** the eight specific sets, mock shell, markers, decision table.

### What this implies for a component/provider stack

The two successful implementations share one recipe: a declared reader returns rows or a
document unchanged; a presentation layer maps named sets to presentation kinds; keys,
limits, refusal codes and fallbacks are declared; failures render as failures. Two shapes
already exist side by side: a **generic set renderer** (the inspection panel renders any
returned set as `name · rows`, `P1 sources/…:60-62`) and a **specialized profile**
(`provider-profile.js` bound to eight named sets). A component/provider stack should make
that pairing explicit: a layout capability, section capabilities that name a reader and a
presentation kind, and presentation-kind providers shared across pages.
`[proposal]`

## Existing presentation providers

**`sfx-providers/providers/circuit-presentation`** (declaration `circuit-presentation.mjs`):

- Provider `sfx-circuit-presentation`; tools `presentation.compile`,
  `presentation.from-capability`, `presentation.to-google-slides`; input/output contracts
  `PROPOSED`; deterministic execution; `AUTHORED` with a candidate or `HELD` with typed
  findings; request/output byte caps (`circuit-presentation.mjs:5-25`).
- `src/circuit-presentation/compile.mjs` validates a declarative deck (title, page size,
  sources each with `claim` and `limit`, slides with `{op,args}` commands), maps each
  command to native Google Slides requests and an SVG rendering, enforces a 960 × 540
  canvas, 4-96 pt text, 4,000 commands, 23,000 native requests, 24,000 requests per deck,
  and returns `inputDigest`/`contentDigest` (`compile.mjs:1-71`).
- `src/circuit-presentation/design.mjs` is a reusable native primitive layer: `Slide` with
  `shape`, `t`, `line`, `route`, `port`, `junction`, `gate`, `chip`, `socket`, `terminal`,
  `region`, `label`, `source`, `foot`, `legend`, and the same token map `C`
  (`design.mjs:4-85`). `presets/sidefx-announcement.json` is a compiled announcement deck
  whose sources carry explicit `claim` and `limit` pairs (`presets/sidefx-announcement.json:1-159`).
- `src/capability-presentation/provider.mjs` is the data-driven path: it reads a capability
  snapshot from the estate (`loadEstateReader`), builds a circuit model and a storyboard,
  optionally enriches narrative through a bounded narrator that must cite existing evidence
  and cannot change nodes, edges or titles (`provider.mjs:34-48`), verifies coverage of
  every node and edge and the blueprint (`provider.mjs:49-53`), splits into at most eight
  volumes of at most 256 slides, compiles each with `presentation.compile`, and returns
  snapshot + model + storyboard + inference + coverage + volumes + `contentDigest`
  (`provider.mjs:25-71`). This is genuine data-driven presentation, but it targets decks
  (Google Slides/PPTX), not web pages.
- Evidence runs exist under `sfx-providers/outputs/capability-estate/sda-cli-invoke-*`
  (for example `sda-cli-invoke-blueprint-v9/{storyboard.json,presentation.json,
  volume-*/google-batch.json,volume-*/slide-0NN.svg,receipt.json}`) and
  `outputs/capability-presentation-review[-v2]/{candidate.json,draft.pptx,renders}`.

**In-product presentation layers already data-driven:**

- `live-circuit/circuit/run-evidence.mjs` ("Presentation of retained receipts. Declaration,
  execution and observation remain separate; this module never evaluates a trust
  disposition", `run-evidence.mjs:1`) builds run reports, per-component evidence and CSV
  traces, and states its own limit: "Time containment is a search aid, not proof of
  ownership … ownership NOT_VERIFIED" (`run-evidence.mjs:40-61`).
- `provider-profile.js` renders the provider profile from named sets and stages edit
  documents (`provider-profile.js:1-47`).
- The declared projection policy (`capability-explorer-projection.v1`) is the existing
  registry of presentation kinds and the shell contract (coordinates, visibility, counts,
  selection/scene keys; `explorer-policy.r3.draft.json`), installed as r4 per
  `…revamp.md:343-350` and `home.js`/`explorer` docs.
- The H2 home is a completed design→implementation pair: `H2/sources/design.json` declares
  hero, featured copy, copyBasis and imagery provenance; `home.html|home.js` implement it
  and read all values at runtime (`home.js:1-4,83-96`).

**Anti-pattern on record:** the retired website had its own second renderer and workbench
(~3,400 lines: `components/circuit`, `lib/run-graph.ts`, `lib/workbench`), deleted at P5
(`…revamp.md:194`), confirming D4's "no second renderer" as learned cost.

## Principles and anti-patterns

The strategy must state these as rules, not aspirations:

1. **Honesty boundaries.** Distinguish architecture/research from product availability;
   label immature capabilities "In development / Lab / Preview" until gates close
   (`intent.md:1414-1430`). Never claim compliance: "SFX provides capability-level
   authority, execution evidence, traceability and control surfaces that organizations and
   assessors can map to applicable regulatory obligations", not "makes you HIPAA compliant"
   (`intent.md:227-241`). Do not claim universal provider integration; use the
   architecture-backed claim plus measured coverage (`intent.md:382-390,417-425,894-923`).
   Do not headline formal verification before proof obligations are discharged
   (`intent.md:685-701`).
2. **No invented evidence.** "Evidence the platform does not capture today is drawn as a
   dashed amber box and never filled with invented content" (`E1 build_evidence.py:9-12`);
   the foundation's rule "Rendered, never recomputed" (`build_master.py:30-34`); live
   acceptance never substitutes synthetic events or API responses
   (`automatic-staging-deployment.md:125`); unexplained gaps stay findings
   (`README.md:317-319,360-367`).
3. **Every claim has a locator and a state.** Values cite sheet/reading + key; counts name
   their population; missing cell, EMPTY, NOT READ, UNAVAILABLE, ABSENT and UNRESOLVED are
   distinct and never share a blank (`build_master.py:149-156`).
4. **Colour never carries meaning alone.** Every state has a word, a border colour and,
   where meaning differs, a dash style (`build_master.py:99,212`; `design_system.py:33-52`).
5. **No rasterised design.** "Every shape is editable PowerPoint … nothing is rasterised"
   (`design_system.py:2-5`). Decks embed the returned scene SVG with a PNG fallback and crop
   by viewBox only (`E1 build_evidence.py:151-164`; `L1 build_linear.py:35-50`). Also
   rejected: single-field slides with a large empty canvas, and treating a presentation
   receipt as admission or execution (`build_master.py:241-244`).
6. **One workspace, one renderer.** No second surface for a story flow
   (`V1 build_voice.py:353-358`; `…revamp.md:88-99`); no browser re-draw of capability
   meaning (`…revamp.md:187,449-451`).
7. **Reads are not receipts.** Provider inspection "is a current database read, not an
   execution receipt" (`P1 sources/…:279-282`); the inspector is read-only and writers never
   enter retrieval (`P1 sources/…:123-127`).
8. **Failure and staleness are visible states.** Never an empty workspace; 409 for stale
   selection; failures keep sections visible (`…revamp.md:368-369,443-444`).
9. **Preserve selection and liveness.** Moving between pages keeps the selected run and
   replay position (`…revamp.md:382-384`).
10. **Measured claims over marketing.** Coverage numbers with their real values
    (`intent.md:906-923`); editorial text is labelled and its basis stated
    (`H2/sources/design.json:15`; `circuit-host.json:6`).

## Reusable assets

- **One shared design system**: `design_system.py` (identical across E1/L1/V1/V2/P1/H1 and the
  foundation) with the token map, type scale, STATE table and RELATION table
  (`design_system.py:15-65,124-248`). `[proposal]` Treat the STATE and RELATION tables as the
  canonical machine-readable state/edge vocabulary for the component styling layer, exported
  as JSON so both the web CSS and any generator read the same file.
- **The token palette**: bg/white/blue/amber/green/red/observation already agree between
  decks and live CSS; add `--violet` and reconcile muted/dim/line values (table above).
  `[proposal]`
- **The declared presentation-kind registry**: 22 kinds in
  `explorer-policy.r3.draft.json`; the installed r4 policy is the contract to extend.
- **The reader-as-data pattern**: `circuit-host.json` `readers` and `retrieval.provider`
  (`circuit-host.json:12-21`) show exactly how a page's data source is declared.
- **The host-declared page pattern**: `home` hero/featured (`circuit-host.json:6`) is the
  narrowest existing "page as data" example; the strategy can generalize it while moving the
  editorial list to authority.
- **Presentation compiler primitives**: `circuit-presentation/design.mjs` and the
  command→native-request compilation with digests (`compile.mjs`) are proven,
  dependency-free patterns for declarative rendering with bounded geometry.
- **The capability-presentation pipeline** (snapshot → model → storyboard → coverage check
  → volumes → digest) is the closest existing analogue of "page capability + layout +
  sections" for generated views; a web renderer provider could mirror it.
- **In-product presentation modules**: `run-evidence.mjs` (receipt presentation with stated
  limits), `provider-profile.js` (named-set profile + staged document), `objective-run.js`
  (prompt-shell component), `explorer-model.mjs` and the declared navigation consumption.
- **H2 home assets**: `live-circuit/circuit/assets/` logo, emblem, decorative
  `optical-architecture`/`optical-flow` WebP (provenance recorded in `H2/sources/design.json`
  and `README.md:182-185`).
- **Sealed review artifacts**: per-deck `SHA256SUMS` and `render/slide-NN.png`; usable as
  design evidence, not runtime assets. The `.pptx` files are review binaries, not product.
- **The foundation's accessibility rules**: focus order, 2 px observation focus outline,
  contrast thresholds, colour independence, 200% zoom by family switch, no animation in
  comprehension panels, and "Links name their destination page key"
  (`build_master.py:207-221`). Directly reusable as the styling layer's acceptance rules.

## Gaps and unknowns

- **No exported web design tokens.** The palette/grammar lives in Python and in scattered
  CSS (`site.css`, `explorer.html:14`, `circuit-canvas.css`, `run-evidence.css`); a
  component styling layer has no single token source today. `[proposal]` is to create one.
- **Which presentation kinds are real.** The revamp says specialized renderers for 21 kinds
  are still owed (`…revamp.md:80-87`); the r3 draft lists 22 but is a draft. The installed
  r4 policy and the exact kind list were not read in this lane (they live in `sfx-embody`).
- **Card bindings and operation scene key** remain unbound (summary cards, operation
  linking; `…revamp.md:78-87`). A page/section component stack must cover these as
  declared bindings, not code.
- **Editorial content ownership.** No declared authority exists yet for the featured list
  or page copy; where it lands (estate migration pair, host JSON, content documents) is
  undecided and is the central boundary for "content change vs code deploy".
- **The intent IA** (nine top-level areas, `intent.md:970-1043`) has no mapping to the
  Explorer-only rule; every new area implies either a declared page set inside the one
  workspace or a decision to allow new surfaces. This is unresolved.
- **PPTX source fidelity**: `build_master.py:244` records that PowerPoint once refused an
  enrollment `presentation.pptx` while python-pptx parsed it; the five design-surface decks
  are asserted editable but their PowerPoint open fidelity was not re-verified here (the
  `.pptx` binaries were deliberately not opened).
- **The design-system provenance comment** still names `demo/circuit/index.html`
  (`design_system.py:4-5`), a retired path; the deck-to-product token mapping needs an
  audit before reuse.
- **Prompt shell source** is external (`cognitive-codebase … prompt-shell` per
  `V2 build_voice2.py:230-232,253-256`); this lane verified the adopted copies in V2's
  design and in `README.md`, not the shell repository itself.
- **No README/notes** exist in the E1/L1/V1/V2/P1 folders; intent and status were read from
  generator docstrings, notes payloads and the platform README. An author lane may want the
  design-surface folders to carry a status line pointing at what shipped.
