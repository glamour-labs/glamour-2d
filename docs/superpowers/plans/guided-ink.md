# Guided ink — native `guided` block (decision + spec)

**Decided (user delegated): a native, general `guided` capability in the format.**
Not host code, not letter-specific. The player interprets a `guided` block and
owns the drag mechanics; the host only listens and does presentation.

## Why native (not a host controller)
- Behavior lives in the AI-authored document → works on **any** glamour and any
  host (playground, React, harness) with zero host wiring. This is the "works on
  any animated + UI" requirement.
- The player trims a **single** ink stroke along an authored `path` (no pre-baked
  segment nodes, no per-letter ids). Fully general.
- The arrow follows the authored path's **tangent**, so directional guidance
  ("down the stem, up at the turn, over the curve") comes from the path, not a
  hardcoded hint.

## Format (general)
```ts
interface GlamGuidedStroke {
  path: number[];   // flat [x,y,…] the drag follows (arc-projected); ≥2 points
  into: string;     // a `stroke` node the player trims to progress (the ink)
  handle?: string;  // node moved to the ink tip (the draggable puck)
  arrow?: string;   // node rotated to the path tangent
}
interface GlamGuided {
  strokes: GlamGuidedStroke[];  // ≥1; drawn in order
  grab?: number;                // px grab radius (default 44)
  emit?: string;                // host event fired per stroke complete
}
// GlamDoc gains: guided?: GlamGuided
```

## Player behavior (the proven algorithm, generalized)
- Grab: pointer-down within `grab` px of the current handle/tip starts a drag.
- Progress: nearest point on `path` within a **short forward arc window**
  (monotonic — can't jump onto an overlapping return pass).
- Ink: set `into.points` to `path` trimmed to progress (interpolated tip).
- Handle: moved to the tip; `arrow` rotated to the path tangent at the tip.
- Release: **stays** where it stopped (no reset); completes only at the end
  (progress ≥ ~0.98), then advances to the next stroke.
- Events: `player.onGuided(cb)` → `{ index, progress, done }` on movement and on
  each stroke completion; `emit` also fires to `player.on` listeners on complete.
- Presentation (reveal next stroke's guide, sparkle, reset) stays HOST-side, via
  those events — same motion-vs-logic split as `ink`/`emit`.

## Test plan
- Harness gains guided coverage; assert: full drag completes; **half go** stays
  mid-path; wrong-way finger doesn't jump; multi-stroke advances index/done.
- A fresh **non-letter** example (`examples/…/guided-check.glam`) proves generality.

## Deferred (own gated step)
Migrating the 4 draw-letter EASY glams + playground from the host guided-drag to
this native block — deliberately not in this pass; the letters are approved and
delicate, so that swap gets its own verify + device check.
