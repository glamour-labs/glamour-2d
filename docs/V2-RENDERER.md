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

Current status: **18/19 MATCH**. The one DIFF is `conformance/text-and-stroke.glam`
at 3.09%, entirely attributable to text (see Known residuals).

> **BUILD v1 BEFORE GENERATING THE ORACLE.** v1's `dist/` was a day stale, so the
> first oracle was generated from out-of-date v1 behaviour and quietly mis-scored
> several documents — `dash` in particular was absent from the stale bundle, which
> inflated every dashed doc's diff (`letter-h-easy` read 1.03%; against a correct
> oracle it is 0.10%). An oracle is only a spec if it is built from current source.

Excluded:
- `sketches/draw-letter-a/letter-a.glam`, `sketches/trace-letter/letter-a.glam` —
  legacy and unused (King, 2026-08-03), and dominated by one huge glyph, so they
  measure the two rasterizers' font engines rather than this renderer.

## The frame-sequence gate

The static gate above diffs ONE resting frame per document, which proves nothing
about `loops`, `wander`, or the tween engine — and v2's tween engine and rAF
ticker are both hand-written replacements for Konva's.

```bash
node scripts/frame-parity.mjs ~/Project/glamour frame-parity-out
# exit 0 = pass, 1 = fail.  GLAM_FRAMES=41 for a longer run.
```

Two independent checks:

- **A. Easing math** — every `Ease` name sampled at 101 phases in both
  implementations and compared numerically. Konva exposes easings as full
  interpolators `(time, begin, change, duration)`, so they are normalized to a
  phase→phase curve first. All six agree to float noise (max |Δ| 2.2e-16).
- **B. Frame sequence** — each animated document driven through identical
  **virtual** timestamps in both versions, diffed frame by frame. Currently
  **4/4 MATCH**, worst 0.42%.

Determinism comes from two page-level shims installed *before* the player bundle
loads, so no test hooks are needed and both versions are treated identically:

1. `requestAnimationFrame` + `performance.now` + `Date.now` are replaced with a
   hand-stepped clock. Konva's own `Animation` engine and v2's ticker both ride
   it. (The players' `__tick` seam is NOT usable for this: `tick()` writes node
   props but does not redraw, and the redraw is owned by the very rAF loop we
   need to control.)
2. `Math.random` is a seeded LCG, **reset after scene construction and before
   motion starts**. That reset is load-bearing: Konva assigns every shape a
   random hit-test colour key, so v1 consumes draws during construction that v2
   does not. Sharing one continuous stream gave the two versions different wander
   trajectories and showed up as a phantom ~1.7pp diff — orb read 1.97% before
   the reset and 0.42% after.

**Threshold is 0.8%, not the static gate's 2%.** 2% was calibrated for text
antialiasing and no animated document contains text. Verified by mutation testing
in both directions: clean baselines measure 0.10–0.42%, while an injected 40ms
loop phase shift measures 1.04–1.66% — which at 2% reported MATCH. The gate now
fails that mutation with exit 1 and writes the worst-frame pair to disk.

Out of scope, deliberately: pixel parity for tween *transitions*. Those fire from
a node click, and the two versions dispatch clicks through different event systems
(Konva's hit graph vs v2's analytic hit-test), so a simulated click is not a
like-for-like input. Check A covers the interpolation math instead.

> **A mutation test only proves anything if the mutation reaches the tested
> artifact.** The first attempt rebuilt `@glam/core` only — but check B reads the
> *player's* UMD bundle, which bundles core. The mutation never shipped, the gate
> reported MATCH, and it briefly looked blind. Always `pnpm -r build`.

### Conformance documents

The 18 real documents only exercise `circle`, `rect`, `text` and `stroke`. Parity
across them proved **nothing** about `ellipse`, `arc`, `fillGradient`, shadow/glow,
`cornerRadius` or `fontStyle` — all of which appear **zero** times in the corpus.
`conformance/*.glam` exist to close that hole and are part of the gate:

| file | covers |
|---|---|
| `shapes.glam` | ellipse, arc (pie/ring/full), cornerRadius, rotation, stroke-on-shape |
| `paint.glam` | linear + radial gradients, glow, offset drop shadow |
| `text-and-stroke.glam` | fontStyle normal/bold/italic/italic-bold, rotated text, dash, tension, closed+filled |

Writing them immediately found two renderer bugs that the corpus could never have
caught — see below.

## Bugs the conformance docs found

Both were invisible to the 18-document corpus, and both were real:

1. **Glow was vertically flipped and mis-offset.** The vertex shader negates
   `clip.y` so geometry is in canvas space (top-left origin); rendering that into
   an FBO — which has a *bottom*-left origin — stores the image upside down, and
   sampling with the same convention double-flipped it. Every glow landed at
   `h - y`. The shadow offset was also applied by moving the composite quad, which
   crops the texture instead of shifting it. Both corrections now live in
   `FS_TINT`, and the intermediate blur passes deliberately do *not* flip.
2. **Rotated text rendered upright and truncated.** The stencil mask is built
   from rotated geometry, but the texture sampler was axis-aligned, so the glyph
   was sampled unrotated then clipped by a rotated mask. `FS_TEXTURE` now
   un-rotates the fragment position about the node origin.

A third, smaller fidelity gap: `tension` was a generic cardinal spline, which
drifted ~4% at tension 0.5. It is now a faithful port of Konva's
`_getControlPoints` / `_expandPoints` plus curve flattening — 4.41% → 2.02%.

## Known residuals

- **Text cannot be pixel-identical across the two backends.** node-canvas
  (FreeType) and Chromium (Skia) hint the implicit default family differently.
  This is uniform across all seven text nodes (9–15% over threshold at 20px, 3.7%
  at 11px) and is the entire remaining DIFF. Rotated text reads highest (14.7%)
  because diagonal glyph edges amplify the same disagreement — its ink bounding
  box matches v1 to 1px, so the geometry is right.
- **`glam render` is ~1–2s**, not instant. Chromium must be installed:
  `npx playwright install chromium`.
- **`fontFamily` is still not in the format.** v2 pins `Arial` — Konva's old
  default. Adding a `fontFamily` field is the real fix for the text residual.
- **`tension` on a *closed* stroke** still uses the cardinal spline; Konva has a
  separate closed-line routine. Closed tensioned strokes in the corpus are
  low-tension fills that agree within threshold (1.23%).

## Latent v1 bugs this port surfaced

1. **v1's build is broken on a clean rebuild.** `apps/studio`'s `GlamPlayer` mock
   is missing `onGuided`; v1 only typechecks because its committed `dist/*.d.ts`
   predates the field. Running `pnpm -r build` in v1 fails at `apps/studio`.
   Proven by execution, not inference.
2. **v1's `dist/` was a day stale**, so its shipped bundle predated `dash`
   support that exists in its source. Anything consuming v1's build — including
   an oracle — was reading old behaviour.
3. The player ran three tsup configs concurrently with `clean: true` on one of
   them — a clean racing a sibling's write deleted `glam-player.umd.js`
   mid-build. In v1 this was invisible; here it surfaced as an intermittent
   "UMD bundle not found". `dist` is now cleaned once by the build script.

Retracted from an earlier draft of this document: `letter-y-hard.glam` was
reported as failing validation. It does not — that was the stale v1 build. It
renders and matches at 0.05%.
