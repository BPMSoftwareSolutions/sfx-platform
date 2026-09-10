# Capability execution

A visitor opens a capability, composes an input, presses **Run**, and the capability executes —
its authority read from SQL, its body rebuilt in memory, its result reported as the capability
produced it. This is the surface the rest of the platform exists to make possible: the catalog
describes capabilities, the circuits show what they mean, and this runs them.

It is also the surface with the most ways to lie. Everything below is arranged around not doing
that: an execution reports its own disposition, a refusal keeps the estate's own code, and a
capability that cannot execute says so rather than being quietly omitted or approximated.

## The chain

```
browser
  │  explicit user action (§13.1) — rendering a page or playing a circuit invokes nothing
  ▼
server action                      app/capabilities/[namespace]/[capabilityId]/actions.ts
  │  resolves the identity against the published estate, rate-limits, parses JSON
  ▼
capability API                     services/capability-api  ← holds the database boundary
  │  POST /commands { object, operation, subject, namespace?, input }
  ▼
sfx SDK                            sidefx-cli — validates against the command mapping
  ▼
process delivery                   sfx-embody — owns SQL reads, planning and memory loading
  │
  ├─ restricted reads → selected authority, scenario closure and mechanics
  ├─ native body planned and loaded in memory
  └─ Scenario Kernel executes the canonical input
```

Invocation returns separate timings for authority reads, native planning, loading and execution.
Use those measurements for the selected workload; the older preparation-read timing is historical.

## Boundaries this preserves

**The web process opens no database connection** (§11.1). It holds no connection string, spawns
no runtime and embeds no interpreter. The API service is the boundary that does, running *beside*
the web process exactly as the Python services do in §7 and §8.7. A deployment without that
service reports execution unavailable; it does not degrade into something that looks like it
worked.

**The command surface stays entity-neutral.** The API has one route. `object`, `operation` and
`subject` are data on the envelope, never path segments, branches or a dispatch table. That is
`sidefx-cli`'s Entity Neutrality Law observed literally, and it has a practical consequence worth
stating: **adding a capability to the estate adds nothing to this repository.** No route, no
component, no mapping, no copy. The 219th capability and the 220th are the same code path.
The committed web command policy permits only `capability invoke`. The API and SDK receive the
intersection of that policy and the project mapping; `prepare` and future project operations
are refused before dispatch unless deliberately added to the web policy.

**The estate owns meaning.** This platform forwards a command envelope and renders a result. It
interprets no canonical input, implements no provider, and holds no admission policy.

## Direct invocation and historical preparation coverage

The current `sfx-embody` provider reads selected SQL authority, plans the body and executes
it in memory on each invocation. `sfx capability prepare` remains an optional separate proof
stored in `runtime.capability_preparation`; invocation neither requires nor consumes it.
The website command policy still exposes invocation only.

The following is the retained **historical preparation census**, from a pass over 219
capabilities (median preparation 8.0s). It is not current invocation coverage:

| | |
| --- | ---: |
| Prepared | **94** |
| Held | **125** |

Held capabilities carry declared reasons, never silence:

| Reason | Count |
| --- | ---: |
| `PORT_IMPLEMENTATION_NOT_RESOLVED` | 39 |
| `DATABASE_INVOCATION_FAILED` | 30 |
| `NATIVE_TRANSITION_TRANSLATION_NOT_AVAILABLE` | 20 |
| `PREPARATION_FIXTURE_FAILED` | 19 |
| `NODE_BINDINGS_HELD` | 4 |
| `CONTRACT_SCHEMA_SOURCE` | 4 |
| `MECHANIC_ARGUMENT_MISSING` | 3 |
| `SOURCE_REFERENCE` | 2 |
| `SCHEMA_TYPE_UNION_NOT_SUPPORTED` | 2 |
| `CAPABILITY_ROOT_SCENARIO_UNRESOLVED` | 1 |
| `PATH_ARGUMENT_DOMAIN_NOT_SUPPORTED` | 1 |

What each held reason means, where its fix belongs, and how to rank the work from the database is
in [capability-readiness.md](capability-readiness.md). The short version: they are four different
problems, and only some are fixable in the database.

Whether a capability executes is resolved at invocation time. A selected pilot needs fresh
input/output evidence and exact authority bindings. The Hugging Face qualification runner in
`sfx-embody` exercises `say-hello-world`, `greet-by-name`, and
`resolve-sidefx-eligible-providers` through the installed `sfx` command. It is a local execution
proof, not a remote deployment or a qualification of the entire catalog.

Binding the authority displayed in a web publication to that used by invocation remains a
separate API design requirement. The current closed command envelope has no expected-revision
field; a frontend-only comparison would not prevent a selection race.

## Composing the input

Input is composed as a **form** generated from the capability's declared input contract, or as
**raw** JSON. Both are views of one document, so switching carries the value across.

The form reads the contract and renders it:

- a `const` is shown as *fixed by contract* rather than editable, because the contract fixed it
- `enum` becomes a select; strings, integers and booleans become their controls
- arrays get item builders; objects nest; local `$ref` resolves into `$defs`
- a shape the form cannot render faithfully is edited as JSON rather than approximated

Across the 215 published schemas, **1,142 of 1,152 declared properties render as controls** and 10
fall back to raw. The form seeds only what the contract declared — required members and fixed
values — and invents nothing else.

Schemas come from `npm run publish:contracts`, which reads each capability's root-scenario input
contract and the retained JSON Schema it references from one pinned generation into
`generated/input-contracts.json`. **216 of 218** capabilities with a root scenario declare one; a
capability without one gets raw input and no claimed shape.

Run `npm run select:estate` after publishing contracts. Manifest v2 binds `input-contracts.json`
alongside the estate, circuits and visuals. Release validation and page reads verify the file
hash, publication identity, canonical schema digests, references, capability/scenario owners,
and the selected snapshot/projection. The v2 input publication retains the original SQL schema
digest separately from its canonical JSON digest. Mixed generations and altered bytes fail
validation before a form is offered.

Where the estate workspace publishes example requests, `SIDEFX_CAPABILITY_EXAMPLES` seeds the form
with one. Examples are matched by the `contractId` the example itself declares against the contract
the capability declares — never by filename, which is not evidence of applicability. Examples are
read while pages are prerendered, so that variable belongs to the build; the command endpoint is
read per request.

The form checks JSON syntax. Invalid drafts remain visible with an error and block Run and mode
switching until corrected. Removing an array item preserves drafts on the surviving items.
A supplied value that differs from a schema constant remains visible and editable as JSON.
Semantic admission belongs to the capability's contract, and its refusal is a real result the page shows.

## Reading a result

The page renders what the estate returned and nothing else.

| Reported | Meaning |
| --- | --- |
| `terminated` | The capability executed and produced its outcome |
| `rejected` | The capability's own contract refused the input, or refused the outcome it produced. A real execution, with its own kernel testimony |
| `failed` | The event executed and threw |
| `PORT_IMPLEMENTATION_NOT_RESOLVED` | No executable port implementation resolves for the selected authority |
| `NATIVE_TRANSITION_TRANSLATION_NOT_AVAILABLE` | The current native provider cannot lower the declared topology |
| `CAPABILITY_NOT_FOUND` | The estate resolved no declared root for that capability |
| `NOT_CONFIGURED`, `RATE_LIMITED`, `INVALID_JSON` | The website did not dispatch a request |
| `UNKNOWN` (`UNREACHABLE`, `BAD_RESPONSE`, `REQUEST_FAILED`, or an unclassified service error) | Execution is unconfirmed. The command may still be running or may have completed; confirm before retrying |

Each result carries the full `observations`
and `executions` arrays — one record per observed kernel step, and one per nested scenario
execution. The page shows counts and an expandable full execution record, including kernel errors.
An SDK error containing that record is still an execution, with its original disposition.
That testimony is what the workbench's
**observed-execution** trace binds to (spec §5.0, §12.4): the branch actually taken, the
disposition actually reached, observed timestamps, and absence drawn as absence. It is the reason
this surface returns evidence rather than just an outcome.

Two distinctions the surface must never blur:

1. **A rejection is an execution.** The kernel ran and refused the value. It is reported with its
   testimony, not as a page error, and never corrected into something admissible.
2. **An execution is not an admission.** A completed execution is not managed admission and not a
   conformance result; both remain separately unevaluated (§1.7). Invocation evidence records
   `managedAdmission: NOT_REQUESTED`.

A refusal is never filled in with another capability's result.

## Operating it

```bash
cd services/capability-api && npm install
SIDEFX_PROJECT_DIR=../../../sfx-embody npm start     # resolves the database credential itself
```

```bash
SIDEFX_INVOCATION_ENDPOINT=http://127.0.0.1:8787 npm run dev
```

| Variable | Read at | Purpose |
| --- | --- | --- |
| `SIDEFX_INVOCATION_ENDPOINT` | request | Capability command service; absent means execution unavailable |
| `SIDEFX_INVOCATION_TIMEOUT_MS` | request | Response deadline (default 630000), longer than the service's 600000 ms command deadline |
| `SIDEFX_CAPABILITY_EXAMPLES` | build | Example requests, matched by declared `contractId` |

The service resolves its command mapping and process bindings from the `sfx-embody` workspace,
which owns the database delivery, its credential reference and its integrity checks. The
connection string never passes through this repository.
The API defaults to `127.0.0.1`. A response timeout does not cancel estate execution or establish
that nothing ran; the page reports execution unconfirmed and does not retry automatically.

The API is directly usable:

```bash
curl -X POST http://127.0.0.1:8787/commands -H 'content-type: application/json' \
  -d '{"object":"capability","operation":"invoke","subject":"admit-execution-vector","input":{}}'
```

## What is open

| Gap | Effect |
| --- | --- |
| **Generic versus deployed API** | The loopback entry point is unauthenticated; the [deployed private Lab](live-finance-deployment.md) requires a bearer credential and enforces the four-profile input policy |
| **Current invocation coverage** | The historical preparation census is not a current readiness measure; qualify each selected pilot |
| **Deployment scope** | The private Hugging Face Lab invokes the separate Azure service. This verifies four published profiles, not the entire catalog |
| **No preparation from the site** | Preparation is a CLI/estate operation. The site cannot trigger it, and does not offer to |
| **Conformance and admission** | Separately unevaluated for every executed capability |

## Historical browser verification

Measured against the earlier running stack. These observations preserve their original scope;
the new CLI pilot qualification does not rerun this browser suite:

- `resolve-sidefx-eligible-providers`, composed in the generated form from its canonical example
  and run from a browser: `terminated`, outcome `PROVIDERS_RESOLVED`, 2 considered, 1 eligible,
  5 kernel observations, ~3.5s. The same result the CLI acceptance records.
- `admit-execution-vector` with an inadmissible input: `rejected` at admit-input, with testimony —
  a real execution, not a page error.
- An unprepared capability: `CAPABILITY_PREPARATION_REQUIRED` rendered as its own state.
- Nothing executes on page load.

Regression coverage exercises forbidden operations, overlapping partial-body uploads at a
capacity of one, failed execution records inside SDK errors, accepted requests that outlive
the client deadline, invalid form drafts and array removal, and altered or mixed-generation
input publications. These are transport/UI/publication tests; they do not claim estate admission.
