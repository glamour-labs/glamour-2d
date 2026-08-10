# browser-qc · third-party embed (plain HTML + UMD player) · rollup: PASS

Scope: verify Glamour's UMD player (`glam-player.umd.js`) works as a drop-in embed in a page
that is NOT part of the Glamour repo — the "random new user drops it into their real project"
scenario. Server: `python3 -m http.server 8123` serving `/tmp/glam-realproject/` (index.html,
demo.glam, glam-player.umd.js — no build tooling, no Node 20 requirement at runtime).

Tool: `playwright-cli --raw -s=qc-embed`, depth: quick. No code changes made — observation only.

## Path A — zero-JS drop-in (`<glam-canvas src="./demo.glam">`) — PASS
- Tested:   Loaded `http://localhost:8123/index.html`, screenshotted the first canvas (auto-registered by the UMD script with no host JS beyond the `<script src>` tag).
- Expected: Orb + "click the orb" text + a green progress bar render inside the canvas, matching the doc's intended layout.
- Actual:   Canvas rendered exactly as expected — blue orb, label text, green bar (~35% width at initial `demo.glam` default).
- Evidence: <repo>/docs/superpowers/qc/evidence/embed-browser-qc/01-initial.png

## Pointer interaction — hover — PASS
- Tested:   `mousemove` to orb center in Path A canvas (no click), screenshot.
- Expected: Hover reacts (per doc author's intent — "pointer interaction just works").
- Actual:   Orb visibly lightened (solid blue → pale blue) on hover; Path B orb (untouched) stayed solid blue, confirming the two canvases are independent players reacting correctly to their own pointer state.
- Evidence: <repo>/docs/superpowers/qc/evidence/embed-browser-qc/02-hover-pathA.png

## Pointer interaction — click (Path A) — PASS
- Tested:   `mousedown`/`mouseup` on the orb center in Path A canvas.
- Expected: idle → active state transition, orb "changes" (grows / color shift).
- Actual:   Orb grew (Konva circle radius 52 → 78, confirmed via `window.Konva.stages[0].find('Circle')`) and changed color blue → orange. Visual + programmatic confirmation agree.
- Evidence: <repo>/docs/superpowers/qc/evidence/embed-browser-qc/03-click-pathA.png

## Path B — host-driven input, orb click — PASS
- Tested:   Clicked the orb in the Path B canvas (`renderGlamour()` instance driven by host JS), read `#st` readout and Konva circle radius before/after.
- Expected: Same idle→active transition as Path A (grow + color shift); "state: …" readout updates from `player.getState()` polling.
- Actual:   Orb grew (radius 52 → 78) and shifted blue → orange; readout updated from "state: idle" to **"state: active"**.
- Evidence: <repo>/docs/superpowers/qc/evidence/embed-browser-qc/05-click-pathB-fixed.png
- Note: first attempt at this click landed on stale pre-scroll coordinates (an intervening `click` command via CSS selector auto-scrolled the page ~465px, per Playwright's scroll-into-view behavior) and silently missed the orb — this is a QC-methodology gotcha, not a Glamour defect. Re-measured `getBoundingClientRect()` post-scroll and the retry worked cleanly.

## Path B — host-driven input, "progress 100%" button → `bar` width — PASS
- Tested:   Clicked `#p100` button, screenshotted both canvases.
- Expected: Green `bar` in Path B (bound to `progress` input via `lerp`) fills to 100% width; Path A's bar (independent instance, untouched) stays unaffected.
- Actual:   Path B bar filled to full width of the track; Path A bar unchanged. Confirms `setInput('progress', 1)` correctly drives the bound `lerp` node.
- Evidence: <repo>/docs/superpowers/qc/evidence/embed-browser-qc/06-progress100.png

## Path B — host-driven input, range slider → `bar` width — PASS
- Tested:   `fill #sl 0.35` (range input), read back `el.value === "0.35"`, screenshotted.
- Expected: Bar width proportional to slider value (0.35 of track), readout stays "state: active" (orb already active from prior click, unaffected by progress-only input).
- Actual:   Bar visibly shrank from full-width back to ~35% width, matching the slider's `oninput → setInput('progress', 0.35)` wiring. Readout remained "state: active".
- Evidence: <repo>/docs/superpowers/qc/evidence/embed-browser-qc/07-slider35.png

## Diagnostics — console — PASS
- Tested:   `playwright-cli console` after full interaction sequence.
- Expected: No errors related to loading/parsing the UMD bundle or the `.glam` doc.
- Actual:   1 total console message, and it is a benign `favicon.ico` 404 — no errors from `glam-player.umd.js`, `Glam.renderGlamour`, Konva, or JSON parsing of `demo.glam`.
- Evidence: console dump captured inline (see command transcript); no artifact file — level of detail is a single-line message, reproduced verbatim above.

## Diagnostics — network requests — PASS
- Tested:   `playwright-cli requests --static` after full interaction sequence.
- Expected: `index.html`, `glam-player.umd.js`, `demo.glam` all 200 OK; no 4xx/5xx besides the accepted favicon 404 (which doesn't show in the JS-request list, only in console).
- Actual:   4 requests total, all `200 OK`: `index.html` (1), `glam-player.umd.js` (1), `demo.glam` (2× — once by the UMD player auto-registering `<glam-canvas>`, once by the page's own `fetch('./demo.glam')` for Path B). No failed asset loads.
- Evidence: request list captured inline in command transcript (see below); no separate artifact file.

```
1. [GET] http://localhost:8123/index.html => [200] OK
2. [GET] http://localhost:8123/glam-player.umd.js => [200] OK
3. [GET] http://localhost:8123/demo.glam => [200] OK
4. [GET] http://localhost:8123/demo.glam => [200] OK
```

## Verdict

**PASS.** Glamour's UMD player works as a genuine drop-in embed in a plain third-party page with
zero build tooling: `<script src="./glam-player.umd.js">` + `<glam-canvas src="./demo.glam">`
renders and reacts to pointer input with no host JS (Path A), and the `Glam.renderGlamour()` API
lets host code drive playback state via `setInput()` / read it via `getState()` (Path B). Both
paths were exercised end-to-end (render, hover, click, button, slider) with no console errors and
no failed network requests beyond an accepted favicon 404.

One methodology note only (not a product defect): a stray `click` command using a CSS-selector
target auto-scrolled the page, invalidating a prior manual-coordinate click on Path B's orb. This
is a QC-tooling interaction to remember for future sessions (re-measure `getBoundingClientRect()`
after any selector-based click, before doing manual coordinate math), not a finding about Glamour
itself.
