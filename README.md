# Patrick Luo · Particle blog

An English portfolio inspired by the atmosphere and full-screen navigation of [Tencent UP 2017](https://up.qq.com/act/a20170301pre/index.html). The particle geometry, transitions, and backgrounds are implemented locally with JavaScript, WebGL, and Canvas. The default background is now a quiet field of blue-violet particles, with the earlier stars, meteors, and aurora still available from the sky selector.

The repository root serves the approved particle blog on GitHub Pages. The reviewed snapshot remains in `previews/qq-inspired/`. Existing project, experience, and skills URLs retain their previous content using `legacy-styles.css`.

## Run locally

From the repository root:

```sh
python -m http.server 8769 --bind 127.0.0.1
```

Open [the site](http://127.0.0.1:8769/). No build step or npm dependencies are required.

## Included

- Four full-screen chapters: Home, Journal, Projects, and About.
- Twelve particle forms, including three space stations and Jupiter; every form rotates once in approximately 48 seconds.
- Hexagonal-prism, woven-net, and orbital-cloud transitions with a 90-degree camera turn.
- Automatic form changes after 60 seconds of settled, foreground display time; pause, hidden-tab, and reduced-motion support.
- Responsive separation between particle artwork and reading content, with a Canvas 2D fallback.
- A pure-particle background by default: sparse distant points, broken blue-violet streams, and a few drifting foreground points. Stars, meteors, and aurora remain selectable for comparison.
- One Field Notes entry: **Keeping TableSync in sync.** This remains a draft outline, not a finished or published article. Other outline data is retained for later use.
- TableSync first in Projects, with its [website](https://table-sync.app/) and an interactive frontend/backend/database architecture walkthrough.
- CaseCraft and GoodHub show their short introductions inline when their plus buttons expand the Projects entries.

Use the mouse wheel, arrow keys, PageUp/PageDown, chapter links, or vertical touch gestures to navigate. The arrow below the sculpture changes its form. The header controls pause motion, switch sky effects, and toggle fullscreen.

## Checks

From this directory:

```sh
node --test tests/particles.test.cjs tests/ambient.test.cjs
```

These checks exercise geometry, timing, transitions, autorotation, paused and hidden states, reduced motion, background switching, and fallback behavior without requiring a browser or GPU. The pure-particle direction was reviewed in a separate local preview before this update; the deployed source is the same effect with cache keys updated for changed assets.

## Assets and sources

Space Grotesk is bundled under the SIL Open Font License 1.1; see `assets/OFL.txt` and `assets/font-source.txt`. The signature and particle artwork are local assets, and the favicon uses the `pl` signature. TableSync explanations link to the [reviewed source snapshot](https://github.com/pljf/TableSync/tree/b70cd7ab4d333da134e9b38e594a28725e1fdeba). `previews/qq-inspired/DESIGN.md` records the preview's visual conventions and design history.
