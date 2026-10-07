# SFX Live Circuit Platform home page: design H2

## H2 visual revision, 2026-10-05

The revised eight-slide deck is in
`sfx-providers/outputs/capability-estate/live-circuit-platform-home/H2/home-H2.pptx`.
H1 remains unchanged. This is a design revision, not a website deployment.

- Two generated navy/cyan optical backgrounds support the cover, desktop and
  mobile compositions. They are decorative artwork, never execution evidence.
- Text, controls and page structures remain native editable PowerPoint objects.
  The three circuit placements retain the exact database SVG with its PNG fallback.
- The headline is now **Watch capabilities execute live.** It avoids claiming
  universal execution readiness from one accepted capability run.
- Featured cards use complete editorial summaries of their retained user stories
  and promises. Their friendly titles are design copy, not new database labels.
- The desktop signed-in view retains an explicit empty run state. All seven
  original review decisions remain present.

The sources remain the H1 readings at `2026-10-05T22:35Z`, including 350
capabilities, 1,019 scenarios and 125 multi-scenario capabilities. The design
task did not refresh or change database authority. See the source details below.

| H2 artifact | SHA-256 / verification |
| --- | --- |
| `home-H2.pptx`, 18,639,013 bytes | `0faa60178776b94f9e27ff656bde92ff67f720d1245b52ed3bfff683a430719f` |
| Exact embedded scene SVG, slides 3, 5 and 6 | `250c07e73dd9e888b468f50d1d90cfe8a62b919286b9fd8765a9a215be1ba26f` |
| Source H1, preserved | `b0a856c00f5635ffcad336bcfc8d82885132e1936b31f26560ab37567ad330a9` |
| `render/slide-01..08.png` | Final Microsoft PowerPoint renders, individually reviewed |
| `generator/`, `sources/`, `assets/`, `SHA256SUMS` | Retained authoring sources, readings, imagery and hashes |

Package integrity, slide count, source dimensions, heading fit, font policy and
Artifact Tool re-import all passed with no findings. Native PowerPoint rendering
also passed. The deck preserves Arial and the source 13.333 × 7.5 inch canvas.
The output folder remains outside Git. This record supplies its durable identity.

## H1 baseline

Status: **H1 drafted for review, 2026-10-05.** It is not implemented. The
staging gateway now serves the platform home page at `/`; the Next.js website
is retired under [the revamp plan](live-circuit-platform-revamp.md)
(decisions D2–D3, phases P2–P5).

## Package

The editable PowerPoint deck and its evidence are in
`sfx-providers/outputs/capability-estate/live-circuit-platform-home/H1/`. That
output folder is not version-controlled, so this record keeps the digests.

| File | SHA-256 |
| --- | --- |
| `home-H1.pptx` (8 slides, 1,025,412 bytes) | `b0a856c00f5635ffcad336bcfc8d82885132e1936b31f26560ab37567ad330a9` |
| `render/slide-01..08.png` | listed in the package's `SHA256SUMS` |
| `sources/catalog.json`, `healthz.json`, `authenticate-ide-user.scene.json` | listed in `SHA256SUMS` |
| Logo source: `docs/visual-assets/SideFX (SFX) Logo Emblem.png` (1,145,256 bytes) | `42b3f9c31416a0cf68ff6abc476caf9be585f94a9b1d11aada40d040706f60b7` |

Every element in the deck is an editable PowerPoint shape or text box. The hero
circuit is the returned scene SVG, unchanged, embedded as an Office SVG image
with a PNG fallback. The logo is cropped to emblem and wordmark, with its dark
background keyed to transparent so it sits cleanly on any surface.

## Frames

| Slide | Frame |
| --- | --- |
| 1 | Cover |
| 2 | Brief and sources |
| 3 | H1-A desktop, signed out, above the fold |
| 4 | H1-B how it works, capabilities to explore, footer |
| 5 | H1-C desktop, signed in |
| 6 | H1-D phone (390 px), top and scrolled |
| 7 | Headline options and their evidence |
| 8 | Decisions for review |

H1-A, the first screen:

- **Global bar:** logo, "Live Circuit Platform", navigation (Live Circuit,
  Capabilities, How it works), a STAGING label and Sign in.
- **Hero copy:** the headline "Watch every capability execute." with its
  mechanism line, two actions (Open the Live Circuit, Sign in to observe), and a
  note that viewing is public while Observe requires sign-in.
- **Hero figure:** the `authenticate-ide-user` scenario circuit read from the
  database.
- **Live counts strip:** capabilities, scenarios, multi-scenario capabilities and
  the installed kernel.

## Where each value comes from

The page shows only values it can read. A value it cannot read is shown as
unavailable, never as a plausible number.

| Value | Source used for H1 |
| --- | --- |
| Release and kernel | Staging `/healthz`: `sda-f50865d3feb4-r15`, kernel `sha256:f50865d3…` |
| Capability counts | `GET /api/circuit/v1/capabilities`, readAt `2026-10-05T22:35:07Z`: 350 capabilities (311 `sidefx:capabilities` + 39 `sidefx:platform-capabilities`), 1,019 scenarios, 125 multi-scenario capabilities |
| Hero circuit | Returned scene `authenticate-ide-user` / `scenario-1`, snapshot `dba6240fe5a3911e…`, `svgDigest` verified |
| Capability cards | Catalog `userStory` (actor, intent), `promise` and `scenarioCount` |
| Copy | [website-design-spec.md](website-design-spec.md) §1.7 (claims need evidence), §2.1 (name rules), §2.2 (claim with mechanism) |

The recommended headline cites the r15 hosted acceptance of 2026-10-05T22:31Z.
In it, a signed-in Observe of `request-capability-from-objective-v3` was admitted,
with live operation, provider and outcome visits. "Own your capabilities." (the
spec's primary tagline) is held: §1.7 requires a reviewed download bundle and
independent use first.

## Decisions for review

1. **Headline.** A (recommended), B, or hold C until downloads exist.
2. **Hero circuit.** `authenticate-ide-user` (shown) or the equity providers
   story.
3. **Featured capabilities.** Keep a curated four, or declare the list and section
   order as an authority the page reads, like the explorer navigation policy. The
   recommendation is the declared authority.
4. **Stats strip.** As shown. Observed-run counts wait for durable run history
   (P6).
5. **Navigation.** "Capabilities" opens the circuit catalog until the Explorer
   catalog lands (P4).
6. **Legal and About.** Retiring Next.js removes privacy, terms and About. Decide
   what returns, and the legal entity, before production.
7. **When `/` switches.** With P2, or sooner by routing `/` to the platform app in
   the gateway.

## Implementation notes, after review

- **Where it lives.** The page is a `live-circuit/` page served at `/`, in the
  same dependency-free style as the circuit and sign-in pages. Counts come from
  the catalog read; release and kernel come from the gateway's health response.
- **Signed-in state.** It uses `GET /api/circuit/v1/session` and
  `/api/circuit/v1/session/runs`.
- **Observed runs need one change.** Listing the capability of each run means the
  observer must record the Observe subject; today it records the run ID and
  admission time only.
- **Accessibility.** Keep the visible focus treatment and contrast of the circuit
  pages. The circuit preview's link text names the capability.
