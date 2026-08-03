# Glamour v1 — Devil (adversarial) + Techdebt Findings

Persisted for compaction safety. All confirmed by execution where noted.

## Devil (Mordred) — MUST-FIX (both corroborate code review)
- **XSS/breakout in `exportInlineHTML`** (`player/src/export.ts:39`). Confirmed repro: `text:"</script><script>alert(document.domain)//"` → real closed script tag in the "shareable" file. Escape `<`,`/`,U+2028/U+2029 (e.g. `<`→`<`) before embedding. **[= C1]**
- **`validate` never parses `bind.expr`/condition RHS** (`core/src/validate.ts`). Confirmed: `expr:"1 +"`, `"("`, `"foo("`, `"unknownvar"` all validate ok:true → throw at `renderToPNG`. `on:"progress>"` → throws in xstate guard on first INPUT → crashes `setInput`. Also `"(".repeat(1e5)` → RangeError (stack). Validate must eval/parse every expr + condition against declared numeric inputs, with depth/length bound. **[= I1]**

## Devil — Verify/Fix
- **expr prototype-chain leak** (`expr.ts:155`): `t.value in this.scope` walks prototype → `constructor`, `__proto__`, `toString` resolve as "numbers" (type confusion, no RCE — calls are whitelist-gated). Fix: `Object.hasOwn(this.scope, t.value)`. **[FIX — cheap, real]**
- **div-by-zero / NaN / Infinity** propagate from validate-passing docs; Konva silently ignores. Consider rejecting non-finite expr results. **[nice]**
- **validate↔machine ambiguous-key classifier divergence** (`"a>b.click"`): validate treats as condition, machine as pointer → dead transition. Share ONE classifier. **[fix — merge with techdebt dup finding]**
- **set/bind value-type not checked vs prop kind**: `set:{"label.text":5}` or `{"circle.r":"x"}` validates, tweens to NaN with ms>0. **[= I2 — tie value type to prop kind in validate + skip tween for non-numeric]**
- **`removeNode` leaves dangling bind/machine refs** → reducer yields invalid doc (`ops.ts:20`). Prune references. **[fix]**
- **applyOps aliases op payloads by reference** (`ops.ts:18` etc). Clone inserted payloads. **[= M1]**

## Techdebt (Kay) — Must-fix
- **`GlamPlayer.play()/pause()` are no-ops** (`player/src/player.ts:66,75,79`): `playing` var never read; studio never calls them. Misleading public contract. **DECISION:** v1 motion is state/transition-driven — there is no continuous timeline to play/pause yet. Drop `play`/`pause` from the public `GlamPlayer` for v1; surface continuous-timeline playback as a v2 item. **[fix — remove stub]**

## Techdebt — Review (worth fixing before ship)
- **Dup condition-parsing** validate.ts vs expr.ts (same op list + algo) → extract shared `splitCondition`/`classifyOnKey`. Also closes the devil classifier-divergence. **[fix]**
- **Dup starter-doc** cli/new.ts (object) vs studio/starterDoc.ts (hand-typed JSON string) → derive studio from one source. **[fix — small]**
- **Dup schema** core/schema.ts vs mcp/server.ts (hand-copied zod) → derive MCP input shapes from core. **[fix if cheap, else note]**
- **`preview.ts` skips validate** before export (`cli/commands/preview.ts:18`) → worse error than render/validate. Add validate. **[fix — small]**
- **`canvas-shim.ts` export shape drift** (`export default {}` vs `export {}`). Reconcile. **[trivial]**

## Techdebt — Acceptable for v1 (documented tradeoffs, leave)
- `KonvaLike = any` in SceneHandle public type (node/browser Konva differ; eslint-disabled) — tighten to structural interface post-v1.
- CLI/MCP `console.*` — legitimate output layer, not debug debris.
- MCP per-tool arg interfaces — standard typed-dispatch pattern.
