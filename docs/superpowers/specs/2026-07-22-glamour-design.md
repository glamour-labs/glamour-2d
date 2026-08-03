# Glamour — Design Spec

**Date:** 2026-07-22
**Status:** Approved (direction + name locked with the user); spine spike-proven
**File extension:** `.glam` · **CLI:** `glam` · **Authoring skill:** `cast-glamour`

> A *glamour* is a medieval spell that casts a living illusion on the eye. This project is
> an **AI-native format + runtime for interactive, animated canvases** — the thing Rive and
> Lottie are, but designed from the ground up so an LLM (Claude) is the *primary author*.

---

## 1. The one-sentence thesis

Rive (`.riv`, binary) and Lottie (After-Effects export JSON) were both designed for a **GUI
editor with a human driving** — the file is a byproduct, and neither is authorable by an LLM.
**Glamour inverts that:** the document is designed first, to be small, regular, fully named,
and prompt-sized — so Claude *composes* interactive animations instead of guessing at them.
The format is the moat; everything else is composed from proven parts.

## 2. What v1 is (and isn't)

**Primary destination:** standalone shareable pieces — a self-contained document + a tiny
portable player that renders anywhere (URL, file, `<script>`, web-component). No app-integration
surface to maintain.

**Interaction model (all four, unified into one architecture):** pointer events on shapes,
host-set external inputs, a state machine, and playback control. These are not four builds —
they are *timelines + an XState statechart driven by named inputs, where pointer listeners and
host code both feed those inputs.*

**v1 content:** vector shapes + text.

| In v1 (prove the thesis) | Deferred to v2+ |
|---|---|
| Vector + text nodes | Raster / sprites + SVG import |
| Timeline + state machine + inputs + pointer hit-testing | **Image → animation** (depends on raster) |
| Player: self-contained export | In-app chat (beyond prompt→scene) |
| Studio: live preview + JSON editor + AI author/edit | WebGL/Pixi performance path |
| Self-verify loop (validate + render + inspect) | Cloud share-hosting, collaboration |

Rationale for the cut (decided with the user, over an initial "all four content types"):
raster drags asset-bundling into the clean single-file story, and SVG-import means parsing
arbitrary messy SVG — both are tar pits. Vector+text fully proves the format, runtime, and AI
loop. Raster is also the *bridge* to the image→animation nice-to-have, so those belong together
in v2.

## 3. Architecture — one document, three consumers

```
        ┌────────────────── THE DOCUMENT (.glam JSON) ─────────────────┐
        │   nodes • timelines • state-machine • input-bindings         │
        └───────┬──────────────────────┬──────────────────────┬───────┘
       authors  │                edits │                 plays │
         ┌──────▼──────┐        ┌───────▼───────┐        ┌──────▼───────┐
         │  AI layer   │  ◄───► │   Studio app  │  ◄───► │  The Player  │
         │  (Claude)   │        │ (edit + live) │        │  (portable)  │
         └─────────────┘        └───────────────┘        └──────────────┘
```

The **Player** is the only thing that ships with a shared glamour. The **Studio** is the visual
playground/inspector. The **Document** is the contract binding all three — and the AI's entire
API surface.

## 4. The Document format (`glamour/v0`) — the moat

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

Design rules that make it LLM-authorable:
- **Everything named** — no opaque indices (Lottie's fatal flaw). Nodes, inputs, states are keys.
- **`on` keys read as `node.event`** (pointer) **or input conditions**; **`set` targets read as
  `node.prop`.** One consistent addressing scheme.
- **Bindings are plain expressions** over inputs (`lerp`, `clamp`, arithmetic) — a small, fixed
  vocabulary, not arbitrary code.
- **The whole schema + a handful of examples fit in a prompt**, so the AI composes from a known
  palette instead of hallucinating math.

The format compiles cleanly onto the proven spine: `nodes` → Konva scene-graph, `machine` →
XState statechart, `set`/`transition` → tween, `bind` → recomputed on input change.

## 5. The runtime spine (SPIKE-PROVEN — see §9)

- **Renderer + hit-testing:** [Konva](https://konvajs.org) `@9` — Canvas2D scene-graph with a
  built-in pixel hit-detection graph (the mechanism pointer events ride on). Handles vector +
  text now; raster later.
- **State machine:** [XState](https://xstate.js.org) `@5` — statecharts authored *as data*
  (JSON-shaped config), battle-tested. Our `machine` block maps onto it.
- **Tweening:** Konva.Tween for v1 (Web Animations API / GSAP as options if we outgrow it).
- **Player packaging:** a small JS lib `renderGlamour(doc, mount)` → shippable as `<script>` tag,
  web-component `<glam-canvas src="…">`, or inlined self-contained HTML.

Why not build our own engine (Approach B): months rebuilding solved problems (easing,
hit-testing, statecharts) that aren't the moat. Why not wrap Lottie/Theatre.js (Approach C): we'd
inherit an LLM-hostile format, killing the thesis. **Approach A composes proven engines under our
own format** — invention spent only where the moat is.

## 6. The AI layer — one core engine, thin adapters

```
       ┌──────────────── CORE ENGINE (headless lib) ────────────────┐
       │  validate(doc)  •  render(doc)→PNG  •  applyOps(doc, ops)   │
       │  schema  •  primitive palette  •  the self-verify loop      │
       └──┬────────────┬──────────────────┬──────────────────┬──────┘
      ┌───▼───┐   ┌────▼─────┐      ┌──────▼──────┐    ┌──────▼──────┐
      │  CLI  │   │   MCP    │      │ Skill /     │    │   Studio    │
      │ glam  │   │  server  │      │ sub-agent   │    │ (in-browser)│
      └───────┘   └──────────┘      └─────────────┘    └─────────────┘
```

The intelligence lives in **core** (operations) + the **skill's knowledge** (schema + palette +
recipe). The adapters are thin:

- **CLI (`glam`)** — `glam new`, `glam validate <f>`, `glam render <f> -o out.png`,
  `glam preview <f>` (serves the player). **Claude Code drives this directly** — edit the
  `.glam`, run `glam validate && glam render`, *look at the PNG*, fix. This is the primary
  authoring path (the user lives in Claude Code).
- **MCP server** — exposes core operations as tools (`add_node`, `set_props`, `define_state`,
  `add_binding`, `validate`, `render_preview`, `list_primitives`). Makes Glamour AI-native at the
  *protocol* level; any MCP client can author.
- **Skill / sub-agent (`cast-glamour`)** — the *knowledge*: format schema + primitive palette +
  authoring recipe + **the self-verify loop baked in** ("write → validate → render → inspect →
  fix"). The sub-agent is that skill as a focused worker: "make me a loading spinner" → returns a
  validated `.glam`.
- **Studio** — visual playground/inspector; uses core in-browser. In-app chat (v2) becomes just
  another adapter.

**The self-verify loop is identical across every adapter** — validate + render + inspect — so
"do it with proof" is structural, not a promise. Claude never ships a glamour it hasn't rendered.

## 7. Component boundaries (what depends on what)

| Unit | Does | Depends on | Consumed by |
|---|---|---|---|
| `@glam/core` | validate, render(headless), applyOps, palette | Konva, XState, schema | everything |
| `@glam/player` | play a `.glam` in a live DOM canvas + inputs + pointer | `@glam/core` runtime | shared pieces, Studio |
| `glam` CLI | new/validate/render/preview | `@glam/core`, `@glam/player` | Claude Code, humans |
| `glam-mcp` | operations as MCP tools | `@glam/core` | MCP clients |
| `cast-glamour` skill | authoring knowledge + self-verify recipe | CLI | Claude Code |
| Studio | visual edit + live preview + AI panel | `@glam/core`, `@glam/player` | humans |

Core is the only unit with real logic; each other unit is a thin skin and independently testable.

## 8. Build sequence for v1

1. **Core** (format schema + `validate` + `render` + `applyOps` + palette)
2. **Player** (portable export: `<script>`, web-component, inlined HTML)
3. **CLI** (`glam new/validate/render/preview`)
4. **Skill / sub-agent** (`cast-glamour`)  ← *minimal thesis proven here: Claude Code authors a
   validated, shareable, interactive glamour end-to-end*
5. **MCP server**
6. **Studio**

Steps 1–4 are the smallest loop that proves the whole idea. If we run long, we cut from the tail
(Studio), never the spine.

## 9. Proof (the spike — "do everything with proof")

A throwaway spike ran the **real libraries** (`konva@9`, `xstate@5`, node `canvas`) headless and
verified every load-bearing claim. Artifacts live in `docs/superpowers/spikes/`
(`spine-spike.mjs`, `spine-spike-proof.png`).

| Claim | Result |
|---|---|
| Our JSON → Konva scene-graph | ✓ 3 nodes built from our format |
| Round-trip (nodes → our JSON) | ✓ ids + radius preserved |
| **Pixel hit-test** (pointer mechanism) | ✓ `(200,150) → "orb"`; empty corner → no hit |
| Headless render to pixels | ✓ stage rasterized to PNG |
| External input binding | ✓ `setInput(progress,100) → width 20→220` |
| **Data-only statechart** driving props | ✓ `idle → hover → active → idle`; active drove `r→72`, `fill→#ff9f43` |

**6/6 passed.** The Approach-A spine is verified, not asserted.

## 10. Open questions deferred to planning

- Expression language for `bind`/conditions — exact allowed vocabulary (keep it tiny + safe).
- Timeline representation (keyframes vs. tween-on-transition only) for v1.
- Player packaging details (bundle size budget; which of `<script>`/web-component/inlined-HTML is
  the v1 default export).
- Repo/remote hosting + whether this ever leaves the personal-tool tier.
- Naming inside the format for verbs: "cast" vocabulary vs. plain `render/play`.
