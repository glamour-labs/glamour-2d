# Glamour — Autonomous Multi-Quest Run (2026-07-22)

**Mode:** unattended-but-not-blind. King authorized: "Decide for me, deliver the result at the end,
no need to stop and ask." Ground truth lives HERE — any interruption re-orients from this file.

**Toolchain note (session-critical):** the global `pnpm` is Node-24-built and dies under Node 20
(`node:sqlite`). Use `npx -y pnpm@9.15.0 <cmd>` under `nvm use 20.19.4`. Baseline verified green:
**192 tests / 26 files, clean build** before any change.

## Locked decision (the shape)
1. **Parallel now:** Track A (mission acceptance test — the gate) + Track B (format enrichment).
   - A consumes the finished engine + adds a NEW react package → no file collision with B.
   - B collapses paint (gradient/glow/ellipse) + v1.1 gaps (arc/rounded-rect/spring/bold) — one
     cohesive "add fields + node types + render cases" change to core.
2. **Then:** Track C — Rung 2 (input + ink + trace-matching). Biggest; new capability class.
   Sequenced after B because both mutate core schema/scene/validate.

## Verification doctrine (this run)
- Builder never certifies its own work. I (main loop) build core; FRESH agents review + QC.
- **Trust the round table + a LIVE measurement over green tests** (this repo's headline lesson:
  a seeded-RNG unit test hid a live jitter bug). Verify in the real runtime.
- Round table per track: code-reviewer (Opus) + techdebt + devil (Opus), then browser/runtime QC.

---

## Track A — Mission acceptance test
**DoD:**
- [ ] A1. `@glam/react` package: a real `<Glamour doc={} onEmit={} playerRef={}/>` React component
      wrapping `renderGlamour`, with lifecycle (mount/destroy), ref-forwarded `send`/`setInput`/`play`/`pause`.
- [ ] A2. `examples/react-crab/` — a real Vite+React app embedding `<Glamour>`, with the
      **scoring/correctness logic in React** (not in the glam doc): listens via `onEmit`, keeps score
      in React state, drives the canvas via the player ref.
- [ ] A3. AI-authoring proof: dispatch `glamour-smith` with a PLAIN description (no format spoon-fed);
      it authors + validates + renders a v0.1 glamour. Capture the .glam + PNG as evidence.
- [ ] A4. Build + typecheck the new package/app clean; component unit test (jsdom) green.

## Track B — Format enrichment (paint + v1.1 gaps)
**DoD:**
- [ ] B1. `ellipse` node type (rx/ry) — soft oval eyes.
- [ ] B2. gradient fills — radial + linear (fillGradient on nodes).
- [ ] B3. glow/shadow — shadowColor/shadowBlur/shadowOpacity/shadowOffset.
- [ ] B4. `arc` node type (sweeping progress ring: innerRadius/outerRadius/angle).
- [ ] B5. rounded `rect` corners (cornerRadius).
- [ ] B6. spring/elastic easing (BackEaseInOut / ElasticEaseOut) in the ease enum.
- [ ] B7. bold / `fontStyle` on text.
- [ ] B8. schema + types + scene render + validate + PROP_TO_KONVA_METHOD updated coherently;
      TDD tests for each; all packages build; suite green.

## Track C — Rung 2 (input + ink)
**DoD:**
- [ ] C1. pointer drag/move host events: player emits pointer position stream (down/move/up) with
      canvas coords, so the host (React) can react.
- [ ] C2. `stroke` / freehand path primitive — a Konva.Line the user's drag draws into.
- [ ] C3. trace-matching helper (PURE math in core): given a target path + a drawn path, return a
      match score (coverage + order + tolerance). Host decides pass/fail.
- [ ] C4. schema + validate + scene + player wired; TDD; build; suite green.
- [ ] C5. an alphabet-trace proof sketch (draw letter, trace-match scores it).

---

## Progress ledger (update at every step — this is the resume anchor)
- 2026-07-22: baseline green (192/26). Plan written. Starting Track A + B in parallel.
- 2026-07-23: **A3 DONE** — glamour-smith authored a v0.1 crab from a PLAIN description;
  `glam validate` = ok, 13.8KB PNG rendered. Evidence: examples/ai-authored/crab.{glam,png}.
  Friction notes captured (see below) — they VALIDATE Track B: "no arcs/paths — curved smile not
  expressible" (arc now added), z-order trap + coord conventions undocumented in the skill (doc gap).
- 2026-07-23: **Track B code DONE + green** — ellipse, arc, rounded rect, fontStyle, shadow/glow,
  linear+radial gradients (with live pixel checks), backInOut + elasticOut easing. Collapsed the
  duplicated machine.transition ease enum onto shared easeSchema. Full suite **209/27 green**,
  all packages build. MCP/palette need no change (types flow through core validate). NEXT: commit B,
  round table on B, then Track C.

- 2026-07-23: **Round table on B** — techdebt: clean (fixed 2 nits: fontStyle msg consistency,
  test misname). devil: 1 MUST-FIX + 4 verify-items, ALL FIXED:
  * MUST-FIX: overshoot easing → negative radius → canvas throw. Fixed by clamping radius-family
    props (r/rx/ry/innerRadius/outerRadius/cornerRadius) to >=0 at every apply site (loop.ts,
    scene tween via onUpdate, scene instant-set) via shared `clampPropValue`. Regression tests added.
  * degenerate linear gradient (from==to), non-ascending stops, non-finite geometry, negative static
    radii — all now refused by validate. fontStyle normalized to CSS-canonical 'italic bold' at render.
- 2026-07-23: **Track C code DONE + green** — Rung 2: `stroke` node (Konva.Line), doc-level `ink`
  block (into/emit/match), player pointer stream (onPointer) + live ink drawing + onStroke with
  trace score, pure `traceMatch` in core (coverage/stray/startOk/endOk/score). Full suite **234/29
  green**. NEXT: Rung-2 proof sketch, Track A React embed (@glam/react + examples/react-crab),
  final code-review on full diff, live/browser QC, docs.

- 2026-07-23: **Track A React embed + trace sketch DONE** — @glam/react `<Glamour>` (5 jsdom tests),
  examples/react-crab (embeds the A3 crab, scoring in React), sketches/trace-letter. Registered
  examples/* in workspace. Full suite **242/30 green**, all packages + example build.
- 2026-07-23: **Final code review** — APPROVED w/ fixes: caught the clamp missing at 2 MORE paths
  (recomputeBindings + resting-frame seeding), fixed + regression-tested. 3 Minor items also applied
  (set-fontStyle validate guard, ink coord-space doc, ink comment accuracy). Suite 242/30.
- 2026-07-23: **LIVE browser QC — both PASS** (the decisive measurement, real runtime):
  * react-crab (MISSION acceptance): clicking the canvas crab fired crab-tapped → React scored 0→3→5,
    timer 15→0, end-screen final score matched. Only a favicon 404 (cosmetic). Evidence:
    docs/superpowers/plans/evidence/react-crab-qc.md + 01..05 png.
  * trace-letter (Rung 2): correct drag → "Nice! ⭐" 100% coverage/0% stray; wrong scribble → correctly
    rejected. 0 console errors. Evidence: evidence/trace-letter-qc.md + 01..03 png.
- 2026-07-23: **Docs** — README (status + surfaces + test count), ROADMAP (handoff: both axes moving,
  what's left, ⚠️ re-sync global glam/skill note), cast-glamour SKILL.md (§6 v1.1 + §7 Rung 2 +
  coordinate-anchoring gotcha), sketches/README (trace-letter + gaps-closed status).

## FINAL STATUS — all four forks delivered, live-verified
- Track A (acceptance test): **DONE** — describe→AI-authored crab + real React embed, scoring in React. Live PASS.
- Track B (paint/fidelity + v1.1 gaps): **DONE** — ellipse/arc/gradient/glow/cornerRadius/fontStyle/spring easing. Round table clean.
- Track C (Rung 2 input+ink): **DONE** — stroke/ink/onPointer/onStroke/traceMatch. Live PASS.
- Rung 3 (game kit) intentionally NOT done — the roadmap sequences it after 1+2; flagged as next.
- Suite 242/30 green · all packages + example build · 5 commits on claude/glamour-42c584 (not pushed).

## Findings from A3 (folded into docs / skill — DONE)
- Skill/format doc gap: coordinate anchoring differs per shape (circle=center, rect=top-left,
  grouped=relative) and the group z-order trap — neither stated in cast-glamour; the agent had to
  read scene.ts. Worth documenting in the skill + a "fidelity/authoring" doc.
- Group loops are x/y-only → no rotational idle (claw wave / tilt). Logged as a future rung.

## Decisions audit trail (irreversible / notable choices made autonomously)
- Toolchain: use `npx pnpm@9.15.0` under Node 20 (global pnpm is Node-24-built, dies on node:sqlite).
  Ran `pnpm install` in the worktree to link bins (fixed export.test.ts tsup ENOENT). Reversible.
- Committing locally per track on the feature branch (NOT pushing / no PR) — checkpoints for the
  Watch; "deliver the result" reads as authorization to commit, not to ship outward.
- Made shadowBlur/shadowOpacity animatable (breathing glow); gradient is declarative w/ validated
  geometry (refuse dead gradient). Kept gradient points in node-LOCAL coords (Konva-native).

## Stage 3

### Code review
- **Iteration 1**: CHANGES REQUESTED → fixed. Full-diff review (be77da7..c188a50): v1.1 paint
  enrichment, Rung 2 input/ink, @glam/react. Suite green (241/30 after fixes), all packages build,
  both new .glam docs validate ok. One Important gap found and fixed; rest clean.
- **Issues fixed**:
  - Important — clamp NOT applied at all apply paths. The radius-family >=0 clamp covered
    loop.ts run-loop, scene tween onUpdate, and scene instant-set, but MISSED two sites:
    (a) `recomputeBindings` in scene.ts — a bind expr driving a radius-family prop negative for
    some input (e.g. `r = 30 - k*6`) reached the canvas unclamped → IndexSizeError throw on
    setInput; input-driven, so validate cannot catch it statically. (b) resting-frame seeding in
    buildScene — a negative `loop.from` on a radius was applied raw before `layer.draw()` → throw
    at build. Both now route through the single-sourced `clampPropValue`. Regression tests added
    (packages/core/test/paint.test.ts): bind-driven negative radius + negative loop.from seed.
    Files: packages/core/src/scene.ts, packages/core/test/paint.test.ts.
- **Issues punted** (Minor, reported to dispatcher, not fixed):
  - Ink coordinate math (player.ts `appendInk`) subtracts `getAbsolutePosition()` — correct for
    translation/grouping but not node/group rotation or scale; the doc comment slightly overclaims.
    Left: no rotated/scaled ink node ships today; the fully-correct form is
    `getAbsoluteTransform().invert().point()` if that case ever arises.
  - `GlamInk.match.target` coord space (must be ink-node-LOCAL to match drawn points) is undocumented
    on the type; works in the sketch only because the ink node sits at origin.
  - A `fontStyle` value set via a machine `state.set` is checked for string-type but not against
    ALLOWED_FONT_STYLES (node-level fontStyle is); an invalid style via a transition renders plain.
