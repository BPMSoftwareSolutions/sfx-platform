# Azure container deployment

This implements the deployment path in design spec §§8.4–8.7. It deploys the current incomplete
P1 site to staging. It does not enable the authoring conveyor, exports, media persistence or mail.

## Verified baseline

Azure was inspected on 2026-09-08. Subscription `878efc24-f06f-4255-83c0-2d38e71dc51c` contains
`sidefx_group/sidefx`, a Linux app in East US 2 using classic `DOCKER|` configuration. The existing
`ASP-sidefxgroup-ad2e` plan is P0v3, one instance. Production ran
`mcr.microsoft.com/appsvc/staticsite:latest`; it had no managed identity or health-check path.
The existing Basic registry `bpmaiengineacr` is in East US. This work reuses that registry and
the existing East US 2 app plan; it does not move resources or create another paid plan/registry.

Provider bindings are versioned in `infra/azure.json`. The deployment script fails if classic
mode no longer matches. Enhanced `sitecontainers` would need an explicit, separately tested binding.

## Build and run locally

```powershell
npm ci
npm run validate:estate
docker build --platform linux/amd64 --build-arg SOURCE_COMMIT=(git rev-parse HEAD) -t sidefx-platform:test .
docker run -d --name sidefx-local -p 127.0.0.1:3000:3000 -e SIDEFX_INDEXING=disabled sidefx-platform:test
npm run smoke -- http://127.0.0.1:3000 --noindex
docker stop --time 15 sidefx-local
docker rm sidefx-local
```

The image pins Node 24.20.0 and the Linux amd64 base manifest digest. Dependencies use `npm ci`.
The build validates the selected publication, compiles Next.js, runs TypeScript, ESLint and tests.
Existing browser-state mount effects currently produce three lint warnings; there are no suppressed
new lint errors. Runtime uses `node server.js` as the non-root `node` user. Public/static assets
and the selected generated JSON are explicitly copied. `.dockerignore` allow-lists source inputs,
excluding environment files, Git history, local database captures and work queues.

`npm run build` never refreshes the estate. After a deliberate content refresh, use
`npm run select:estate` and review/commit the two projections plus `publication-manifest.json`.
The manifest pins their bytes. Runtime and build share schema, publication identity, graph digest,
owner/scenario and coverage checks. This verifies the stored publication, not the absent upstream
query result; upstream source digests remain retained provenance.

## Staging setup and release

Run `infra/bootstrap-staging.ps1` from PowerShell 7 with Azure and GitHub administrative access.
It creates a staging slot on the existing plan, assigns the slot an ACR pull identity and creates
the `sfx-platform-github-staging` user-assigned identity for GitHub OIDC. Its Website Contributor
scope is the staging slot only. Deployment patches that slot's `config/web` resource directly using
API `2025-05-01`, avoiding the container CLI helper's reads of production app settings and registry
admin credentials. AcrPush is scoped to the existing registry under its legacy RBAC
mode; no registry admin password is used. An ABAC registry requires revising the role binding.

The GitHub `staging` environment trusts only `main` and the implementation branch
`codex/azure-container-deployment`. Client, tenant and subscription IDs are nonsecret environment
variables. Set repository variable `AZURE_STAGING_ENABLED=true` to enable staging delivery.
Future branches require a deliberate environment-policy change. Bootstrap does not enable this flag.
The actual OIDC subject includes numeric owner/repository IDs; its exact observed value is recorded
in `infra/azure.json`. A name-only subject failed authentication in the first run. Preserve the
ID-qualified trust boundary; inspect the actual claim again if repository ownership changes.

`.github/workflows/container.yml` builds and tests on pull requests and the two selected branches.
Only a non-PR run with the flag enabled can enter the OIDC staging job. Build actions are pinned
to commit digests. The build job has no Azure token permission.

The workflow runs the final image, checks representative pages and all their static references,
redirect/404 behavior, server-rendered circuits and staging noindex. It removes a circuit artifact
inside the disposable test container to verify `/readyz` returns 503 while `/healthz` stays 200,
then restores the artifact and exercises restart/graceful stop. The stored Docker image is loaded
by the staging job and its image ID compared with the tested one; it is not rebuilt. After push,
the registry digest is pulled and compared again, then the tag and manifest are write/delete locked.
App Service receives the digest reference. Azure ingress smoke checks must pass before the job succeeds.
The image embeds its source commit in `SIDEFX_RELEASE_REVISION`; `/readyz` exposes it in the nonsecret
`X-SideFX-Release` header. Smoke checks wait for that exact revision and a JSON ready response, so a
starter page or the previous healthy release cannot satisfy a new deployment's readiness check.

Artifacts record commit, lockfile hash, publication selection, image ID/digest, previous slot image,
URL and test logs. GitHub retains the tested image archive for 14 days and staging receipt for 90 days;
the locked release remains in ACR. A failed staging check leaves its failure visible and retains the
receipt; it does not silently report a deployment success or swap production.

## Runtime and state

Classic App Service routes to `WEBSITES_PORT=3000`; the app receives `PORT=3000`,
`HOSTNAME=0.0.0.0`, `NODE_ENV=production`. Health Check and warm-up use `/readyz` and require 200.
The Docker health check also uses `/readyz`. `/healthz` only verifies process responsiveness;
`/readyz` reads and validates the selected publication and freshness configuration. Neither invokes
a provider or returns source facts/secrets. A stale but valid estate stays available with its existing
notice; publication freshness is not a provider outage or evidence of complete P1 functionality.

`SIDEFX_INDEXING=disabled` is sticky to staging. The runtime proxy applies noindex to prerendered
responses too and supplies a disallow-all robots file. It is not access control: staging contains the
same public estate already committed to GitHub. Add actual access controls before introducing private
test accounts, drafts or service artifacts.

The canonical production origin is a build-time value shared across slots. Service endpoints and
secrets must use server-side runtime configuration in future integrations. Container storage is
disposable. Hosted contact actions currently refuse to acknowledge receipt; the development Map
is not a durable store and no mail worker exists. Auth, jobs, original media and exports still need
their external adapters. Logs go to stdout/stderr. Multi-instance cache/action coordination remains
a release task before scale-out.

## Production and rollback

Production is intentionally not an automatic workflow target while spec §9 gates remain open.
Before promotion, finish the P1 integrations and evidence, configure the production pull identity,
runtime settings, health checks and domain/TLS bindings, and test slot identity behavior. Establish
production's previous image/configuration receipt before its first swap. Configure sticky service
settings and production indexing explicitly. Confirm `www.sidefx.io`, apex redirect and the staging
hostname/DNS with the domain owner.

Promote the exact validated ACR digest (or verified slot swap); never rebuild during promotion.
After promotion, verify production through its own ingress and record the result. Rollback restores
the prior recorded image and environment configuration, or swaps back the retained validated slot.
It does not reverse database writes. Production promotion and rollback are not claimed as tested by
the staging workflow or by successful ACR publication.

## References

- [Next.js standalone output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)
- [Azure classic container configuration and managed identity](https://learn.microsoft.com/en-us/azure/app-service/configure-custom-container)
- [Azure deployment slots](https://learn.microsoft.com/en-us/azure/app-service/deploy-staging-slots)
- [Update slot configuration API](https://learn.microsoft.com/en-us/rest/api/appservice/web-apps/update-configuration-slot?view=rest-appservice-2025-05-01)
- [GitHub OIDC authentication to Azure](https://learn.microsoft.com/en-us/azure/developer/github/connect-from-azure-openid-connect)
- [ACR image locking](https://learn.microsoft.com/en-us/azure/container-registry/container-registry-image-lock)
