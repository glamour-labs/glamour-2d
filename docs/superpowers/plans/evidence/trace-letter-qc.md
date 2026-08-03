# browser-qc · sketches/trace-letter · rollup: PASS

Served: repo root via `http-server -p 8137 -c-1 .` (source ~/.nvm/nvm.sh && nvm use 20.19.4). URL: http://localhost:8137/sketches/trace-letter/index.html

Note: the shared Chrome instance (attached via bootstrap, already running on :9222) had unrelated tabs open (a Crab Tap Game dev server at :5173, an orb.html tab). The initial `goto` on the "current" tab briefly rendered the correct page (screenshot 01 confirms this) but the tab was later found navigated away to :5173 by whatever else uses that shared browser — a new isolated tab (`tab-new`) was opened for all subsequent interaction to avoid cross-talk. All later checks ran on that dedicated tab.

## Render — PASS
- Tested:   Navigate to the sketch, screenshot initial state.
- Expected: Title "Trace the letter", subtitle instructions, 240x260 canvas with grey Λ-shaped guide path, green start dot near canvas (40,220).
- Actual:   All present. Canvas confirmed 240x260 (both `getBoundingClientRect()` and canvas.width/height attrs). Green dot located via pixel scan (color ~#5ad67d) centered at canvas (39.5, 219.5) — matches glam spec point (40,220) exactly.
- Evidence: docs/superpowers/plans/evidence/trace-letter-01-initial.png

## Correct drag → ink + pass verdict — PASS
- Tested:   mousedown at canvas-space (40,220) [mapped to page coords via canvas bbox x=258,y=90], mousemove through 15 intermediate points tracing both legs up to apex (110,40) and down to (180,220), mouseup.
- Expected: Blue ink stroke rendered along the path; `onStroke` fires with `traceMatch` score ≥ 0.6 and `startOk` true → verdict "Nice! ⭐" plus detail line with score/coverage/stray percentages.
- Actual:   Blue ink (#2f6bd8) drawn precisely over the grey guide, both legs, apex included. Verdict: "Nice! ⭐" in green. Detail: "score 100% · coverage 100% · stray 0%". Confirms canvas-owned ink drawing, onStroke event wiring, and traceMatch scoring all fire live end-to-end.
- Evidence: docs/superpowers/plans/evidence/trace-letter-02-drag-verdict.png

## Reload + wrong drag → fail verdict — PASS
- Tested:   Reload page (fresh ink), then mousedown/mousemove/mouseup a short 5-point horizontal wiggle scribble in the empty top-right corner of the canvas (~205,20)–(218,28)), far from the guide path and not starting at the green dot.
- Expected: Verdict is NOT a pass — low/zero score, likely "Start at the green dot" or "Try again".
- Actual:   Small blue scribble ink appears in the top-right corner (not along the guide). Verdict: "Start at the green dot 👆" in orange. Detail: "score 0% · coverage 0% · stray 100%". Correctly rejects the off-path stroke.
- Evidence: docs/superpowers/plans/evidence/trace-letter-03-wrong-drag.png

## Console / network diagnostics — PASS
- Tested:   `console` and `requests` after both drag runs.
- Expected: No JS errors; `letter-a.glam` fetch 200 OK; UMD bundle loads without error.
- Actual:   Console: 0 messages total (0 errors, 0 warnings). Network: `GET /sketches/trace-letter/letter-a.glam` → 200 OK (both initial load and post-reload). No 4xx/5xx observed.
- Evidence: inline in this run (no error output to screenshot); see command transcript above.

## Summary
Rung 2 interactive trace sketch works end-to-end in a real browser: pointer-drag draws live blue ink into the `stroke` node, `onStroke` reports a `traceMatch` score, and the host page's pass/fail verdict logic reacts correctly to both a faithful trace (100% score, pass) and a wrong scribble (0% score, explicit "start at the green dot" rejection). No JS errors, no failed requests. No code changes made.
