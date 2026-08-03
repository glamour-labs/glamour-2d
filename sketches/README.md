# Sketches — real glamours built with the tooling

Hand-and-AI-authored `.glam` files that exercise the format for real (and surface gaps).

## progress-ring
`progress-ring/ring.glam` — a segmented progress ring (12 dots + a green core), each bound to a
single `progress` input via `clamp((progress*12 - i)*3, 0.12, 1)`. **Hand-authored** (generator
script). Building it caught the `canvas.bg` dead-field bug (now fixed).

## toggle-switch
`toggle-switch/toggle.glam` — an on/off settings toggle (track + knob + OFF/ON label), state machine
`off`⇄`on` on click, tweened knob-slide + colour. **AI-authored** — the first real run of the
`cast-glamour` skill loop from a natural-language description ("an on/off toggle, slides + changes
colour, feel springy"). The AI made every design call (dims, iOS-green `#34c759`, dual-click target,
the label affordance) and self-verified (validate → render both states → look). One pass, no fixes.

## flappy (tap scene)
`flappy/flappy.glam` — AI-authored from "a flappy bird game, click/space to jump". A tappable Flappy-flavoured scene (bird hops on click via a 2-state machine); NOT a playable game. The ask exposed the format ceiling: no keyboard (space), no physics/gravity loop, no moving pipes, no collision, no scoring — all game-engine territory. Also surfaced: headless `glam render` (no --state) draws base node props, NOT the machine initial-state `set`, so a still shows the resting pose (here it matches; would diverge if initial-state differs from base).

## draw-letter-a (Duolingo trace card)
`draw-letter-a/letter-a.glam` — AI-authored from a 3-screen Duolingo reference. An instructional TAP-THROUGH (ghost+arrow start / bowl counterclockwise then stem down / black letter reveal / sparkle celebration), 3-state machine. NOT interactive tracing. Biggest ceiling hit yet — real trace-the-letter needs a whole capability class v1 lacks: pointer-DRAG/move input, freehand ink/stroke rendering, a path primitive, and partial stroke-along-path reveal (blocked also by no sin/cos in exprs). Also: no bold/fontStyle (faked with stroke).

## trace-letter (Rung 2 — real interactive tracing) — NEW
`trace-letter/letter-a.glam` + `trace-letter/index.html` — the answer to draw-letter-a's ceiling.
A `stroke` guide path + a drawable `ink` node + a doc-level `ink` block with a `match` target. Open
`index.html` (served, so the UMD bundle + `fetch` resolve): drag from the green dot along the grey
path, and the **canvas inks the drag live**; on release the host reads the `traceMatch` score from the
`onStroke` event and renders pass/try-again. The scoring threshold lives in the HTML (the host),
not in the glamour — the mission split. Uses Rung 2: `stroke` node, `ink` block, `onStroke`,
`traceMatch`.

## Format gaps surfaced by real use — status
Real authoring kept revealing what the format couldn't yet say. The v1.1 + Rung 2 pass closed the
backlog below:
1. **`arc` primitive** — **DONE (v1.1)**. `arc` node (innerRadius/outerRadius/angle) for a smooth
   sweeping ring. (was: from progress-ring)
2. **`rect` corner radius** — **DONE (v1.1)**. `cornerRadius` on rect. (was: from toggle-switch)
3. **spring / elastic easing** — **DONE (v1.1)**. `backInOut` + `elasticOut`. (was: from toggle-switch)
4. `canvas.bg` — was a dead field; **FIXED** 2026-07-22.
5. **bold / fontStyle** — **DONE (v1.1)**. `fontStyle` on text. (was: from draw-letter-a)
6. **pointer drag/move input + freehand ink + trace-matching** — **DONE (Rung 2)**. `stroke` node,
   `ink` block, `onPointer`/`onStroke`, pure `traceMatch`. (was: from draw-letter-a)
7. **gradient fills + glow/shadow + `ellipse`** — **DONE (v1.1)**, the fidelity/paint layer. (was:
   from the orb proof)

Still open (v2-scale): raster/sprite fill + halftone texture (the orb's last ~20%), keyboard input +
collision + spawning (Rung 3 / flappy), a path primitive with partial stroke-along-path reveal.
