# Primitive palette reference

Source of truth: `packages/core/src/palette.ts`. Every primitive returns a plain `Op[]`
meant to be fed straight into `applyOps(doc, ops)` (from `packages/core/src/ops.ts`).
Nothing here reads or mutates the doc directly — palette functions are pure factories of
ops; `applyOps` does the (also pure, immutable) application.

```ts
import { applyOps, palette, listPrimitives } from '@glamour-labs/core';
```

Call `listPrimitives()` at any time to get this table live from the source (name +
signature + one-line description) — useful if this doc has drifted.

## `hoverGrow(id, by = 60)`

```ts
palette.hoverGrow('orb')        // grows to r=60 on hover (default)
palette.hoverGrow('orb', 80)    // grows to r=80 on hover
```

Adds:
```json
"machine": {
  "initial": "idle",
  "states": {
    "idle":  { "on": { "orb.hover": "hover" } },
    "hover": { "set": { "orb.r": 80 }, "on": { "orb.leave": "idle" } }
  }
}
```

**Note the `by` parameter is the ABSOLUTE hover radius, not a delta or multiplier** —
palette functions are pure and never see the node's current radius, so they can't compute
a relative "+20". Pass the exact target size you want on hover.

If the doc already has a `machine` block (e.g. from a previous primitive), `defineState`
merges the new states in rather than replacing the machine — but only one `on.hover`/`on.leave`
pair should exist per node; composing two hover-affecting primitives on the same node id
will overwrite each other's `hover` state definition.

## `clickToggle(id, a, b)`

```ts
palette.clickToggle('orb', { r: 48, fill: '#4c7dff' }, { r: 72, fill: '#ff9f43' })
```

Adds:
```json
"machine": {
  "initial": "idle",
  "states": {
    "idle":   { "set": { "orb.r": 48, "orb.fill": "#4c7dff" }, "on": { "orb.click": "active" } },
    "active": { "set": { "orb.r": 72, "orb.fill": "#ff9f43" }, "on": { "orb.click": "idle" } }
  }
}
```

`a` and `b` are `Partial<GlamNode>` — any subset of animatable props (see
`reference/schema.md`'s per-type table). Keys are namespaced under `<id>.` automatically.

## `progressBar(id, input)`

```ts
palette.progressBar('bar', 'progress')
```

Adds a single binding:
```json
"bind": [ { "node": "bar", "prop": "w", "expr": "lerp(20, 220, progress)" } ]
```

This only adds the binding — it does NOT create the `progress` input or the `bar` node.
Make sure `doc.inputs.progress` exists (any starting number, e.g. `0`) and `bar` is a
`rect` node before applying, or `validate` will flag the binding as referencing a missing
input/node context. (The binding itself only checks `bar` exists and `w` is animatable on
it; the input's existence is a machine-condition concern, not a bind concern, but the
expression will throw at eval time if `progress` isn't in the live inputs.)

## `fadeIn(id)`

```ts
palette.fadeIn('orb')
```

Adds:
```json
"machine": {
  "initial": "visible",
  "states": { "visible": { "set": { "orb.opacity": 1 } } }
}
```

Sets `visible` as `machine.initial` — if a machine and other states already exist, this
overwrites `initial`, so apply `fadeIn` first if you're composing it with something whose
own initial state matters more.

## Composing multiple primitives

`applyOps` takes a flat `Op[]`, so concatenate:

```ts
import { applyOps, palette } from '@glamour-labs/core';

const doc2 = applyOps(doc, [
  ...palette.progressBar('bar', 'progress'),
  ...palette.clickToggle('orb', { r: 48 }, { r: 72 }),
]);
```

Each primitive's ops are independent (`defineState` merges by state name, `addBinding`
appends) — but as noted above, two primitives that both write to the SAME state name on
the SAME node (e.g. two different hover behaviors) will have the later one win, since
`defineState` for an existing name replaces that state's definition wholesale.

Always run the doc through `validate()` (or the CLI `glam validate`) after composing —
see `SKILL.md` §4 for the mandatory self-verify loop.
