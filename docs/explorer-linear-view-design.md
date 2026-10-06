# Capability Explorer: linear scenario view, design L1

Recorded 2026-10-06. Status: **for review**. Nothing is implemented.

The deck is one editable slide:
`sfx-providers/outputs/capability-estate/live-circuit-platform-explorer/L1/linear-L1.pptx`.
Its render, generator, sources and `SHA256SUMS` sit beside it.

| Artifact | SHA-256 |
| --- | --- |
| `linear-L1.pptx` | `065b284d53c9eef613b2068954e6d0163682cc0b203726005e61f2db0e5e1a84` |
| `render/slide-01.png` | `89f6280cf32ed14c5ba3b004e86d7a164fd03c20631066cd4d07795c36c660b5` |

## What the slide shows

The Explorer workspace for `authenticate-ide-user` (one scenario, three scenario
pages, 17 operations), with two new run-bar controls:

- **View: Paged | Linear.** Paged is today's page-by-page circuit. Linear lays
  every scenario page end to end. The choice is kept per viewer and in the URL.
- **Zoom:** −, a preset list (Fit, 100%, 150%, 200%) and +, plus Ctrl + wheel
  and pinch.

It shows two states of the linear view:

- **A · Fit.** All three pages sit side by side between pinned end caps:
  Given / Input on the left and Then / Outcome on the right. There is no
  scrollbar.
- **B · Zoomed (180% of fit).** The end caps stay pinned at both edges and scale
  with the band. A horizontal scrollbar under the band scrolls only the pages.
  Follow execution scrolls the band to the current operation instead of
  switching pages.

Amber markers show where pages meet (operations 7 → 8 and 14 → 15). The
Complete execution circuit page stays a separate page in both views.

## Sources

The circuit pieces are the returned database scene pages, cropped by viewBox
only. Their content is unchanged; each piece is embedded as the SVG with a PNG
fallback. The cuts follow the scene's own regions:

- **Left end cap:** x 8–166, the Given / Input region.
- **Bands:** x 166–794 of each page, the When / Event region and its providers.
- **Right end cap:** x 794–952, the Then / Outcome region.
- **Height:** y 77–499, the capability boundary and the telemetry strip.

Scene snapshot `dba6240f…`, read 2026-10-06 11:08 UTC. The tree and header come
from `capability-details.v1` version 2591462.

Design additions, not database authority: the two new controls, the amber
markers, the scrollbar, and one placeholder (below).

## Decision needed

Each page draws only the outcome variants its own operations reach:

- page 1: `authenticated`, `authentication rejected`, `identity unavailable`;
- page 2: `throttled`;
- page 3: none.

So no single page's Then region can be the linear end cap. The slide uses page
1's Then region and marks `throttled` as a placeholder.

- **Client-composed (quicker).** Crop each returned page by its regions and lay
  the bands end to end. The end cap then shows only one page's outcomes, and the
  lanes to the outcomes break at page edges.
- **Reader-composed (recommended).** `read_live_scenario_circuit` returns one
  linear scene: one Given, the whole execution chain, one Then listing every
  outcome variant with its lanes, and the end-cap bounds the client pins. The
  browser only fits, zooms and scrolls; nothing is redrawn there. This is an
  estate change to the circuit reader.
