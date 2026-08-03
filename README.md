# Glamour

**An AI-native format + runtime for interactive, animated canvases.**

Glamour is what Rive and Lottie are — a document you can share that plays an interactive vector
animation — but the document is designed *from the ground up so an LLM (Claude) is the primary
author*. Rive's `.riv` is binary; Lottie is opaque After-Effects export JSON; neither can be
reliably written by an AI. A `.glam` file is small, fully named, and prompt-sized, so Claude
composes interactive animations instead of guessing at them.

> A *glamour* is a medieval spell that casts a living illusion on the eye.

## Documentation

- **[Using Glamour](docs/USING-GLAMOUR.md)** — getting started: author a `.glam`, verify it, and embed
  it in a real project (three paths), plus how an AI agent authors one.
- **[Testing behavior](docs/TESTING-BEHAVIOR.md)** — the drive-and-assert harness: exercise an
  interactive glamour headlessly (full drags, mid-drag "half go", inputs, loops) and assert outcomes.
- **[Decisions](docs/DECISIONS.md)** — durable decision records (toolchain = pnpm; packaging &
  publishing). Read before changing the toolchain or publishing.
- **[Format reference](skills/cast-glamour/reference/schema.md)** — the full `glamour/v0` schema.
- **[Primitive palette](skills/cast-glamour/reference/palette.md)** — the composable motion primitives.

## The four surfaces

One document (`.glam`), several ways to author and play it:

| Surface | What it is |
|---|---|
| **`@glam/core`** | Headless engine — the format, `validate`, `applyOps`, headless `renderToPNG`, the env-agnostic scene+machine builder. The only unit with real logic. |
| **`@glam/player`** | Browser runtime — `renderGlamour(doc, mount)`, `<glam-canvas>` web-component, self-contained HTML export, and `createHarness(doc)` for headless drive-and-assert testing. What ships with a shared glamour. |
| **`@glam/react`** | React wrapper — a `<Glamour doc={…} onEmit onStroke onPointer />` component + an imperative handle (`send`/`setInput`/`play`/`pause`). The idiomatic embed for a React host. |
| **`glam` CLI** | `glam new / validate / render / preview`. The self-verify loop lives here. |
| **`@glam/mcp`** | MCP server — the core operations as tools, so any MCP client can author `.glam` files. |
| **`cast-glamour` skill** | The authoring knowledge for Claude Code: schema + palette + the self-verify loop. |
| **Studio** (`apps/studio`) | Visual playground — JSON editor + live preview + input controls + palette. |

## The `.glam` format

```json
{
  "schema": "glamour/v0",
  "canvas": { "w": 640, "h": 300, "bg": "#12151b" },
  "inputs": { "progress": 0 },
  "nodes": [
    { "id": "orb", "type": "circle", "x": 200, "y": 150, "r": 48, "fill": "#4c7dff" },
    { "id": "bar", "type": "rect",   "x": 300, "y": 170, "w": 20, "h": 10, "fill": "#5ad67d" }
  ],
  "bind":    [ { "node": "bar", "prop": "w", "expr": "lerp(20, 220, progress)" } ],
  "machine": {
    "initial": "idle",
    "states": {
      "idle":   { "set": { "orb.r": 48, "orb.fill": "#4c7dff" }, "on": { "orb.click": "active" } },
      "active": { "set": { "orb.r": 72, "orb.fill": "#ff9f43" }, "on": { "orb.click": "idle" } }
    },
    "transition": { "ms": 250, "ease": "easeOut" }
  }
}
```

- **Everything is named** — no opaque indices.
- `on` keys are `node.event` (pointer: `click`/`hover`/`leave`) or an input condition (`"progress > 0.5"`).
- `set` targets are `node.prop`. `bind` expressions are a tiny safe vocabulary (`lerp`, `clamp`, arithmetic).
- The runtime is *timelines + an XState statechart fed by named inputs* — pointer listeners and host
  code both feed those inputs. Built on Konva (render + hit-testing) and XState (statechart).

## Quickstart

> **Node 20 required.** The native `canvas` dependency (headless render) is built for the Node 20
> ABI. This repo pins it via `.nvmrc`; run `nvm use` (or `nvm install`) first.

This repo uses **pnpm** (npm also works — the `*` workspace specs link locally under both).

```bash
nvm use                 # → Node 20.19.4
pnpm install            # builds native canvas (pre-approved via pnpm-workspace.yaml)
pnpm build
pnpm test               # all tests across every surface
pnpm --filter @glam/studio dev   # the visual Studio
```

## The `glam` CLI

The whole authoring + self-verify loop is four commands. `glam` is a global wrapper
(`~/.local/bin/glam`) that runs the built CLI under Node 20; from a fresh checkout you can
also call `node packages/cli/dist/cli.js <cmd>`.

| Command | What it does |
|---|---|
| `glam new <file.glam>` | write a starter `.glam` to edit from |
| `glam validate <file.glam>` | check the doc against the schema + every semantic rule; prints `ok` / names the offending node/state/bind |
| `glam render <file.glam> -o <out.png>` | headless-render the **resting frame** to a PNG (look at it — the self-verify loop) |
| `glam preview <file.glam>` | serve a live, interactive page (real pointer/drag behavior) at a printed URL |

```bash
glam new my.glam
glam validate my.glam
glam render my.glam -o my.png     # then open my.png and check it
glam preview my.glam
```

## Testing behavior (drive-and-assert)

Because the runtime is drivable and inspectable, you can exercise an interactive glamour
**the way a user would — including mid-interaction — and assert the result**, headlessly.
This is what a binary format (Rive) can't give an AI: *drive it → freeze it → check it*.

```ts
import { createHarness } from '@glam/player';
const h = createHarness(doc);
const e = h.stroke([[10,10],[55,55],[100,100]]); // full drag → e.match.score
h.dragTo([[10,10],[55,55]]);                       // "half go": stop mid-drag…
h.node('ink').points;                              // …and inspect the in-progress state
h.setInput('progress', 1); h.send('RESET'); h.tick(500);
```

Everything **objective** — trace scores, ink accumulation, machine/state, binds, `loops` —
is automatable and self-guarding. Only *feel* (smooth / stuck / floaty) still needs a device.
Full guide: **[Testing behavior](docs/TESTING-BEHAVIOR.md)**.

## The self-verify loop

The reason "AI authors it" actually works: every authoring path (CLI, MCP, skill) **validates and
renders** what it produces. Claude writes a `.glam`, runs `glam validate` then `glam render`, and
*looks at the PNG* — it never ships a glamour it hasn't seen render. "Do it with proof" is
structural, not a promise.

## Status

**v1** — vector + text, the full state-driven interaction model (pointer + inputs + state machine),
and all six surfaces. Spike-proven before the build (`docs/superpowers/spikes/`).

**v0.1 — living canvas** (additive over v1; the first rung toward covering Rive-class interactions):
- **`loops`** — continuous auto-playing motion (`mode: loop | alternate`), on a node or a group's x/y.
- **`wander`** — free drift to random points in an ellipse (a node or group).
- **`groups`** — a `Konva.Group` (`node.group`) so several nodes move as one.
- **Host API** — the player is now *driven and listened to* like the Rive runtime: `player.send('EVENT')`
  (host commands a state, via machine `@EVENT` on-keys), `player.on(cb)` (host hears a `node.emit` click),
  `play` / `pause`. **The host app keeps the logic** (scoring, correctness) — Glamour owns motion + input.

**v1.1 — paint + shape enrichment** (the fidelity axis + the logged format gaps):
- **node types** — `ellipse` (rx/ry), `arc` (innerRadius/outerRadius/angle — smooth sweeping rings).
- **paint** — `fillGradient` (linear + radial), glow/shadow (`shadowColor`/`Blur`/`Opacity`/`Offset`),
  rect `cornerRadius`, text `fontStyle` (bold/italic).
- **easing** — `backInOut` (spring) + `elasticOut` (bounce). Radius-family props are clamped to ≥0 so
  the overshoot can't produce an invalid canvas radius.

**Rung 2 — input + ink** (the alphabet-trace capability class):
- **`stroke` node** — a polyline; used for both static guide paths and live ink.
- **`ink` block** — `{ into, emit?, match? }`: the canvas owns the live ink (a drag draws into the
  `into` stroke node); the host owns the verdict.
- **host API** — `player.onPointer(cb)` (raw down/move/up stream) and `player.onStroke(cb)` (fires on
  stroke end with the drawn points and, when `ink.match` is set, a **`traceMatch` score** —
  coverage/stray/startOk/endOk/score). The host picks the pass threshold; scoring stays in the host.

**Mission acceptance test — passed:** a v0.1 glamour was authored end-to-end by *describing* it to the
AI skill (`examples/ai-authored/crab.glam`), then embedded in a real React app
(`examples/react-crab`) with **all scoring/timer logic in React** — the engine drives, the host scores.

Deferred: image→animation, raster/sprite + halftone texture (the orb's last polish), keyboard +
collision + spawning (Rung 3), WebGL.

Docs: [Roadmap / what's next](docs/ROADMAP.md) · [Using Glamour](docs/USING-GLAMOUR.md) · [Decisions](docs/DECISIONS.md) ·
plans under `docs/superpowers/plans/` · proof sketches in `sketches/` (progress-ring, toggle, crab-game,
orb, **trace-letter**).
