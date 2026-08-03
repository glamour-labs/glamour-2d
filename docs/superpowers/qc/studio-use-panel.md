# browser-qc · Glamour Studio "Use it" panel · rollup: PASS

Served: production build via `vite preview --port 5199` (root `npm run build` + `npm run build -w @glam/studio`), Node v20.19.4. Session `qc-studiouse`. No auth required (local static app, no backend — AI panel correctly shows "Offline mode").

## Initial load — PASS
- Tested:   navigate to `http://localhost:5199`, resize to 1600x1200, full-page screenshot.
- Expected: dark two-pane UI (Document editor left, Preview right) with a "Use it" panel beneath the editor, showing 3 tabs.
- Actual:   Loads with default sample doc (blue orb + green bar). "Use it" section present under "Document", tabs Web component / JavaScript / React, Web component selected by default, snippet + Copy button all render on dark theme.
- Evidence: /Users/khavu/Project/glamour/docs/superpowers/qc/evidence/studio-use-panel/01-initial-state.png

## Load real progress-ring doc — PASS
- Tested:   cleared JSON editor, filled with contents of `/Users/khavu/Project/glamour/sketches/progress-ring/ring.glam` (canvas 360x360, bg #0e1014, 12 dots + track + core, progress=0.66).
- Expected: right pane renders 12 dots ring + green core on dark bg per the doc's bind expressions (progress 0.66 → ~8 dots bright, core r≈22).
- Actual:   Preview renders correctly — 12-dot ring visible, several dots dim (opacity 0.12, not yet reached by progress 0.66) fading up to full-bright ones, green core rendered at a real radius (not 0), all on the #0e1014 dark canvas. Machine state correctly reads "(no machine)" since ring.glam has no `machine` block. Progress slider reflects 0.66.
- Evidence: /Users/khavu/Project/glamour/docs/superpowers/qc/evidence/studio-use-panel/02-ring-loaded.png

## Use it — Web component tab — PASS
- Tested:   tab is default-selected; confirmed content and re-visited it after cycling other tabs.
- Expected: shows `<script src="/glam-player.umd.js"></script>` + `<glam-canvas src=...>`.
- Actual:   Exactly that — `<script src="/glam-player.umd.js"></script><glam-canvas src="/my.glam"></glam-canvas>`, with a caption noting the doc is assumed saved as `my.glam` and the UMD bundle path.
- Evidence: /Users/khavu/Project/glamour/docs/superpowers/qc/evidence/studio-use-panel/05-tab-webcomponent.png

## Use it — JavaScript tab — PASS
- Tested:   clicked "JavaScript" tab.
- Expected: shows `Glam.renderGlamour(...)` call with the ring doc inlined, canvas `"w": 360`.
- Actual:   Snippet is `<script src="/glam-player.umd.js"></script><div id="stage"></div><script> const doc = {...ring doc, "canvas":{"w":360,"h":360,"bg":"#0e1014"}...}; const player = Glam.renderGlamour(doc, document.getElementById('stage')); // player.setInput('progress', 0.5); </script>` — doc is the live, current editor content (confirmed the exact ring JSON is inlined, not a stale/default doc).
- Evidence: /Users/khavu/Project/glamour/docs/superpowers/qc/evidence/studio-use-panel/03-tab-javascript.png

## Use it — React tab — PASS
- Tested:   clicked "React" tab.
- Expected: shows a `<Glamour doc={...} />` usage.
- Actual:   `// Glamour component — see docs/USING-GLAMOUR.md (Path C) for the wrapper source. const doc = {...ring doc inlined...}; <Glamour doc={doc} inputs={{ progress: 0.66 }} />`. Correctly reflects the live inputs.progress value from the doc.
- Evidence: /Users/khavu/Project/glamour/docs/superpowers/qc/evidence/studio-use-panel/04-tab-react.png

## Copy button — PASS
- Tested:   clicked "Copy" button on the Web component tab.
- Expected: label flips to a "Copied" confirmation, no console error.
- Actual:   Button label flips to "Copied!" immediately on click (first attempt was screenshotted too late — full-page screenshot capture is slow enough that the label had already reverted to "Copy" by render time; a second click + fast viewport-only screenshot caught "Copied!" cleanly). No console errors either time.
- Evidence: /Users/khavu/Project/glamour/docs/superpowers/qc/evidence/studio-use-panel/06-copy-confirmation.png

## Diagnostics — PASS
- Tested:   `playwright-cli console` and `playwright-cli requests --static` after full click-through (load, edit doc, 3 tab switches, 2 copy clicks).
- Expected: no console errors; no failed (4xx/5xx) requests.
- Actual:   0 console messages (0 errors, 0 warnings). All 3 network requests (`/`, JS bundle, CSS bundle) returned 200. No favicon request fired at all (non-issue either way).
- Evidence: inline in this run — no screenshot needed for a text-only check.

## Notes
- Server: `vite preview --port 5199` from `apps/studio`, killed after the run.
- No design export was supplied for this task — fidelity is functional/measured against the DoD described in the task prompt (ring renders, 3 tabs correct, copy works), not pixel-diffed against a Figma export. Flagging per the measured-fidelity doctrine: if a design export exists for Studio's Use-it panel, a follow-up fidelity pass with a side-by-side composite would be worth running.
