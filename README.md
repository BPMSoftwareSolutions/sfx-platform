# sfx-platform

The SideFX **Live Circuit Platform**: the Explorer and its live circuit, the capability readers
that feed it, and the composite image that serves and releases them.

The platform serves `/` (home) and the workspace at `/circuit/explorer`; `/circuit` redirects
there. Observe requires a signed-in principal, runs are attributed to that principal, and their
evidence is captured durably through the identity host. Releases to the Azure staging slot are
automatic: every watched push runs the release contract — composite build and deploy, public
boundaries, real browser sign-in/Observe/replay, restart and vault proof, external CLI follow and
the Windows CLI checks — and rolls back on a failed gate.

> **Legacy website retired.** The `www.sidefx.io` Next.js website is retired and its code was
> removed under P5 (2026-10-07). Staging serves one composite image with no website; the gateway
> owns `/robots.txt`, and the website's routes answer 404. Website-era documents are retained as
> historical records and are marked as such. See the
> [revamp plan](docs/live-circuit-platform-revamp.md) for decisions D2–D3 and phases P0–P6.

## Current surface

- **Home** — `/` serves the platform home page from the circuit host; `/circuit/home` is the same page.
- **Explorer** — `/circuit/explorer`: declared navigation from the installed estate, the database
  circuit, live/replay run controls, the run report and Evidence context tabs, and Observe for a
  signed-in principal.
- **Objective row** — above the run bar: describe an objective by text or dictation (the prompt
  shell's mic icon and voice status) and press **Run** to execute
  `request-capability-from-objective-v3`; the circuit follows that run, the
  requested-capabilities strip sits under it with honest attribution, and Play speaks the returned
  summary.
- **Circuit host** — observer feed, per-run SSE, run attribution, capability details and scenario
  readers, all served through the gateway.
- **Identity** — sign-in, session validation, and durable run evidence (pinned identity host and
  generated DAL) behind private service credentials.
- **Staging** — `sidefx/staging` in `sidefx_group`. Latest accepted release: run
  [37555602379](https://github.com/BPMSoftwareSolutions/sfx-platform/actions/runs/37555602379),
  source `65703db` (P5), with the durable restart acceptance retained in
  [E14](docs/run-evidence-plan/evidence/E14-staging-restart-acceptance.json).

## Repository layout

| Path | Holds |
| --- | --- |
| `live-circuit/` | Explorer, circuit host/observer, run API, browser session transport, evidence store |
| `deploy/sda-kernel/` | gateway, composite packaging, host identity/retrieval policy, identity-login contract |
| `deploy/staging/` | release, acceptance, finish and rollback tooling |
| `tools/` | local Live Circuit stack and verification scripts |
| `infra/` | Azure bindings and release authorization |
| `docs/` | platform plans, runbooks and retained evidence |

## Running locally

[`tools/live-circuit/start-local.mjs`](tools/live-circuit/README.md) starts an observer and Run API
against a built [`scenario-driven-architecture`](https://github.com/BPMSoftwareSolutions/scenario-driven-architecture)
API and an [`sfx-embody`](https://github.com/BPMSoftwareSolutions/sfx-embody) estate whose
`sfx.config.json` selects an admitted installed kernel. It changes nothing else — no SDA source,
estate configuration, database or Azure. Sign in through the staging HTTPS origin (or a configured
local identity host) and view the circuit on localhost; the sign-in gate stays enabled.

The local stack requires a previously built SDA API and an admitted kernel. It deliberately has no
embedded checkout paths and is not part of the staging image.

## Releasing

[Automatic staging releases](docs/automatic-staging-deployment.md): only watched paths restart
staging; `docs/`, this README and other unrelated changes do not.

[`staging.yml`](.github/workflows/staging.yml) runs, in order: checks → composite build and deploy
→ public boundaries → real browser sign-in/Observe/replay → confirmed restart with unchanged vault
→ retained-run reopen → external CLI follow → Windows CLI checks → finish (accept or roll back).
Receipts are retained in `artifacts/staging/` and [`docs/releases/`](docs/releases/).

## Documentation

- [Revamp plan](docs/live-circuit-platform-revamp.md) — what the platform is, phases P0–P6 and the
  decisions that retired the website
- [Automatic staging deployment](docs/automatic-staging-deployment.md) — the release contract and
  the current accepted release
- [Staging deployment runbook](docs/live-circuit-staging-deployment.md)
- [Browser session contract](docs/live-circuit-browser-session.md)
- [Identity host and login](deploy/sda-kernel/identity-login.md)
- [Windows CLI login client](docs/cli-login-client.md)
- [Run evidence plan](docs/run-evidence-implementation-plan.md) and its
  [reconnaissance and execution analysis](docs/run-evidence-plan/analysis/README.md)
- [Explorer run-evidence design (E1)](docs/explorer-run-evidence-design.md)
- [Flight recording](docs/sfx-flight-recording/intent.md) — intent, research and implementation plan

## Retired website documents

Retained as historical records, each marked historical at the top:
[`website-design-spec.md`](docs/website-design-spec.md), [`architecture.md`](docs/architecture.md),
[`visual-integration-audit.md`](docs/visual-integration-audit.md),
[`capability-execution.md`](docs/capability-execution.md),
[`capability-readiness.md`](docs/capability-readiness.md),
[`media-operations.md`](docs/media-operations.md). Their subjects are the retired Next.js website;
its code was removed under [P5](docs/live-circuit-platform-revamp.md) on 2026-10-07.
