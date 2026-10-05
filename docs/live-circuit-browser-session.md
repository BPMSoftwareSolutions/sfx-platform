# Live Circuit browser session: cookie and CSRF contract

Status: **implemented and verified locally (2026-10-05); not yet released to
`sidefx/staging`.** It reaches staging with the next image that carries
`live-circuit/` and the updated gateway (see
[live-circuit-staging-deployment.md](live-circuit-staging-deployment.md) §6).

The estate's CLI login plan requires browser login to have its own cookie and
CSRF contract, rather than placing the CLI bearer in browser storage. This is
that contract. Sign-in runs the same declared capability as `sfx login`:
**`authenticate-ide-user`**, executed by the identity host's
`POST /auth/v1/login`. The circuit page can watch it live.

## 1. Who holds what

| Party | Holds | Never holds |
| --- | --- | --- |
| Browser | `__Host-sfx-session` cookie (HttpOnly, so script cannot read it) | Password after submit; bearer value |
| Observer (`live-circuit/`, loopback 8787) | Bearer only for the duration of a request; display labels (identifier by session ID) and run attributions, in memory and bounded | Passwords at rest; bearers at rest |
| Identity host (loopback 8793) | Sessions, verifier store, audit; runs `authenticate-ide-user` | — |
| SDA Run API (loopback 8799) | The host's machine credential | User bearer, cookie, password |

## 2. Routes (same origin, through the gateway)

| Route | Behavior |
| --- | --- |
| `GET /circuit/login` | Sign-in page (`login.html`, `login.js`). `?return=/circuit...` names a same-origin circuit path to open after sign-in |
| `POST /api/circuit/v1/session` | Body exactly `{ "identifier", "password" }` (≤ 4 KiB). Forwarded to `POST /auth/v1/login`. On `200`, sets the cookie and returns `{ disposition: AUTHENTICATED, sessionId, principalId, expiresAt, realm, identifier }`. No bearer in the body |
| `GET /api/circuit/v1/session` | `{ authenticated, observeRequiresSession, ... }`. With a cookie, validated by `GET /auth/v1/session`. An ended session clears the cookie (`disposition: SESSION_ENDED`) |
| `GET /api/circuit/v1/session/runs` | Runs this principal admitted through Observe on this observer (in memory) |
| `POST /api/circuit/v1/session/logout` | Calls `POST /auth/v1/logout` and always clears the cookie. Reports `REVOKED`, `SESSION_ALREADY_ENDED`, `NOT_SIGNED_IN` or `REVOCATION_UNCONFIRMED` (503). Clearing the cookie is never reported as server revocation |
| `POST /api/circuit/v1/runs` (Observe) | Same-origin JSON and body checks first. Then, when `identity.observeRequiresSession` is true (the default), the session is validated. Refusals: `401 SIGN_IN_REQUIRED`, `401 SESSION_ENDED` (cookie cleared), `503 IDENTITY_NOT_CONFIGURED` or `IDENTITY_UNAVAILABLE`. Each refusal happens before any SDA API call |

The gateway admits exactly these three circuit POST paths. Every other non-GET
circuit request receives 405.

## 3. Cookie

`__Host-sfx-session=<bearer>; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=<seconds until expiresAt>`

- The `__Host-` prefix requires `Secure`, `Path=/` and no `Domain`.
- The value must match the identity host's bearer shape (32 bytes, base64).
  Anything else is treated as absent.
- Browsers treat `http://localhost` as secure, so local development works without
  TLS.
- A new sign-in revokes the browser's previous session on the identity host.

## 4. CSRF

Three controls apply together on every state-changing request (sign-in, sign-out,
Observe):

1. `SameSite=Strict`: cross-site requests carry no cookie.
2. The `Origin` header must be present and equal the forwarded host.
3. `Content-Type: application/json` is required, which a cross-site form cannot
   send without a CORS preflight. The observer answers no preflight.

Sign-in requires the same checks, which prevents login CSRF. All refusals happen
before the identity host is called.

## 5. What "tied to identity" means today

- **Observe needs a valid user session.** Anonymous or ended sessions are refused
  before admission. If identity is not configured, Observe is refused (fail
  closed).
- **Each admitted run is attributed to its principal and session** on the
  observer.
- **The SDA Run API still executes under the host's machine credential.** Per-user
  authority inside the API (allowed capabilities, run ownership on read/stream) is
  estate plan package **L5**, owned by the API. It is not established here.
- **Public reads stay public.** That covers scene inspection, run reads and
  `/events`. The plan's audience rules for private authentication traces are also
  outside this change.

## 6. Configuration

| Setting | Where | Meaning |
| --- | --- | --- |
| `SFX_IDENTITY_ENDPOINT` | Observer environment | Identity host base URL. The gateway sets `http://127.0.0.1:8793`; the identity host accepts loopback HTTP only behind its local gateway setting. For local development against staging, use the staging HTTPS origin |
| `identity` | `live-circuit/circuit/circuit-host.json` | `observeRequiresSession`, cookie name, timeout (130 s, longer than the identity host's two-minute attempt lifetime), body limit, label and attribution bounds |

Throttling: the identity host throttles by the connection's remote address. Behind
the gateway this is loopback for every caller, which is also true of CLI logins
today.

## 7. Verification

`node live-circuit/circuit/verify-identity-session.mjs` runs the real observer
against a stub identity host that answers with the identity host's contract
shapes, and a stub SDA API. Thirteen checks pass:

- page serving;
- unauthenticated state;
- cross-origin and form-encoded refusals before identity;
- malformed input;
- rejected credentials with no cookie;
- cookie attributes and a bearer-free body;
- status;
- anonymous Observe refused without reaching the API;
- signed-in Observe forwarded with the machine credential only and attributed;
- revoked session refused with the cookie cleared;
- sign-out revocation;
- fail-closed when identity is unconfigured;
- password and bearer canaries absent from observer output, API traffic and the
  identity log.

`verify-run-api.mjs` keeps its transport checks with the gate off, and confirms
the default gate refuses an anonymous Observe.

**Not yet established:** a real sign-in through the identity host, which executes
`authenticate-ide-user` and needs an enrolled account; the deployed gateway path;
and browser rendering of the page. Retain those as an acceptance receipt when this
is released.
