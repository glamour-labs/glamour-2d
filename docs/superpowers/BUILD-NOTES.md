# Glamour v1 — Build Log & Findings Ledger

Ground-truth progress for the autonomous v1 build (survives compaction). Plan:
`docs/superpowers/plans/2026-07-22-glamour-v1.md`.

## Environment invariant
- **Run everything on Node 20.19.4**, not the machine default (Node 24). The native `canvas`
  binary is built for the Node 20 ABI. Prefix commands with:
  `export PATH="$HOME/.nvm/versions/node/v20.19.4/bin:$PATH"`. `.nvmrc` pins 20.19.4.

## Progress
- [x] Wave 0 — monorepo scaffold (npm workspaces) — committed.
- [x] Group A — `@glam/core` — 49 tests, tsc clean, renderToPNG real PNG. **Verified independently.**
- [x] Group B — `@glam/player` — 11 tests, tsc clean, UMD canvas-free. **Verified (60/60 core+player).**
- [x] Group E — `@glam/mcp` — 7 tests, SDK 1.29.0 in-memory transport, 11 tools, render_preview PNG.
- [x] Group C — `glam` CLI — 6 tests, 4 commands proven live.
- [x] Group D — `cast-glamour` skill + sub-agent — 7 tests, 3 examples validate+render.
- [x] Group F — Studio — 4 tests, vite build clean, dark UI, honest offline AI panel.
- [x] Player export split (finding #1 fixed) — `@glam/player` (browser) + `@glam/player/node`; shims deleted; 84/84 green.
- [x] Root README.
- [x] Final verification: round table (code-review/techdebt/devil) + runtime-QC + browser-QC all reported.
  QC PASS both surfaces. Evidence → `docs/superpowers/qc/`.
- [x] Fix pass: all 14 findings fixed (FIX-LIST.md), incl. critical export-XSS + validate-expr gap.
  **Independently re-verified:** export breakout escaped; all malformed exprs rejected by validate.
- [ ] Final certification (final-review) + deliver report. Ship = local commits (no remote yet).

**Full-repo: 125 tests green across 23 files (Node 20). Up from 84 pre-fix.**

## Findings ledger (fix before v1 ships)
1. **[player] Node-import of `@glam/player` throws `ReferenceError: HTMLElement is not defined`.**
   The barrel eagerly declares `class GlamCanvasElement extends HTMLElement` at module eval time,
   which crashes any Node importer. The CLI worked around it with a dom-shim + dynamic import
   (`packages/cli/src/dom-shim.ts`). **Proper fix:** lazy-declare the custom element inside
   `defineGlamCanvas()` (don't declare the class at import time) OR split browser-only exports from
   the Node-safe `exportInlineHTML`. Then the CLI shim can be removed. Owner: player package.
   **RESOLVED (commit a5712ce):** split into `@glam/player` (browser default) + `@glam/player/node`
   (`exportInlineHTML`); CLI dom-shim and Studio node-shims both deleted; 84/84 still green.

## v0.1 — living canvas (Rung 1) — IN PROGRESS
Plan: `docs/superpowers/plans/2026-07-22-glamour-v0.1-living-canvas.md`. Additive over v0.
- [x] Core (Group A): v0.1 schema (loops/wander/groups/emit/@events), validate, pure motion math
  (`motion.ts`: `loopValueAt` + `Wander`), groups in buildScene + resting-frame seeding, `@EVENT`
  classified in `onkey.ts`. **164 tests.** Verified 164/164.
- [x] Player (Group B): rAF run-loop (`loop.ts`), host API `send`/`on`/`play`/`pause`, `@event` mapping,
  emit-on-click. **174 tests.** UMD canvas-free.
- [x] Fix: `loops` can target a group id (x/y) — parity with wander (validate was stricter than the
  runtime needed). +2 tests. **176 tests green, all packages build (incl. studio).**
- [x] Proof sketches authored (v0.1): `sketches/crab-game/crab.glam` (loops+emit), `sketches/orb/orb.glam`
  (wander+groups+@events). Validated + rendered.
- [~] Verifying: browser-qc (crab moves+emits; orb wanders+state-swaps) + round table (code-review/
  techdebt/devil) dispatched in parallel.
- [ ] Apply findings; update README/DECISIONS (v0.1 + host API); rebuild global glam + teach the skill
  v0.1; publish live proof artifacts; final report.

### v0.1 findings ledger
- **loops-target-group** — validate rejected a group loop target (wander accepted it). FIXED (commit 66):
  validate accepts group id for loops (x/y only); runtime already supported it.
- **group z-order trap** (author-facing, documented not fixed): ungrouped nodes always paint above all
  groups regardless of `nodes` order (buildScene adds groups first). Wrap a covering node in its own
  earlier group. Note for skill docs.

## Post-ship findings (from real use)
2. **`canvas.bg` was a dead field** — declared in the schema, accepted by `validate`, but never
   painted (not headless, not in the browser player; dark bgs in QC screenshots came from container
   CSS, which masked it). Caught by *looking at* a real render (progress-ring sketch) — the self-verify
   loop working. **FIXED (2026-07-22):** `buildScene` now paints `canvas.bg` as a non-listening
   background rect at the bottom of the layer (honored in both render paths; `listening:false` keeps
   empty-space hit-testing clean, guarded by the existing getIntersection miss test). +1 regression
   test (reads the rendered corner pixel). Full suite 126 green.

## Pre-baked decisions (surfaced, not silently taken)
- Sequential group-by-group builds (not parallel file-writing) — shared monorepo tree makes
  concurrent npm install + git index writes unsafe. Final review knights run parallel (read-only).
- Timeline = tween-on-transition for v1 (no keyframe track).
- Player default export = inlined-HTML; UMD build excludes `exportInlineHTML` (Node-only helper).
- Core deps trimmed to konva+zod+canvas (xstate lives in player's adapter); expr = hand-written parser.
