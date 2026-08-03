# Glamour v1 — Consolidated Fix List (post-review)

Source: code-review-findings.md + devil-and-techdebt-findings.md. QC (runtime + browser) both PASS.
Every fix gets a **regression test written first** (TDD). Re-run full suite (`npx vitest run`, Node 20) after.

## MUST-FIX (blocks ship)
1. **XSS/breakout in `exportInlineHTML`** — `packages/player/src/export.ts`. Escape the inlined doc JSON so a
   string field containing `</script>` (or U+2028/U+2029) cannot break out. Replace `<`→`<` (and `/`→`\/`
   or `</`→`<\/`) in BOTH the UMD-source slot and the `__GLAM_DOC__` slot before embedding.
   Test: a doc with `text:"</script><img src=x onerror=alert(1)>"` → exported HTML has NO literal `</script>`
   outside the intended tags; parsing yields exactly the expected script tags.
2. **`validate` must parse `bind.expr` and condition keys** — `packages/core/src/validate.ts`. For every
   `bind.expr`: parse it, confirm every identifier is a declared **numeric** input, every function whitelisted;
   evaluate once against inputs' initial values and require a finite result. For every condition `on` key:
   parse `"<input> <op> <value>"`, confirm the input exists and is numeric-comparable, and the RHS parses.
   Bound expression depth/length so `"(".repeat(1e5)` is rejected, not a stack overflow.
   Tests: `expr:"1 +"`, `"("`, `"foo("`, `"unknownvar"`, `""`, and `on:"progress>"` all → `validate.ok === false`;
   the spec example still → ok. Deep-nested expr → rejected, no throw.
3. **Remove no-op `play()`/`pause()` from `GlamPlayer`** — `packages/player/src/player.ts`. v1 motion is
   state/transition-driven; there is no continuous timeline to control. Drop both methods + the dead `playing`
   var from the public type. (Continuous-timeline playback → v2, surfaced in the report.) Update any test that
   referenced them.

## SHOULD-FIX (real correctness, cheap)
4. **expr prototype-chain leak** — `packages/core/src/expr.ts:~155`. Replace `t.value in this.scope` with
   `Object.hasOwn(this.scope, t.value)` so `constructor`/`__proto__`/`toString` throw "unknown identifier"
   instead of resolving. Test: `evalExpr('constructor',{})` throws.
5. **Non-numeric `set` tweened to NaN** — `packages/core/src/scene.ts`. In `applyStateSet`, apply non-numeric
   prop values (e.g. `text`, string `fill` is fine—Konva channel-tweens color; guard only genuinely non-numeric
   like `text`) INSTANTLY (skip the numeric tween) even when `transition.ms>0`. AND in `validate`, reject a
   `set` value whose type mismatches the prop kind (`text` wants string; `r/w/h/x/y/opacity/rotation` want
   number). Test: `set:{"label.text":"Done"}` with `transition.ms:250` no longer yields NaN; `set:{"c.r":"x"}` → validate fails.
6. **`removeNode` leaves dangling refs** — `packages/core/src/ops.ts`. On `removeNode`, also drop `bind` entries
   for that node and any `machine` `on`/`set` keys referencing it, so the reducer never returns an invalid doc.
   Test: remove a node that a bind + a state.set reference → result validates ok.
7. **`applyOps` aliases op payloads** — `packages/core/src/ops.ts`. Clone inserted `op.node`/`op.bind`/
   `op.props`/`op.state`. Test: mutate the op object after `applyOps` → returned doc unaffected.
8. **Dedup condition parsing** — extract ONE `splitCondition`/`classifyOnKey` used by both
   `packages/core/src/validate.ts` and `expr.ts` (and referenced by player's machine mapping). Closes the
   validate↔machine ambiguous-key divergence (`"a>b.click"`). Keep behavior; just single-source it.
9. **`glam preview` skips validate** — `packages/cli/src/commands/preview.ts`. Run `validate` before
   `exportInlineHTML`; on failure print schema errors + exit 1 (like `render`/`validate`).
10. **`<glam-canvas src>` no error handling** — `packages/player/src/webcomponent.ts`. Check `res.ok`, run
    `validate` on the fetched doc, and surface load/validation errors (don't swallow the async rejection).
11. **Studio slider range + resync** — `apps/studio/src/components/InputPanel.tsx`. Fix the range heuristic so
    an input starting at 0 (the spec's `progress` 0→100) isn't capped at max=1 (e.g. default range 0..1 for
    fractional, or infer a sensible max); make the slider controlled so it resyncs on doc change.

## CHEAP CLEANUPS (include)
12. **Dup starter-doc** — `apps/studio/src/starterDoc.ts` should derive from the single source (cli's
    `starterDoc`, or a shared fixture), not a hand-typed JSON string.
13. **`canvas-shim.ts` export drift** — reconcile `export default {}` vs `export {}` between player + studio copies.
14. **Non-finite expr result guard** — folded into fix #2 (validate rejects non-finite sample result).

## DEFER (note in report, NOT fixing in v1)
- MCP↔core schema duplication (`mcp/src/server.ts` restates core's zod) — derive-from-core is a nice v2
  cleanup; low runtime risk (both tested). Leave a code comment pointing at core as the source of truth.
- `SceneHandle` `KonvaLike = any` public type → tighten to a structural interface post-v1 (documented tradeoff).
- Degenerate geometry (circle w/o `r`) validate-warning — low value for v1.
