# Live scenario circuit

The [scenario playback contract](https://github.com/BPMSoftwareSolutions/sfx-embody/blob/main/docs/scenario-playback-contract.md) defines
the replay window, excluded host phases, clock scaling, evidence retention, and
acceptance checks. **Startup, database connection, session setup, authority reads,
and graph preparation are excluded from scenario playback.**

The default source is **Live database**. Search the installed kernel catalog,
select any capability and namespace, and open its declared scenarios without
creating an export. The reader supplies the circuit SVG, deck palette and Arial
typography, complete event pages, component navigation and observation bindings.
See [live circuit data and navigation](https://github.com/BPMSoftwareSolutions/sfx-embody/blob/main/docs/live-circuit-data-contract.md)
for the portable contract, caching, selection validation and evidence limits.

Click circuit labels to drill into complete event circuits and component
relationships. **Explore component** also opens operations, ports/bindings,
providers, platform catalogs, mechanics, transformations and contracts returned
by the reader. These are deck-style SVG drill-down scenes; declaration trees and
JSON appear beneath them for inspection. **Drill-down page** exposes every page
of a large detail, and operand links open the selected declaration subtree.
Details load on demand; Back/Forward and URL reload preserve the
selection. Page/detail navigation does not reset a running replay.

For the hosted demo, start with the [sidefx/staging deployment guide](../../docs/live-circuit-staging-deployment.md).
It identifies the canonical platform runbook, deployed services, vault and API
boundaries, database versus image releases, live/replay acceptance and rollback.

Start locally from the sfx-platform checkout with `SDA_ESTATE_DIR` naming the estate
(the directory whose `sfx.config.json` selects the installed kernel and whose
`evidence/` holds retained decks), then `node live-circuit/dispatch-pair/observe-server.mjs`. In the
image the estate directory is `/opt/sfx/estate`, two levels above this file. The observer listens on
8787 by default. The installed kernel delivery comes from `sfx.config.json` and
reader/transport limits from `live-circuit/circuit/circuit-host.json`. No package install,
build, source checkout or generator import participates.

## Capability details reading

`GET /api/circuit/v1/capability-details?capabilityId=…&namespaceId=…` returns the
complete capability details reading as one document (`capability-details.v1`):
every result set of the estate's `analysis.read_capability_details`, in emission
order, ending with `capability_navigation`. That set holds the Explorer's
declared tree, tabs, counts, badges and per-scenario attribution. The host invokes
the declared capability `read-capability-details` through the installed kernel
(the `details` reader in `circuit-host.json`), with the same queue, timeout,
response-size limit and cache as the scenario reader.

The host passes the document through unchanged. It never selects, counts or
interprets the sets. A capability that is unknown or not selected returns 404
(`CAPABILITY_NOT_FOUND`, `CAPABILITY_NOT_SELECTED`), a namespace mismatch returns
409, and a reading that fails in the estate returns 422 with its kernel code
(for example `CELL_EXECUTION_FAILED`). None of these responses carry sets, so a
failure is never shown as an empty workspace.
`verify-capability-details.mjs` checks a running host against real capabilities.

## Capability Explorer

`/circuit/explorer?capability=…&namespace=…[&scenario=…&node=…&row=…&page=…&detail=…]`
is the Live Circuit Platform's one workspace (`explorer.html`, `explorer.js`,
`explorer-model.mjs`, `circuit-runtime.js`). The former separate circuit page is
gone; `/circuit` and `/circuit/` redirect here, keeping their query. The regions:

- **Shell:** the tree, the tabs and the scenario switcher are the reading's
  declared navigation rows: coordinates, nodes, aliases and scenarios. Counts,
  states, placements and finding badges are shown as returned. Empty and
  diagnostic sections stay listed under their coordinate.
- **Sidebars:** the capability tree and the run context resize by dragging their
  splitters (double-click resets the default width; a focused splitter resizes
  with arrow keys, Home/End, and collapses with Enter or Space). The header's
  **Sections** and **Observe & details** buttons collapse them, and widths plus
  collapsed state persist per browser. Below 1150 px the same buttons open the
  drawers instead.
- **Objective row:** above the run bar, the universal `request-capability-from-objective-v3`
  composer. Type or dictate an objective (the prompt shell's mic icon and voice status), press
  **Run**, and the Explorer switches to that capability and follows the run. The
  requested-capabilities strip sits under the circuit with honest attribution, and the summary
  player speaks the summary's spoken text: tool-result JSON and machine payloads are never read
  aloud, while the on-screen text stays verbatim. Text always works when dictation or audio is
  unavailable.
- **Circuit and run bar:** the selected scenario's database scene, drawn by
  `renderCircuitViewer`, with the circuit runtime mounted on it: live following of
  observer runs, captured replay (pause, step, speed, return to live), follow
  execution page, drill-down pages, and a collapsible panel of verification
  evidence and execution testimony. The element ids of these controls (`#viewer`,
  `#slide`, `#mode`, `#follow`, `#speed`, `#replay`, …) are what the staging browser
  acceptance drives.
- **View: Paged | Linear** (shown when the scene has a `scenario-linear` slide).
  Paged is the page-by-page circuit. Linear shows the reader's single linear
  scene: Given / Input pinned at the left, Then / Outcome pinned at the right, and
  the execution bands scrolling between them.
  - **Zoom:** −, Fit, 100%, 125% and +, or Ctrl + wheel. 100% is a page's width.
    Zoom stops where the two end caps would take half the frame.
  - **Follow execution** scrolls the band to the current position instead of
    switching pages.
  - **Saved:** the choice is kept per viewer and in the URL (`view=linear`).
  - **Traversal:** paged traversal never includes the linear slide.
- **Sections:** each section shows the rows of its declared result set. A
  scenario-scoped section shows only the selected scenario's rows, using its
  declared scenario key. Rows with a non-ROW `row_state` are shown as markers.
- **Linking sections and circuit:** a row whose declared scene key names a
  component of the circuit links to it, and a circuit target selects its section.
  Components without a declared scene key (operations, bindings) select no
  section. Any component's declared authority opens in the right column.
- **Observe:** at the top of the right column. The input contract becomes one
  control per declared field: constants are fixed, enums are lists, strings are
  text, string arrays are one item per line, and anything else is a JSON value.
  The fields write the input JSON shown below them. That JSON is what is
  submitted, and editing it updates the fields. Observe requires a signed-in
  session where the host policy says so.

The details and the scene are read in parallel, so the circuit appears first. A
failed reading is shown as a failure, never as empty sections.
`verify-explorer.mjs` checks a running host, including that the client names no
result set.

## Provider database inspection

Open a declared provider through a circuit label or **Explore component**.
Below its declaration, **Provider database inspection** displays the named
result sets and row counts returned by the hosted procedure-extract API. Expand
each set to inspect its rows. The component identity comes from the selected
database scene; the browser does not choose a SQL procedure or synthesize fields.

The observer's `PROCEDURE_EXTRACT_ENDPOINT` selects the HTTP service. On Azure it
is the colocated loopback service at `http://127.0.0.1:8791`; a local observer can
point to a local service or the hosted `/procedure-extract` URL. Direct hosted
calls use the existing server-side `SDA_API_TOKEN`. No token is sent to the
browser. `circuit-host.json` declares the provider reader and identity result set.

The same-origin `GET /api/circuit/v1/provider-inspection` requires a capability,
namespace, scenario, provider detail ID and expected circuit snapshot digest.
The host revalidates that selection, invokes the generated-DAL reader, and checks
the returned provider ID and definition digest. Stale selections return 409;
non-provider details return 422. Reads share the existing queue, timeout and
response-size limits. Navigation cancels display of a superseded response.

The provider drill-down renders the **provider involvement profile** from
`analysis.read_provider_details` (identity, configuration, mechanics/ports,
bindings, engagements, instructions, invocations, summary; the raw sets stay in
a fold). `circuit-host.json` declares that reader with its identity set, and keeps
`analysis.read_provider_canonical_body` as the declared fallback for the platform
catalog providers named in `canonicalProviders` (a platform capability can be
engaged by more than a thousand ports and exceed the read timeout). If the details
reader fails for any other provider, the host retries the canonical reader and
reports the reader and the reason (`readerFallback`); the profile shows the reason
instead of an empty workspace.

These are current database reads, not execution receipts. They do not affect
live flow or replay. The inspector remains read-only: instruction and engagement
editors stage the exact change document for `model.install_provider_details_change`
(with its `expectedDigest` guards) and copy or download it — nothing is applied in
the browser, and no writer is added to `retrieval-policy.json`.

Azure acceptance on 2026-10-02 verified Gemini Select and Gemini Summary with
eight returned result sets each, exact definition digests, stale-selection 409
and non-provider-selection 422. The hosted browser expanded the canonical row
without JavaScript errors. Evidence is retained at
the estate's `evidence/retrieval-api-deployment-20261002/azure-acceptance.json` and in the
deployment repository's `deploy/sda-kernel/retrieval-acceptance-2026-10-02.json`.

## Home and sign-in pages

`/circuit/home` is the platform home page (design H2). `/circuit/login` uses the
same visual language. Both share `site.css` and `site.js`. Until revamp phase P2
removes Next.js, the gateway still sends `/` to the old website, so the home page
is reached at `/circuit/home`.

Every value on these pages is read when the page loads:

- `GET /api/circuit/v1/home`: the hero circuit, featured capabilities and
  sign-in circuit from `circuit-host.json` (`home`, `identity.circuit`), plus the
  environment label (`SFX_ENVIRONMENT_LABEL`, or `STAGING` when
  `SIDEFX_INDEXING=disabled`).
- The capability catalog, for the counts and each card's scenario count. A
  featured capability missing from the estate shows as such.
- The gateway's `/healthz`, for release and kernel language. A host without it
  reports nothing rather than a guess.
- The database scene for the hero, shown unchanged after its `svgDigest` check.
- The session and the observed runs of the signed-in identity. The greeting uses
  the identifier entered at sign-in.

Featured titles and summaries are editorial host data until the list is declared
as database authority (revamp P3). The artwork in `assets/` is decorative and
never execution evidence. `optical-architecture` and `optical-flow` are WebP
encodings (1672 px and 900 px) of the generated H2 images, whose PNG sources
hash `9acc7812…` and `ec27ecc8…` respectively.

## Sign in

`/circuit/login` signs a browser in by running the declared `authenticate-ide-user`
capability through the identity host (`SFX_IDENTITY_ENDPOINT`). The session is an
HttpOnly `__Host-sfx-session` cookie that page script cannot read. Observe requires
a signed-in identity by default (`identity.observeRequiresSession` in
`circuit-host.json`), and each admitted run is attributed to its principal. The
header shows who is signed in. The cookie and CSRF contract, the routes and their
limits are in sfx-platform `docs/live-circuit-browser-session.md`;
`verify-identity-session.mjs` checks them.

## Observe from the page

Select a capability, fill **Capability input · JSON**, and click **Observe**.
The editor reads the root scenario's input contract through its returned database
navigation link. **Use contract template** restores declared constants/defaults
and required property slots; fill those slots before submitting. **Declared input
schema** shows the complete returned contract. JSON syntax is checked in the
browser; the SDA API and kernel remain the admission and contract authorities.
Payload drafts stay in this tab's memory, separately for each capability/namespace.

Observe opens the live root scenario, enables page following and animation, then
submits one `capability observe` request to the SDA API. The selected run's own
SSE cursor, graph and unchanged testimony drive the existing traversal model.
Other executions cannot replace the submitted run. **API result** displays its
returned output; the process state is separate from the domain outcome.
**Replay latest run** reuses that capture, including its original timestamps and
the existing scenario-only replay window. **Follow external runs** restores the
CLI observer feed. Changing capability stops this tab's observation, not the
execution already admitted on the server.

Interrupted streams expose **Resume observation**, which reads the same run from
its last consumed cursor without resubmitting. Missing/truncated events hold the
circuit evidence; no invented receipt fills a gap. A failed admission connection
shows its idempotency key because the server may already have accepted it.
Capability, provider and contract identities are never embedded in this transport.

The observer host needs `SDA_API_ENDPOINT` and `SDA_API_TOKEN` in its process
environment. Hosted staging supplies these internally. Browser requests use
same-origin `/api/circuit/v1/runs`; `run-api.mjs` forwards them to `/v1/runs`
with the server credential. Neither the HTML nor browser storage receives the
token, and scene-reader kernel children have it removed from their environments.
`circuit-host.json` declares limits and the API's default namespace. Only that
namespace is omitted from admission; any other namespace is passed unchanged
for API validation. Unconfigured hosts show Observe as unavailable.

This public staging action intentionally lets visitors invoke capabilities under
the host's configured SDA admission policy, like the existing website actions.
It accepts same-origin JSON POSTs; external `/v1/` clients still need Bearer
authentication. The browser proxy is a transport, not a capability implementation.
`node live-circuit/circuit/verify-run-api.mjs` checks its request boundaries, credential
custody, cursor forwarding and capture-envelope compatibility.
Optional scene/capture arguments check every real receipt prefix for the omitted
variant-list regression. A capability without declared variants still returns its
API output; the circuit reports the missing exact outcome match instead of
crashing or synthesizing a successful variant.

Acceptance on 2026-10-01: hosted API run
`d5ee7d3f-68f5-4c06-9b4b-2fb45493ca25` was admitted from the browser and
displayed all three providers while live, then the exact admitted outcome.
Captured replay measured 1× and 0.1×. A second capability (`say-hello-world`)
loaded its own empty-payload contract and returned its greeting without browser
errors. Disconnect/resume, duplicate-click suppression and draft restoration also
passed. The live conformance tool checked 1,892 prefixes of an actual API capture
and all three provider returns. These checks do not prove that every catalog
capability executes or resolve the graph's existing missing-definition-digest
finding; the viewer continues to disclose that limitation.

For the complete **live** operation flow, observe with `--trace`, for example:

```
sfx capability observe request-capability-from-objective --trace --input "What is Broadcom current market price?"
```

Keep the viewer in **LIVE RECEIPTS** with **Follow execution page** checked.
The CLI's default story stream selects scenario altitude; it does not include
the mechanical admissions needed to show each operation and provider call.
Missing mechanical testimony cannot be reconstructed as live work.

Historical exported decks remain optional. Put complete deck directories under
`evidence/circuit-decks/` under `SDA_ESTATE_DIR`, or set `CIRCUIT_DECK_ROOT`. Each directory retains
`receipt.json`, `snapshot.json`, `storyboard.json`, `circuit-blueprint.json`
and `volume-*/slide-*.svg`. Select an **Export** source to inspect its original
slides, links and review readings. Missing exports do not hide live capabilities.

`read-deck-observation-map` is installed by the SQL migration pair. It checks
the selected capability and scenario versions against base rows and binds
operation identities/ordinals to exact semantic addresses. The browser joins
those addresses to the captured graph, then joins testimony by cell identity.
The database also supplies `deck-live-flow-policy.v1`, installed by the
`declare-deck-live-flow` migration pair. It declares admission/completion/failure
states, containment activity, allowed edge kinds, provider identity matching,
scenario wire roles, telemetry slots and captured-time replay rates. The browser interprets
this policy over the captured graph and original slide geometry.

## One traversal model

`traversal.js` decides every visible state once, from database geometry and
receipts; `circuit-viewer.js` only draws it. For any instant (a replay position,
or the latest live receipt) it returns:

- **current** — the one component geometrically under the dot (bright white
  outline). A provider or called scenario is current only when the dot is inside
  it; on a wire nothing is current.
- **busy** — callers that own outstanding work (dashed blue): the scenario until
  its own return, the step throughout its captured interval, and a call box
  while its provider or child scenario holds the dot. Current wins over busy.
- **visited** — components the traversal has passed through (dim outline).
- **terminal** — the scenario's own return: an exact declared variant, or the
  defect endpoint (below). Nothing terminal is shown before the return.

Evidence phases are unchanged and separate from these states. An admitted edge
lights its destination cyan before completion; own completion turns a component
green; failure turns it red; a traversed component without its own completion
stays violet. Run end clears unresolved active states to observed, never
completed. Green means execution completed, not domain success.

**One payload.** The Given panel shows one payload component, the input
contract, enclosing its field cards. The route starts inside the payload,
outside every field, so the payload is current at scenario entry.

**Calls.** A provider call and an invoke-scenario call are drawn the same way:
the step, its call box, and the callee device (a declared provider, or a called
scenario with drill-down to its own circuit). The dot goes out through the call
box and returns through it to the step. Live admission opens the selected call
when the captured operation authority matches its declared binding. The dot
waits at that selected callee, with the step and call box busy, until the own
operation return arrives. This indicates an outstanding admitted call, not a
measured physical provider/network phase. The return must name the selected
executor to establish provider-return history. Replay uses that same executor
check before showing a recorded provider trip. A child call additionally needs
the exact declared scenario identity under its owning operation. Missing or
mismatched identities are findings, never substituted callees.

Replay retains the start/end of the exact provider-child receipt used for that
executor check. The dot holds at the provider throughout this recorded span;
only the remaining entry/return portion is schematic. Normal and Slow use the
same timestamps scaled by the selected rate. A captured provider span is never
replaced by box size, wire length or an arbitrary fraction of the operation
duration. When no separate provider span exists, only the owning operation is
timed and the path remains explicitly schematic.

Live call admission displays the selected callee immediately. A decorative
transition must not hide calls that return faster than its animation duration.
Other live transitions remain schematic; no minimum dwell or delayed outcome
extends execution for presentation. A call whose admission and return arrive
within one browser frame can still be too brief to see; its receipts and visited
history remain available. Replay alone expands the captured time at Slow speed.

Moving dots follow the returned scene or exported wire coordinates. Execution wires require an
admitted edge with matching graph identity, destination address, direction,
kind and mapped endpoints. Completing both endpoints cannot light a wire.
Scenario input/output wires indicate contained activity and own scenario return;
live call-entry wires indicate admitted work with matching captured authority,
and provider-return wires require the exact owning-operation provider receipt. These bases
remain distinct from canonical execution-edge evidence. Unobserved branches
stay unlit. The slide telemetry slots update with the attached live/replay state.

Historical scenario summaries arrange provider call sites left-to-right by declared
operation order. Each exported call connector joins the owning event to its
operation glyph and lights from that operation's activity. It does not invent
a direct execution edge between the displayed calls when other operations lie
between them. Shared provider identities remain a single provider glyph.

The `declare-deck-boundary-flow` migration adds selected input/output contracts,
payload field paths and scenario variants from base rows. The Given/Input panel
and its payload boxes light amber when the scenario input participates. Dashed
field outlines mean contextual input activity only: field presence was not
published. If a matching input shape is available, only present fields light
with solid outlines (including null, false, zero and empty values).

The Then/Outcome panel uses the scenario's own return receipt. Before the return
the dot travels only the route every outcome shares; the branch is chosen by the
return, at the return. An exact declared variant match lights that card; failure
variants are red. A child operation's variant never substitutes for the scenario
return. Anything else reaches the dashed **defect endpoint** ("Unmatched or
missing outcome"): an undeclared variant (`Unmatched: terminated`), a
mismatched outcome contract, or a run that ended without its own return. The
defect endpoint is testimony about the return, never a domain outcome.
Input shapes are absent from these captures. Field presence remains an exposed
evidence gap; the viewer never pretends that payload values were captured.

Live boundary highlights use explicit bounds supplied by the database. Historical
exports retain their caption/containment locator; ambiguous captions remain unlocated. The inspector exposes the
receipt and evidence basis for payload fields and variants.

The deck retains its exact inspection readings, source references and internal
navigation. All cell/edge testimony is available below the slide, including
observations outside direct deck addresses and unmatched observations. The
original SVG bytes remain unchanged beneath the animation layer. Persistent DOM
elements keep animation and component selection stable during streaming updates.

## Verification limits

Selected declaration identity checks are a bounded check. The streamed graph
does not carry the selected definition digests needed to establish that a run
used the exported deck's exact generation. The reader reports
`NOT_FORMALLY_OBSERVABLE` for execution-generation equality. Refresh rechecks
declaration identities; it does not regenerate the deck or its inspection
readings. Snapshot proof labels do not become runtime proof.

The observer scopes runs by run-start/run-end order. Overlapping starts hold
the overlay because the sink cannot safely attribute interleaved observations.
Opening a page is live-only. **Replay latest run** plays the selected capability's
latest complete captured run; if none has been seen, it asks the observer for the
latest retained run *of this capability's graph* (`/events?run=current&graphId=`),
so the circuit reader's own interleaved invocations cannot displace it. Replay is
held, with the missing evidence named, when a capture has no own-operation
receipts or no own scenario return. **Pause replay**, **Step**, and the pace selector let the
viewer inspect fast transitions. The installed `declare-captured-circuit-clock`
policy selects **Normal 1×**, **Slow 0.1×**, and **Fast 2×**. All use the same
captured scenario window, from the first mapped operation's start through the own
scenario return. There is no initial host delay and no fixed delay per operation.
Each in-scope cell/edge receipt uses its captured completion timestamp rebased to
that start. Excluded invocation records remain separately inspectable. Actual
own-operation `startedAt`/`completedAt` intervals establish replay activity before
the completion receipt. These intervals reference the original receipt and are
explicitly labeled **recorded execution**; they are not invented testimony.

The monotonic playback clock schedules absolute offsets, preserves the remaining
gap through pause/resume and speed changes, and catches up after delayed callbacks.
It never stretches the timeline to make every transition visible. Browser timers
and display frames can be late; the evidence panel reports measured playback wall
time beside captured scenario duration and the expected scaled duration. Missing
or reversed timestamps, multiple graph captures, and mismatched run process IDs
hold replay.
Concurrent recorded operation spans are labeled concurrent instead of asserting
an unsupported single-operation order.

Only the dot moves; there are no per-receipt pulse animations. Completed history
stays static and dim. Live delivery
continues in the background; **Return to live** shows incoming receipts immediately.
Live admissions and activity arrive before own completion. Unmatched nested
receipts cannot erase the outstanding caller. A descendant never completes or
reopens a returned caller. Parallel captured cells remain separate; overlapping
admissions without distinguishable invocation identities are reported and held.
The live dot interpolates between received locations over a maximum 120 ms
presentation transition. New receipts retarget that transition; there is no
per-operation queue, captured-duration playback, or progress estimate while
waiting. The scenario's own return stops motion immediately at its exact
outcome. Operations faster than a display frame remain in observed history;
live execution is not slowed to make them look longer. Live evidence is limited
by receipt delivery; the viewer never claims entry before evidence. Post-run launcher
bookkeeping cannot extend a closed invocation. A truncated capture without
run-start is held until a new run starts.
Reduced-motion preference suppresses glow while retaining the position marker,
traversal states and evidence states.

## Checks

`node live-circuit/circuit/verify-live-flow.mjs <scene.json> <capture.sse> [<browser-samples.json>]`
checks every actual receipt prefix without a replay timeline: both provider
admissions before completion, persistent calls across unrelated nested receipts,
own returns, exact outcome, and no motion after return. Optional browser samples
must stay in live mode and place each provider dot between its admission and
return receipt. Adversarial copies check wrong authorities/addresses, refused
edges, mismatched graphs, ambiguous or parallel calls, late descendants, exact
child identity and parallel-return motion isolation. No test testimony is posted.

`node live-circuit/circuit/verify-deck.mjs <deck-directory-id> <capture.sse>` compares
served SVG bytes to the exported slide and checks real testimony joins plus
wrong-address, wrong-capability, wrong-generation, missing-map and overlapping
run refusals. `node live-circuit/dispatch-pair/verify-run-scoped-sse.mjs` verifies the
observer's existing stream/replay contract on an isolated port.
`node live-circuit/circuit/verify-flow.mjs <deck-directory-id> <capture.sse>` additionally
checks admission before completion, failure, containment, refused/mismatched
edges, no traversal inferred from completed endpoints, original wire geometry,
and complete receipt preservation through replay.
`node live-circuit/circuit/verify-boundaries.mjs <deck-directory-id> <capture.sse>` checks
real input participation and exact or unknown outcomes, plus synthetic exact success and
failure variants, absent/falsey/ref-only payload fields, wrong contracts, child
variant isolation, original shape geometry and replay parity.
`node live-circuit/circuit/verify-timing.mjs <deck-directory-id-or-saved-deck.json> <capture.sse>`
checks every cell/edge timestamp, retained record order, recorded operation
intervals and declared sequential edges; exact outcome timing; Normal/Slow/Fast
clock scaling; pause/resume, stepping, rate changes and stalled-clock catchup;
and refusal of incomplete, ambiguous, mismatched or invalid timestamp captures.
The deterministic scheduler consumes the actual capture. Negative tests damage
copies only; nothing generated is posted to the live observer.
`node live-circuit/circuit/verify-traversal.mjs <scene.json> <capture.sse> [<child-scene.json>]`
is the acceptance for the traversal model: start-point containment and payload
at entry; current exactly under the dot and busy as the call stack at every
sample; no endpoint before the own return; captured intervals with no added
delay; 1×/0.1×, pause, step and speed; routing to every declared variant and the
defect endpoint for unknown, mismatched and missing returns; held traversal for
unmatched executors and missing edges; and called-scenario entry/return
geometry. Positive claims use the real capture; altered copies are labelled and
test routing or defect behaviour only. A capture with no own-operation receipts
is checked in live mode (no step claimed; the dot at the received terminal).

`preserve-objective-scenario-outcome.sql` made the objective lane's fixture-read
terminal return its own admission result (`ADMITTED`, `REFUSED`,
`PROVIDER_UNAVAILABLE`). The real invoke binding activated since returns the
child's `terminated` again (fresh capture, 2026-09-30), so the circuit now shows
that run at the defect endpoint. That is an estate declaration defect, not a
viewer rule; see [docs/research/circuit-traversal/](https://github.com/BPMSoftwareSolutions/sfx-embody/blob/main/docs/research/circuit-traversal/README.md).

## Integrated execution flow

The database scenario scene now embeds every execution operation and returns
continuous path geometry. See [the product and evidence contract](https://github.com/BPMSoftwareSolutions/sfx-embody/blob/main/docs/integrated-scenario-flow.md)
for ownership, provider identity, timing, navigation, outcomes and live telemetry
limits. Normal and 0.1× replay use captured operation intervals; route position
within an interval is explicitly schematic, not measured packet transit.
