# Alphabet tracing — the whole alphabet as a game

**Status:** built · under certification · branch `claude/alphabet-tracing-game-293174`
**Date:** 2026-08-05

## The ask

Research real alphabet tracing worksheets, pick the most suitable, and build the full
26-letter tracing game — both cases, both difficulties. Use the existing `h` and `y`
sketches as the knowledge of *how* the interaction works, but restyle everything
(including `h` and `y`) to the researched UI. Multiple approaches welcome. Show both
chosen worksheets and a playground covering all of them.

## Shape

One glyph dataset, many documents.

```
src/glyphs.mjs   52 hand-authored skeletons in band units (y: 0 ceiling, 1 midline,
                 2 baseline, 3 descender). The source of truth for shape AND stroke order.
src/themes.mjs   the two aesthetics as data. Same geometry, different pen:
                 0.14 × x-height (paper) vs 0.34 × (card).
src/build.mjs    glyph × theme × mode -> one .glam
build.mjs        208 documents, each validated on write
```

EASY emits a `guided` block (the player owns the drag); HARD emits `ink` + a per-stroke
`match` target (the host owns the verdict). That is a capability difference, not a
tuned difficulty number.

## Research

Two read-only agents ran in parallel before any code:

- **Stroke order** → `docs/ALPHABET-STROKE-ORDER.md`. Cross-checked Zaner-Bloser (chart
  text *and* the numbered-arrow diagrams), Handwriting Without Tears, D'Nealian,
  Fountas & Pinnell, and seven UK schemes. Caught five glyphs the first pass had wrong:
  `B` and `G` were over-split, `J` was missing its top bar, `b` and `p` needed their
  retrace. Also surfaced that ZB's own PDF has a typo (lowercase `f`'s text block
  duplicates capital `F`'s) and that numbered arrows ≠ pen lifts.
- **Worksheet visual design** → `docs/ALPHABET-WORKSHEET-STYLES.md`. Two aesthetics with
  sources, palettes and measurements.

## The design loop

`tools/specimen.mjs` renders all 52 glyphs colour-coded per pen-stroke with a dot at each
stroke's start; `tools/sheet.mjs` renders all 26 finished cards for one combination. Both
were rendered and *looked at* repeatedly — that loop, not the code, is where the
letterforms came from. Roughly a dozen shape corrections came out of it (round capitals
too narrow, `B`'s bottom bowl, `M`'s vertex, `S` vertically short, `k`'s arm not meeting
its stem, `f`'s counter closing at the fat pen weight, the `i`/`j` dot clearance).

## Verification

| Check | Result |
|---|---|
| `node build.mjs --check` | 208/208 valid and in sync |
| `vitest --project node` | 179 pass (20 files) |
| `vitest --project browser` | 102 pass (14 files) |
| All 208 documents fetched over HTTP | 200, parse, correct block, correct schema |
| Contact sheets rendered and inspected | 8 of 8 (2 themes × 2 cases × 2 modes) |
| Guided drag driven in a real browser | full path, wobbled path, wrong-way, half-go |
| Free-write scoring | careful trace passes; scribble scores 10% and is rejected |

## Certification

**First pass: NO-SHIP.** Three blocking defects, all real:

1. **`i` and `j` were unwinnable in guided mode** — and the root cause was in the
   runtime, not the letters. `gProject` samples a forward window of `52 / pathLength`;
   when a path is shorter than 52px that ratio exceeds 1 and the sample grid steps over
   the end without ever evaluating `t = 1`. Progress saturated at 0.71, below both
   completion gates. Fixed in `packages/player/src/player.ts` by clamping.
2. **The test that claimed to guard it was written so it could not fail** — it asserted
   a minimum path length and then exempted `i` and `j`, the only two violations, by name.
   Replaced with a sweep that drives all 104 guided documents through the real player.
3. **Lowercase `u` was the wrong shape** — its right side never returned to the midline.

Plus ten non-blocking findings, all addressed.

**Second pass: NO-SHIP again**, on a defect the *fixes* introduced. The stray-tap guard
rejected any stroke inking under 14px — which is exactly how the dot on an `i` is drawn
(its target is 5.6px), so `i` and `j` became uncompletable in free-write mode. Removed:
the scorer already separates a stray tap from a tap on the dot, and a failed stroke
restarts the letter, so the heuristic was solving a problem the verdict path handles.

That pass also proved, by mutation, that the B1 regression test was hollow — its 6.0px
path is one of the lengths where the old bug does not reproduce. Repointed at the real
5.6px dot and re-verified by mutation (revert the clamp → red).

**Third pass: GO** (one LOW finding — a `startsWith` containment check in the dev
server that also admitted sibling directories; fixed with `relative`).

**Adversarial pass on `index.html`** — run *after* that GO, because the host page had
never been reviewed and two of the quest's worst defects had lived there. It found five
more, all demonstrated live, all fixed:

1. `load()` was async and re-entrant. Two overlapping loads resolved in either order and
   left the canvas on one letter while state, prompt and rail said another — trace the C,
   and D gets the tick. Reproduced 3 times in 60 alternating navigations on plain
   localhost. Fixed with a generation token.
2. A second finger anywhere on the card destroyed the stroke in progress — the pointer
   stream merged every active touch. In free write a perfect stroke went 100% → 0%; in
   guided it failed *silently*, leaving the puck stranded with no message at all. Fixed in
   the runtime: one pointer owns a drag.
3. A single straight swipe passed 14 of the 68 curved strokes, because tolerance was
   1.15×pen (59px, 14% of the canvas). Now 1 of 82.
4. Removing the stray-tap heuristic had left nothing at all in its place, so one
   accidental tap discarded every stroke already drawn. Fixed in the runtime, where the
   stroke is actually spent: an unmoved press that is not near the stroke's start is not
   an attempt at it.
5. `fitStage`'s `Math.max(230, …)` sat *outside* the min, overriding the height budget it
   had just measured. In landscape the letter's baseline and all three buttons were below
   the fold, on an element with `touch-action: none`. Now measured clean at eight
   viewports, with a side-by-side layout for short ones.

**Fourth pass: NO-SHIP.** The pointer fix from the adversarial round stranded
`activePointerId`: a mouse gets no implicit pointer capture, so pressing inside the canvas
and releasing outside delivered no `pointerup` at all and the canvas went **permanently
dead** — worse than the two-finger bug it fixed, and in `packages/core`, so every host.
Fixed with `setPointerCapture` plus a `lostpointercapture` backstop.

The same pass proved that guard had **zero coverage** — deleting it left 290/290 green,
because the three new tests drove the player's `__pointer` hook, which bypasses
`StageShim` entirely. Round 2's lesson, unlearned. Now covered by four tests at the right
layer, driving real DOM PointerEvents, mutation-checked.

**Adversarial pass on the shared runtime** (`scene.ts` + `player.ts`) — the certifier's
recommendation after the dead-canvas defect walked in there. Three more:

1. The accident guard was `!startOk` in disguise. "Unmoved and further than tolerance from
   the start" is character-for-character the definition of `!startOk`, so it fired only for
   presses *away* from the start and let through a motionless tap *on* it — touch down,
   hesitate, lift — which then destroyed the letter. It was also defeated by one pixel of
   jitter. Re-derived instead of patched: a barely-moved press is a legitimate attempt only
   when the target is itself barely longer than the press. Ask the scorer.
2. A palm landing FIRST owned the canvas — the previous fix had only handled palm-second.
3. `setPointerCapture` had no test coverage; deleting it left the suite green.

Then a self-check caught that fix #2's rule broke the **mirror** case, so ownership now
follows whichever pointer draws rather than either down-order.

**Lessons worth keeping:**

- A guard whose exceptions *are* the bug is worse than no guard, because it reads as
  coverage. The exemption should have been the moment to ask why those two were special.
- The degenerate end of a distribution deserves a test of its own. Every letter was
  driven except the two shortest paths in the corpus.
- Cross-checking `u` against `U` in the same file found the shape bug instantly. Internal
  consistency is a cheap oracle.
- A regression test must be shown to fail against the unfixed code. Two of them here did
  not, for two different reasons, and both looked fine.
- Fixing a cosmetic finding introduced the worst defect of the quest. Low-severity work
  deserves the same "what does this reject?" question as the high-severity kind.
- Cost is a correctness concern for a guard: the sweep started at ~8 minutes and would
  have been deleted within a year. Stripping the scene down to what the projector reads
  took it to ~46s with the property unchanged.
- A screenshot is not a responsive check. The 375px page scrolled sideways to 1309px and
  looked perfect, because the overflow was off-screen. Only `scrollWidth` sees it.
- Certification said GO; the adversarial pass then found five must-fixes in the one file
  nothing tested. "Small blast radius" measured the diff, not the coverage. Where a
  surface has no tests, the lens IS the coverage.
- Both remaining scoring trade-offs were settled by measuring the corpus (172 strokes)
  rather than arguing: tolerance at 0.75×pen, and the single `card/lower/b` residual left
  in place because failing a child who *did* trace the letter is the worse error.
- **A test at the wrong layer is not coverage.** Twice, tests written for a fix exercised a
  different layer than the fix. The check that catches it is cheap and was skipped both
  times: delete the fix, run the tests, watch them go red. If they don't, they aren't
  testing it.
- Sweep with the WORST case, not a representative one. The viewport sweep used `A`;
  descender letters are a whole band taller and are what actually sets the constraint.
  Re-measuring with `j` moved the answer.
- Six review rounds, six that found something. Three of those defects were introduced by
  the previous round's fix. The find rate did not decline the way it should if the code
  were converging — worth knowing before trusting any single green pass.
- When a guard keeps needing its edges patched, the shape is wrong. Both the accident guard
  and the pointer-ownership rule were fixed twice at the boundary before being re-derived
  from what actually distinguishes the cases — and the re-derivation was shorter than the
  patches.
- Mutation-check each half of a rule separately. Removing one half of the ownership rule
  left every test green, which is how a load-bearing branch turned out to be uncovered.

## Deliberately not done

- No picture/word cue ("A is for Apple") — needs 26 pieces of art to be worth having.
- No UK letterform variants. UK `y` and `f` need different *geometry*, not a different
  stroke order, so it is a feature rather than a flag. The glyph data is a plain table;
  a second table is the shape that change would take.
- No cursive.
