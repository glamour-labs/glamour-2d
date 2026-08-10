# browser-qc · examples/alphabet · rollup: PARTIAL

> **Ran against commit `c144c48`.** Findings 1 (free-write dot stroke), 2 (responsive
> overflow) and 9 (favicon) describe code that has since been fixed — see `5fce8e4` and
> `0f11371`. Finding 6's *verdict* (stray taps are handled) still holds, but its stated
> mechanism does not: the `inked < 14` guard it credits was the cause of finding 1 and has
> been removed; the property is now carried by the scorer. Kept as-written rather than
> edited, because the evidence is the point.

Server started by this QC run (`node scripts/serve.mjs 4399`, per caller instruction — no
server was running beforehand). cwd verified against the worktree via
`verify-server-cwd.sh` before navigating. Player bundle confirmed fresh (no `packages/{core,player}/src`
files newer than `packages/player/dist/glam-player.umd.js`) — no rebuild needed.

Session: `qc-abctrace`. Depth: thorough. Route: `http://localhost:4399/examples/alphabet/`.
No design export file was supplied; fidelity is instead checked against
`docs/ALPHABET-WORKSHEET-STYLES.md` using the numbers baked into the served `.glam` JSON
documents themselves (the authoritative source of what's actually drawn) — cited below as
computed values, not adjectives.

Two real bugs found (one functional, one responsive-layout). Everything else — completion
drivability across every mode/letter sampled, scoring rigor, stray-tap protection (general
case), state transitions, console/network cleanliness, and design-token fidelity — passes with
cited numbers.

---

## 1. Free-write dot-stroke bug (lowercase `i`, `j`) — FAIL

- Tested: In Free write mode, traced lowercase `i`'s stroke 1 (the stem) exactly against the
  authored target, then tapped stroke 2 (the dot) as a single accurate press at its exact
  target midpoint, `(210,178)` canvas-space, no drag.
- Expected: A stroke that scores 100% coverage against its target should be accepted and the
  letter marked complete (per the letter's own design — `dot()` in `glyphs.mjs` deliberately
  authors this stroke's target as a 5.6px segment, i.e. the "correct" way to trace it is a
  near-stationary press).
- Actual: The engine scores it perfectly (`Score 100% / Covered 100% / Off path 0% / Right
  start yes`, confirmed in the right-rail meter and in `traceMatch()`'s own return value), but
  the host's own stray-tap guard in `examples/alphabet/index.html` —
  `let inked = …; if (inked < 14) { toast('Oops…'); … setTimeout(() => load(), 900); }` —
  measures the *cumulative drawn-path length* of the stroke, not its match score. A precise
  single-point tap has `inked ≈ 0`, so it is misclassified as a dropped/stray touch. The
  resulting `load()` call reloads the **entire letter** from scratch, discarding stroke 1's
  already-perfect completion. `state.current` goes `1 → 0`. Reproduced identically for
  lowercase `j` (same `dot()` geometry, same 5.6px target, same discard).
  This is exactly the case flagged in the task brief: "i and j are the ones to be suspicious
  of — their second stroke is a tiny dot." A child who taps the dot the *correct* way (per the
  letter's own numbered-dot instruction) can get stuck restarting `i`/`j` indefinitely in Free
  write mode; only a tap with >14px of incidental jitter escapes the guard. Applies to both
  worksheet themes (the guard lives in the shared host script, not per-theme) and to both
  `i` and `j` — the only two letters using `dot()` in `examples/alphabet/src/glyphs.mjs`
  (confirmed via `grep -n "dot(" glyphs.mjs` → lines 184, 188 only).
- Evidence:
  - `<repo>/docs/superpowers/qc/screens/i-hard-dot-oops-toast.png` — right rail shows `✓ Good stroke / Score 100%` while the bottom toast simultaneously reads "Oops — let's start that one again."
  - `<repo>/docs/superpowers/qc/screens/i-hard-dot-after-reload.png` — 900ms later: back to a pristine "Stroke 1 of 2," the previously-perfect stem is gone.
  - Repro scripts (state dumps inline): stroke1 `current:1, verdict:"✓ Good stroke"` → dot tap `current:1 (unchanged), toast:"Oops — let's start that one again", meter:"Score100%Covered100%Off path0%Right startyes"` → +1s `current:0`. Identical sequence reproduced for `j` (`afterStroke1.current:1` → dot tap `meter:"Score100%…"` + Oops toast → `afterReload.current:0`).
  - Mechanism: `packages/core/src/trace.ts` (`traceMatch`) is correct and blameless — the bug is the app-level heuristic in `examples/alphabet/index.html`'s `onStroke` handler (search `let inked = 0`), which fires *before* consulting `e.match`.

## 2. Horizontal page overflow at tablet + mobile widths — FAIL

- Tested: Resized viewport to 768×1024 and 375×812, then **reloaded** (fresh load, not just a
  runtime resize, to rule out a missed `resize`-event artifact) and measured
  `document.documentElement.scrollWidth` vs `window.innerWidth`.
- Expected: Per the task brief, "Nothing may overflow horizontally," and per the CSS's own
  comment (`index.html` line ~182), the mobile rail is meant to become "a one-row horizontal
  strip" *underneath* the card, scrolling *within itself* (`.rail-grid { overflow-x: auto }`),
  not stretching the page.
- Actual: at 375px, `scrollWidth = 1309` (viewport 375) — the page itself scrolls horizontally.
  At 768px, `scrollWidth = 1317` (viewport 768) — same defect, just less visually obvious
  because more of the overflowing content happens to sit past the visible fold. At 1280px
  (desktop, 3-column grid layout) there is no overflow (`scrollWidth = 1280 = innerWidth`) —
  confirming the defect is confined to the `@media (max-width: 1000px)` single-column
  fallback.
  Root cause, read directly from `examples/alphabet/index.html`'s inline `<style>`: the base
  `.body` rule sets `align-items: start;` (correct for its normal 3-column **grid** layout,
  where it only affects vertical alignment of the row). The `@media (max-width: 1000px)` block
  overrides `.body` to `display: flex; flex-direction: column` but never resets
  `align-items` back to `stretch`. In a flex **column**, `align-items` controls the **cross
  axis, i.e. width** — so every stacked child (`.rail`, `.stage-card`, the strokes `aside`)
  shrinks to its own max-content width instead of stretching to the viewport. For `.rail` that
  max-content width is the *unwrapped* width of all 26 letter buttons in `.rail-grid` (flex,
  `overflow-x: auto`, each button `flex: 0 0 42px` + `gap: 7px` ⇒ 26×42 + 25×7 ≈ 1267px, close
  to the measured 1297px `.rail` width) — so the inner scroll strip never gets a chance to
  activate; its *outer* container has already grown to fit everything, dragging the whole page
  wide with it.
  Visible consequence on-screen (not just a DOM measurement): at 375px, the letter card's
  right edge, the "2 strokes · Free write" caption, and the "Follow the arrows" instruction
  text are all clipped by the viewport edge on a **fresh load**.
- Evidence:
  - `<repo>/docs/superpowers/qc/screens/responsive-375-fresh-reload.png` — instruction text and card right edge cut off at the viewport boundary on a cold load at 375×812.
  - `<repo>/docs/superpowers/qc/screens/responsive-375.png` — same defect via a live resize (kept as a secondary data point; the fresh-reload screenshot above is the one that rules out a resize-event artifact).
  - `<repo>/docs/superpowers/qc/screens/responsive-768.png` — visible dead whitespace to the right of every panel at 768px; the literal overflow (`scrollWidth 1317`) sits past the visible fold, not shown in-frame by definition, so the DOM measurement is the load-bearing evidence for this width, not the screenshot.
  - Computed values: `{docScrollWidth:1309, innerWidth:375}` and `{docScrollWidth:1317, innerWidth:768}` (both `hasHorizontalScrollbar:true`), vs `{docScrollWidth:1280, innerWidth:1280}` at desktop (no overflow) — measured via `document.documentElement.scrollWidth`.
  - The "card comes first on mobile" ordering requirement itself is satisfied (`.stage-card{order:1}` correctly puts the card above the rail — confirmed visually in all three responsive screenshots); it's specifically the *width* of the stacked panels that's broken, not their order.

## 3. Render + first paint, 8 worksheet×case×difficulty combinations — PASS

- Tested: paper/card × upper/lower × easy/hard, spot-checked with `Q`, `W` (uppercase) and
  `g`, `j`, `y`, `t` (lowercase, incl. all three descenders `g j y`), captured at 1280×900.
- Expected: No clipping/overflow on descender letters, whose cards are documented to be taller
  ("Letters with descenders … have taller cards than the rest").
- Actual: All 20 screenshots render cleanly — ghost/track letter, all four writing rules, start
  chip(s), and (in hard mode) static arrows all sit inside the card with comfortable margins.
  Confirmed numerically for the worst case sampled (`card` theme, lowercase `g`): the letter's
  own drawn shape (`track2`) has a 34.6px clearance to the card's rounded border on every
  side; only decorative, momentary celebration-sparkle nodes (opacity 0 at rest) sit outside
  the card, which matches the design doc's own description of confetti "burst[ing] from the
  card's top edge" — not a fidelity violation.
- Evidence: `docs/superpowers/qc/screens/{paper,card}-{upper,lower}-{easy,hard}-{Q,W,G,J,Y,T}.png` (20 files, e.g. `paper-lower-hard-G.png`, `card-lower-easy-G.png`, `paper-upper-easy-W.png`). Numeric card-bbox check: computed from `examples/alphabet/glam/card/lower/g-easy.glam` node geometry (`card` rect `x:18,y:16,w:384,h:556`; `track2` bbox after applying its `x,y` offset stays ≥34.6px inside on every edge).

## 4. Completion drivability (guided mode) — PASS

- Tested: Real `page.mouse` down/move/up drags (not teleports — resampled every ~30px along
  each authored path, since the engine's forward-look window is 52px) through every guided
  stroke for `A, B, D, H, M, W, Z` and, specifically because the task called them out as
  suspect, lowercase `i` and `j` (both strokes, including the ~5.6px dot).
- Expected: Every letter — including the `i`/`j` dot and `h`'s retrace stem — reaches
  `done`/celebration and marks the rail letter complete.
- Actual: All of the above completed on the first real drag: `toast:"Nice! <letter> done"`,
  `steps` all `"step done"`, rail shows the green checkmark, progress counter increments
  (confirmed `0 of 26 → 1 of 26 → …`), and it auto-advances to the next letter after ~1.9s.
  This includes `i`/`j`'s dot stroke, which the player's own source comment
  (`packages/player/src/player.ts` around `gProject`) says was previously "unfinishable" and
  was fixed by clamping the forward-search window to guarantee `t=1` is always sampled — that
  fix is confirmed working end-to-end in guided mode. (Contrast with finding #1: the identical
  dot geometry is *not* safe in Free write mode, because that mode's stray-tap guard is a
  different, unrelated code path that doesn't get the same fix.)
- Evidence: sequential run-code output, e.g. for `i`: `{"results":[{"into":"ink1","samples":6},{"into":"ink2","samples":2}],"after":{"toast":"Nice! i done","steps":["step done","step done"]}}`; for `j`: `{"results":[…],"after":{"toast":"Nice! j done",...}}`; screenshots `docs/superpowers/qc/screens` (rail checkmarks visible in `paper-lower-easy-J.png`, `-Y.png`, `-T.png`, taken immediately after each completion).

## 5. Free-write scoring rigor — PASS

- Tested: (a) a deliberate wide zigzag scribble across the whole card on uppercase `M`'s stem;
  (b) an exact trace of both of `M`'s strokes against their authored targets; (c) a graduated
  test on `C`'s single arc stroke — traced exactly 50% of the target's points, then a fresh
  attempt at exactly 85%.
- Expected: A scribble fails with a visible reason; an accurate trace passes; the response is
  proportional to actual coverage, not a binary rubber stamp, and matches the app's own
  documented `PASS = 0.6` threshold (`examples/alphabet/index.html`).
- Actual: (a) scribble → `Score 0% / Covered 0% / Off path 100% / Right start no`, verdict
  `"↺ Not quite — let's try again"`. (b) exact trace → `Score 100%` both strokes, verdict
  `"✓ Good stroke"` then `"Nice! M done"`, letter marked complete. (c) 50%-of-target trace →
  `Score 54%` (below the 0.6 gate) → `"Not quite"`; 85%-of-target trace → `Score 88%` → `"✓
  Good stroke"`. The score tracks coverage smoothly and the pass/fail boundary lands exactly
  where the source says it should.
- Evidence: `{"verdict":"↺ Not quite — let's try again","meter":"Score0%Covered0%Off
  path100%Right startno"}`; `{"verdict":"✓ Good stroke","meter":"Score100%…"}` ×2,
  `toast:"Nice! M done"`; boundary test `{"half":{"verdict":"↺ Not quite…","meter":"Score54%Covered54%Off
  path0%Right startyes"},"most":{"verdict":"✓ Good stroke","meter":"Score88%…"}}`. Screenshot
  `docs/superpowers/qc/screens/` scribble state captured mid-session (viewport screenshot after scribble, shows fresh reload back to stroke 1 with the retry toast already faded — see run log; static file not separately saved for this one but state dump above is the load-bearing evidence per the score numbers, which is the actual claim).

## 6. Stray tap does not silently consume a pen-stroke (general case) — PASS

- Tested: (a) Guided mode: pointer down + 1px move + up, both far from the puck and directly
  on the puck's resting position. (b) Free write mode: pointer down + 1px move + up on blank
  canvas with no prior progress.
- Expected: No progress change; a dropped/stray touch must not cost a stroke.
- Actual: (a) `state.current` unchanged (`0 → 0`) in both cases — the guided engine requires
  `guidedDragging` to have been set (pointer within `grab` radius) *and* actual forward
  progress via `move` events before `up` can complete a stroke; a 1px wiggle satisfies
  neither meaningfully. (b) Free write: toast `"Oops — let's start that one again"` fires (the
  same `inked < 14` guard as finding #1) and `load()` reloads — but since there was no prior
  progress to lose (`current` was already `0`), this is exactly the intended, harmless case
  the guard is designed for. This nicely brackets finding #1: the guard is correct in the
  general "nothing to lose" case and only misbehaves when it fires on a stroke *after* real
  progress exists, on a target whose correct shape is itself sub-14px.
- Evidence: `{"before":{"current":0,...},"afterFar":{"current":0,...},"afterOnPuck":{"current":0,...,"finished":false}}` (guided); `{"before":{"current":0},"rightAfter":{"toast":"Oops — let's start that one again","current":0},"after":{"current":0}}` (free write).

## 7. State transitions — PASS

- Tested: Try again button, Prev/Next buttons, `ArrowLeft`/`ArrowRight` keys (incl. Z→A
  wraparound), `R` key reset mid-stroke, and the specific race called out in the source
  comments — completing a letter (guided `D`) then immediately (`+80ms`, well inside the
  celebration's 45ms-staggered sparkle burst and 1900ms auto-advance timer) navigating to a
  totally different letter (`Z`) via `go()`.
- Expected: No stale-player errors (the code's own `alive()` guard in `celebrate()` exists
  specifically to prevent a destroyed player from being mutated by outstanding `setTimeout`s);
  all standard controls work.
- Actual: All controls work as expected (`Try again` → `current:0`; `Prev`/`Next` step
  correctly; `ArrowLeft`/`ArrowRight` step and wrap Z→A; `R` resets `current` from `1→0`
  mid-letter). The celebration-interrupt race produced zero console errors/warnings
  (`Total messages: 0`) and a clean subsequent render of `Z` with no leftover sparkle/ghost
  artifacts from the destroyed `D` player.
- Evidence: sequential eval/press output shown in the run log (e.g. `{"letter":"Y"}` after
  `ArrowLeft` from `Z`; `{"letter":"A"}` after two `ArrowRight`s from `Y`; `{"current":0}`
  after `R` from `current:1`); console check immediately after the interrupt test:
  `Total messages: 0 (Errors: 0, Warnings: 0)`; screenshot
  `docs/superpowers/qc/screens/` not separately saved for this one — the state dumps above are
  the load-bearing evidence (no visual artifact was produced to show, which is itself the
  point).

## 8. Progress persistence round-trips through localStorage — PASS

- Tested: Completed `H`/`I`/`J` under `paper/lower/easy`, read
  `localStorage['alpha.done.paper.lower.easy']`, then did a full page **reload** and re-read.
- Expected: Progress is keyed per worksheet×case×difficulty and survives a reload (the write
  is half the test).
- Actual: `["I","J","H"]` before and after reload, identically; rail shows `3 of 26` and at
  least one `.letter.done` element post-reload.
- Evidence: `{"done":["I","J","H"],"progressText":"3 of 26","letterButtonHasDone":true}`.

## 9. Console + network cleanliness — PARTIAL (one cosmetic 404)

- Tested: Console + network monitoring across the entire session — dozens of letter loads,
  every mode combination, all the drag/scoring/state tests above.
- Expected: Zero uncaught errors, zero failed requests.
- Actual: Every `.glam` document fetch returned `200 OK` (confirmed via `requests`, e.g. 19+
  consecutive `[GET] …/glam/… => [200] OK` entries spanning multiple letters/themes/modes).
  The only console error seen in the entire session, at any point, was a single
  `favicon.ico` 404 on first page load — cosmetic, not app-breaking, not part of the game
  surface.
- Evidence: console log excerpt: `[ERROR] Failed to load resource: the server responded with
  a status of 404 (Not Found) @ http://localhost:4399/favicon.ico:0` (this is the entire
  contents of that log — 1 error, 0 warnings). All subsequent `console` checks throughout the
  session returned `Total messages: 0`.

## 10. Design fidelity — palette, four writing rules, pen weight — PASS (numbers cited)

- Tested: Read the hex/width/dash values actually used at render time from the served
  `.glam` documents (the authoritative "what's drawn" source — more precise than pixel
  sampling) for both worksheets, and compared against
  `docs/ALPHABET-WORKSHEET-STYLES.md`'s palette and line-system tables.
- Expected (paper worksheet, per spec table): ceiling `#7FA9D8` 2px solid; midline `#A8C4E2`
  2px dashed `8/6`; baseline `#D24B4B` 3px solid, extending 8px further left/right than the
  other three rules; descender `#7FA9D8` 2px; ghost letter `#C9CDD4` at `0.14×H`; start dot
  diameter `2.0×` stroke width.
- Actual, read from `examples/alphabet/glam/paper/{upper/a-easy,lower/g-easy}.glam`: `ruleTop
  {stroke:"#7FA9D8", strokeWidth:2}`; `ruleMid {stroke:"#A8C4E2", strokeWidth:2, dash:[8,6]}`;
  `ruleBase {stroke:"#D24B4B", strokeWidth:3}`; `ruleDesc {stroke:"#7FA9D8", strokeWidth:2}` —
  **exact hex + width + dash matches**. Baseline span `[26,394]` (368px) vs the other three
  rules' span `[34,386]` (352px) → baseline overhangs by exactly 8px on each side, matching the
  spec's stated tell precisely. Build's own x-height `H=140` (`midline−ceiling = 248−108 =
  140`, `baseline−ceiling = 388−108 = 280 = 2H`); `track1.strokeWidth = 20`, and `20/140 =
  0.143 ≈ 0.14H` — matches. Start dot `g1_curC.r = 21` → diameter 42; spec ratio `2.0×`
  stroke width (20) `= 40`, close (the extra ~2px is the dot's own 3px white ring, additive).
- Expected (card worksheet, per spec table): baseline `#C9D4E2` 6px; midline `#DDE5EF` 3px
  dashed `10/14`; ceiling/descender `#E8EDF3` 2px dashed `4/10`; ascender:x-height:descender
  proportions `0.9 : 1 : 0.7`; track (channel) stroke `0.34×H`; ink stroke `0.30×H`; card
  radius 40px @ ~720px card width, `3px #E5E5E5` border, `6px #DFE3E8` flat bottom shadow.
- Actual, read from `examples/alphabet/glam/card/upper/q-easy.glam`: `ruleTop
  {stroke:"#E8EDF3", strokeWidth:2, dash:[4,10]}`; `ruleMid {stroke:"#DDE5EF", strokeWidth:3,
  dash:[10,14]}`; `ruleBase {stroke:"#C9D4E2", strokeWidth:6}` — exact matches. Build's `H=150`
  (`midline−ceiling=259−124=135=0.9×150`; `baseline−midline=409−259=150=1.0×150`) → **exact**
  `0.9:1` ratio match. `track1.strokeWidth=51`, `51/150=0.34` — **exact**. `ink1.strokeWidth=45`,
  `45/150=0.30` — **exact**. `trackEdge1.strokeWidth=59 = track(51) + 2×4px outline` — matches
  the spec's "4px outline" describing the extra ring around the channel. Card node:
  `{x:18,y:16,w:384,h:451,cornerRadius:32, stroke:"#E5E5E5", strokeWidth:3}` and
  `cardEdge {fill:"#DFE3E8"}` offset `+7px` down — matches "3px `#E5E5E5` border" and "flat
  bottom-only offset shadow" (radius ratio `32/420 ≈ 0.076`, in the same neighbourhood as the
  spec's `40/720 ≈ 0.056` reference — both worksheets are built at their own internal scale,
  not literally 420px/720px, so ratios rather than absolute px are the correct comparison, and
  those ratios track consistently across every measurement above).
- Evidence: raw `.glam` JSON node dumps (quoted inline above) from
  `curl http://localhost:4399/examples/alphabet/glam/{paper,card}/…`.

## 11. Design fidelity nuance — paper worksheet's "dotted centre path" — PARTIAL (undocumented departure, not a functional bug)

- Tested: Compared the paper worksheet's dashed centreline node (`g1_dash` etc.) against the
  spec's description of the "Trace target: dotted skeleton" rendering.
- Expected: Per `docs/ALPHABET-WORKSHEET-STYLES.md`, "Trace target: dotted skeleton, **same
  0.14H weight** [as the solid ghost], stroke `#AAB0B8`, dash `10 on / 14 off`."
- Actual: The implementation draws *both* a solid ghost (`track1`, `#C9CDD4`, `strokeWidth:20
  = 0.14H` — correct) *and*, on top of it, a much thinner dashed centreline
  (`g1_dash {stroke:"#AAB0B8", strokeWidth:6, dash:[9,13]}`) rather than making the dotted
  rendering itself the full-weight trace target. The colour is right; the weight (6px vs an
  implied ~20px) and dash cadence (`9/13` vs the spec's stated `10/14`) are not. Visually this
  reads as "solid grey letter with a thin stitch-line down the spine," which is a reasonable
  and arguably clearer design (it shows both the letter's outline *and* the exact path to
  follow at once), but it is a departure from the literal spec text that isn't called out in
  the doc's own "What we implemented / Departures worth naming" section — the four departures
  listed there (no picture cue, no travelling chevron, static-arrows-HARD-only, card trims its
  own bottom) don't mention this one.
- Evidence: `examples/alphabet/glam/paper/lower/g-easy.glam` node dump:
  `track1 {stroke:"#C9CDD4", strokeWidth:20}` vs `g1_dash {stroke:"#AAB0B8", strokeWidth:6,
  dash:[9,13]}`. Not screenshotted separately — visible in every paper-theme screenshot listed
  under finding #3 (e.g. `paper-lower-easy-G.png`) as the thin dashed line running down the
  centre of the thick grey letter.

---

## Ranked summary

1. **[Functional, FAIL]** Free write mode cannot reliably finish lowercase `i`/`j` — the
   host's stray-tap heuristic (`inked < 14px`) misfires on the letters' own tiny dot stroke
   even when it's traced with a perfect 100% score, discarding the whole letter's progress and
   restarting it. Confined to exactly these two letters (only `dot()` users), both worksheet
   themes, Free write mode only.
2. **[Layout, FAIL]** The page overflows horizontally at both required responsive widths (768
   and 375) due to a `.body { align-items: start }` rule (correct for the desktop grid) that
   leaks into the `≤1000px` flex-column fallback, preventing the stacked panels from
   stretching to the viewport and letting the un-scrolled 26-button letter rail drag the whole
   page wide. Confirmed on a fresh load, not a resize artifact.
3. **[Fidelity nuance, minor]** Paper worksheet's "dotted centre path" is a thin 6px stitch
   line over a full-weight solid ghost, not the spec's literal "dotted skeleton at the same
   0.14H weight" — a reasonable, undocumented departure, not a functional problem.
4. **[Cosmetic, minor]** One `favicon.ico` 404 on first load; no other console/network issues
   found across the entire session.
5. Everything else tested — 8-combination render/clipping, guided-mode completion for every
   sampled letter including the `i`/`j` dot and `h`'s retrace stem, free-write scoring rigor
   (scribble-fails / careful-trace-passes / 54%-vs-88% graduated boundary), stray-tap
   protection in the general case, all state transitions including the celebration-interrupt
   race, progress persistence, and palette/line-system/pen-weight fidelity for both
   worksheets — **passes**, with cited numbers throughout.
