# draw-letter-webgl-spike

The throwaway spike that started v2 (2026-08-03). Self-contained, no dependencies,
no build — open `index.html`.

It re-draws `letter-h-easy` and `letter-y-easy` in raw WebGL2, reading the point
arrays **straight out of those `.glam` files** so the comparison isolates the
renderer rather than the artwork. 263 lines of hand-written JS against 0 lines for
the Glamour original.

## Why it is kept

It is the evidence for a load-bearing decision in the real renderer. This spike
strokes polylines as **expanded quads plus a disc at every joint**, which
antialiases every *internal* triangle edge as well as the silhouette — look closely
at the black ink over the grey track and you can see the seam fringe.

That artifact is precisely why `packages/core/src/gl/renderer.ts` resolves each node
through a **stencil union** instead of drawing tessellated triangles directly. A
stencil is binary per sample, so only the true outline antialiases.

Superseded by the production renderer in every other respect — do not build on it.
See `docs/V2-RENDERER.md`.
