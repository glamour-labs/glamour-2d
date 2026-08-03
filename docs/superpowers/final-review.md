# Quest Glamour v1 — Final Review

**Verdict:** ⚠️ GO WITH CONCERNS — **GO** for a v1 personal-tool bar (greenfield, no remote, no other users)
**Surface(s):** library (core) · browser (player + Studio) · cli · mcp · skill/sub-agent
**Evidence:** `docs/superpowers/qc/` (+ `docs/superpowers/spikes/`, `docs/superpowers/BUILD-NOTES.md`)

## Done — verified against the Definition of Done

- [✓] **Spine spike (Konva+XState+node-canvas) 6/6 claims proven** before build — `docs/superpowers/specs/2026-07-22-glamour-design.md`#§9, artifacts `docs/superpowers/spikes/spine-spike.mjs` + `spine-spike-proof.png` present.
- [✓] **Group A (`@glam/core`)** — schema/validate/expr/ops/palette/scene/render implemented per plan; `validate` catches all 6 semantic error classes (confirmed by reading `packages/core/src/validate.ts` directly — node-id dup, bind-node-missing, bind-prop-animatable, machine.initial, on-target, on-key classification, set-key/prop-type). `runtime-qc-glamour-v1-nonui.md`#"Core public API" — PASS with raw stdout (validate ok, applyOps pure, renderToPNG real PNG, signature confirmed).
- [✓] **Group B (`@glam/player`)** — `renderGlamour`, `<glam-canvas>`, `exportInlineHTML`; UMD canvas-free split (`@glam/player` + `@glam/player/node`) — `BUILD-NOTES.md` finding #1 RESOLVED, confirmed by reading `packages/player/src/export.ts` (Node-only helper, correctly isolated).
- [✓] **Group E (`@glam/mcp`)** — 11 tools, real stdio subprocess handshake (not just in-memory) — `runtime-qc-glamour-v1-nonui.md`#"MCP server" — PASS, raw tool list + scripted session + error-path (`isError:true`) captured.
- [✓] **Group C (CLI)** — `glam new/validate/render/preview` all exercised live against real files/ports — `runtime-qc-glamour-v1-nonui.md`#"CLI end-to-end self-verify loop" — PASS, includes the broken-doc negative case (exit 1, useful error).
- [✓] **Group D (`cast-glamour` skill)** — 3 worked examples, each independently validated + rendered to real PNGs with correct dimensions — `runtime-qc-glamour-v1-nonui.md`#"Skill examples" — PASS.
- [✓] **Group F (Studio)** — dark two-pane UI, live preview, validation-error surfacing + clear-on-fix, and — critically — the input→binding wire proven with a **real user-gesture** interaction (not just a synthetic-event false start, which was correctly flagged and discarded) — `studio-browser-qc.md`#"One interaction" — PASS, screenshot `evidence/06-slider-arrow-keys-0.8.png` (visually confirmed: bar grown to ~176px at progress=0.8, matches `lerp(20,220,0.8)=176`).
- [✓] **Round-table review ran and reported** — `code-review-findings.md` (1 critical + 2 important + 5 minor) and `devil-and-techdebt-findings.md` (corroborating, independent) both present with specific line-numbered findings, not vague rollups.
- [✓] **Critical export-XSS (C1) fixed and re-verifiable** — read `packages/player/src/export.ts` directly: `escapeForInlineScript` neutralizes `</script`, `<!--`, U+2028/U+2029 in both the UMD slot and the `__GLAM_DOC__` slot, exactly as the fix-list specified. Matches devil's confirmed repro vector.
- [✓] **validate-expr gap (I1) fixed** — read `packages/core/src/validate.ts` directly: every `bind.expr` is parsed via `evalExpr` against numeric-only inputs and checked `Number.isFinite`; every condition key routed through a shared `classifyOnKey`; malformed `set` value types rejected against a `NUMERIC_PROPS`/`STRING_PROPS` split (also closes I2/finding #5 in the same pass).
- [✓] **`play()`/`pause()` stubs removed (finding #3)** — confirmed by grep: zero occurrences of `play(`, `pause(`, or `playing` in `packages/player/src/player.ts`.
- [✓] **Shared `classifyOnKey` extracted (finding #8, dedup)** — confirmed present at `packages/core/src/onkey.ts`, imported by both `validate.ts` and referenced by machine mapping — closes the validate↔machine ambiguous-key divergence devil flagged.
- [✓] **Node-20 ABI invariant documented and consistent** — `.nvmrc` = `20.19.4` (read directly), `BUILD-NOTES.md` states the invariant, README quickstart states it, `runtime-qc` evidence shows the exact `export PATH=...v20.19.4...` prefix used throughout.
- [✓] **Test-file inventory matches the "23 files" claim** — independently globbed (not just cited): 20 files under `packages/*/test/*.test.ts`, 1 under `skills/cast-glamour/test/`, 2 under `apps/studio/test/*.test.tsx` = **23**, exact match.

## Open — not done / deferred / NOT-RUN

- [ ] **"125 tests green" full-suite re-execution — NOT-RUN by this review.** This reviewer session has no Bash tool available, so `npx vitest run` could not be independently executed here (the task brief assumed Bash access this session didn't have). Downgraded per audit rule (claim with no fresh Evidence: line from *this* pass). Mitigated by: (a) exact test-file-count match above (23/23, independently globbed), (b) per-group counts in `BUILD-NOTES.md` are internally consistent (49+11+7+6+7+4=84 pre-fix, matches the separately-reported "84/84 green" after the player export split), (c) `runtime-qc-glamour-v1-nonui.md` shows a real `npm run build` (all workspaces, `tsc --noEmit` + `vite build`) succeeded, which a broken test suite would be unlikely to survive alongside. Net: plausible and well-corroborated, but not a fresh, first-party PASS from this certification.
- [ ] **README quickstart still says "84 tests across all surfaces"** (`README.md:64`) — stale by one fix-pass; actual is 125 (`BUILD-NOTES.md:27`). Cosmetic doc drift, not a functional gap — flagging so it doesn't ship stale to whoever reads the README next.
- [ ] **DEFER (as designed, not oversold):**
  - MCP↔core schema duplication — `packages/mcp/src/server.ts` still hand-restates zod shapes (confirmed present, not fixed) — documented low-risk in `FIX-LIST.md`, both sides independently tested.
  - `SceneHandle`'s `KonvaLike = any` — confirmed still present in `packages/core/src/scene.ts` — documented tradeoff (Node vs browser Konva types differ), tighten post-v1.
  - Degenerate-geometry validate-warning (circle w/o `r`) — not implemented, explicitly low-value-for-v1 per fix list.
- [ ] **v2-deferred by design (surfaced, not built, and shouldn't be read as gaps):** raster/sprites + SVG import, image → animation, in-app AI chat (beyond prompt→primitive), WebGL/Pixi performance path, continuous-timeline playback (only tween-on-transition exists in v1; `play()`/`pause()` were correctly *removed* rather than left as dead stubs).
- [ ] Studio "Apply primitive" palette flow and `thorough`-depth browser QC (full state matrix, responsive widths) — explicitly out of scope for the `quick`-depth pass run; not a v1 blocker but not exercised either.

## Concerns — my judgement; what the King should eyeball

- The one thing I could not independently re-confirm this pass is the exact **125/125** figure — everything else (file inventory, individual fix diffs, individual runtime/browser QC) checks out on direct read, so I'd call this a low-risk gap, not a red flag. If you want it airtight, a 10-second `export PATH=... && npx vitest run` at repo root closes it.
- The **critical fix (export-XSS) and the validate-expr gap** are the two findings that actually mattered for a "personal tool that produces shareable HTML" — both read correctly in the source, matching the exact vectors devil/code-review confirmed. This is the load-bearing part of the ship decision and it holds up under a fresh read.
- Studio QC is `quick`-depth only; the one interaction tested (slider→bind) is real and convincing (genuine keyboard gesture, not synthetic-event theater — the QC report itself correctly discarded a false-negative synthetic attempt rather than papering over it). No responsive/thorough pass exists yet, but for a personal tool with a single primary user, this is an acceptable bar.
- README doc drift (84 vs 125) is trivial to fix and should be, but does not block a personal-tool ship.

## Evidence audit

- Checks claimed: 19 DoD-level items (per plan's per-group DoDs + final-integration checklist) + 14 fix-list items + 6 spike claims = ~39 discrete claims audited.
- Backed by proof (Evidence: line + this review's own direct-read corroboration): 37.
- Downgraded to NOT-RUN: 1 — the fresh full-suite "125 green" re-execution (no Bash tool this session; strongly corroborated by file-count match + build-success evidence, but not a first-party rerun).
- No findings were fabricated-pass or evidence-free "PASS" claims — every PASS in `runtime-qc-glamour-v1-nonui.md` and `studio-browser-qc.md` carries a concrete Evidence: line (raw output, screenshot path, or byte-level file check), and this review independently re-read the actual source for every fix claimed rather than trusting the fix-list prose.

## Report

- Rendered: *(see final message — report-builder output path)*
