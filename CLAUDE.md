# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Gilded Grove — a static landing page for a boutique organic bamboo toilet paper brand (forest green + gold). No build step, no Node: plain `index.html`, `styles.css`, `main.js` (ES module). Three.js 0.160.0 is loaded from jsDelivr via the importmap in `index.html`; fonts come from Google Fonts. Deployed with GitHub Pages from `main` (https://yaaronet-dev.github.io/gilded-grove/).

## Commands

```
python -m http.server                 # serve locally (open http://localhost:8000, or /#open for unrolled state)
python -m pip install -r requirements-dev.txt
python -m pytest                      # full suite (~2 min)
python -m pytest tests/test_site.py::test_toggle_button   # single test
```

Tests use pytest + Playwright (Python) driving the **installed Microsoft Edge** (`channel="msedge"`, headless, SwiftShader WebGL) — Playwright browsers are not downloaded. They need internet (CDN). `tests/conftest.py` starts `http.server` on a free port per session; the `page` fixture records console errors, page errors and failed requests, so any new 404 or JS error fails `test_loads_without_errors`.

## Architecture of the 3D roll (`main.js`)

- Scene graph: `root` (follows the pointer: rotation, idle bob) → `spin` (the roll body: paper cylinder, end rings, gold tube; rotates about X). The unrolling `sheet` is a child of `root`, **not** `spin`, because its vertices are rebuilt every frame in `updateSheet()`.
- Open/close is a single scalar: `length` eases toward `targetLength` (`CLOSED` / `OPEN`). Everything derives from it — `spin.rotation.x = length / R` keeps the roll's rotation equal to the paper released, and the sheet UVs use `(total - s) / SHEET_LEN` so the texture stays pinned to the free end and appears to come off the roll.
- Sheet path: an arc over the roll from angle `A0` to the front (`ARC`), then a vertical hang of `length`, plus breeze ripple, mouse-driven pendulum sway (`swingX/swingZ` springs fed by pointer velocity) and an end curl.
- Textures are generated on canvases at runtime (`quiltTexture`, `endTexture`) — no image assets.
- `window.__roll` (getters: `length`, `isOpen`, `rotationY`) is a read-only hook the tests depend on; keep it if refactoring. `#open` URL hash starts the page unrolled (also used by tests).

## Layout gotcha

In `styles.css`, `.hero-copy, .hero-stage { min-width: 0 }` and the absolutely positioned canvas prevent the WebGL canvas's pixel size from widening its grid column (caused horizontal overflow on mobile). `test_no_horizontal_overflow` guards this at 390/768/1440 px.

## Required workflow

1. Planning is done on Opus 5.5; execution (writing code) is delegated to Sonnet 5.5 (Agent tool, `model: sonnet`).
2. After writing code, run the tests and the regression tests (`python -m pytest`); add tests for new behavior.
3. Commit after every action that changes code.
4. After tests pass, run a security review with the `security-review` skill.
5. At the end of the work, document every update made in Obsidian (via the obsidian MCP tools).
6. Branches: work on `dev`, merge to `main` (which GitHub Pages serves). Both exist on GitHub.
