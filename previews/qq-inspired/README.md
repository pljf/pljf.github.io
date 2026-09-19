# Patrick Luo · Particle blog preview

A standalone English portfolio preview inspired by the atmosphere and full-screen navigation of [Tencent UP 2017](https://up.qq.com/act/a20170301pre/index.html). The particle geometry, transitions, starfield, meteors, and aurora are implemented locally with JavaScript, WebGL, and Canvas.

This branch saves the reviewed preview under `previews/qq-inspired/`. It does not replace the repository's root homepage or publish a production redesign.

## Run locally

From the repository root:

```sh
python -m http.server 8769 --bind 127.0.0.1
```

Open [the preview](http://127.0.0.1:8769/previews/qq-inspired/index.html). No build step or npm dependencies are required. Serve the repository root so the existing CaseCraft and GoodHub project links resolve.

## Included

- Four full-screen chapters: Home, Journal, Projects, and About.
- Twelve particle forms, including three space stations and Jupiter; every form rotates once in approximately 48 seconds.
- Hexagonal-prism, woven-net, and orbital-cloud transitions with a 90-degree camera turn.
- Automatic form changes after 60 seconds of settled, foreground display time; pause, hidden-tab, and reduced-motion support.
- Responsive separation between particle artwork and reading content, with a Canvas 2D fallback.
- Stars, meteors, and aurora background options.
- One Field Notes entry: **Keeping TableSync in sync.** This remains a draft outline, not a finished or published article. Other outline data is retained for later use.
- TableSync first in Projects, with its [website](https://table-sync.app/) and an interactive frontend/backend/database architecture walkthrough.

Use the mouse wheel, arrow keys, PageUp/PageDown, chapter links, or vertical touch gestures to navigate. The arrow below the sculpture changes its form. The header controls pause motion, switch sky effects, and toggle fullscreen.

## Checks

From this directory:

```sh
node --test tests/particles.test.cjs tests/ambient.test.cjs
```

These checks exercise geometry, timing, transitions, autorotation, paused and hidden states, reduced motion, and fallback behavior without requiring a browser or GPU. Desktop and mobile appearance was also checked in a browser during local design review.

## Assets and sources

Space Grotesk is bundled under the SIL Open Font License 1.1; see `assets/OFL.txt` and `assets/font-source.txt`. The signature and particle artwork are local assets. TableSync explanations link to the [reviewed source snapshot](https://github.com/pljf/TableSync/tree/b70cd7ab4d333da134e9b38e594a28725e1fdeba). `DESIGN.md` records the preview's visual conventions and design history.
