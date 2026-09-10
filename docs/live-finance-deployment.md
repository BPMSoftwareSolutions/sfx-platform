# Private Hugging Face Lab: deployed live finance

Verified 9 September 2026, America/New_York (10 September UTC).

The private [BPMSoftwareSolutions/SideFX Space](https://huggingface.co/spaces/BPMSoftwareSolutions/SideFX)
now hosts the shared Lab. Hello World, personal greeting, the provider fixture
demonstration and live stock-price retrieval all ran successfully from that Space.
The finance flow is Space → authenticated Azure service → selected database
authority and declared provider-input binding → RapidAPI → native normalization.
It has no dependency on a local development server.

## Deployed identities

| Component | Identity |
|---|---|
| Private Docker Space | `BPMSoftwareSolutions/SideFX` |
| HF source commit | `764b7eea6c71b9eb0e0301adbed2b4eaa02ca979` |
| HF application origin | `https://bpmsoftwaresolutions-sidefx.hf.space` |
| Azure service | `https://bpm-sidefx-lab-api.azurewebsites.net` |
| Azure resource group / existing plan | `sidefx_group` / `ASP-sidefxgroup-ad2e` |
| Runtime image | `bpmaiengineacr.azurecr.io/sidefx/lab-service@sha256:a8108d3eb3522bcf571415f1597fe1e5a9c8fe1ec79eee3f9369b30a459c115d` |
| Lab publication | `sha256:2f43afdafdf734303c449cab844ad0a0dddc3c5d5645178fe3b004e6e547b304` |
| Selected estate model | `33` |
| Pinned SDA commit | `716811046f52dd2a67f9ff308a50d755571cbbad` |

The Azure app reuses existing plan capacity and pulls its pinned image using its
managed identity. The deployment did not create another App Service plan or change
the existing production or staging apps.

## What executed

The registered `resolve-equity-market-price-evidence` root now takes the
`live-equity-price-request.v1` contract: an uppercase symbol and `US` region. It
is a declared composition, not a normalizer carrying an invocation-time binding.
Its execution authority chains five operations: build the credential-binding
request, bind the external credential reference (effect), build the governed HTTP
request from symbol and region, observe the bounded exchange (effect), and
normalize the observed testimony into canonical evidence. Ports, endpoints, the
credential reference, the response mapping and the transformations are declared
authority, not code. Credentials, redirects, retries and arbitrary endpoints are
not caller options. The pinned SDA credential-binding and governed-HTTP providers
execute the effects; the candidate Node provider materializes them into the body
and shares one governed effect context across the scenario's effect ports.

The installed CLI also exercised this complete path, exiting 0:

```powershell
sfx capability invoke resolve-equity-market-price-evidence --namespace sidefx:capabilities --input @evidence/hugging-face-live-finance/request.json --json
```

The input was `{"contractId":"live-equity-price-request.v1","payload":{"symbol":"AAPL","region":"US"}}`.
The observed result was AAPL, USD 315.34, market time `1788984001` (Unix seconds),
with Nasdaq Real Time Price attribution. Each live call retains its own retrieval
time and response digest; matching prices across runs are not the acceptance test.

## Verification

- Browser runs inside the Space: exact Hello World; `Hello, Zoë <script>!` displayed
  as text; eligible-provider fixture with considered count 2 and eligible count 1;
  live AAPL quote with HTTP 200, market time, retrieval time and attribution.
- The final inspected browser quote was retrieved at `2026-09-10T01:45:40.930Z`.
- `ZZZZINVALIDSYMBOL` returned `PROVIDER_UNAVAILABLE`; the Space showed no price.
- The hosted Azure service passed 28 checks: seven successful runs covering all
  four fixtures, plus invalid-token, forged-input and unauthorized-subject refusals.
- The authenticated Space adapter passed all four profiles and rejected a forged
  provider-testimony field. The quote price was compared against its own retained
  native response.
- Seven focused binding/provider tests passed, including missing credential,
  access denial, throttling, unavailable/malformed/mismatched response and uncertain
  timeout. None of those failure tests produced a price or an automatic retry.
- The platform suites passed 80 tests before the final two finance-specific tests;
  the subsequent ten-test Lab suite and type check passed. Lint reported only the
  three existing warnings. Both Linux images and the HF build completed.

[Compact verification](huggingface-verification.json) retains deployment and
execution identities. Full responses are under ignored
`artifacts/deployment/huggingface-verification/` and the dated Azure verification
directory identified by `artifacts/deployment/latest-verification.json`. Installed
CLI evidence is in `sfx-embody/evidence/hugging-face-live-finance/`.

## Updating this deployment

Run `npm run publish:lab` only after the intended database authority is selected.
Then run `node scripts/package-remote-lab.mjs` and
`node scripts/package-hf-lab.mjs`. The first packages the SDK, restricted database
delivery, pinned SDA source/build closure and exact invocation bindings. The
second copies only the shared renderer and server adapter into the HF build.

Build/push the remote service image and set Azure's `linuxFxVersion` to its digest
using a JSON configuration file. Windows Azure CLI arguments containing JSON or
`|` should be supplied via a file. `Dockerfile.lab` uses Node 24's `--permission`
flag and the portable `SIDEFX_SQL_CONNECTION_STRING` environment-variable alias.

Azure settings are `SIDEFX_SERVICE_TOKEN`, `SIDEFX_SQL_CONNECTION_STRING`,
`RAPID_API_KEY` and `WEBSITES_PORT=8080`. HF secrets are
`SIDEFX_SERVICE_TOKEN`, `SIDEFX_INVOCATION_ENDPOINT` and `SIDEFX_LAB_ORIGIN`.
Only the scoped service token is shared; HF has no SQL or RapidAPI credential.
The deployment token is read from Windows `HF_ACCESS_TOKEN` and supplied to the
HF SDK as `HF_TOKEN`, never written into the uploaded directory.

`python scripts/deploy-hf-lab.py` uploads the prepared private Space directory.
`node --import tsx scripts/verify-remote-lab.mjs <service-origin>` verifies the
remote service with `SIDEFX_SERVICE_TOKEN` set. `python scripts/verify-hf-lab.py`
verifies the private Space adapter with `HF_TOKEN` set. Runtime credentials in
the ignored deployment working directory have a user-only Windows ACL.

This is a synchronous private pilot. Publication changes fail closed before
native execution. Timeouts and interrupted deliveries preserve uncertainty;
there is no automatic retry or durable asynchronous run-status service.
