# Glamour — Roadmap & Next-Session Handoff

Read this first in a new session (with `DECISIONS.md` + `BUILD-NOTES.md`). It's the forward-looking
map; DECISIONS is the *why* of settled choices; BUILD-NOTES is the build/findings ledger.

## Where we are (2026-07-23)
- **v1 shipped** — format + player + CLI + MCP + Studio + `cast-glamour` skill.
- **v0.1 "living canvas" shipped** — `loops`, `wander`, `groups`, host API (`send`/`on`/`play`/`pause`).
- **v1.1 "paint + shape" shipped** — the fidelity axis + the logged format gaps: `ellipse`/`arc` node
  types, linear+radial `fillGradient`, glow/shadow, rect `cornerRadius`, text `fontStyle`,
  `backInOut`/`elasticOut` easing. Radius-family props clamp to ≥0 (overshoot safety).
- **Rung 2 "input + ink" shipped** — `stroke` node, doc-level `ink` block, player `onPointer`/`onStroke`
  host API, pure `traceMatch`. Unlocks alphabet-trace.
- **`@glam/react` shipped** — `<Glamour>` component + imperative handle; the idiomatic React embed.
- **Mission acceptance test PASSED** — a v0.1 crab was authored by *describing* it to the AI skill
  (`examples/ai-authored/crab.glam`) and embedded in a real React app (`examples/react-crab`) with all
  scoring/timer logic in React. Both halves the roadmap flagged as never-run are now done.
- **242 tests green, all packages + the example build, tree clean.**
- **AI authoring installed globally** — the `cast-glamour` skill, `glamour-smith` agent, and the
  `glam` wrapper (`~/.local/bin/glam`). See `DECISIONS.md` §3. NOTE: the global `glam`/skill point at
  the MAIN checkout — re-sync them (rebuild + re-copy) so they learn v1.1 + Rung 2 (see below).
- **Proofs** in `sketches/`: progress-ring, toggle-switch, draw-letter-a (tap-through), flappy,
  crab-game, orb / Dolli, and **trace-letter** (Rung 2 — real interactive tracing).

## ⚠️ First thing next session — re-sync the global AI-authoring install
The work above lives in this worktree. The globally-installed `glam` wrapper + `cast-glamour` skill
point at the MAIN `~/Project/glamour` checkout, which does NOT yet have v1.1 / Rung 2. Until this
branch merges to main AND the repo is rebuilt, an AI authoring session that shells out to the global
`glam` will VALIDATE against the old engine and reject `ellipse`/`arc`/`stroke`/`ink`/gradient docs.
To use the new features from authoring: merge → `cd ~/Project/glamour && pnpm build` → re-copy the
skill per `DECISIONS.md` §3. (Toolchain: the global `pnpm` is Node-24-built; under Node 20 use
`npx -y pnpm@9.15.0`.)

## The mission (why this exists)
Glamour is the maintainer's **own tool to author complex interactions himself** — no designer, no
heavy Rive studio — for the real react-web-monorepo Exercise-Kid cases (crab word-game, alphabet-trace,
flappy). Target is **Rive-class *interaction*, NOT character rigging**. Iron rule: **logic stays in the
host (React); Glamour is the interactive animated canvas** the host drives (`send`/`setInput`) and
listens to (`on`).

## Two axes to "replace Rive" — both moving now
1. **Behavior** — how it *acts*. Rungs 1 (+ acceptance test) and 2 done; Rung 3 (game kit) next.
2. **Fidelity / paint** — how it *looks*. Cheap tier done in v1.1 (gradient + glow + ellipse/arc →
   ~80% of the reference-orb look). Hard tail (raster/halftone texture) still open.

---

## What's LEFT

### Behavior rungs
- **Rung 1 (v0.1) — DONE**, incl. the mission-level acceptance test (was open/deferred, now PASSED):
  (a) an agent authored a v0.1 crab from a **plain description** via the skill
  (`examples/ai-authored/crab.glam`), and (b) it's embedded in a **real React app**
  (`examples/react-crab`) with scoring/timer logic in React. The engine serves the mission — proven,
  not assumed.
- **Rung 2 — input + ink — DONE.** `stroke` node + doc-level `ink` block + player `onPointer`/`onStroke`
  + pure `traceMatch`. Proof: `sketches/trace-letter` (drag to trace, host scores). *Still open within
  this rung:* a true **path primitive with partial stroke-along-path reveal** (the Duolingo-style
  animated guide) and richer direction/order scoring — the current `traceMatch` is coverage+stray+
  endpoints, not full DTW/sequence matching.
- **Rung 3 — game kit** (unlocks **flappy**): keyboard input, collision helpers, spawning. Biggest;
  the natural next behavior step. (Even here, game *logic* stays in the host — Glamour exposes
  positions/events; the host scores.)
- **Rotational group idle** (surfaced by the crab A3 proof): group `loops` are x/y-only, so a group
  can't tilt/rotate as one (no claw-wave). Small, worth adding with Rung 3.

### Fidelity axis — the paint layer — CHEAP TIER DONE (v1.1)
- **DONE:** linear/radial `fillGradient`, glow/shadow, `ellipse` node, `arc` node → the ~80% of the
  reference-orb look that Konva already supported and the format now exposes.
- **Hard tail (still open):** halftone/texture body — needs raster-image fill (depends on v2 raster
  work) or a shader. The last ~20% of polish.

### Smaller logged gaps — status
- **DONE (v1.1):** `arc` primitive, rounded `rect` corners, spring/elastic easing, bold/`fontStyle`.
- **Still open:** raster/sprites + SVG import, image→animation, in-app AI chat, WebGL perf path.
- Residual hygiene: MCP↔core schema dedupe; tighten `SceneHandle`/`KonvaLike` `any` (export from core).

---

## Environment invariants (every session)
- **Node 20.19.4** (native `canvas` ABI) — `.nvmrc` pins it; prefix commands with the Node-20 bin.
- **pnpm** (`pnpm install/build/test`); npm still works as a fallback. See `DECISIONS.md` §1.
- **Local repo, no git remote** — not on npm; consume via the UMD or `pnpm pack` (`USING-GLAMOUR.md`).
- **Author v0.1 by describing it** → the `cast-glamour` skill / `glamour-smith` agent (installed globally).

## How to resume / process that worked
1. Read this + `DECISIONS.md` + `BUILD-NOTES.md`; plans in `docs/superpowers/plans/`; proofs in `sketches/`.
2. Pick a rung (Rung 2 is the natural next behavior step; the paint layer is the fidelity step) →
   write a plan → **plan-review** → build core+player (TDD) → **round table (code-review + techdebt +
   devil) + browser-QC**.
3. **Trust the round table + a *live* measurement over green tests.** This session's headline lesson:
   the v0.1 wander-jitter Critical shipped through a green suite because the unit tests used a seeded
   RNG the live player never uses — only the adversarial trace + a browser measurement caught it.
   Verify the artifact in the real runtime, not the proxy.
