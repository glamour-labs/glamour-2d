# browser-qc · Crab Tap (@glam/example-react-crab) · rollup: PASS

App: `@glam/example-react-crab` (React + Glamour canvas embed)
URL: http://localhost:5173/
Dev server: started for this run (`npx pnpm@9.15.0 --filter @glam/example-react-crab dev`, Node 20.19.4), cwd verified via `verify-server-cwd.sh` → bound to `examples/react-crab` under the expected worktree checkout. Stopped at end of run.
No plan file / design export supplied for this task — fidelity check NOT-RUN (no baseline to measure against); this is a functional acceptance QC only, as scoped.

## Initial render — PASS
- Tested:   Load http://localhost:5173/, screenshot before any interaction.
- Expected: Title "Crab Tap", Score/Time HUD, crab canvas on blue/sand beach, "Start" overlay button.
- Actual:   All present — "🦀 Crab Tap" title, Score=0 / Time=15s HUD tiles, canvas showing muted blue sky / teal sea / sand beach with crab silhouette and eyes, orange "Start" button overlaid on canvas center.
- Evidence: docs/superpowers/plans/evidence/01-initial.png

## Start round — PASS
- Tested:   Click "Start" button (`role=button[name='Start']`), screenshot ~0.5s later.
- Expected: Overlay disappears, crab visible and animating (idle bob/sway), Time begins counting down.
- Actual:   Overlay gone, crab now rendered in full color (bright red body, googly eyes on stalks, visible claws/legs), scene brightened (sky/sea/sand palette shifted lighter — active-round state), Time HUD reads 14s (already ticking down from 15s).
- Evidence: docs/superpowers/plans/evidence/02-started.png

## Canvas tap → React score (key proof) — PASS
- Tested:   6x synthetic clicks via mousemove(640,373)+mousedown+mouseup at canvas center (canvas rect: x440-840, y187-487 → ~50% width, ~62% height, matching crab-body guidance), 0.15s apart.
- Expected: Score (React state) increases from 0 as a direct result of clicks landing on the canvas-rendered crab; game logic — including scoring — lives in React, not the canvas.
- Actual:   Score went 0 → 3 after 6 taps (some taps missed as the crab gently shifts position, consistent with mission description). A second batch of 6 taps at (620,365) brought score 3 → 5. Confirms `crab-tapped` events emitted by the Glamour canvas are correctly wired to and scored by the React component.
- Evidence: docs/superpowers/plans/evidence/03-after-taps.png (score=3, time=12s), docs/superpowers/plans/evidence/04-more-taps.png (score=5, time=12s)

## Countdown + round-end — PASS
- Tested:   Let the round run out (~3s wait after last tap batch), screenshot at expiry.
- Expected: Time counts down from 15 to 0 while running; round ends automatically.
- Actual:   Time HUD reached "0s"; canvas overlay switched to end-state ("Time! You scored 5 🎉" + "Play again" button), scene dimmed back to muted idle palette. Final score (5) matches the last in-round score exactly — confirms the round-end summary reads from the same React state as the live HUD.
- Evidence: docs/superpowers/plans/evidence/05-countdown.png

## Console + network diagnostics — PASS
- Tested:   `playwright-cli console` and `requests` / `requests --static` after full play-through.
- Expected: No JS errors (Konva/canvas warnings acceptable per mission brief).
- Actual:   1 console error total: `Failed to load resource: 404 (Not Found) @ /favicon.ico` — a missing static asset, not a JS/runtime error, does not affect app function. No other console errors or warnings. All `.vite/deps` and static requests returned 200; no 4xx/5xx besides the favicon.
- Evidence: console output captured this run (not screenshotted — text log): `[ERROR] Failed to load resource: the server responded with a status of 404 (Not Found) @ http://localhost:5173/favicon.ico:0`

## Rollup: PASS
Canvas-to-React wiring confirmed end-to-end: Glamour canvas renders + animates the crab, emits `crab-tapped` on click, React owns and correctly updates Score/Time state, and round-end summary matches live state. Only blemish is a cosmetic missing favicon (404) — not a functional defect. Fidelity dimension NOT-RUN (no design export/plan file provided for this task; out of scope as given).
