---
name: cast-glamour
description: Author and verify glamour/v0 interactive canvas documents (.glam) — vector+text scenes with pointer/input/state-machine behavior — using the @glam/core format and the glam CLI.
---

# cast-glamour

Glamour (`.glam`, schema `glamour/v0`) is a small, fully-named JSON format for
interactive animated canvases — vector shapes + text, driven by pointer
events, host inputs, and a state machine. It is designed to be prompt-sized
and composed, not hand-derived: build documents from the primitive palette
below, then validate and render before calling anything done.

## 0. Interactive? Spec before you build.

Most glamours worth making are *interactive* — pointer, drag, input, state
machine, ink. For those, the format (the rest of this skill) is the easy part;
the hard part is the **interaction model**, and getting it wrong is what burns
rounds. Before writing any `nodes`:

**A reference video/design shows the _look_ and a _canned demo_ — never the
_input model_.** What the user's finger does, how many modes exist, what "done"
means: none of that is in the pixels. Treat interaction as unknown → **ask,
don't infer.**

**Write a ~20-line interaction spec and get it confirmed — this is a gate, not a note:**
- **Modes** — more than one (e.g. easy/hard)? what distinguishes them?
- **Input model per mode** — what does the user *do* (drag a handle / freehand
  trace / tap / scrub)? Does the mark **snap to a path** or go free? Is it **scored**?
- **Phase-by-phase** — grab → move → snap/advance → complete → reset; what
  happens at each, and what leaves ink vs. only guides.
- **Guide timing** — when each cue appears / flips / hides (arrow direction,
  per-stroke reveal, celebration).
- **Geometry & palette source-of-truth** — shape coords; and *when a video and
  a design disagree, state which one wins.*

**Feel is unfalsifiable by you.** You can validate + render frames, but you
cannot feel "stuck," "floaty," or "auto-completes too early" — only the user,
on a device, can. Serve it (`glam preview`, or the host page over Tailscale for
mobile) and hand it to the user from the **first** build, not the tenth. Budget
1–2 device rounds for feel-tuning as normal, not failure.

The format loop (§4) proves the doc is *well-formed*; only a device + the user
prove it *feels right*.

## 1. The schema (`glamour/v0`)

```ts
type NodeType = 'circle' | 'rect' | 'text';

interface GlamNode {
  id: string; type: NodeType;
  x: number; y: number;
  r?: number;                        // circle only
  w?: number; h?: number;            // rect only
  text?: string; size?: number;      // text only
  fill?: string; stroke?: string; strokeWidth?: number;
  opacity?: number; rotation?: number;
}

interface GlamBind { node: string; prop: string; expr: string; }

interface GlamState {
  set?: Record<string, number | string>;   // "<nodeId>.<prop>": value
  on?: Record<string, string>;             // "<nodeId>.<event>" | "<input> <op> <value>" -> target state
}

interface GlamMachine {
  initial: string;
  states: Record<string, GlamState>;
  transition?: { ms: number; ease?: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' };
}

interface GlamDoc {
  schema: 'glamour/v0';
  canvas: { w: number; h: number; bg?: string };
  inputs?: Record<string, number | string>;
  nodes: GlamNode[];
  bind?: GlamBind[];
  machine?: GlamMachine;
}
```

**Addressing rules** (this is the whole moat — learn these, not much else):
- `bind[].node` / `set` / pointer `on` keys all address a node as `<nodeId>.<prop>`.
- Animatable props per node type: circle → `x y fill stroke strokeWidth opacity rotation r`; rect → same common set + `w h`; text → same common set + `text size`.
- Pointer `on` keys: `"<nodeId>.<event>"` where event is **one of `click`, `hover`, `leave`** — this is the full v1 wired set (`tap`/`press` are not implemented; `validate` rejects them).
- Input-condition `on` keys: `"<input> <op> <value>"` with op ∈ `< > <= >= == !=`, `<input>` an existing key in `doc.inputs`.
- `bind.expr` / condition values: numbers, `+ - * /`, parens, identifiers from `inputs`, and functions `lerp(a,b,t)`, `clamp(x,lo,hi)`, `min(...)`, `max(...)`, `abs(x)`. No arbitrary JS.
- **Coordinate anchoring differs by shape** (easy to get wrong — get it right and parts land where you expect): `circle`/`ellipse`/`arc` are anchored at their **center** (`x,y` is the middle); `rect` and `stroke`/`text` use the **top-left** origin. A node with `group: "<id>"` has coords **relative to that group's** `x,y`, not the canvas. So a crab's leg at group-local `(20, 40)` sits at `groupX+20, groupY+40` on the canvas.

## 2. Primitive palette (`@glam/core` `palette` + `listPrimitives()`)

Pull these live with `node -e "console.log(require('@glam/core').listPrimitives())"` (or `import { listPrimitives } from '@glam/core'`) if this doc ever drifts from the source. As of writing:

| Primitive | Signature | Does |
|---|---|---|
| `hoverGrow` | `hoverGrow(id: string, by = 60): Op[]` | Adds `idle`/`hover` states; node's `r` becomes the **absolute** value `by` on hover (default 60), reverts on leave. `by` is a target, not a delta. |
| `clickToggle` | `clickToggle(id: string, a: Partial<GlamNode>, b: Partial<GlamNode>): Op[]` | Adds `idle`/`active` states holding prop-sets `a`/`b`; click toggles between them. |
| `progressBar` | `progressBar(id: string, input: string): Op[]` | Adds a binding: node's `w` = `lerp(20, 220, <input>)`. |
| `fadeIn` | `fadeIn(id: string): Op[]` | Adds a `visible` state (`opacity: 1`) as machine initial; fade rides the transition tween. |

Each returns an `Op[]` for `applyOps(doc, ops)` (from `src/ops.ts`): `addNode`, `removeNode`, `setProps`, `setInput`, `defineState`, `setInitial`, `addBinding`. `applyOps` is pure — never mutates the input doc.

See `reference/palette.md` for full call examples and `reference/schema.md` for the deep schema reference (every validation rule).

## 3. Authoring recipe

1. **Start from a starter file**, don't hand-roll from scratch:
   ```
   glam new /tmp/my-scene.glam
   ```
   (`glam` is a global wrapper → the built repo CLI on Node 20; see §4 if it reports a missing build.)
2. **Compose with the palette** where a pattern matches (hover, toggle, progress, fade). Write a small script that does `applyOps(doc, palette.hoverGrow('orb'))` etc., or hand-edit the JSON directly using the addressing rules in §1 — both are valid, palette composition is preferred for the four covered patterns.
3. **Hand-write `nodes` / `machine` / `bind`** for anything outside the palette, following §1's addressing rules exactly. Keep `machine.initial` pointed at a real state; keep every `on` target a real state name.
4. **Run the self-verify loop (§4) — mandatory, every time.**

## 4. THE MANDATORY SELF-VERIFY LOOP

Never hand back a `.glam` that hasn't been validated and rendered. This is not optional polish — it is the acceptance ritual for anything this skill produces.

> **The `glam` command** is a global wrapper (`~/.local/bin/glam`) that runs the built CLI from
> `~/Project/glamour` under Node 20 (the native `canvas` ABI) — so it works from any directory, no
> PATH juggling. If `glam` errors that a build is missing, build the repo once:
> ```
> cd ~/Project/glamour && pnpm build
> ```

Then, for every `.glam` you write or edit:
```
glam validate <file.glam>
glam render   <file.glam> -o /tmp/glam-preview.png
```
- `validate` must print `ok` and exit 0. If it doesn't, the stderr lines name the exact offending node/state/bind — fix and re-run, don't guess.
- `render` must produce a PNG file. Read it back (image tool / file size / PNG magic bytes `89 50 4E 47`) and actually look at it — confirm the shapes, colors, and layout match intent before calling the work done.
- Optional: `glam preview <file.glam>` serves a live interactive page (`glam-canvas` + UMD player) at a printed URL for a human/browser-QC check of pointer behavior. Close it when done — don't leave dev servers running.

If validate or render fails, that is the loop working as intended: fix the doc and re-run both steps until they pass. Deliver the file path (and PNG path if rendered) only after this passes.

## 5. v0.1 — living canvas

`glamour/v0.1` is additive over v0 (every v0 doc stays valid unchanged; just use
`schema: "glamour/v0.1"` to unlock the new fields). It grows the format from
state-driven animation into an interactive *canvas*: continuous motion, free
drift, node grouping, and a host-driving API. Full shapes + validation rules in
`reference/schema.md`; the summary here is what to actually reach for.

**`groups` + `node.group` (nesting).** `doc.groups: { id, x, y }[]` declares a
Konva-style group at an absolute position; any node opts in via `node.group:
"<groupId>"`. A group's own `x`/`y` can be bound/set/looped/wandered like a
node's — moving it slides every child with it (e.g. a whole face).

> **Z-order trap:** groups are painted first, then ungrouped nodes — so an
> **ungrouped node always paints above every group**, regardless of where it
> sits in the `nodes` array relative to the group's declaration. If something
> needs to visually cover a group (e.g. a "modal" rect over a wandering face),
> put that covering node in its own group declared earlier — an ungrouped
> node can't be layered *under* a group no matter how you order `nodes`.

**`loops` (continuous motion).** `doc.loops: { node, prop, from, to, ms, mode?,
ease? }[]` drives one numeric prop back and forth forever, no host input
needed. `node` can be a node id OR a group id (group loops are restricted to
`x`/`y` — that's all a Konva.Group exposes). `ms` is the **full round-trip
period**. `mode: "loop"` (default) sawtooths `from → to` and wraps; `mode:
"alternate"` ping-pongs `from → to → from`, peaking at `ms/2`. Use `alternate`
for back-and-forth motion (a crab pacing), `loop` for wrap-and-repeat (a
progress ring).

**`wander` (free drift).** `doc.wander: { target, cx, cy, rx, ry, stepMs, ease?
}[]` makes a node or group drift to random points inside an ellipse centered
at `(cx, cy)` with radii `rx`/`ry`, retargeting every `stepMs`. Good for
"alive but idle" motion — an orb's face wandering while waiting for input.
`target` is a node id or group id, same rule as `loops`.

**Host events — `@EVENT` on-keys.** A machine state's `on` map gains a third
key form (beyond `<nodeId>.<event>` and `<input> <op> <value>`): `"@EVENTNAME"`
— fires only when the host calls `player.send("EVENTNAME")`, never from
pointer/input activity. Event names are host-chosen strings; **`INPUT` is
reserved** (the player sends it internally on every `setInput()`) — an
authored `"@INPUT"` on-key is a validation error.

**`node.emit` + the host API.** Give a node `emit: "someEvent"` and a click on
it fires that name to every `player.on(cb)` listener — *in addition to* any
machine transition the same click also causes. This is the seam between
Glamour and the host app:

- **Glamour owns the interactive canvas** — shapes, continuous motion, pointer
  hit-testing, state visuals.
- **The host app owns the logic** — scoring, correctness, game rules. It never
  lives inside the `.glam` doc.
- The host drives Glamour via `player.send("EVENT")` (fire an `@EVENT` on-key)
  and `player.setInput(name, value)` (drive input-condition transitions /
  bindings); it listens via `player.on(cb)` for `emit`s bubbling up from
  clicks on the canvas.
- `player.play()` / `player.pause()` start/stop the loops+wander run-loop
  (no-op if the doc has neither); `player.getState()` still reports the
  current machine state name.

Concretely: a crab-catching game's `crab.glam` loops the crab back and forth
(`loops`, `mode: "alternate"`) and sets `emit: "pick"` on it; the host's React
code calls `player.on(e => { if (e.event === 'pick') scoreIt() })` — Glamour
never knows what "scoring" means, it just reports the click.

**Validate guards to respect** (get these right and `glam validate` won't
surprise you):
- `loop.ms > 0` — a non-positive period never advances (validate rejects it
  rather than shipping a dead loop).
- `wander.stepMs > 0`, `wander.rx > 0`, `wander.ry > 0` — same rationale;
  a non-positive value would silently settle at the ellipse center forever.
- No `loop` and `bind`/`wander` targeting the **same node+prop** — they'd
  fight every frame (each overwrites the other); validate refuses the doc.
- `node.group` must reference a declared `groups[].id`; group ids can't
  collide with node ids.

**Self-verify note for v0.1 docs:** `glam render` always shows the **resting**
frame — loops sit at `from`, wander sits at its ellipse center `(cx, cy)` —
because a still PNG has no time axis to animate along. That's expected, not a
bug: continuous motion only actually runs inside the live player
(`renderGlamour`/`glam preview`). Validate + render still prove the doc is
well-formed and the resting composition looks right; to see the motion itself,
use `glam preview` and watch it in a browser.

## 6. v1.1 — paint + shape (fidelity)

Additive over v0.1 (still `schema: "glamour/v0.1"`). This is the *how it looks* axis — reach for these
when a flat solid-fill circle won't read as the reference (e.g. a glowing gradient orb).

**New node types.**
- `ellipse` — `{ type: "ellipse", x, y, rx, ry }`. Center-anchored oval (soft eyes, squashed shapes).
- `arc` — `{ type: "arc", x, y, innerRadius, outerRadius, angle }`. A ring/wedge; `angle` is degrees.
  Bind or loop `angle` for a **smooth sweeping progress ring** (what the segmented-dots ring wanted).

**Paint on any node.**
- `fillGradient` — a declarative gradient, overrides flat `fill`. Points are in the node's LOCAL space
  (center for circle/ellipse/arc, top-left for rect):
  - linear: `{ type: "linear", from: {x,y}, to: {x,y}, stops: [{offset,color}, …] }` (needs `to`; `from` defaults to origin).
  - radial: `{ type: "radial", center?: {x,y}, startRadius?, endRadius, stops: [...] }` (needs a positive `endRadius`).
  - stops: ≥2, each `offset` in 0..1, ascending. A degenerate/backwards gradient is a validate error.
- glow/shadow — `shadowColor` (required to paint any shadow), `shadowBlur`, `shadowOpacity`,
  `shadowOffsetX`, `shadowOffsetY`. `shadowBlur`/`shadowOpacity` are animatable (a breathing glow).
- `rect` gains `cornerRadius` (rounded cards/tracks/buttons).
- `text` gains `fontStyle`: `"normal" | "bold" | "italic" | "italic bold"`.

**New easings** (anywhere `ease` is accepted — loops, wander, machine transition): `backInOut`
(spring anticipation+overshoot) and `elasticOut` (bounce-and-settle). They intentionally overshoot the
0..1 range; radius-family props clamp to ≥0 automatically so an overshoot can't crash the canvas.

## 7. Rung 2 — input + ink (tracing)

The capability class for **drag-to-draw / trace-the-letter** (still `schema: "glamour/v0.1"`).

**`stroke` node** — `{ type: "stroke", x, y, points: [x0,y0,x1,y1,…], stroke, strokeWidth, tension?, closed? }`.
A polyline. Use it two ways: a **static guide** (give it the target `points`, faint color) and a
**live ink surface** (start with `points: []`, the player fills it as the user drags).

**`ink` block (doc-level)** — makes the canvas drawable:
```ts
ink?: {
  into: string;        // id of the `stroke` node the drag inks into
  emit?: string;       // host event name fired on stroke end
  match?: { target: number[]; tolerance: number };  // flat [x,y,…] path (ink-node-LOCAL coords) + px tolerance
}
```
On pointer drag, the player draws into `into` live; on release it fires `emit` to `player.onStroke(cb)`
listeners with `{ event, points, match? }`. When `ink.match` is set, `match` is a **trace score**:
`{ coverage, stray, startOk, endOk, score }` (all 0..1 / booleans). **The host picks the pass
threshold and scores** — the doc only draws + reports (mission rule).

**Player host API additions:** `player.onPointer(cb)` — raw `{ type: 'down'|'move'|'up', x, y }` stream
in canvas coords; `player.onStroke(cb)` — the completed-stroke event above. Both return an unsubscribe fn.

Concretely: `sketches/trace-letter/` — a grey guide "Λ", a drawable ink line, `ink.match` = the letter
path; the HTML host reads `onStroke(e => e.match.score)` and shows pass/try-again. Scoring lives in the
host, not the glamour.

## 8. Guided ink (drag a handle along a path)

The **general** guided-trace capability (still `schema: "glamour/v0.1"`) — not
letter-specific. The user grabs a handle and drags it *along an authored `path`*;
the player trims a single `into` stroke to how far they've pulled (perfect,
snapped ink) and reports progress. Works for any shape (letter, number, check,
signature).

```ts
guided?: {
  strokes: { path: number[]; into: string; handle?: string; arrow?: string }[]; // >= 1, drawn in order
  grab?: number;   // px radius to grab the handle (default 44)
  emit?: string;   // host event fired when a stroke completes
}
```

The player owns the **mechanics**: grab within `grab` px of the tip; progress by
a short forward-arc projection (monotonic — no leap onto an overlapping return
pass); `into.points` trimmed to the tip; `handle` moved to the tip; `arrow`
rotated to the path's **tangent** (so "down, then up, then over" comes from the
path, not a hardcoded hint); forgiving release (stays where you stop; completes
only at the end); per-stroke advance. The host owns **presentation** (reveal the
next stroke's guide, celebrate, reset) via `player.onGuided(cb)` →
`{ index, progress, done }` and the `emit`. Same motion-vs-logic split as `ink`.

Difference from §7 `ink`: `ink` is *free-draw* (+ optional `traceMatch` scoring);
`guided` is *snapped* drag-along-a-fixed-path. A doc uses one or the other.

Worked example: `examples/guided/check.glam` (a checkmark). Behavior is covered
headlessly by `packages/player/test/guided.test.ts` (full go, half go, wrong-way,
multi-stroke) — see [Testing behavior](../../docs/TESTING-BEHAVIOR.md).

## 9. References

- `reference/schema.md` — full type reference + every semantic validation rule for v0/v0.1 (the v1.1 + Rung 2 additions are summarized in §6/§7 above; `packages/core/src/{schema,validate}.ts` is the source of truth).
- `reference/palette.md` — palette call signatures with worked before/after examples.
- `examples/*.glam` — worked examples (v0: hover-grow button, progress bar bound to an input, click-toggle; v0.1: `orbit-loop.glam` — a loop + a group + wander) — all pass `validate` and `renderToPNG`; see `test/examples.test.ts`.
- Embedding in React: `@glam/react` exposes `<Glamour doc onEmit onStroke onPointer />` + an imperative handle (`send`/`setInput`/`play`/`pause`/`getState`); see `examples/react-crab/` for a real host that keeps scoring in React.
