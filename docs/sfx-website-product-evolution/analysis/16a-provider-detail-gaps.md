# 16a — Provider-detail surface gaps: what the drill-down reads today and what a per-provider UI contract must add

Prepared 2026-10-09; updated 2026-10-10 with the model-provider trace (G13). Status: **research
and comparison only; not started.** Lane: provider-detail
surface (companion to [`16b-provider-ui-contract.md`](16b-provider-ui-contract.md), which proposes
the contract; this document records the surface that contract must fit and the exact deltas).

Every claim about current behaviour cites `path:line`. Every design element is labelled
`[proposal]`. Nothing in this document has been implemented, published or committed. The deployed
database state is not asserted: where a repository migration and a platform document disagree, both
are cited and the disagreement is recorded as a gap.

Primary artefacts read for this lane: [`docs/live-circuit-provider-details.md`](../../live-circuit-provider-details.md);
[`analysis/08`](08-claim-provenance-tooling.md) (citation and `[proposal]` conventions);
[`analysis/12`](12-ui-runtime-providers.md); [`analysis/15`](15-provider-deployment-boundary.md);
the estate reads and writer (`sfx-embody/sql/migrations/declare-provider-details-read.sql`,
`declare-provider-details-screen-read.sql`, `install-provider-details-change.sql`); the declared
drill-down (`sfx-embody/sql/migrations/declare-provider-profile-view.sql`,
`declare-ui-page-provider-drilldown.sql`); the hosted UI providers
(`sfx-providers/providers/`, `sfx-providers/src/ui-providers/`, `sfx-providers/docs/ui-provider-hosting.md`).

---

## 1. The surface in one pass

Clicking a declared provider glyph in the Explorer opens the estate-published
`provider-profile` view (`live-circuit/circuit/README.md:174-185`). The middle region mounts it and
reads it through the deployed page reader (`sfx-providers/providers/sfx-ui-explorer-region-middle/circuit-runtime.js:93-124`;
`live-circuit/circuit/view-runtime.js:98-113`). The view's one source is `provider-inspection`
(`sfx-embody/sql/migrations/declare-provider-profile-view.sql:68`), served by the platform host
route `GET /api/circuit/v1/provider-inspection` (`live-circuit/circuit/live-store.mjs:456`), which
calls the procedure-extract service once and passes the result sets through
(`live-circuit/circuit/live-store.mjs:350-391`). The Explorer interprets nothing; a refused read is
a named state (`live-circuit/circuit/README.md:186-191`).

## 2. What `analysis.read_provider_details` returns today

### 2.1 The reader in the estate

Signature `analysis.read_provider_details(@provider_id, @estate_model_pk=NULL)` —
`sfx-embody/sql/migrations/declare-provider-details-read.sql:56-58`. The eight sets, in emission
order:

| # | result set | what it carries | declared at |
| ---: | --- | --- | --- |
| 1 | `provider_identity` | state (`DECLARED`/`ENGAGED_UNDECLARED`/`ABSENT`), provider pk, object kind, namespace, declared name, role, newest selected `definition_digest`, `engagement_kinds`, engagement count | `declare-provider-details-read.sql:169-182` |
| 2 | `provider_configuration` | name, role, runtime/package/type/method, execution location, `operations_json`, `candidate_capabilities_json`, `conformance_claims_json`, raw `configuration_json`, digest; an explicit absent branch carries nulls and a note | `:184-209` |
| 3 | `provider_mechanics` | declared entrypoint, PORT rows, MECHANIC rows, or an explicit ABSENT row | `:211-241` |
| 4 | `provider_bindings` | slot, binding-context target/environment, binding/scope policy, ordinal, or ABSENT | `:243-264` |
| 5 | `provider_engagements` | one row per selected port generation naming the provider: `OVERLAY` (`configuration.providerId` / `providerAuthorities[]`) or `PLATFORM` (`platformCapabilityId`), binding id, authority, endpoint digest, credential reference + injection, url prefixes, application ref, carrier shaping (`requestPath`/`resultMode`/`resultPath`/`lineageMode`) | `:104-152,266-274` |
| 6 | `provider_instructions` | every SYSTEM/USER instruction row with direction, kind (`DECLARED_TEMPLATE`/`DECLARED_LITERAL`/`PROJECTED`/`MAPPING`/`FIXTURE`/`INVOCATION`), JSON path, value, digest | `:442-444` |
| 7 | `provider_invocations` | one row per fixture document and per instruction-bearing transformation: `fixture_id`, aggregated `system_texts`/`user_texts`, `system_template_values` | `:465-491` |
| 8 | `provider_summary` | one measure row per state and count | `:493-510` |

The estate's newer screen-shape migration keeps the original eight and appends three more sets
(`sfx-embody/sql/migrations/declare-provider-details-screen-read.sql:7-40,761`):

| # | result set | what it adds | declared at |
| ---: | --- | --- | --- |
| 9 | `provider_credentials` | reference name, endpoint digests, injection rule id/header, `value_state` (`REDACTED`); never the value | `:762-768` |
| 10 | `provider_reference_joins` | canonical reference rows plus shared-authority rows naming another provider, each resolution flag | `:770-784` |
| 11 | `provider_update_targets` | every scalar semantics leaf of the engaged port definitions and endpoint templates with `path_suffix`, `value_type`, `current_value` and an `update_call` | `:786-791` |

The screen migration also widens earlier sets in place: `provider_identity` gains
`reference_joins`/`shared_authority_references` (`:378-393`), `provider_configuration` gains
`declaration_profile` and per-field `*_state` (`:395-436`), mechanics and bindings gain state
columns (`:438-473,475-496`), and engagements gain `reference_kinds`, closure, endpoint and
credential-state columns (`:510-517`).

**Documentation drift.** `docs/live-circuit-provider-details.md:29` says "It returns eight result
sets"; the repository's newest migration emits eleven. `docs/live-circuit-provider-details.md:76-82`
describes a `readerFallback` that "retries the canonical reader and reports the choice and the
reason"; the deployed host states the opposite — "There is no reader fallback: a failed read is a
named `CircuitReadError`, never a canonical-only render" (`live-circuit/circuit/live-store.mjs:380-382`;
confirmed by `live-circuit/circuit/README.md:182-185`). These are gap G4.

### 2.2 By provider kind

The reader is model-agnostic: one procedure resolves every kind
(`docs/live-circuit-provider-details.md:42-47`). Kind is not an input; it is discovered from the
estate's engagement and binding rows, so "per kind" describes what the same eight/eleven sets
contain for each estate shape.

| Estate shape | What the sets contain today |
| --- | --- |
| **Model overlay** (example `google/gemini-select`) | Declared provider definition: `provider_configuration` filled; `OVERLAY` engagement rows from `configuration.providerId` or `providerAuthorities[]` (`declare-provider-details-read.sql:109-141`) with `provider_kind` observed as `gemini`/`openai` (`sfx-embody/sql/migrations/repair-model-step-provider-binding.sql:32-36`), credential reference, url prefixes; instructions/invocations populated — the verified capture has 2,028 instruction rows and 13 invocations for one provider (`sfx-providers/outputs/capability-estate/live-circuit-platform-explorer/P1/provider-profile-P1.ui-view.json:273,477-490`) |
| **HTTP overlay** (example `rapidapi/yahoo-finance-real-time1`) | Same shape with `providerRole: "overlay"` (`sfx-embody/sql/migrations/declare-provider-overlay-roles.sql:7-13,66`) and an HTTP engagement (`{host, method, pathPrefix, bindingId, credentialInjectionRuleId}` — `sfx-embody/sql/migrations/add-equity-price-fallback-route.sql:61`). The instruction walk selects only bodies carrying `instruction`/`messages`/`prompt` (`declare-provider-details-read.sql:301,319`); when none match it emits an explicit ABSENT row (`:438-440`), never silence |
| **Slot-bound** (example `ScenarioKernel.Adapters.Consumer.AdmittedConsumerPlatform`) | `provider_bindings` rows from `model.provider_binding` (`:251-260`), mechanics PORT rows (`:227-232`); `provider_engagements` stays ABSENT unless a selected port configuration also names the provider (`:109-152`). The migration's own proof calls both scoped reads for this provider (`declare-provider-and-operation-inspection.sql:262-264`) |
| **Platform capability** (example `sda-authority-transformation-port.v1`) | `PLATFORM` engagement rows only (`declare-provider-details-read.sql:143-152`); if no `model.provider` row exists the identity state is `ENGAGED_UNDECLARED` (`:170-172`) and `provider_configuration` takes the "engaged through port configuration or binding only" branch (`:200-209`). The host selects the canonical-body reader for the one named catalog because this shape can reach 1,047 selected port generations (`circuit-host.json:14-15`; `docs/live-circuit-provider-details.md:290-294`) |

### 2.3 The host call and what the Explorer validates

- Selection must name `detailId` and `expectedSnapshotDigest`; the selected scene must be a
  `DECLARED` provider detail with a matching navigation digest
  (`live-circuit/circuit/live-store.mjs:353-357`).
- One procedure is chosen — `providerReader(configured, providerId)` returns the details reader
  unless the provider id is in `canonicalProviders` (`:347-348,383`).
- One POST to `PROCEDURE_EXTRACT_ENDPOINT/json` with only `{provider_id, estate_model_pk}`
  (`:359-367`); there is no scope, set, kind or row parameter.
- The response is accepted when it is an array of `{name, columns, rows}` sets (`:375-378`).
- Only the identity set is validated: exactly one row, same `provider_id` as selected, same
  `definition_digest` as the scene snapshot, else 409 `PROVIDER_DEFINITION_CHANGED` (`:385-387`).
  Every other set is passed through unvalidated beyond shape.
- The host reports `reader` (procedure name), `providerId`, `definitionDigest`, `snapshotDigest`,
  host `readAt` (`:388-389`) — no reader version, no reader digest, no result-set manifest.
- Host limits that bound the read: 30 s timeout, 16 MiB response, 2 concurrent reads, 32 queued,
  30 s cache (`live-circuit/circuit/circuit-host.json:7-11`).
- `verify-provider-profile.mjs` proves the default reader, the canonical selection, policy
  admission and that the retired bespoke renderer and `readerFallback` are gone
  (`live-circuit/circuit/verify-provider-profile.mjs:19-46`).

## 3. The declared drill-down as published

- Capability meaning: `ui-page-provider-drilldown` — "the declared provider-details screen read
  (the 39-section provider profile at /circuit/views/provider-profile) and the region circuits it
  sits within" (`sfx-embody/sql/migrations/declare-ui-page-provider-drilldown.sql:23`;
  `sfx-embody/sql/migrations/complete-ui-landing-hosted-providers.sql:1249-1255`). Its outcome is
  `ui-page.v1` READ or a named refusal, never a fallback (`declare-ui-page-provider-drilldown.sql:135`).
- Publication: `declare-provider-profile-view.sql:8-13` stores the P1 deck's
  `provider-profile-P1.ui-view.json` as `ui-view-provider-profile` at
  `/circuit/views/provider-profile`, revision 1, with layout `ui-layout-provider-profile.v1`
  registered beside it (`:65,72-97`).
- The view is 39 sections (`sfx-providers/outputs/capability-estate/live-circuit-platform-explorer/P1/provider-profile-P1.ui-view.json:37-1114`).
  Its one source pins `detailId: "provider:google/gemini-select"` and the captured
  `expectedSnapshotDigest` (`:8,24-35`); the host selection overrides those pins at mount
  (`live-circuit/circuit/view-runtime.js:52-57,58-90`), so they are provenance, not routing.
- The published document has **no `actions` and no `events`** on any section
  (`declare-provider-profile-view.sql:68`; the fixture-grade view makes the absence explicit with
  empty arrays — `live-circuit/circuit/fixtures/pages/provider-profile.json:25,37,48,61,72,85`).
  The form and the staged document are presentation; nothing dispatches (see §5).
- `provider-profile-P1` is a capture of the eight-set era: its header says "8 result sets"
  (`provider-profile-P1.ui-view.json:236`), its evidence table lists the eight sets (`:431-500`)
  and its canonical-only fold says `provider_update_targets` and the endpoint template are "not
  carried by this read" (`:954-960`) — while the screen migration now emits update targets and
  endpoint fields (`declare-provider-details-screen-read.sql:293-301,786-791`). The published view
  is therefore a stale capture of the reader it fronts.

## 4. UX noise

Judged against a per-provider detail contract ("show and stage the declarable facts"), the
following are noise.

**Read-side (the payload the browser receives):**

- Raw JSON columns `operations_json`, `candidate_capabilities_json`, `conformance_claims_json`,
  `configuration_json` (`declare-provider-details-read.sql:193-196`; widened in the screen wave,
  `declare-provider-details-screen-read.sql:404-407`). They are the only carriers of runtime,
  package, model and endpoint values, yet unrendered as editable fields.
- The instruction corpus is dominated by copies: of 2,028 rows, `DECLARED_TEMPLATE` is 4,
  `FIXTURE` 311, `MAPPING` 1,402, `INVOCATION` 19; `DECLARED` 292
  (`provider-profile-P1.ui-view.json:273,678-709`). The platform documents this explicitly: fixture
  and projected copies must be separated by `instruction_kind` and `provider_invocations`
  (`docs/live-circuit-provider-details.md:282-285`).
- `provider_summary` repeats counts already derivable from identity, engagements, bindings,
  instructions and invocations (`declare-provider-details-read.sql:493-510`).
- `provider_invocations.system_texts`/`user_texts` are `STRING_AGG` strings with `'; '` joining
  (`:471-486`), not structured values.

**View-side (the 39 sections):**

- Deck and capture provenance, not provider meaning: the captured response hash/size and second
  read (`provider-profile-P1.ui-view.json:1116-1132`), the two-capture provenance table
  (`:1013-1094`), the evidence table of sets (`:431-500`), the "xlsx cross-check" note (`:533`),
  the read-notice literal with endpoint and response hash (`:226-248`), and the product wordmark
  (`:1097-1114`).
- Design-surface material: read timeline (`:967-1011`), kind chart (`:672-714`), tabs (`:623-653`),
  card list with deck copy (`:250-300`), fixture list (`:761-789`), usage list (`:580-604`), and the
  "engagement 3 · promised, not returned" chip (`:164-180`).
- Literal recorded values where a contract would read-select: template text (`:716-737`), staged
  document JSON text (`:866-887`), apply state (`:889-905`), canonical-only fold (`:946-965`).
- The published view is a capture, not a generic profile: provider-specific literals are baked
  (`analysis/16b-provider-ui-contract.md:28-31`).

## 5. Editors: what exists and what is missing

| Intent | Present today | Evidence | Missing |
| --- | --- | --- | --- |
| **Instruction edit** | A `form` section (`profile-change-form`) with namespace/path/valueJson/expectedDigest fields, a `code` section holding the staged document and an apply-state `notice` | `provider-profile-P1.ui-view.json:791-905`, published at `declare-provider-profile-view.sql:68`; the writer accepts `instructions[]` (`install-provider-details-change.sql:19-34,198-235`; `docs/live-circuit-provider-details.md:136`) | The form has no `actions`/`events`; `stage-change` in the shell only dispatches a `page-action` `CustomEvent` (`live-circuit/circuit/page-runtime.js:673-675`) and no listener for `page-action` exists in either repository; the form's fields are literals, not read-selected rows (`provider-profile-P1.ui-view.json:816-861`). The editor is presentation-only |
| **Model version** | Nothing in the view; the model-provider trace resolves the configured model and instruction sources outside it | The view has no model section; the writer's document sections are only `provider`, `engagements[]`, `instructions[]` (`install-provider-details-change.sql:19-34`). Model identity lives inside transformation/port configuration JSON (`sfx-embody/sql/migrations/repair-model-step-provider-binding.sql:44-51`) reachable only through raw `configuration_json`/`operations_json`. The model-provider trace resolves it from stored definitions: resolved model `gemini-3.8-flash`, endpoint `…/models/{model}:generateContent`, transformation `compose-governed-model-invocation.v1`, three active instruction-source procedures (`sfx-dal/.tmp/model-provider/model-resolution.json`; `prepare_objective_selection.sql:31`, `prepare_objective_capability_request.sql:31`, `prepare_objective_summary.sql:9`) | A declared model section, an instruction-source table and an intent that maps the model member to a writer section, guards initialised from the read (16b §4, §10.1-§10.3, `[proposal]`) |
| **Provider switch** | Nothing at detail level. UI region slots have a versioned selection mechanism (`live-circuit/circuit/region-host.mjs:1-17,33-48`), but that selects region packages, not a capability's provider | Bindings are read-only sets (`declare-provider-details-read.sql:243-264`); the writer has no binding section (`install-provider-details-change.sql:19-34`); the lived switch was an estate migration writing provider identity, transformation literals and port configuration (`sfx-embody/sql/migrations/route-objective-v3-summary-through-secondary-provider.sql:23-33`) | A staged intent for the two writer-reachable writes, with the new-provider case declared as a migration, not a UI edit (16b §4, `[proposal]`) |
| **API label / URL** | Nothing as an edit form. The read carries `declared_name` (`declare-provider-details-read.sql:186`), `url_prefixes`, endpoint template/digest/state (`declare-provider-details-screen-read.sql:293-301,510-517`); the view shows the whole engagement row read-only (`provider-profile-P1.ui-view.json:924-944`) | The writer can patch one configuration member or replace a whole port configuration (`docs/live-circuit-provider-details.md:131-136`; `install-provider-details-change.sql:143-196`) | Declared field-level intents for label and url/endpoint members, and a form that reads its current value and digest from the engagement row (16b §4, `[proposal]`) |

No writer is applied from the browser; the retrieval service is read-only by policy
(`docs/live-circuit-provider-details.md:120-126`; `live-circuit/circuit/README.md:187-191`).

## 6. Efficiency: one broad read versus per-provider scoped reads

**The broad read.** The details reader materialises the newest selected generation of *every*
estate port before it can find the provider's engagements
(`declare-provider-details-read.sql:70-82`), then expands every instruction-bearing port body of
the engaged namespaces plus every instruction-bearing transformation, walking to depth 40 with
`MAXRECURSION 200` (`:278-320,359-414`). The verified Gemini Select capture is 1,620,113 response
bytes with 2,028 instruction rows (`provider-profile-P1.ui-view.json:273,1059,1124`). A platform
catalog engaged by 1,047 selected port generations can exceed the 30 s read timeout, which is why
the canonical reader is *selected* for it rather than tried and caught
(`docs/live-circuit-provider-details.md:286-294`; `circuit-host.json:14-15`).

**The scoped estate reads already exist and are admitted but unused.**

- `analysis.read_provider_bindings`, `analysis.read_provider_ports`,
  `analysis.read_capability_operations`, `analysis.read_capability_providers` are in the retrieval
  allowlist (`deploy/sda-kernel/retrieval-policy.json:5-8`) and described as the drill-down's reads
  (`docs/live-circuit-staging-deployment.md:156-166`).
- Their declarations are id-keyed and bounded: bindings (binding, slot operations, binding ports —
  `sfx-embody/sql/migrations/declare-provider-and-operation-inspection.sql:100-145`), ports
  (`:148-187`), capability operations (summary + operation rows, `:190-251`), capability providers
  (summary, provider rows, evidence, unresolved platform ids —
  `sfx-embody/sql/migrations/declare-read-capability-providers.sql:7-19`). The screen wave adds
  screen-shaped projections to the same broad read (`declare-provider-details-screen-read.sql:7-40`).
- The host never calls them: `readProviderInspection` builds one request from the one configured
  procedure (`live-circuit/circuit/live-store.mjs:359-365`).

**Where scoping can be declared today.**

- `circuit-host.json` `retrieval.provider` is the only declared reader map, and
  `canonicalProviders` is the existing precedent for a per-provider reader declaration
  (`live-circuit/circuit/circuit-host.json:12-15`; consumed by `providerReader`,
  `live-circuit/circuit/live-store.mjs:347-348`).
- The policy allowlist admits new reads without estate change (`retrieval-policy.json:2-9`), but a
  service binary and DAL must carry them (`docs/live-circuit-staging-deployment.md:162-166`).
- The estate operation catalog declares read parameters and result-set shapes as data
  (`sfx-embody/sql/migrations/declare-provider-inspection-catalog.sql:7-13,21`), so a per-set scope
  vocabulary could be declared there.
- A reader-side `@scope`/`@sets` parameter would be an SDA behaviour change and must go through a
  request, not a shell change (`docs/live-circuit-provider-details.md:92-100`; `AGENTS.md`;
  16b §5 `[proposal]`).

## 7. The hosted `sfx-ui-*` provider API surface

The packages the contract would sit beside:

- Each provider is one folder named exactly by its provider id and exports
  `descriptor`/`capabilities`/`invoke` (`sfx-providers/docs/ui-provider-hosting.md:8-22`).
  Header/left-sidebar/middle/right-sidebar are 0.1.0, footer 0.2.0, token set 0.1.1
  (`sfx-providers/providers/sfx-ui-explorer-region-header/sfx-ui-explorer-region-header.mjs:3`,
  `.../sfx-ui-shell-footer/sfx-ui-shell-footer.mjs:3`,
  `.../sfx-ui-runtime-token-set/sfx-ui-runtime-token-set.mjs:3-4,15`).
- Region providers share one factory and return CSS/HTML/SVG candidates with digests
  (`sfx-providers/src/ui-providers/region-provider.mjs:8-40,44-78,181-198`); the token set exposes
  `ui.tokens.resolve` (`sfx-ui-runtime-token-set.mjs:4`).
- Versioned API: `GET /ui-providers`, `GET /ui-providers/{providerId}/manifest`,
  `GET .../assets/{assetId}`, `POST .../invoke`, every route accepting `?version=` with a named 409
  on mismatch (`sfx-providers/docs/ui-provider-hosting.md:40-49`;
  `sfx-providers/src/ui-providers/http.mjs:3-11,46-108`).
- The drill-down provider `sfx-ui-provider-drilldown` owns `ui.view.prepare` (READ_ONLY): it accepts
  a supplied `ui-page.v1` reader result with `ui-view.v1` identity, validates and selection-binds
  it, and never reads the estate or synthesizes a profile
  (`sfx-providers/providers/sfx-ui-provider-drilldown/sfx-ui-provider-drilldown.mjs:7-17,19-35`;
  `README.md:6-16`; `browser.mjs:20-22`).
- Stage B is unfinished: the platform still renders Explorer from its pinned region packages while
  the invoked estate circuit calls the hosted API; the browser-provider receipt fix and consumer
  selection are outstanding (`sfx-providers/docs/ui-landing-provider-coverage.md:37-48,50-71`).
- Consequence for the contract: the hosted API has no provider-detail operation today; a contract
  reference could ride the manifest without adding a route (16b §8, `[proposal]`).

## 8. Exact gap list to a provider UI contract

Numbered deltas between the observed surface and the `provider-ui-contract.v1` design in
[`16b`](16b-provider-ui-contract.md). Each closure is `[proposal]`.

| # | Gap | Observed anchor | Contract element that closes it (16b) |
| ---: | --- | --- | --- |
| G1 | No declared per-provider/per-kind read scope; kind is discovered, never requested | one procedure, one parameter pair (`live-circuit/circuit/live-store.mjs:359-367`); `readScope` absent from `circuit-host.json:12-15` | `scope` + `readScope.sets`/`rowLimits` (16b §2, §5) |
| G2 | The host executes one broad procedure for every kind, including platform and slot shapes whose instruction sets are typically empty | `readProviderInspection` (`live-store.mjs:350-391`); instructions walk (`declare-provider-details-read.sql:278-320`) | per-kind defaults that omit inapplicable sets (16b §5-§6) |
| G3 | Scoped reads (`read_provider_bindings`/`_ports`/`read_capability_operations`/`read_capability_providers`) are policy-admitted but unreachable from the host | `retrieval-policy.json:5-8`; `docs/live-circuit-staging-deployment.md:157-161`; single request (`live-store.mjs:359-365`) | host reads the contract's sets/scope, not one fixed procedure (16b §5, §8) |
| G4 | The response identifies the reader name but not its version/digest; the platform doc still documents eight sets and a `readerFallback` that the code removed | `live-store.mjs:380-389`; `docs/live-circuit-provider-details.md:29,76-82`; screen wave `declare-provider-details-screen-read.sql:761` | reader/contract digests in the served view and panel parity evidence (16b §7, §10) |
| G5 | Only the identity set is validated; every other set is passed through on shape alone | `live-store.mjs:375-378,385-387` | per-set selection that refuses an absent set/column by name (16b §3.1) |
| G6 | Field/row selection is hand-coded in the view (whole rows, literals, captured pointers) instead of declared pointers into the read | `provider-profile-P1.ui-view.json:431-500,791-905`; published literals (`declare-provider-profile-view.sql:68`) | `selection` pointers + closed vocabulary (16b §2-§3) |
| G7 | The instruction editor is presentation-only: form and staged document exist, but no action/event dispatches and `stage-change` has no handler | `provider-profile-P1.ui-view.json:791-905`; `page-runtime.js:673-675`; no `page-action` listener found | `editable` sections populating a `form`/`code` and a wired `stage-change` (16b §4) |
| G8 | Model version, API label, request URL and provider switch have no declared edit form or intent, although the writer can express most of them | `install-provider-details-change.sql:19-34,131-136`; read carries the raw members (`declare-provider-details-read.sql:186,193-196`; `declare-provider-details-screen-read.sql:510-517`) | four intent families mapped to writer sections/guards (16b §4) |
| G9 | The served view is a captured 8-set artifact with deck/provenance material and baked literals | `provider-profile-P1.ui-view.json:236,431-500,1116-1132`; staleness vs `declare-provider-details-screen-read.sql:786-791` | one generic view composed from the contract; raw sets stay one disclosure away (16b §3.5, §7) |
| G10 | No contract document, no contract reader, no stale-contract refusal; the view cannot say which contract revision it was composed from | `declare-provider-profile-view.sql:68` carries only `viewId`/`viewContractId`/provenance | `ui_provider_ui_contract` rows + declared reader + `contractDigest`/`resolution` in the view (16b §7) |
| G11 | The hosted UI provider API has no provider-detail operation; the drill-down provider is a pass-through over a prepared read, and its manifest references no contract | `sfx-ui-provider-drilldown.mjs:13-17`; `ui-provider-hosting.md:40-49` | manifest `uiContract` reference only; no new route (16b §8.5) |
| G12 | Editor guard sourcing is manual: the staged document's `expectedDigest` values are literals from one capture, not read-selected row digests, so a stale page cannot be told from a fresh one | `provider-profile-P1.ui-view.json:847-853`; writer's guard semantics `PROVIDER_DETAILS_STALE_DIGEST` (`docs/live-circuit-provider-details.md:201-207`) | guards initialised from `provider_instructions.definition_digest`, `provider_engagements.generation_digest`, `provider_identity.definition_digest` (16b §4 guard rules) |
| G13 | The drill-down displays neither the resolved model nor the three active instruction sources; the model-provider trace exists only outside it | `sfx-dal/.tmp/model-provider/model-resolution.json` (`model`, `stages`; ignored local trace, not committed); instruction texts at `prepare_objective_selection.sql:31`, `prepare_objective_capability_request.sql:31`, `prepare_objective_summary.sql:9`; the view's model/instruction material is captured literals (`provider-profile-P1.ui-view.json:716-737`) | a model section and instruction-source table over scoped read fields (16b §10.1-§10.4) |

## 9. What this document does not claim

- It does not assert that the screen-shape read (eleven sets) is installed in staging or
  production; it asserts only what the repository migrations declare and what the platform code
  and docs record.
- It does not re-specify the contract; [`16b`](16b-provider-ui-contract.md) holds the design and
  its vocabularies. This document supplies the observed surface each contract element must fit.
- It asserts no execution evidence: provider inspection is a current database read, not a receipt
  (`docs/live-circuit-provider-details.md:278-285`).

## 10. Evidence map

| Artefact | Role |
| --- | --- |
| `sfx-embody/sql/migrations/declare-provider-details-read.sql` (42a8149, 2026-10-07) | the eight-set reader |
| `sfx-embody/sql/migrations/declare-provider-details-screen-read.sql` (4ef5a08, 2026-10-08) | screen wave: eleven sets, states, projections |
| `sfx-embody/sql/migrations/install-provider-details-change.sql` (2bea954, 2026-10-07) | atomic writer the editors feed |
| `sfx-embody/sql/migrations/declare-provider-profile-view.sql` (4ef5a08) | the published 39-section view and layout |
| `sfx-embody/sql/migrations/declare-ui-page-provider-drilldown.sql` (be78ccd, 2026-10-08) | the drill-down capability and its 39-section meaning |
| `sfx-providers/outputs/capability-estate/live-circuit-platform-explorer/P1/provider-profile-P1.ui-view.json` | the P1 capture the view was generated from |
| `live-circuit/circuit/live-store.mjs`, `circuit-host.json`, `view-runtime.js`, `page-runtime.js` | platform host, reader selection, mount, action dispatch |
| `sfx-platform/deploy/sda-kernel/retrieval-policy.json`, `docs/live-circuit-staging-deployment.md` | admitted procedures and deployment rules |
| `sfx-providers/providers/sfx-ui-*`, `sfx-providers/src/ui-providers/`, `sfx-providers/docs/ui-provider-hosting.md`, `ui-landing-provider-coverage.md` | hosted provider packages, versioned API, unfinished Stage B |
| `sfx-dal/.tmp/model-provider/model-resolution.json` (captured 2026-10-10T00:02:42Z; ignored local trace, not committed) | the model-provider facts G13 and 16b §10 fold in: configured model, endpoint template, the three instruction sources |
| `sfx-dal/.tmp/model-provider/prepare_objective_selection.sql:31`, `prepare_objective_capability_request.sql:31`, `prepare_objective_summary.sql:9` | the three declared instruction sources the trace resolves |
