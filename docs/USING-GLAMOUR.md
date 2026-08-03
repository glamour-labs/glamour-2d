# Using Glamour

A practical guide for someone who's never seen this before. For the big picture, read the
[README](../README.md); for the format details, see
[`skills/cast-glamour/reference/schema.md`](../skills/cast-glamour/reference/schema.md).

Glamour is a small JSON format (`.glam`) + a tiny runtime for **interactive, animated canvases** —
vector shapes and text that respond to clicks, host inputs, and a state machine. You author a
`.glam` (by hand, with the CLI, or with an AI agent), and play it anywhere.

---

## 0. Setup (today)

> **Heads up — not on npm yet.** v1 is a local monorepo. You install it by cloning + building, not
> `pnpm add @glam/…`. Publishing to a registry is the first packaging step for v1.1.

Uses **pnpm** (npm also works — inter-package `*` specs link locally under both, via `link-workspace-packages`).

```bash
git clone <repo>  # or: cd ~/Project/glamour
nvm use           # Node 20.19.4 — REQUIRED (the headless renderer's native `canvas` is Node-20 ABI)
pnpm install      # native canvas + esbuild builds are pre-approved in pnpm-workspace.yaml
pnpm build        # builds core, player (incl. the UMD bundle), cli, mcp, studio
pnpm test         # 131 tests, should be green
```
> First time on pnpm: it only runs a dependency's native build script if that package is listed under
> `onlyBuiltDependencies` in `pnpm-workspace.yaml` (already done here for `canvas` + `esbuild`).

The two build outputs you'll actually use downstream:
- `packages/player/dist/glam-player.umd.js` — the browser player as a plain `<script>` (global `Glam`).
- `packages/cli/dist/cli.js` — the `glam` CLI (`node packages/cli/dist/cli.js …`).

---

## 1. Author a `.glam`

**Start from the CLI:**
```bash
node packages/cli/dist/cli.js new my.glam     # writes a valid starter document
```

A `.glam` is just JSON. Minimal shape:
```json
{
  "schema": "glamour/v0",
  "canvas": { "w": 520, "h": 300, "bg": "#12151b" },
  "inputs": { "progress": 0 },
  "nodes": [
    { "id": "orb", "type": "circle", "x": 150, "y": 150, "r": 52, "fill": "#4c7dff" },
    { "id": "bar", "type": "rect",   "x": 250, "y": 165, "w": 20, "h": 12, "fill": "#5ad67d" }
  ],
  "bind":    [ { "node": "bar", "prop": "w", "expr": "lerp(10, 220, progress)" } ],
  "machine": {
    "initial": "idle",
    "states": {
      "idle":   { "set": { "orb.r": 52 }, "on": { "orb.click": "active" } },
      "active": { "set": { "orb.r": 78, "orb.fill": "#ff9f43" }, "on": { "orb.click": "idle" } }
    },
    "transition": { "ms": 220, "ease": "easeOut" }
  }
}
```

The three ways things move:
- **`on`** keys are `"<node>.<event>"` (events: `click`, `hover`, `leave`) or an input condition like
  `"progress > 0.5"` → transitions the state machine.
- **`set`** targets are `"<node>.<prop>"` — the property values a state enforces (tweened via `transition`).
- **`bind`** wires a node property to an expression over `inputs` (`lerp`, `clamp`, arithmetic).

## 2. Verify it (the self-verify loop)

Never ship a `.glam` you haven't validated + rendered:
```bash
node packages/cli/dist/cli.js validate my.glam        # schema + semantic checks; exit 1 on error
node packages/cli/dist/cli.js render   my.glam -o my.png   # headless PNG — look at it
```

---

## 3. Use it in a real project

### Path A — a standalone shareable file (zero integration)
The simplest "destination". Produces one self-contained `.html` (player inlined) you can open offline,
email, or drop on any static host:
```bash
node packages/cli/dist/cli.js preview my.glam   # serves it locally to check
# or generate the file:
node -e 'const{exportInlineHTML}=require("./packages/player/dist/node.js");
  const fs=require("fs");fs.writeFileSync("my.html",exportInlineHTML(JSON.parse(fs.readFileSync("my.glam"))))'
```

### Path B — drop it into a web page with the web-component (zero JS)
Copy `glam-player.umd.js` next to your page. Loading it **auto-registers** `<glam-canvas>`:
```html
<script src="./glam-player.umd.js"></script>
<glam-canvas src="./my.glam"></glam-canvas>
```
Pointer interaction (click/hover) works out of the box. *(Note: the element keeps its player private,
so to drive host inputs from your own code, use Path C. Exposing `<glam-canvas>.player` is a planned
v1.1 nicety.)*

### Path C — mount it yourself and control it
`renderGlamour(doc, mountEl)` returns a player you can drive — the full interaction surface:
```html
<script src="./glam-player.umd.js"></script>
<div id="stage"></div>
<script>
  fetch('./my.glam').then(r => r.json()).then(doc => {
    const player = Glam.renderGlamour(doc, document.getElementById('stage'));
    player.setInput('progress', 0.8);     // feed a host input → bound props update
    player.getState();                    // read the current state-machine state
    // player.destroy() when you unmount
  });
</script>
```
(With bundlers/ESM once published: `import { renderGlamour } from '@glam/player'`. Node-only helpers
like `exportInlineHTML` live at `@glam/player/node`.)

---

## 4. How the AI authors a glamour

This is the whole point — Claude is a first-class author, three ways:

- **Claude Code skill** — `skills/cast-glamour/SKILL.md` teaches Claude the schema, the primitive
  palette, and the mandatory self-verify loop (write → `glam validate` → `glam render` → look → fix).
  Point Claude Code at this repo and ask it to "make me a loading-spinner glamour."
- **Sub-agent** — `agents/glamour-smith.md` is a focused worker: natural-language ask → a validated
  `.glam` + rendered PNG.
- **MCP server** — `packages/mcp` exposes the core operations (`add_node`, `define_state`,
  `add_binding`, `validate`, `render_preview`, …) as MCP tools, so any MCP client can author `.glam`
  files at the protocol level. Run the built `glam-mcp` bin over stdio and register it with your client.

Why it works reliably: the format is small, fully named, and prompt-sized, so the model composes from
a known palette instead of guessing — and every path renders-and-checks before calling anything done.

---

## Current limits (honest)

- **Not on npm** — clone + build for now.
- **Node 20 only** — the native `canvas` (headless render) is built for the Node-20 ABI.
- **v1 content** is vector + text. Raster/sprites, SVG import, image→animation, in-app chat, a WebGL
  perf path, and continuous-timeline playback are v2.
- `<glam-canvas>.player` accessor and an npm publish are the top v1.1 usability items.
