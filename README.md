# Glamour

**An AI-native format + runtime for interactive, animated canvases.**

Glamour is what Rive and Lottie are — a document you can share that plays an interactive vector
animation — but the document is designed *from the ground up so an LLM (Claude) is the primary
author*. Rive's `.riv` is binary; Lottie is opaque After-Effects export JSON; neither can be
reliably written by an AI. A `.glam` file is small, fully named, and prompt-sized, so Claude
composes interactive animations instead of guessing at them.

> A *glamour* is a medieval spell that casts a living illusion on the eye.

## Install

There are two audiences here, and they need different things. Deciding which one you are is the
whole of the setup:

**Playing a `.glam` in an app** — you need the runtime, and nothing else. No CLI, no browser
download, no AI tooling.

```bash
pnpm add @glamour-labs/react      # React hosts — pulls @glamour-labs/player + @glamour-labs/core
pnpm add @glamour-labs/player     # any other browser host (vanilla, web component, Vue, Svelte)
```

`@glamour-labs/react` ships with `'use client'`, so it drops straight into a Next.js App Router project.
See **[Using Glamour](docs/USING-GLAMOUR.md)** for the embed paths, including a self-contained
`<script>` build with no bundler at all.

**Authoring a `.glam`** — you need the CLI, which is a separate, global install:

```bash
npm install -g @glamour-labs/cli
glam doctor                  # says whether this install can render, and what's missing if not
```

`new`, `validate` and `preview` work immediately. `render` — the visual half of the self-verify
loop — additionally needs a real browser, because the renderer is WebGL2 and Node has no
in-process rasterizer for it:

```bash
npm install -g playwright && npx playwright install chromium
```

That's deliberately opt-in: a React app embedding a glamour should never pay for a 300MB Chromium
download it will never use. Run `glam doctor` any time `render` fails — it names the failing
prerequisite and the exact command that repairs it, and exits `3` (environment) rather than `1`
(bad document) so scripts and agents can tell the two apart.

For AI authoring — describing a glamour in prose and having Claude write it — see
**[the cast-glamour skill](skills/cast-glamour/)**.

## Documentation

- **[Alphabet tracing](examples/alphabet/README.md)** — the largest worked example: 208 generated
  documents (26 letters × case × difficulty × two worksheet aesthetics) and a playable game, with
  every letterform traceable to a real handwriting curriculum.
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
| **`@glamour-labs/core`** | Headless engine — the format, `validate`, `applyOps`, headless `renderToPNG`, the env-agnostic scene+machine builder. The only unit with real logic. |
| **`@glamour-labs/player`** | Browser runtime — `renderGlamour(doc, mount)`, `<glam-canvas>` web-component, self-contained HTML export, and `createHarness(doc)` for headless drive-and-assert testing. What ships with a shared glamour. |
| **`@glamour-labs/react`** | React wrapper — a `<Glamour doc={…} onEmit onStroke onPointer />` component + an imperative handle (`send`/`setInput`/`play`/`pause`). The idiomatic embed for a React host. |
| **`glam` CLI** | `glam new / validate / render / preview`. The self-verify loop lives here. |
| **`@glamour-labs/mcp`** | MCP server — the core operations as tools, so any MCP client can author `.glam` files. |
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
  code both feed those inputs. Built on a hand-written WebGL2 renderer (drawing + hit-testing)
  and XState (statechart). See [docs/V2-RENDERER.md](docs/V2-RENDERER.md).

## Working on this repo

> This section is for developing Glamour itself. To *use* it, see [Install](#install) above.

> **No Node version pin.** v2 dropped the native `canvas` package along with Konva, so the
> Node-20 ABI constraint is gone. Headless render drives a real headless Chromium instead —
> install it once with `npx playwright install chromium`.

This repo uses **pnpm** (npm also works — the workspace specs link locally under both).

```bash
pnpm install
npx playwright install chromium   # once — headless render + the browser test project
pnpm build
pnpm test               # all tests across every surface (node + real-Chromium projects)
pnpm --filter @glamour-labs/studio dev   # the visual Studio
pnpm playground                  # static server for the example pages
```

Then open <http://localhost:4321/examples/alphabet/> for the alphabet tracing game, or
<http://localhost:4321/examples/playground/> for every sketch on one page.

## The `glam` CLI

The whole authoring + self-verify loop is five commands. Install it with
`npm install -g @glamour-labs/cli`; from a source checkout you can also call
`node packages/cli/dist/cli.js <cmd>`.

| Command | What it does | Needs a browser? |
|---|---|---|
| `glam new <file.glam>` | write a starter `.glam` to edit from | no |
| `glam validate <file.glam>` | check the doc against the schema + every semantic rule; prints `ok` / names the offending node/state/bind | no |
| `glam render <file.glam> -o <out.png>` | headless-render the **resting frame** to a PNG via headless Chromium, ~1–2s (look at it — the self-verify loop) | **yes** |
| `glam preview <file.glam>` | serve a live, interactive page (real pointer/drag behavior) at a printed URL | no |
| `glam doctor` | report each render prerequisite and the exact command that fixes it | — |

```bash
glam new my.glam
glam validate my.glam
glam render my.glam -o my.png     # then open my.png and check it
glam preview my.glam
```

**Exit codes** are load-bearing, because the most common failure is an environment problem being
mistaken for a document problem:

| Exit | Meaning | Reaction |
|---|---|---|
| `0` | passed | continue |
| `1` | the document is wrong | fix the `.glam`; stderr names the node/state/bind |
| `3` | the environment can't render | `glam doctor`, then install what it names — **don't touch the document** |

## Testing behavior (drive-and-assert)

Because the runtime is drivable and inspectable, you can exercise an interactive glamour
**the way a user would — including mid-interaction — and assert the result**, headlessly.
This is what a binary format (Rive) can't give an AI: *drive it → freeze it → check it*.

```ts
import { createHarness } from '@glamour-labs/player';
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
- **`groups`** — a positioned group (`node.group`) so several nodes move as one.
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

**Alphabet tracing** (the capability class end-to-end): the whole English alphabet as a playable
game — `examples/alphabet/`. One glyph dataset (52 hand-authored skeletons on a four-line band
system, stroke order cross-checked against Zaner-Bloser / HWT / D'Nealian / UK schemes) generates
208 documents across two worksheet aesthetics. EASY uses the native `guided` block; HARD uses
`ink` + `match`. Guards: every document validates, and a test asserts the committed files match
the generator.

Docs: [Roadmap / what's next](docs/ROADMAP.md) · [Using Glamour](docs/USING-GLAMOUR.md) · [Decisions](docs/DECISIONS.md) ·
[Publishing](docs/PUBLISHING.md) ·
plans under `docs/superpowers/plans/` · proof sketches in `sketches/` (progress-ring, toggle, crab-game,
orb, **trace-letter**).

## Packages

All published from this repo under the `@glamour` scope:

| Package | What it's for |
|---|---|
| [`@glamour-labs/core`](packages/core) | the format, `validate`, `applyOps`, the scene + machine builder |
| [`@glamour-labs/player`](packages/player) | browser runtime, web component, inline-HTML export, test harness |
| [`@glamour-labs/react`](packages/react) | the `<Glamour>` component (client-only, `'use client'`) |
| [`@glamour-labs/cli`](packages/cli) | the `glam` binary — `new` / `validate` / `render` / `preview` / `doctor` |
| [`@glamour-labs/mcp`](packages/mcp) | MCP server, so any MCP client can author `.glam` files |

## Contributing

Issues and pull requests are welcome. Fork the repo, branch, and open a PR — every change needs
`pnpm build && pnpm test` green, and anything touching the renderer needs the parity gate against
the v1 pixel oracle (see [docs/V2-RENDERER.md](docs/V2-RENDERER.md)).

## License

MIT — see [LICENSE](LICENSE).
