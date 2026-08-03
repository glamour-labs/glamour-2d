# Glamour v1 — Code Review Findings (Gawain / code-reviewer)

Persisted verbatim-summary so it survives compaction. Report-only; fixes applied centrally after all verifiers report.

## CRITICAL
- **C1 — `exportInlineHTML` inlines doc JSON unescaped → breaks the shareable deliverable + stored XSS.**
  `packages/player/src/export.ts:36-40`. `JSON.stringify(doc)` interpolated raw into a `<script>` body; a text node containing `</script>` (or `</script><img onerror=...>`) validates OK but terminates the script tag early — player never inits, and it's an XSS vector in the headline "shareable piece". Also flows through `glam preview` (`cli/src/commands/preview.ts:20`).
  **Fix:** escape `<` before inlining (`</`→`<\/` or `<`→`<`) in both the UMD slot and the `__GLAM_DOC__` slot. **[MUST FIX]**

## IMPORTANT
- **I1 — `validate` never checks `bind.expr`; bad/string/empty expr validates-OK but crashes render/play.**
  `core/src/validate.ts:70-79` gap vs `scene.ts:113-124`, `expr.ts:155-158`. Typo'd input, string-typed input (dropped by `numericScope`), or empty `""` expr all pass validate, then `recomputeBindings()` throws out of `renderToPNG`/`renderGlamour`. Defeats the self-verify thesis.
  **Fix:** validate tokenizes each `expr`, confirms every identifier is a known **numeric** input and every function is whitelisted. **[MUST FIX]**
- **I2 — `set` on a string prop (`text`) with `transition.ms>0` tweens to NaN.**
  `core/src/scene.ts:150-158`. Headless render uses ms=0 so it's masked; live player drives `label.text` through a numeric tween → NaN. Medium confidence on exact Konva behavior — runtime/browser QC to confirm.
  **Fix:** set non-numeric props instantly (skip the tween path) regardless of transition.ms. **[FIX]**

## MINOR
- **M1** `applyOps` inserts `op.node`/`op.bind`/`op.props`/`op.state` by reference (input doc is cloned, but op payloads alias into output). Clone inserted payloads. `ops.ts:18,32,55`.
- **M2** Degenerate geometry (circle w/o `r`, rect w/o `w`/`h`) validates-OK, renders invisible. Consider validate warning. `schema.ts:11-14`, `scene.ts:60-64`.
- **M3** `<glam-canvas src>` `_loadFromSrc` has no `res.ok` check, no `validate`, swallows async rejection. `webcomponent.ts:48-55`.
- **M4** Studio `InputPanel` slider `max={Math.max(1,value*2,1)}` → max=1 for inputs starting at 0 (the spec's `progress` 0→100 caps at 1); slider uncontrolled (`defaultValue`) won't resync. `apps/studio/src/components/InputPanel.tsx:23-27`.
- **M5** `evalCondition` mixes string LHS / number RHS via JS relational coercion. Add validate-time type check. `expr.ts:255-258`.

## Checked & OK
applyOps input immutability (structuredClone); expr evaluator safety (no eval/injection); 2-char vs 1-char operator ordering; validate↔machine pointer/condition classification convergence; pointer wiring agreement (click/hover/leave); MCP session-doc error mapping; node/browser entry split. Input-condition transitions ARE wired (scope note understated it) — just not re-evaluated at initial state (minor design gap).
