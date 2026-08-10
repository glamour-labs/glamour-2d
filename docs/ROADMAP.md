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
- **`@glamour-labs/react` shipped** — `<Glamour>` component + imperative handle; the idiomatic React embed.
- **Mission acceptance test PASSED** — a v0.1 crab was authored by *describing* it to the AI skill
  (`examples/ai-authored/crab.glam`) and embedded in a real React app (`examples/react-crab`) with all
  scoring/timer logic in React. Both halves the roadmap flagged as never-run are now done.
- **242 tests green, all packages + the example build, tree clean.**
- **AI authoring installed globally** — the `cast-glamour` skill, `glamour-smith` agent, and the
  `glam` wrapper (`~/.local/bin/glam`). See `DECISIONS.md` §3. NOTE: the global `glam`/skill point at
  the MAIN checkout — re-sync them (rebuild + re-copy) so they learn v1.1 + Rung 2 (see below).
- **Proofs** in `sketches/`: progress-ring, toggle-switch, draw-letter-a (tap-through), flappy,
  crab-game, orb / Dolli, and **trace-letter** (Rung 2 — real interactive tracing).

## ✅ CUTOVER DONE — this repo IS the live engine (2026-08-03)

**Directory layout after the rename (same day):**

| Path | Role |
|---|---|
| `~/Project/glamour` | **LIVE** — this repo, the WebGL2 engine |
| `~/Project/glamour-v1-oracle` | retired Konva engine, kept ONLY as the pixel oracle |

The names are deliberate: the live project holds the plain name, and the oracle's name states its
only remaining job. Pointing a gate at `~/Project/glamour` instead of the oracle would compare this
repo against itself — everything would MATCH and prove nothing.

The global authoring path now runs v2. All three artifacts were repointed:

| Artifact | Now |
|---|---|
| `~/.local/bin/glam` | `node ~/Project/glamour/packages/cli/dist/cli.js` — **no Node pin** |
| `~/.claude/skills/cast-glamour/` | **symlink** → `~/Project/glamour/skills/cast-glamour` (edits are live; nothing to re-copy) |
| `~/.claude/agents/glamour-smith.md` | Node-20 block replaced by the Chromium prerequisite |

Verified from a neutral directory on **Node 24** (v1 cannot run there at all — it needs the Node-20
`canvas` ABI): `glam new` / `validate` / `render` all pass, render takes ~1.4s via headless Chromium
rather than being instant, and an `arc` + glow document — v2-only paint — validates and renders.

Backup of the pre-cutover artifacts: `~/.glamour-cutover-backup-<timestamp>/`.

**`~/Project/glamour-v1-oracle` is RETIRED but must NOT be deleted, and must stay BUILT.** It is the pixel
oracle for both parity gates. Its README carries the banner. A stale `dist/` there has already
produced one wrong parity result — if the gates ever look suspiciously good or bad, rebuild v1 first.

The skill is a **symlink**, so editing `skills/cast-glamour/` here is immediately live — no re-copy
step, and it cannot silently drift the way the old copy did. Trade-off: moving or deleting this repo
breaks the skill. If it ever needs to be a copy again, `cp -R` over the symlink.

## The oracle must stay fresh — now enforced

Both parity gates refuse to run against a stale oracle (`exit 2`) rather than reporting confident
nonsense. `scripts/oracle-freshness.mjs` checks two things: v1's `dist/` newer than its `src/`, and
the reference PNGs newer than that `dist/`. Verified in both directions — the guard fires on a stale
build and stands down on a fresh one.

Rebuilding v1 therefore invalidates the references, which is what the second check catches. One
command puts it right:

```bash
node scripts/gen-oracle.mjs /tmp/glam-oracle     # renders every .glam with v1's CLI (via Node 20)
node scripts/parity.mjs      /tmp/glam-oracle parity-out
node scripts/frame-parity.mjs ~/Project/glamour-v1-oracle  frame-parity-out
```

`gen-oracle.mjs` invokes v1's CLI through Node 20.19.4 explicitly — v1 still needs that ABI for its
native `canvas`, which is exactly the pin v2 dropped.

Note: `pnpm -r build` in v1 FAILS at `apps/studio` (the pre-existing `onGuided` mock bug). The oracle
packages still build, so this is survivable — but build `--filter @glamour-labs/core --filter @glamour-labs/player
--filter @glamour-labs/cli` if you want a clean exit.

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
