# Private Lab: input ownership and shared rendering

**Deployed and verified:** the private [Hugging Face Space](https://huggingface.co/spaces/BPMSoftwareSolutions/SideFX) runs all three original interactions and the live stock-price path through the authenticated Azure service, database authority and RapidAPI. [Deployment and evidence](live-finance-deployment.md) records the exact revisions and hosted checks.

The local Lab implements all three pilot interactions. Open `http://127.0.0.1:3010/lab` after starting it:

```powershell
npm run dev:lab
```

The runner starts Next on loopback and a separate loopback command service on an available port. It uses the existing installed `sidefx-cli` SDK from `services/capability-api`, the sibling `sfx-embody` project, and that project's configured database and pinned SDA workspace. Those runtime dependencies and the database credential must already be configured. `SIDEFX_LAB_PORT` changes the web port; an optional first script argument selects a different embody checkout. Stop the command to stop the local services.

The checked-in `generated/lab-publication.json` supplies four profiles, scoped schema bytes, four retained provider inputs and execution pins. `npm run publish:lab` reads the currently selected database authority and plans each native body. The original authored profiles and the added `live-finance-interaction-profile.json` remain in `sfx-embody/docs/research/hugging-face-platform/`. Regeneration checks source bytes, schema pins, the fixture digest, the provider-input binding and exact fixture allow-list before writing a publication. The publication supplies application policy; it does not grant managed admission.

## Implemented interactions

| Profile | Editable controls | Server assembly | Outcome |
|---|---|---|---|
| Hello World | Run only | Exact contract ID and `{}` payload | Greeting text |
| Personal greeting | Required name, 1–100 Unicode code points | Fixed contract ID and payload object | Greeting text; markup is escaped |
| Provider fixture demonstration | Four retained examples and Run | Complete retained input, including inventory and assurance fields | Counts, disposition, provider reasons, findings, expandable supporting details and trace digests |
| Live stock price | Required uppercase symbol and allowed region (`US`) | Declared provider request, credential binding and observed response supplied to the existing normalizer | Canonical price, currency, market timestamp, retrieval time, attribution and actual HTTP evidence |

One React renderer dispatches by declared interaction/view family. It contains no capability-name branches. The compiler checks ownership of every closed input-object property, constants, text constraints, collection fields and scoped references. It refuses missing or ambiguous schema resources and unsupported input shapes. Ajv validates complete inputs and successful outcomes against the retained schemas; schema URLs are identifiers, never network fetch instructions.

The browser submits a publication ID, subject, editable values keyed by declared pointers, and an optional example selector. It cannot submit a canonical envelope, namespace override, fixed-field override or provider inventory. The server resolves the published subject, constructs canonical input and rejects extra fields. The loopback command service independently checks canonical input against the same ownership policy, so a direct command request cannot forge fixture inventory either.

Provider examples remain pure fixture demonstrations. A terminated command can have a `NOT_OBSERVABLE` domain outcome. The renderer preserves kernel and domain dispositions separately and does not present fixture eligibility as managed admission.

## Authority and execution boundary

The local runner writes its derived runtime configuration under ignored `artifacts/lab/`. It supplies optional `invocationBindings` to the existing embody database delivery. The delivery selects the permitted namespace/subject, reads and plans authority, then checks snapshot, projection, root scenario and all five native authority identity fields **before loading the exact in-memory plan that will execute**. A stale plan returns `INVOCATION_BINDING_STALE`; an unlisted identity or preparation request returns `INVOCATION_BINDING_REFUSED`. Ordinary `sfx` invocation has no new prerequisite when this deployment policy is absent.

The web adapter also checks the returned canonical input, authority identity and outcome contract. It preserves uncertainty when a response cannot establish execution. It makes no automatic retry. The interface disables duplicate Run, Reset and capability/example changes during execution, clears old results when input changes, focuses invalid fields and moves focus to the returned result.

The Lab page and route are disabled unless `SIDEFX_LAB_ENABLED=1`; `dev:lab` enables them locally. Requests require the configured Space origin (or the local origin/host), and the body is bounded to 8 KiB. The deployed service separately requires a scoped bearer credential, checks canonical input ownership, allows two concurrent commands and bounds accepted requests to 20 per minute. SQL and provider credentials remain on Azure. Durable asynchronous run-status lookup remains outside this synchronous pilot; uncertain requests are not retried automatically.

## Verification

`tests/lab.test.ts` covers scoped schema integrity, ambiguous and missing references, missing ownership, constraints, exact constant assembly, Unicode/whitespace/markup, invalid names, fixed-field forgery, retained-example ownership, stale publications, unauthorized subjects, escaped output and the declared control count. The command API suite covers failed/throwing/non-boolean policy decisions before dispatch. Embody's invocation-binding tests cover each execution pin and the default unbound path.

Run the independent live comparison while `dev:lab` is running:

```powershell
node scripts/verify-lab-live.mjs http://127.0.0.1:3010 <loopback-command-endpoint>
```

The runner prints the command endpoint at startup. Verification compares all seven retained fixture outcomes, canonical inputs and native authority identities against separately captured CLI output. Nine web policy refusal cases and one direct-service inventory-forgery case bring the observed total to **17 passing checks**. Native responses and the summary are retained in `artifacts/lab/`; `latest-verification.json` identifies the latest run.

Browser verification exercised Hello World, required-name focus, keyboard submission, a Unicode name containing literal script markup (no script element or dialog), held and eligible provider outcomes, and the nested details. The 390-pixel layout stacks the panels without horizontal overflow. Type checking, the full platform test suite, lint (three existing warnings) and production build passed. This does not claim a full screen-reader audit or hosted conformance.
