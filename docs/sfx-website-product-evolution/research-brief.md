# Declarative UI circuits: research brief

Shared context for the research lanes behind
[`implementation-strategy.md`](implementation-strategy.md) and the website
evolution in [`intent.md`](intent.md).

## The repositioning

`intent.md` repositions the SFX website around six stories (why SFX exists, who
it is for, standards and assurance, the product, the provider ecosystem, what is
happening now). The new site will make one argument: intelligence may propose;
capabilities authorize; effects are evidenced.

## The problem this research solves

The deployment process is too expensive for the volume of UI and content change
the website evolution needs. Two costs must go away:

1. **Deploy-per-change.** A UI tweak or content edit must not require a code
   deploy, a composite image build, or the full staging acceptance pipeline.
2. **Repetitive rendering code.** The same rendering concerns (layout, tables,
   forms, media, actions, navigation) must not be re-implemented per page.

## The hypothesis to test and design

Pages become declared circuits of capabilities:

- Each page is declared as its own circuit.
- A declared **page capability** leverages a **layout capability** as a provider.
- Other capabilities are grouped into the layout's sections and drive each
  section's display, data, actions and events.
- **UI capability providers** live in `sfx-providers/providers/` as a reusable
  stack (rendering, routing, actions, events), so pages compose providers instead
  of shipping new client code.

## Questions the strategy must answer

1. What is a circuit, a capability, a provider, a port, a binding and a binding
   execution in the current runtime, and what is the narrowest faithful mapping
   of "page capability + layout capability + section capabilities" onto those
   concepts?
2. Which parts of the current UI stack (client JS, HTML, CSS, host routes) are
   generic and reusable as providers, which are bespoke, and what is the first
   real page to convert (the shallow cut that proves the model)?
3. How are providers and capabilities declared into the estate, admitted, bound
   and read today, and what would a UI renderer/action provider declaration look
   like while respecting platform rules (SDA by request, capability meaning via
   `sfx-embody` migration pairs, identity schema via `sfx-dal`)?
4. What must remain deployed (the runtime shell) versus what becomes data
   (page declarations, section composition, content, component list), and what
   change classes result (code deploy vs data/content change)?
5. What are the security, authority, caching, versioning, local-development and
   acceptance implications of pages that read their structure at runtime?
6. What prior decisions constrain the design (design surface E1/L1/V1/V2/P1,
   host-declared home composition, Explorer-only surfaces, prompt shell, visual
   system), and what can be reused?

## Where things are

- Platform runtime: `C:\lab\repos\sfx-platform\live-circuit\`
  - `circuit/` — the pages (home, login, explorer), runtime, traversal,
    storage and verification scripts.
  - `dispatch-pair/observe-server.mjs` — the host that serves the site, the
    static `CIRCUIT_FILES` map, and the same-origin API routes.
- Release machinery: `C:\lab\repos\sfx-platform\deploy\staging\` and
  `C:\lab\repos\sfx-platform\.github\workflows\staging.yml`.
- Capability estate: `C:\lab\repos\sfx-embody\` (capability declarations,
  port configurations and instructions, SQL migration pairs).
- Providers: `C:\lab\repos\sfx-providers\providers\` (for example
  `circuit-presentation`, `ide-session-provider`, `identity-principal-provider`)
  and the design surface
  `C:\lab\repos\sfx-providers\outputs\capability-estate\live-circuit-platform-explorer\`
  (E1, L1, V1, V2, P1).
- Generated DAL: `C:\lab\repos\sfx-dal\`.
- Scenario engine: `C:\lab\repos\scenario-driven-architecture\`.
- Platform rules: `AGENTS.md` (SDA by request; capability meaning only through
  `sfx-embody` migration pairs; identity schema only through `sfx-dal`).

## Known anchors (verify, do not trust blindly)

- `live-circuit/circuit/circuit-host.json` already declares host-page
  composition (the `home` block, `identity.circuit`) and retrieval policy.
- The pages today are `home.html`/`home.js`, `login.html`/`login.js` and
  `explorer.html`/`explorer.js` plus shared modules and CSS, served by
  `dispatch-pair/observe-server.mjs` from its static file map.
- Every new client module must be added to that map and to the staging
  acceptance routes, or the deploy rolls back.
- Watched deploy paths include `live-circuit/**`, `deploy/**` and
  `tools/**`; a full staging acceptance run has recently taken 16-18 minutes
  plus a build. The goal is that page/content changes never need this.

## Lane roster

| lane | file | question |
| --- | --- | --- |
| 1 | `analysis/01-runtime-page-circuit.md` | Runtime model and page-as-circuit mapping |
| 2 | `analysis/02-rendering-inventory.md` | Rendering stack inventory and reusable component taxonomy |
| 3 | `analysis/03-ui-capability-providers.md` | Estate mechanics for declaring UI capabilities/providers |
| 4 | `analysis/04-serving-routing-deploy.md` | Serving, routing, change classes and deploy economics |
| 5 | `analysis/05-prior-art-design-surface.md` | Prior art, constraints and reusable assets |

## Conventions

- Cite `path:line` for every claim about current behavior.
- Label proposals `[proposal]` and distinguish them from observable code.
- Every lane ends with a **Gaps and unknowns** section.
- Research only: change no product code, write only your own analysis file,
  commit nothing.
- Plain language; real names from the code; no invented behavior.
