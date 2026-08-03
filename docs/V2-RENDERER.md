# v2 — the WebGL2 renderer

v2 is a fork of glamour v1 with **one thing replaced**: the rasterizer. Konva is
gone; the scene is drawn with hand-written WebGL2. The `.glam` format, the state
machine, bindings, ink, guided strokes, the host API and the React binding are
untouched, and **every v1 document loads unedited**.

v1 stays installed at `~/Project/glamour` and is the **pixel oracle** for this
repo. It is not a dependency; it is the spec.

## What changed

| | v1 | v2 |
|---|---|---|
| Rasterizer | Konva (Canvas2D) | hand-written WebGL2 |
| Dependencies | konva, canvas, xstate, zod | xstate, zod |
| Headless render | in-process (node-canvas) | headless Chromium (playwright) |
| Node version | pinned 20.19.4 (native `canvas` ABI) | **unpinned** |
| Test environment | jsdom everywhere | split: node + real Chromium |
| Scene builder | `buildScene(Konva, doc, mount)` | `buildScene(doc, mount, opts?)` |
| `renderToPNG` | `@glam/core` | `@glam/player/node` |

Both schema ids stay valid — `glamour/v0` and `glamour/v0.1`. Introducing a
`glamour/v2` id would have forced an edit to all 18 documents for no gain.

## Design decisions worth knowing

**Node handles keep Konva's accessor shape.** `k.radius()`, `k.radius(48)`,
`k.points([...])`. That is why `player.ts`, `loop.ts` and `harness.ts` needed
almost no changes — the swap is a rasterizer swap, not a runtime rewrite.
`stage` and `layer` survive as thin shims for the same reason.

**Every node is drawn through a stencil union, not as raw triangles.** Drawing
tessellated triangles directly antialiases every *internal* triangle edge as
well as the silhouette, so overlapping quads-and-discs leave visible seams inside
a thick stroke. A stencil is binary per sample, so with a multisampled default
framebuffer only the true outline is antialiased. Costs one extra draw per node.

**Text is Canvas2D rasterized into a texture, not an SDF atlas.** Going through
the same text engine Konva used keeps font metrics identical, so the seven
documents containing `text` do not silently reflow. Scaling a text node
re-rasterizes rather than resampling — fine, since `size` rarely animates.

**Hit-testing is analytic, not a GPU colour-ID pass.** `readPixels` stalls the
pipeline and `pointermove` would pay that on every event. Point-in-shape maths
is exact and free.

**Headless render drives a real browser.** `headless-gl` is effectively
unmaintained and would swap one native-ABI liability for a worse one. Chromium
rasterizes with the *same* renderer that ships to users, so a headless PNG is
evidence about production. It costs ~1–2s per render, and it is what let the
Node 20.19.4 pin go away.

## The test split

`vitest.workspace.ts` defines two projects, because jsdom has **no WebGL context
at all** — v1 could run everything in jsdom only because Konva needed a 2D
context, which the native `canvas` package supplied.

- **`node`** — pure logic, node-only helpers, and the headless render path.
- **`browser`** — anything that builds a scene, in real headless Chromium.

Put a test in the wrong project and the failure is legible: a scene test in
`node` fails with `WebGL2 unavailable`; a `node:fs` test in `browser` fails with
`Module node:fs has been externalized`.

## The parity gate

```bash
# one-time: build v1 so it can act as the oracle
cd ~/Project/glamour && nvm use && pnpm install && pnpm build
# render the references
for f in $(find . -name '*.glam' -not -path '*/node_modules/*'); do \
  node packages/cli/dist/cli.js render "$f" -o /tmp/oracle/$(echo $f | tr / _).png; done

# then, in v2
node scripts/parity.mjs /tmp/oracle parity-out
```

Each document is rendered on both backends and diffed per pixel over white. A
document passes when fewer than 2% of pixels differ by more than 24/255.

Current status: **15/15 MATCH**, worst case 1.91 mean / 1.03% over threshold.

Excluded:
- `sketches/draw-letter-a/letter-a.glam`, `sketches/trace-letter/letter-a.glam` —
  legacy, and dominated by one huge glyph, so they measure the two rasterizers'
  font engines rather than this renderer.
- `sketches/draw-letter/letter-y-hard.glam` — **fails validation in v1 today**
  (`ink.into: Required`), so there is no reference to compare against. A
  pre-existing bug, not a v2 regression.

## Known residuals

- **Large text cannot be pixel-identical across the two backends.** node-canvas
  (FreeType) and Chromium (Skia) resolve and hint the implicit default family
  differently. Small text is within threshold; a glyph filling the canvas is not.
- **`glam render` is ~1–2s**, not instant. Chromium must be installed:
  `npx playwright install chromium`.
- **`fontFamily` is still not in the format.** v2 pins `Arial` — Konva's old
  default. Adding a `fontFamily` field is the real fix.

## Latent v1 bugs this port surfaced

1. `letter-y-hard.glam` does not validate (`ink.into: Required`).
2. `apps/studio`'s `GlamPlayer` mock was missing `onGuided`; v1 typechecks only
   because its `dist/*.d.ts` predates the field. A clean rebuild exposes it.
3. The player ran three tsup configs concurrently with `clean: true` on one of
   them — a clean racing a sibling's write deleted `glam-player.umd.js`
   mid-build. In v1 this was invisible; here it surfaced as an intermittent
   "UMD bundle not found". `dist` is now cleaned once by the build script.
