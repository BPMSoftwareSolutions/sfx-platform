# 03 — UI capability providers: how the estate declares, binds and invokes them

Research lane 3 for the SFX website evolution. Question: how are capabilities and
providers declared, admitted, bound and invoked in the estate today, and what
would it take to declare a stack of UI capability providers (rendering, layout,
routing, actions, events) in `sfx-providers/providers/`?

Method: read-only. Every claim cites `path:line`. Proposals are labelled
`[proposal]` and are not observable behaviour. No product code was changed.

---

## How capabilities and providers exist today (observed)

### Capabilities

A capability exists as **rows**, not code. There are two authoring surfaces that
feed the same procedures:

- the JSON document surface `model.declare_capability_document`
  (`sfx-embody/sql/migrations/declare-json-authoring-surface.sql:81`), taking one
  `sidefx-capability-authority.v1` document with `capabilityId`, optional
  `meaning`, optional `cli`, `contracts[]` and `scenarios[]`
  (`declare-json-authoring-surface.sql:55-80`); and
- the SQL surface the document call composes: `model.scaffold_capability`,
  `model.declare_contract`, `model.declare_scenario`,
  `model.author_capability_meaning`, `model.configure_interface`
  (`declare-json-authoring-surface.sql:6-9`, `:128-200`).

The canonical scenario writer is `model.declare_scenario`
(`sfx-embody/sql/schema/declare-scenario.sql:68`). It:

- mints `PORT` semantic definitions from `portBindings[]`
  (`declare-scenario.sql:138-160`) and typed `port_version` rows
  (`:150-155`);
- mints the `EXECUTION_AUTHORITY` and `execution_operation` rows, plus one
  `operation_port_invocation` per `invoke-port` operation and one
  `operation_scenario_invocation` per `invoke-scenario` operation
  (`declare-scenario.sql:161-195`);
- fails closed when an `invoke-port` or `invoke-scenario` operation has no linked
  row (`declare-scenario.sql:190-195`);
- mints `scenario`, `scenario_version`, input/event/outcome faces, variants and
  the `capability_scenario` / `capability_root_scenario` links
  (`declare-scenario.sql:216-290`).

The capability envelope (user story, experience, CLI projection) is applied by
`model.declare_capability_envelope`, which mints a new `capability_version`,
copies the scenario links and repoints the current model's `estate_capability`
(`sfx-embody/sql/migrations/declare-capability-envelope-procedures.sql:44-102`);
`model.declare_capability_feature` re-mints the executable feature text
(`declare-scenario.sql:294-327`). Installed writers are the preferred path and
hand-written DML is a defect unless the procedure cannot express the change
(`sfx-providers/AGENTS.md:68-88`).

Admission/selection is digest- and model-scoped:

- definitions are content-addressed (`model.put_semantic_definition`,
  `declare-scenario.sql:2-35`); a latest-document ledger decides whether the
  installed capability document changed (`declare-json-authoring-surface.sql:104-126`);
- `estate_definition` / `estate_capability` select generations for the pin in
  `source.current_model` (`declare-scenario.sql:32-34`,
  `declare-capability-envelope-procedures.sql:52-64,98-99`);
- reads must additionally be admitted by the retrieval policy
  (`sfx-platform/docs/live-circuit-provider-details.md:76-79`,
  `:98-100`);
- estate lifecycle changes are **migration pairs**: preflight ending in
  `ROLLBACK`, commit twin ending in `COMMIT`, with in-transaction proof
  (`sfx-embody/sql/migrations/declare-provider-identity.sql:3-5`;
  `sfx-embody/AGENTS.md:25-30`).

### Providers

A provider exists as `model.provider` + `model.provider_definition` in
`sidefx:providers`, content-addressed like every definition
(`sfx-embody/sql/migrations/declare-provider-identity.sql:121-141`). The
provider's whole semantics object is supplied as one JSON catalog; `declarationProfile`
must be a profile the estate already uses (`sda-platform-capability-catalog.v1`,
`sfx-provider-catalog.v1`, `sfx-process-runtime.v1` —
`declare-provider-identity.sql:8-31`, `:45-46`). Platform links are **derived**:
every capability id in `$.capabilities[]` / `$.candidateCapabilities[]` that
resolves to a selected `sidefx:platform-capabilities` capability becomes a
`provider_capability_implementation` with role `PLATFORM`
(`declare-provider-identity.sql:16-20`, `:143-159`).

Other provider writers: `model.add_provider` and `model.configure_provider`
(`sfx-embody/sql/migrations/install-provider-details-change.sql:11,132`;
`sfx-embody/sql/migrations/declare-authenticate-ide-user.sql:72`),
`model.declare_provider_role`
(`sfx-embody/sql/migrations/bind-authenticate-ide-user-private-host.sql:1637`)
and `model.declare_provider_port_implementation` for declaring that the newest
provider definition implements one port version for one binding target
(`sfx-embody/sql/migrations/declare-provider-port-implementation.sql:8-24`,
`:54-105`).

A provider's declared configuration carries `runtime`, `package`, `type`,
`method`, `executionLocation`, `operations`, `candidateCapabilities` and
`conformanceClaims` (`sfx-embody/sql/migrations/declare-provider-details-read.sql:184-199`).
A provider package catalog such as `providers/cli-login/providers.json` is
documentation, **not database authority** (`sfx-providers/providers/cli-login/providers.json:35`;
`sfx-providers/providers/cli-login/README.md:29-30`).

There are two provider-side binding families (`scenario-driven-architecture/docs/execution-binding-mechanics.md:20-23`):

- the **registered path** — `provider_capability_implementation`;
- the **blueprint/slot path** — `provider_slot` → `slot_port_requirement` →
  `provider_port_implementation` → `provider_binding` → `binding_port_implementation`,
  written by `model.bind_slot_provider` (`sfx-embody/sql/migrations/bind-slot-provider.sql:56-146`).

### Binding a provider to a capability port

Port bindings are **port semantics**, not side tables: `model.declare_scenario` puts the
`portBindings[]` entry itself into the port definition
(`declare-scenario.sql:143`), and the binding names either

- `configuration.providerId` — an `OVERLAY` engagement, or
- `platformCapabilityId` — a `PLATFORM` engagement

(`sfx-embody/sql/migrations/declare-provider-details-read.sql:109-152`;
`sfx-dal/SFX.DAL.Config.json:334` reads both from `$.semantics`).

`analysis.read_provider_details` emits the engagement surface
(`declare-provider-details-read.sql:21-25`, `:266-274`): `generation_digest`,
`binding_id`, `provider_authority_id`, `provider_kind`,
`endpoint_authority_digest`, `credential_reference` + injection rule,
`url_prefixes`, `application_ref` + digest, `request_path`, `result_mode`,
`result_path`, `lineage_mode`, `binding_digest`, `capability_authority_digest`.
The corresponding configuration members are:

- `providerAuthorities[]` (binding id, authority id, kind, endpoint digest,
  credential reference) (`declare-provider-details-read.sql:114-125`);
- `credentialAuthorities[]` (reference name → injection rule and header)
  (`:121-125`);
- `endpointAuthorities[]` (`urlPrefixes`) (`:126-129`);
- `applicationRef.ref` / `.digest` (`:130-131`) and carrier shaping
  (`requestPath`/`resultMode`/`resultPath`/`lineageMode`) (`:132-135`).

Binding writers observed:

| writer | scope |
| --- | --- |
| `model.bind_provider` | port + platform capability + configuration, all invocations (`execution-binding-mechanics.md:87-94`) |
| `model.replace_port_configuration` / `model.patch_port_configuration` | whole or one member of `$.configuration`, digest-guarded (`sfx-embody/sql/migrations/patch-port-configuration.sql:8-28`, `:58-168`) |
| `model.bind_provider_port` | scenario-level re-declaration (`execution-binding-mechanics.md:93`) |
| `model.bind_slot_provider` | blueprint slot scope (`bind-slot-provider.sql:8-28`) |
| `model.declare_provider_port_implementation` | provider→port implementation for a target profile (`declare-provider-port-implementation.sql:54-105`) |
| `model.install_provider_details_change` | atomic document writer over provider name/operations/configuration, engagements and instructions (`sfx-embody/sql/migrations/install-provider-details-change.sql:8-44`) |

Instructions (SYSTEM/USER message templates and projections) are declared
members under the engaged ports and transformations; the read labels them
`DECLARED_TEMPLATE`, `DECLARED_LITERAL`, `PROJECTED`, `MAPPING`, `FIXTURE`,
`INVOCATION` (`declare-provider-details-read.sql:26-38`, `:276-320`) and the
writer is `model.update_definition_member`
(`sfx-platform/docs/live-circuit-provider-details.md:128-136`, `:199-207`).

**Execution location is declared data.** The login circuit declares four
providers with three distinct locations: `cli-login-input-provider` at
`client-terminal`, and the principal/credential/session providers at
`private-identity-service` (`sfx-embody/sql/migrations/declare-authenticate-ide-user.sql:54-59`),
plus `inputProvider` ordered `before-server-scenario-entry`
(`declare-authenticate-ide-user.sql:112`). Its ports deliberately declare
`"bindingState":"UNBOUND"` and the envelope declares
`"readiness":{"declaration":"REVIEWABLE","execution":"HELD"}` —
declaration can precede admission and execution
(`declare-authenticate-ide-user.sql:86-94`, `:106-114`).

External HTTP bindings carry endpoint authority, credential reference and an
injection rule; the equity route's acceptance changes the injected header by
patching `$.configuration.credentialInjectionRules[0].headerName`
(`patch-port-configuration.sql:203-204`, `:224-227`). The altitude binding
documents show the full document shape — endpoint host/method/pathPrefix,
credential source `vault`, `effectScope`, `mapping`, `observedSample`
(`sfx-providers/bindings/altitude-01.binding.json:19-50`; the author stage
refuses `PROVIDER_NOT_DECLARED` until the provider exists —
`sfx-providers/bindings/README.md:45-75`).

---

## Provider invocation model

### What executes, and where

- The estate has no runtime of its own: the installed kernel
  `KernelEntry.exe` is selected as host data and driven over the closed
  `sfx-command-delivery.v1` stdin envelope
  (`sfx-embody/AGENTS.md:42-50`; `sfx-platform/live-circuit/circuit/live-store.mjs:27-32`, `:120-126`).
- Inside the kernel, a provider is a profile-bound function: the realization
  overlay maps a provider slot to `providerProfileId` + `implementationRef`
  (`scenario-driven-architecture/languages/typescript/runtimes/node/semantic-execution-graph/overlay-resolver.js:4-17`),
  and the scheduler resolves `#options.providers[binding.providerProfileId]` and
  invokes it with `(input, context)` (`scheduler.js:452-491`, `:776-819`,
  `:930-932`). Missing binding or provider is `PROVIDER_BINDING_DIVERGENCE` /
  `UNDECLARED_EXECUTION_MECHANIC` — fail closed, no fallback
  (`scheduler.js:458-465`, `:777-789`).
- What the runtime sees is **testimony**, not a return value alone: each
  completed cell publishes a timestamped receipt carrying `providerProfileId`
  and `providerProfileDigest`, with bounded `providerEvidence` (e.g.
  `reachedStage`, `transportDisposition`) (`scheduler.js:557-566`, `:12-32`).
  The observer stream consumes these receipts
  (`sfx-platform/live-circuit/dispatch-pair/observe-server.mjs:94-113`, `:206-245`).

Concrete provider kinds in use:

- **In-process native mechanics** loaded by the Node registry
  (`scenario-driven-architecture/languages/typescript/runtimes/node/admitted-consumer-platform.mjs:9-19`);
- **Nested capability invocation** — a provider that composes and runs a child
  projected application, verifying the binding and capability-authority digests
  before the child executes and retaining nested lineage
  (`.../projected-capability-invocation-provider.mjs:6-28`, `:90-120`);
- **Declared statement** — `read-circuit-presentation` is a capability whose
  port binding carries the entire SQL read as a configuration string with
  `platformCapabilityId: sda-embodiment-plan-port.v1` and `resultColumn`
  (`sfx-embody/sql/migrations/declare-circuit-presentation.sql:59-67`, `:80-110`).
  A "provider invocation" can therefore be declared data executed by a generic
  platform, not a bespoke service;
- **Governed external HTTP** with endpoint authority and vault credential
  injection (the equity/RapidAPI route; `patch-port-configuration.sql:194-217`);
- **Bounded local process** with admitted executables and roots
  (`.../platform-effect-provider.mjs:26-96`);
- **Arbitrary authored computation** as a declared capability — for example the
  `read-circuit-presentation` display transformation
  (`declare-circuit-presentation.sql:112-134`).

### Can a provider be a browser-side renderer?

Today, **not as an estate binding**. Binding contexts resolve only `node`,
`python` and `csharp` targets with fixed profiles
(`bind-slot-provider.sql:10,30`; `declare-provider-port-implementation.sql:10,89-91`),
and the live browser is a GET-only reader: it fetches catalog, scenario,
capability-details and provider-inspection JSON, then renders returned SVG and
follows opaque targets (`sfx-platform/docs/live-circuit-data-contract.md:15-23`,
`:49-55`, `:99-106`). Provider inspection is a server-side read: the observer
calls the `procedure-extract` service with server-held credentials and the
browser never receives `SDA_API_TOKEN`
(`sfx-platform/live-circuit/circuit/live-store.mjs:233-282`;
`sfx-platform/docs/live-circuit-provider-details.md:90-100`).

Architecturally, the SDA projection model does define browser embodiment:
`ui-embodiment-plan.v1` is applied by a target adapter that maps semantic kinds
to native roles (`.../runtimes/browser/runtime/ui-embodiment-plan-v1.mjs:26-108`),
the React adapter materializes it with a `NATIVE_ROLES` table
(`.../presentation/react/runtime/v3-plan-embodiment.mjs:6-24`, `:42-65`), and the
projection carries `providerId` + `providerDigest` and emits structural
testimony (`ui-embodiment-plan-v1.mjs:110-146`). ADR-0007 separates
`UiEmbodimentProvider` from physical realization providers and requires targets
to apply admitted plans without reinterpreting meaning
(`scenario-driven-architecture/docs/decisions/0007-...md:17`, `:35-46`, `:48-57`).
So a browser renderer provider is compatible with the architecture but is not
yet a binding target the estate can select.

---

## Declaration anatomy for a UI capability stack [proposal]

### Mapping the hypothesis onto the estate's vocabulary

| hypothesis term | estate object(s) | notes |
| --- | --- | --- |
| page capability | capability + root terminal scenario + contracts + execution authority | one capability per route; input = route/params, outcome = page document |
| layout capability "as provider" | either (A) a capability invoked via `invoke-scenario`, or (B) a port provider named by `configuration.providerId` | (A) keeps layout meaning in capability authority; (B) matches "as a provider" literally and is proven by the `sda-embodiment-plan-port.v1` statement pattern |
| section capabilities | capabilities per section kind; invoked by the layout scenario or bound on layout ports | each returns a section document |
| layout sections | `regions[]` / `slots[]` in the layout outcome contract | page/outcome contract data, not renderer code |
| section display/data/actions/events | section outcome contract members: component kind + props + data + declared action/event ids | events resolve to operation ids / capability invocations |
| UI component implementations | providers (renderer/action/event ports) selected by port configuration | rendering implementation remains code; the kind and props contract are data |

Recommended shape `[proposal]`: pages invoke one **layout** capability, which
groups **section** capabilities by slot; the layout's outcome is the composed
page document. Where a renderer needs to execute, the layout/section port binds a
UI provider (statement, browser projector, or external service). This keeps
capability identity (page, layout, section) independent of provider realization,
which is the estate's sovereignty argument (`intent.md:352-374`,
`sfx-providers/docs/capability-absorption-playbook.md:117-123`).

### Level 1 — page capability [proposal]

Data (declared in an `sfx-embody` migration pair, using the document form):

```json
{
  "document": "sidefx-capability-authority.v1",
  "capabilityId": "ui-page-ecosystem",
  "meaning": { "intent": "render the Provider Ecosystem page", "outcome": "a page document of bound sections" },
  "contracts": [
    { "id": "ui-page-request.v1", "schema": { "...": "route, query, locale" } },
    { "id": "ui-page.v1", "schema": { "...": "route, layoutDigest, sections[]" } }
  ],
  "scenarios": [{
    "scenarioId": "ui-page-ecosystem",
    "inputId": "ui-page-request", "inputContract": "ui-page-request.v1",
    "eventId": "ui-page-requested", "eventAuthority": "ui-page-ecosystem.v1",
    "outcomeId": "ui-page", "outcomeContract": "ui-page.v1",
    "terminal": true, "root": true,
    "operations": [
      { "operationId": "page.layout", "kind": "invoke-scenario", "scenarioId": "ui-layout-marketing" },
      { "operationId": "page.sections", "kind": "invoke-scenario", "scenarioId": "ui-section-provider-ecosystem" }
    ],
    "portBindings": [
      { "portId": "ui-page-render-port",
        "platformCapabilityId": "sda-ui-render-port.v1",
        "configuration": { "providerId": "sfx-ui-renderer", "bindingState": "UNBOUND",
          "executionLocation": "browser-runtime", "requiredBoundary": "declared page document only" } }
    ]
  }]
}
```

All members above are existing document vocabulary
(`declare-json-authoring-surface.sql:55-80`); `ui-*` ids and contracts are
`[proposal]` and would be new migration-pair declarations. `bindingState:
UNBOUND` and an explicit `executionLocation` mirror the login circuit's honest
declaration-before-admission pattern
(`declare-authenticate-ide-user.sql:86-94`, `:106-114`).

### Level 2 — layout capability [proposal]

- Contract `ui-layout.v1`: `regions[] = { slotId, role, componentKind,
  sectionCapabilityId, dataRef, order, layoutIntent }`, plus the layout policy
  (`stack`/`row`/`grid`, density, token references). This is declared contract
  data, in the spirit of the declared box/glyph policy in
  `read-circuit-presentation` (`declare-circuit-presentation.sql:59-67`); it
  must not be a CSS class list or framework name
  (`scenario-driven-architecture/docs/ui-authority-and-parity.md:39-48`).
- Scenario operations invoke each section capability (`invoke-scenario`) or
  call a data port (`invoke-port`) bound to a declared statement provider.
  Multiple non-terminal `invoke-scenario` operations are declarable today
  (`declare-scenario.sql:180-189`); composition of their outcomes is a runtime
  question (see Gaps).
- The layout is not a `model.provider` in option (A). In option (B) the layout
  port names `platformCapabilityId` + `providerId` exactly as
  `declare-mechanic-capabilities.sql:47` does.

### Level 3 — section capabilities [proposal]

- One capability per section kind: `ui-section-hero`, `ui-section-feature-list`,
  `ui-section-standards-table`, `ui-section-article`, `ui-section-cta`. Contract
  `ui-section.v1` carries `componentKind`, `props`, `data`, `actions[]`
  (`eventId` → operation/invocation) and `events[]`.
- Data reads: bind ports to declared SQL statements (the
  `read-circuit-presentation` pattern, `declare-circuit-presentation.sql:80-83`)
  or to governed HTTP providers for external content.
- Actions: declared events with operation ids in the section authority; the
  authority already parameterizes events per scenario
  (`declare-scenario.sql:203-215`), and nested capability invocation is the
  proven action mechanism (`projected-capability-invocation-provider.mjs:90-120`).

### What code must still exist [proposal]

The deployed shell (browser) keeps only: fetching declared documents, applying a
generic component projector, event dispatch, and caching. That is the browser
analogue of ADR-0010's language kernels — "language ecosystems resolve language,
toolchain, packaging and native API bindings only"
(`scenario-driven-architecture/docs/decisions/0010-...md:21-31`). Everything
that is page/section **meaning** is declaration data.

### How the browser receives the contract [proposal]

Existing reads the page shell can use today:

- `/api/circuit/v1/home` returns host-configured hero, featured and sign-in
  circuit (`sfx-platform/live-circuit/dispatch-pair/observe-server.mjs:430-433`, `:46-52`;
  `circuit-host.json:6`), and the current home page already consumes it
  (`live-circuit/circuit/home.js:83-93`).
- `/api/circuit/v1/capability-details` returns the complete capability details
  document (`live-store.mjs:216-232`; reader declared at `circuit-host.json:20`).
- `/api/circuit/v1/provider-inspection` returns the provider/engagement/
  instruction result sets (`live-store.mjs:233-281`;
  `live-circuit-provider-details.md:22-40`).
- `/api/circuit/v1/scenario` returns database-authored slides, geometry and
  navigation (`live-store.mjs:193-210`).

Two viable routes to a page document `[proposal]`:

1. **Declared reader route** — add a `read-ui-page` capability (statement or
   capability invocation) and a `readers.page` entry in `circuit-host.json`
   plus retrieval-policy admission (`circuit-host.json:17-21`;
   `live-circuit-provider-details.md:76-79`, `:98-100`). This is a deploy of
   `live-circuit/**` and `deploy/sda-kernel/**` (watched paths;
   `sfx-platform/AGENTS.md:10-13`), but page/content changes afterwards are data.
2. **Capability invocation route** — invoke the page capability through the
   kernel and read its outcome. The run API today exposes run observation, not a
   generic invoke endpoint (`live-circuit/circuit/run-api.mjs:10-22`), so this
   also needs a host read or a new reader declaration.

Until either lands, the home `featured` list and page composition remain host
data and require a deploy to change (`circuit-host.json:6`;
`observe-server.mjs:46-52`).

---

## Component registry options

| option | what is declared | what is deployed | pros | cons |
| --- | --- | --- | --- | --- |
| A. Estate-declared component contracts | component kinds, prop/read/action schemas, section placement, event ids — all as capabilities/contracts/port semantics in migration pairs | a generic projector that interprets the vocabulary | meaning in rows; audit, digests, no per-change deploy; versioning follows existing generation rules (`declare-scenario.sql:2-35`) | every new component kind is a migration + estate generation churn; rich native behaviour still needs projector support and must fail closed |
| B. Client registry of implementations | little or nothing; browser maps component names to JS | a registry module keyed by names | fastest initial delivery; rich components | component meaning now lives in client code; violates "meaning is authored in the database" (`sfx-embody/AGENTS.md:25-30`) and "never encode a capability in the generator" (`sfx-providers/AGENTS.md:44-47`); every new component is a deploy — the exact cost the evolution is removing (`research-brief.md:18-22`) |
| C. Hybrid: declared semantic contracts + shipped generic adapter | component kind, roles, props schema, data/action/event bindings and placement in the estate; adapter maps semantic kind → native element | one generic adapter per target with explicit `NOT_SUPPORTED` refusals | meaning in rows, implementations replaceable (sovereignty), still supports a deploy-free component list | adapter must be disciplined: unknown kinds refuse, never silently fall back; contract/test surface required |

Option C is the closest to the estate's proven patterns: circuit-presentation
has a **declared op vocabulary** interpreted by one compiler
(`sfx-providers/src/circuit-presentation/contracts.mjs:25-41`; `operations`
are the complete command surface), SDA's UI embodiment plan declares semantic
elements and a small adapter maps `semanticKind` → native role with explicit
unsupported-type refusal (`ui-embodiment-plan-v1.mjs:15-24`), and ADR-0007
requires targets to apply admitted plans and report `SUPPORTED` / `ADAPTED` /
`NOT_SUPPORTED` per capability (`.../0007-...md:41-46`, `:74`). **Recommendation
`[proposal]`: option C**, with the component kind/prop contract declared through
`model.declare_contract` + capability envelope/authority semantics, and the
adapter treated as irreducible shell code.

---

## Prior art findings

### circuit-presentation (the closest UI provider)

- `sfx-circuit-presentation` is a hand-authored Node provider with
  `toolId presentation.compile`, input/output contracts and a pure authoring
  boundary (`sfx-providers/providers/circuit-presentation/circuit-presentation.mjs:5-25`).
  It compiles JSON drawing descriptions into Google Slides requests, SVG and
  notes, with declared limits (`sfx-providers/docs/circuit-presentation.md:12-16`, `:61-117`).
- It is **not declared in the estate**; both contract ids are `PROPOSED`
  (`sfx-providers/docs/circuit-presentation.md:18-21`;
  `circuit-presentation.mjs:10-11`). The needed next step is described but not
  performed: "declare these input/output contracts, bind the compiler's
  execution seam, and retain replay and geometry fixtures"
  (`circuit-presentation.md:171-173`).
- The estate already proves the *lower* half: a presentation **policy** can be
  declared authority executed by a generic platform
  (`read-circuit-presentation`, `declare-circuit-presentation.sql:59-67`, `:80-110`).
  So "presentation as data" is proven; "presentation as a declared provider" is
  not yet.
- `capability-presentation` reads the live estate through a host-injected SQL
  seam (`sfx-providers/src/capability-presentation/estate.mjs:8-45`, `:47-60`)
  and produces model/storyboard/compiled volumes
  (`src/capability-presentation/provider.mjs:25-82`). It demonstrates a provider
  can consume estate authority read-only through an injected host binding — a
  good model for a page-rendering provider's data seam, but it reads the
  database rather than the kernel.

### identity/session providers

- Four separately named providers implement login boundaries; the input provider
  runs on the client terminal and the others in a private host over governed
  HTTPS (`sfx-providers/providers/cli-login/README.md:12-15`, `:17-33`, `:36-54`).
  `CliLoginInputProvider.AcquireAsync` refuses non-interactive terminals
  (`providers/cli-login-input-provider/CliLoginInputProvider.cs:27-35`) and bounds input
  (`:43-46`, `:76-107`); `IdeSessionProvider` issues and validates bearers
  (`providers/ide-session-provider/IdeSessionProvider.cs:6`, `:15-52`, `:55-77`);
  `IdentityPrincipalProvider.ResolveAsync` does throttled principal resolution
  (`providers/identity-principal-provider/IdentityPrincipalProvider.cs:20-45`).
- They prove: providers may execute **outside the kernel** (client side);
  provider location is declared data; private values never cross into JSON
  receipts (`cli-login/README.md:56-61`, `:71-76`). They disprove: "a provider
  must be a service".
- They do **not** prove a browser renderer: the client boundary is the CLI
  terminal, driven by the host's callbacks, and the estate has no
  browser binding context (`bind-slot-provider.sql:10,30`).

### altitude-01 (declared-shape comparison)

Every altitude provider exports the same module contract —
`{ altitude, altitudeId, altitudeName, providerId, toolId, foldedTools, modelPrompt,
inputShape, outputShape, handle }` (`sfx-providers/providers/altitude-01/altitude-01.mjs:4-41`,
`:72-111`) — and the admitted `provider add` lifecycle is author → prepare →
dry-run → preflight → install → verify
(`sfx-providers/bindings/README.md:150-187`; `sfx-providers/docs/provider-add-flywheel.md:77-93`).
The altitude bridge is a *code-now, declared-later, shrink-only* surface
(`sfx-providers/README.md:37-48`; `bindings/README.md:3-4`). A UI provider stack
should copy the uniform module contract and the lifecycle separation, but not the
bridge exception: UI components should be declared components, not a new
permanent code registry.

---

## Platform rules and risks

Rules that bind any UI-as-provider design:

1. **Capability meaning only through `sfx-embody` migration pairs.**
   `sfx-platform/AGENTS.md:14-16`; the prime rule is meaning authored in the
   database (`sfx-embody/AGENTS.md:25-30`). Page/layout/section semantics, the
   component kind list and event vocabulary must be declared rows, not client
   code.
2. **SDA behaviour changes only by request.** `sfx-platform/AGENTS.md:14`;
   the estate reaches SDA as an installed `KernelEntry.exe`, not a checkout
   (`sfx-embody/AGENTS.md:42-50`). A browser binding target, a new provider
   protocol or a runtime composition rule is a request to
   `scenario-driven-architecture`, not an edit.
3. **Identity schema only through `sfx-dal`.** `sfx-platform/AGENTS.md:15-16`.
   Generated repositories are registered in `sfx-dal/SFX.DAL.Config.json`
   (`Views` at `:10`, `Functions` at `:140`, `Catalog` at `:328`, `Writers` at
   `:697`), and the documented recipe adds a writer beside `configure_provider`
   and `update_definition_member` (`live-circuit-provider-details.md:219-241`).
   A page-content writer that touches identity data must go through DAL; other
   content writers should remain estate procedures.
4. **Reads are admitted by policy; writes never enter the retrieval service.**
   `live-circuit-provider-details.md:76-79`, `:98-100`, `:122-126`,
   `:240-241`.

Risks and constraints observed:

- **Deploy-per-shell-change remains.** The renderer/adapter and any new reader
  entry live in watched paths (`live-circuit/**`, `deploy/sda-kernel/**`) with
  acceptance gates (`sfx-platform/AGENTS.md:8-13`; `research-brief.md:86-90`).
  Declarations remove per-page deploys; they cannot remove the first shell
  deploy or SDA-side work.
- **No browser write path.** Provider details is read-only by design
  (`live-circuit-provider-details.md:122-126`); content changes are migrations
  or a server-side generated-DAL call (`live-circuit-provider-details.md:209-241`).
  A "content edit" therefore still needs a server-side tool or estate migration
  unless a new admitted writer path is built.
- **Credentials stay server-side.** `SDA_API_TOKEN` is sent only by the observer
  (`live-store.mjs:242-249`); the browser never receives it
  (`live-circuit-provider-details.md:96-100`).
- **Read limits and cost.** Host limits: 30 s timeout, 16 MiB response, two
  concurrent reads, 30 s cache TTL (`circuit-host.json:7-11`). The details read
  can exceed the timeout for platform catalogs
  (`live-circuit-provider-details.md:290-294`). A page read should be scoped and
  cached; the resident kernel pipe serializes deliveries
  (`live-store.mjs:27-32`).
- **Digest/staleness contracts.** Component documents need plan/contract
  digests and explicit refusals, as SDA's embodiment plan does
  (`ui-embodiment-plan-v1.mjs:15-24`); provider details already refuses stale
  selections with `PROVIDER_DEFINITION_CHANGED` 409
  (`live-circuit-provider-details.md:254-255`) and capability details refuses
  changed snapshots (`live-circuit-data-contract.md:35-38`).
- **Frozen vocabulary.** `consumer-ui-authority.v1` and presentation protocol
  choices are frozen; successors are new protocols, not extensions
  (`scenario-driven-architecture/docs/decisions/0007-...md:36`, `:70`). SDA's
  "no new handwritten successor presentation mechanics" policy means a UI
  provider must come from declared capability authority plus generic projection
  (`docs/decisions/0010-...md:44-60`, `:74-86`).
- **Host data is duplicated authority.** The `home` block is host policy until
  "the list is declared as database authority (revamp P3)"
  (`circuit-host.json:6`). A page capability stack must not quietly add more
  host-side composition; that would repeat the cost the evolution targets.

---

## Gaps and unknowns

- **No UI component contract or protocol exists in the estate.** The closest
  declared artefacts are the read-live-scenario-circuit slide/geometry contract
  (`live-circuit-data-contract.md:15-23`) and circuit-presentation's `PROPOSED`
  request/output contracts (`circuit-presentation.mjs:10-11`). No
  `ui-component`, `ui-layout` or `ui-section` contract is installed.
- **No browser binding context or provider profile.** Targets are `node`,
  `python`, `csharp` (`bind-slot-provider.sql:10,30`). Browser execution exists
  only as unbound SDA projection code (`ui-embodiment-plan-v1.mjs`), not as an
  estate-selectable provider. Whether a `browser-runtime` target is an SDA
  change request or can be modelled as a declared application reference
  (`applicationRef`, `declare-provider-details-read.sql:130-131`) is unresolved.
- **Multi-child composition semantics are unproven for the page→layout→sections
  shape.** Multiple `invoke-scenario` operations are declarable
  (`declare-scenario.sql:180-189`), but how the runtime composes several child
  outcomes into one page document (ordering, failure admission, partial
  sections) is not demonstrated; the proven nested pattern is one projected
  child per invocation (`projected-capability-invocation-provider.mjs:90-120`).
- **No installed writer for component/section declarations from the site.**
  The details writer composes existing layer writers for providers, port
  configuration and instruction members only
  (`install-provider-details-change.sql:8-44`); page/section/component changes
  would need existing capability writers or a new declared writer.
- **How page documents reach the browser is undecided.** Option 1 (new declared
  reader + policy entry) and option 2 (capability-invocation outcome) both
  require a deploy of `circuit-host.json`/`live-circuit` and, if kernel-invoked,
  a reader identity in boot configuration (`live-circuit-data-contract.md:20-23`).
  No page read exists today (`circuit-host.json:17-21`).
- **Provider inspection is a database read, not an execution receipt**
  (`live-circuit-provider-details.md:278-285`). It cannot evidence that a UI
  provider actually rendered; only the kernel testimony stream can
  (`scheduler.js:557-566`). Whether browser-rendered output can produce
  comparable testimony is open.
- **Local development and cache behaviour.** What a page author edits locally,
  how the 30 s TTL cache is bypassed (`circuit-host.json:11`), and how
  unchanged-digest replays are tested are all unaddressed for page documents.
- **Content-change authority is still a policy question.** The revamp goal is
  that a UI tweak or content edit does not need a deploy
  (`research-brief.md:18-22`), but no admitted content-writer path from the
  site to the estate has been built; provider details is deliberately read-only
  (`live-circuit-provider-details.md:122-126`).
