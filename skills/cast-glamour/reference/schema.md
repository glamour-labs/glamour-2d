# `glamour/v0` / `glamour/v0.1` schema reference

Source of truth: `packages/core/src/types.ts` (TS types), `packages/core/src/schema.ts`
(zod runtime schema), `packages/core/src/validate.ts` (semantic rules). This doc mirrors
those files as of this writing — if it ever disagrees with the source, the source wins;
re-read those three files.

## Top-level document

```ts
interface GlamDoc {
  schema: 'glamour/v0' | 'glamour/v0.1';         // required, literal
  canvas: { w: number; h: number; bg?: string }; // required
  inputs?: Record<string, number | string>;      // named host-set values
  nodes: GlamNode[];                              // required, may be empty
  bind?: GlamBind[];                              // expression bindings
  machine?: GlamMachine;                          // optional state machine
  groups?: GlamGroup[];                           // v0.1: nesting
  loops?: GlamLoop[];                             // v0.1: continuous motion
  wander?: GlamWander[];                          // v0.1: free drift
}
```

`glamour/v0.1` is strictly additive: a `glamour/v0` doc with no `groups`/`loops`/`wander`
parses and validates identically whichever schema id it declares.

## Nodes

```ts
type NodeType = 'circle' | 'rect' | 'text';

interface GlamNode {
  id: string;        // required, non-empty, unique across doc.nodes
  type: NodeType;     // required
  x: number; y: number; // required, position
  r?: number;          // circle radius
  w?: number; h?: number; // rect width/height
  text?: string; size?: number; // text content / font size
  fill?: string; stroke?: string; strokeWidth?: number;
  opacity?: number; rotation?: number;
  group?: string;      // v0.1: id of a declared GlamGroup this node belongs to
  emit?: string;       // v0.1: host event name fired (via player.on) on click
}
```

**Animatable props per node type** (used by `bind`, `set`, and by nothing else —
these are the only prop names `validate` will accept as a bind/set target):

| type | props |
|---|---|
| `circle` | `x y fill stroke strokeWidth opacity rotation` + `r` |
| `rect` | `x y fill stroke strokeWidth opacity rotation` + `w h` |
| `text` | `x y fill stroke strokeWidth opacity rotation` + `text size` |

Targeting a prop the node type doesn't have (e.g. `r` on a rect) is a validation error:
`"... targeting non-animatable prop ..."`.

## Bindings

```ts
interface GlamBind { node: string; prop: string; expr: string; }
```

- `node` must reference an existing `doc.nodes[].id`.
- `prop` must be animatable for that node's type (table above).
- `expr` is evaluated by `evalExpr` (see below) against the current `doc.inputs` scope
  whenever an input changes (player) or once at render time with the initial inputs
  (headless `renderToPNG`).

## State machine

```ts
interface GlamState {
  set?: Record<string, number | string>;  // "<nodeId>.<prop>": value
  on?: Record<string, string>;             // "<key>": targetStateName
}
interface GlamMachine {
  initial: string;                          // must be a key of `states`
  states: Record<string, GlamState>;
  transition?: { ms: number; ease?: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' };
}
```

### `set` keys
Format: `"<nodeId>.<prop>"`. `nodeId` must exist; `prop` must be animatable for that
node's type. Malformed keys (no `.`, or `.` at position 0) are rejected.

### `on` keys — two forms, disambiguated by content

1. **Pointer form**: `"<nodeId>.<event>"`. `nodeId` must exist. `event` must be one of
   the v1 wired set **`click`, `hover`, `leave`** — `tap`/`press` are NOT implemented in
   the player and are rejected by `validate` so a doc never claims behavior the runtime
   can't deliver.
2. **Input-condition form**: `"<input> <op> <value>"` where `op` is one of
   `< > <= >= == !=` (matched by scanning for the first occurrence of any of these
   substrings at index > 0) and `<input>` (everything before the operator, trimmed)
   must be a key of `doc.inputs`. `<value>` is a literal (number if it parses as one,
   otherwise a bare string) compared against the input's current value.

Classification logic (see `validate.ts::classifyOnKey`): the validator first scans for a
comparison operator; if found with a non-empty left-hand side, it's a condition. Otherwise
it looks for a `.` and treats it as pointer. A key matching neither is `"malformed"`.

Both forms' targets (`"idle"`, `"active"`, ...) must be defined states, or you get
`"... targeting undefined state ..."`.

### `machine.initial`
Must equal one of the keys in `machine.states`, or `"machine.initial ... is not a defined state"`.

## v0.1: groups

```ts
interface GlamGroup { id: string; x: number; y: number; }   // a Konva.Group
```

- `groups[].id` must be unique among groups, and must not collide with any `doc.nodes[].id`.
- Any node sets `group: "<groupId>"` to nest into it; `group` must reference a declared
  `groups[].id` or validate errors: `node "<id>" has "group" referencing undeclared group
  "<groupId>"`.
- A group's `x`/`y` are addressable exactly like a node's for `bind`/`set`/`loops`/`wander`
  purposes — moving the group moves every child with it.
- **Z-order:** groups are added to the scene layer before ungrouped nodes, so an ungrouped
  node always renders above every group regardless of `nodes` array order. To visually cover
  a group, put the covering node inside its own group declared earlier in `groups`.

## v0.1: loops (continuous motion)

```ts
interface GlamLoop {
  node: string;              // a node id OR a group id
  prop: string;              // numeric, animatable for that node's type (x,y,r,w,h,size,opacity,rotation,strokeWidth)
  from: number; to: number;
  ms: number;                // full round-trip period
  mode?: 'loop' | 'alternate'; // default 'loop'
  ease?: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut'; // default 'linear'
}
```

- `node` must reference an existing node id or an existing `groups[].id`.
- If `node` is a group, `prop` must be `x` or `y` (all a Konva.Group exposes) — any other
  prop is `loop on group "<id>" can only animate "x" or "y", got "<prop>"`.
- If `node` is a node, `prop` must be both animatable for that node's type AND numeric
  (`fill`/`stroke`/`text` are not loopable) — otherwise `loop targets non-animatable/non-numeric
  prop "<prop>" on node "<id>"`.
- `ms` must be `> 0` or `loop on "<node>" prop "<prop>" has non-positive "ms" (<ms>); must be > 0`.
- `mode: 'loop'` sawtooths `from → to` over `[0, ms]` and wraps; `mode: 'alternate'` triangle-waves
  `from → to → from`, peaking at `ms/2`. `ease` shapes the 0..1 phase before lerping `from`→`to`.
- A `loop` and a `bind`/`wander` may not both target the same `<node>.<prop>` — each would
  overwrite the other every frame; validate rejects the conflict: `conflict: "<node>.<prop>"
  is targeted by both a "bind"/"wander" and a "loop"`.
- Headless render / initial player frame: the resting value for a looped prop is `loop.from`.

## v0.1: wander (free drift)

```ts
interface GlamWander {
  target: string;   // a node id OR a group id
  cx: number; cy: number; rx: number; ry: number; // ellipse center + radii
  stepMs: number;   // ms per retarget
  ease?: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut'; // default 'easeInOut'
}
```

- `target` must reference an existing node id or `groups[].id` — otherwise `wander references
  missing node/group: "<target>"`.
- `stepMs`, `rx`, `ry` must each be `> 0` (same rationale as `loop.ms` — a non-positive value
  settles at the center forever instead of animating); each has its own
  `wander on "<target>" has non-positive "<field>" (<value>); must be > 0` error.
- A `wander` and a `loop` may not both target the same `<target>.x` or `<target>.y` — same
  conflict rule as loop/bind above.
- Headless render / initial player frame: the resting position is the ellipse center `(cx, cy)`.

## Machine `on` keys — third form: host events

Beyond the pointer form (`"<nodeId>.<event>"`) and input-condition form (`"<input> <op>
<value>"`), v0.1 adds:

3. **Event form**: `"@EVENTNAME"` (matches `/^@[A-Za-z0-9_]+$/`) — fires only when the host
   calls `player.send("EVENTNAME")`. Classified by `classifyOnKey` (checked first, before the
   dot-split/condition scan) and shared verbatim between `validate.ts` and the player's
   `machine.ts` so the two never drift.
   - `"INPUT"` is reserved: the player sends an internal `{ type: 'INPUT', inputs }` event on
     every `setInput()` call. An authored `"@INPUT"` on-key is rejected: `state "<s>" has
     "on.@INPUT", but "INPUT" is reserved for the internal input-condition event`.
   - Otherwise an event on-key needs no node/input to exist — only its transition target must
     be a defined state, same as any other `on` key.

## Expression language (`evalExpr` / `evalCondition`, `src/expr.ts`)

A hand-written recursive-descent parser — deliberately not arbitrary JS:

- Literals: numbers (`20`, `0.5`).
- Identifiers: read from the scope (`inputs` for binds, or the values passed to `evalCondition`).
- Operators: `+ - * /`, unary `+`/`-`, parentheses. No `^`, no comparison operators inside
  `evalExpr` itself (those belong to `evalCondition`'s condition-string parsing, not the
  expression grammar).
- Whitelisted functions only: `lerp(a, b, t)` = `a + (b-a)*t`; `clamp(x, lo, hi)`; `min(...)`;
  `max(...)`; `abs(x)`. Any other identifier called as a function, or referenced as a bare
  identifier not present in scope, throws.

`evalCondition(cond, inputs)` parses `"<input> <op> <value>"` — same operator set as the
`on`-key condition form — reads `<input>` from the `inputs` map, coerces `<value>` to a
number if it parses as one (else compares as a string), and returns a boolean via `<, >,
<=, >=, ==, !=`.

## Full list of semantic errors `validate()` can produce

1. `duplicate node id: "<id>"`
2. `bind references missing node: "<id>"`
3. `bind targets non-animatable prop "<prop>" on node "<id>"`
4. `machine.initial "<name>" is not a defined state`
5. `state "<s>" has "on.<key>" targeting undefined state "<target>"`
6. `state "<s>" has "on" key referencing missing node "<id>"` (pointer form)
7. `state "<s>" has "on" key with unknown event "<event>" (allowed: click, hover, leave)`
8. `state "<s>" has "on" condition referencing unknown input "<input>"` (condition form)
9. `state "<s>" has malformed "on" key "<key>"` (neither form parses)
10. `state "<s>" has malformed "set" key "<key>"` (no `.`)
11. `state "<s>" has "set" targeting missing node "<id>"`
12. `state "<s>" has "set" targeting non-animatable prop "<prop>" on node "<id>"`

v0.1 additions:

13. `duplicate group id: "<id>"`
14. `group id "<id>" collides with a node id`
15. `node "<id>" has "group" referencing undeclared group "<groupId>"`
16. `loop references missing node/group: "<id>"`
17. `loop on group "<id>" can only animate "x" or "y", got "<prop>"`
18. `loop targets non-animatable/non-numeric prop "<prop>" on node "<id>"`
19. `loop on "<id>" prop "<prop>" has non-positive "ms" (<ms>); must be > 0`
20. `wander references missing node/group: "<id>"`
21. `wander on "<id>" has non-positive "stepMs"/"rx"/"ry" (<value>); must be > 0`
22. `conflict: "<id>.<prop>" is targeted by both a "bind"/"wander" and a "loop"`
23. `state "<s>" has "on.@INPUT", but "INPUT" is reserved for the internal input-condition event`

Plus whatever `parseDoc`/zod reports for structural issues (wrong `schema` literal, missing
required fields, wrong types) — these come back as `path: message` strings and short-circuit
before any semantic check runs.

## Example (from `glam new`)

See `packages/cli/src/commands/new.ts` / any file produced by `glam new` — a two-node
(orb circle + bar rect) doc with a `progress`-bound bar width and an `idle`/`active`
click-toggle machine on the orb. Also embedded in the design spec §4.
