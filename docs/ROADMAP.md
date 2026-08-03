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

## ⚠️ THE CUTOVER — the global install still points at v1
The globally-installed authoring path has NOT moved to v2, deliberately. Both pieces point at
`~/Project/glamour` (v1):

- `~/.local/bin/glam` — a wrapper that hard-pins Node 20 and runs **v1's** built CLI.
- `~/.claude/skills/cast-glamour/` — a **COPY**, not a symlink. Editing this repo's
  `skills/cast-glamour/` does not change what an agent reads.

So today an AI authoring session validates and renders against **v1's engine**, whatever this repo
says. Flipping those two is the cutover, and it is a real switch: it also means v1 authoring stops
working, because the wrapper can only point at one repo.

To cut over:
```bash
cd ~/Project/glamour-v2 && pnpm build
cat > ~/.local/bin/glam <<'EOF'
#!/usr/bin/env bash
# Glamour CLI wrapper — v2 (WebGL renderer). No Node pin: v2 has no native `canvas`.
# `render` needs Chromium: npx playwright install chromium
exec node "$HOME/Project/glamour-v2/packages/cli/dist/cli.js" "$@"
EOF
chmod +x ~/.local/bin/glam
rm -rf ~/.claude/skills/cast-glamour
cp -R ~/Project/glamour-v2/skills/cast-glamour ~/.claude/skills/cast-glamour
```
Then confirm: `glam render <any.glam> -o /tmp/x.png` produces a PNG, and the skill's §4 blockquote
mentions Chromium rather than Node 20.

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
  reference-orb look the format now exposes (all of it verified against the v2 WebGL renderer via
  `conformance/paint.glam`).
- **Hard tail (still open):** halftone/texture body — needs raster-image fill (depends on v2 raster
  work) or a shader. The last ~20% of polish.

### Smaller logged gaps — status
- **DONE (v1.1):** `arc` primitive, rounded `rect` corners, spring/elastic easing, bold/`fontStyle`.
- **Still open:** raster/sprites + SVG import, image→animation, in-app AI chat.
- **DONE (v2):** the WebGL renderer — Konva replaced entirely. See `docs/V2-RENDERER.md`.
- Residual hygiene: MCP↔core schema dedupe. (`KonvaLike`/`any` on the scene is GONE — v2's
  `NodeHandle` is a concrete exported type.)

---

## Environment invariants (every session)
- **No Node version pin** — v2 dropped the native `canvas` package with Konva. Headless render and
  the browser test project need Chromium: `npx playwright install chromium`.
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
