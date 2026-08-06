/**
 * The 52 glyph skeletons — A–Z and a–z as ordered pen-strokes.
 *
 * Authored in band units (see `geom.mjs`): y=0 top line, y=1 midline, y=2
 * baseline, y=3 descender line; x starts at 0 on the glyph's own left edge.
 * The model is **Zaner-Bloser manuscript** — vertical axis, monoline, built
 * from straight lines and circles, no slant and no exit tails.
 *
 * Each glyph is `{ w, strokes }`:
 *   - `w`      the glyph's advance width in band units (used to centre it).
 *   - `strokes` an ordered list of pen-strokes — one per pen lift. Each stroke
 *              is a list of segments (`line` / `arc` / `cubic`) that join end
 *              to end.
 *
 * Two conventions matter and are load-bearing for how the game feels:
 *
 * 1. **Retrace strokes are one stroke, not two.** `h`, `m`, `n`, `r` are
 *    written by pulling down the stem, sliding back *up* the same line, and
 *    then arching over. That is a single pen-stroke with a doubled-back path,
 *    which is exactly what the player's guided projector is built for (it
 *    scans a short forward window, so the finger cannot skip onto the return
 *    pass). Splitting them would teach the wrong motor pattern.
 *
 * 2. **Dots are short strokes, not points.** The renderer caps every polyline
 *    with a filled circle of half the stroke width, so a segment shorter than
 *    the stroke width renders as a true round dot. `i` and `j` use that.
 */

import { line, arc, cubic, retrace } from './geom.mjs';

/** A dot for `i`/`j` — deliberately shorter than the pen is wide. */
const dot = (x, y) => [line(x, y - 0.02, x, y + 0.02)];

export const UPPER = {
  A: { w: 1.50, strokes: [
    [line(0.75, 0, 0.02, 2)],
    [line(0.75, 0, 1.48, 2)],
    [line(0.29, 1.22, 1.21, 1.22)],
  ] },
  B: { w: 1.06, strokes: [
    [line(0.10, 0, 0.10, 2)],
    [arc(0.10, 0.50, 0.80, 0.50, -90, 90), arc(0.10, 1.50, 0.92, 0.50, -90, 90)],
  ] },
  C: { w: 1.60, strokes: [
    [arc(0.80, 1.00, 0.78, 1.00, -52, -308)],
  ] },
  D: { w: 1.42, strokes: [
    [line(0.10, 0, 0.10, 2)],
    [arc(0.10, 1.00, 1.28, 1.00, -90, 90)],
  ] },
  E: { w: 1.05, strokes: [
    [line(0.10, 0, 0.10, 2)],
    [line(0.10, 0, 1.02, 0)],
    [line(0.10, 1.00, 0.90, 1.00)],
    [line(0.10, 2, 1.02, 2)],
  ] },
  F: { w: 1.02, strokes: [
    [line(0.10, 0, 0.10, 2)],
    [line(0.10, 0, 1.00, 0)],
    [line(0.10, 1.00, 0.88, 1.00)],
  ] },
  G: { w: 1.60, strokes: [
    // The bar starts exactly on the arc's terminal — anything else leaves a
    // gap the flattener bridges with a visible diagonal jog.
    [arc(0.80, 1.00, 0.78, 1.00, -52, -358), line(1.5795, 1.0349, 0.78, 1.0349)],
  ] },
  H: { w: 1.22, strokes: [
    [line(0.10, 0, 0.10, 2)],
    [line(1.12, 0, 1.12, 2)],
    [line(0.10, 1.00, 1.12, 1.00)],
  ] },
  I: { w: 0.86, strokes: [
    [line(0.43, 0, 0.43, 2)],
    [line(0.06, 0, 0.80, 0)],
    [line(0.06, 2, 0.80, 2)],
  ] },
  J: { w: 1.06, strokes: [
    [line(0.72, 0, 0.72, 1.46), arc(0.42, 1.46, 0.30, 0.54, 0, 180)],
    [line(0.30, 0, 1.14, 0)],
  ] },
  K: { w: 1.18, strokes: [
    [line(0.10, 0, 0.10, 2)],
    [line(1.10, 0, 0.12, 1.05), line(0.12, 1.05, 1.16, 2)],
  ] },
  L: { w: 1.00, strokes: [
    [line(0.10, 0, 0.10, 2), line(0.10, 2, 0.98, 2)],
  ] },
  M: { w: 1.54, strokes: [
    [line(0.10, 0, 0.10, 2)],
    [line(0.10, 0, 0.72, 1.88), line(0.72, 1.88, 1.34, 0), line(1.34, 0, 1.34, 2)],
  ] },
  N: { w: 1.22, strokes: [
    [line(0.10, 0, 0.10, 2)],
    [line(0.10, 0, 1.12, 1.86), line(1.12, 1.86, 1.12, 0)],
  ] },
  O: { w: 1.72, strokes: [
    // Starts right of top (≈1 o'clock), as ZB's diagram shows and as `C` does —
    // not at 12 o'clock, which put the start bead and first arrow in the wrong
    // place even though the sweep was correct.
    [arc(0.86, 1.00, 0.84, 1.00, -60, -420)],
  ] },
  P: { w: 1.12, strokes: [
    [line(0.10, 0, 0.10, 2)],
    [arc(0.10, 0.55, 0.94, 0.55, -90, 90)],
  ] },
  Q: { w: 1.76, strokes: [
    [arc(0.86, 1.00, 0.84, 1.00, -90, -450)],
    [line(1.06, 1.50, 1.66, 2.18)],
  ] },
  R: { w: 1.18, strokes: [
    [line(0.10, 0, 0.10, 2)],
    [arc(0.10, 0.52, 0.86, 0.52, -90, 90), line(0.10, 1.04, 1.16, 2)],
  ] },
  S: { w: 1.30, strokes: [
    [
      cubic(1.20, 0.38, 1.16, -0.12, 0.08, -0.12, 0.08, 0.58),
      cubic(0.08, 0.58, 0.08, 1.04, 1.22, 0.98, 1.22, 1.44),
      cubic(1.22, 1.44, 1.22, 2.14, 0.16, 2.14, 0.06, 1.62),
    ],
  ] },
  T: { w: 1.14, strokes: [
    [line(0.57, 0, 0.57, 2)],
    [line(0.04, 0, 1.10, 0)],
  ] },
  U: { w: 1.22, strokes: [
    [line(0.10, 0, 0.10, 1.44), arc(0.61, 1.44, 0.51, 0.56, 180, 0), line(1.12, 1.44, 1.12, 0)],
  ] },
  V: { w: 1.32, strokes: [
    [line(0.04, 0, 0.66, 2), line(0.66, 2, 1.28, 0)],
  ] },
  W: { w: 1.84, strokes: [
    [line(0.04, 0, 0.48, 2), line(0.48, 2, 0.92, 0.34), line(0.92, 0.34, 1.36, 2), line(1.36, 2, 1.80, 0)],
  ] },
  X: { w: 1.22, strokes: [
    [line(0.08, 0, 1.14, 2)],
    [line(1.14, 0, 0.08, 2)],
  ] },
  Y: { w: 1.26, strokes: [
    [line(0.08, 0, 0.63, 1.02)],
    [line(1.18, 0, 0.63, 1.02), line(0.63, 1.02, 0.63, 2)],
  ] },
  Z: { w: 1.16, strokes: [
    [line(0.07, 0, 1.09, 0), line(1.09, 0, 0.07, 2), line(0.07, 2, 1.09, 2)],
  ] },
};

export const LOWER = {
  a: { w: 1.10, strokes: [
    // Circle first, then the stem — the order `a` is actually written in: around like a
    // `c` from the right at mid-height, over the top, down the left, along the bottom, up
    // the right, then the return pass to the stem's top and straight down.
    //
    // The return pass is a `retrace`, which is what earns it its own dashed line in the
    // guide. That line is the point of this letter's treatment: it is the only thing that
    // tells a child the pen travels back UP before it comes down.
    [
      cubic(1.00, 1.50, 1.00, 1.21, 0.77, 1.00, 0.555, 1.00),
      cubic(0.555, 1.00, 0.31, 1.00, 0.11, 1.22, 0.11, 1.50),
      cubic(0.11, 1.50, 0.11, 1.78, 0.31, 2.00, 0.555, 2.00),
      cubic(0.555, 2.00, 0.70, 2.00, 0.84, 1.90, 0.927, 1.657),
      retrace(cubic(0.927, 1.657, 0.98, 1.46, 1.00, 1.21, 1.00, 1.00)),
      line(1.00, 1.00, 1.00, 2),
    ],
  ] },
  // `arrowBack` pulls the end arrowhead back along the path, in arrow lengths. `b` is the
  // only glyph that needs it: its stroke finishes on the stem it already drew, so a head
  // anchored at the last vertex lands on top of the lines meeting there.
  b: { w: 1.10, arrowBack: 0.9, strokes: [
    // Stem first, then the bowl. The return pass leaves the baseline hugging the stem and
    // peels off it into the bowl — `r`'s turn, reused — and the bowl closes back onto the
    // stem at mid-height so the letter reads as a proper upright `b`.
    //
    // As in `a`, the return pass is a `retrace` so the guide gives it its own dashed line.
    [
      line(0.10, 0, 0.10, 2),
      retrace(cubic(0.10, 2, 0.10, 1.79, 0.12, 1.54, 0.173, 1.343)),
      cubic(0.173, 1.343, 0.26, 1.10, 0.40, 1.00, 0.545, 1.00),
      cubic(0.545, 1.00, 0.79, 1.00, 0.99, 1.22, 0.99, 1.50),
      cubic(0.99, 1.50, 0.99, 1.78, 0.79, 2.00, 0.545, 2.00),
      cubic(0.545, 2.00, 0.33, 2.00, 0.10, 1.79, 0.10, 1.50),
    ],
  ] },
  c: { w: 1.00, strokes: [
    [arc(0.50, 1.50, 0.48, 0.50, -50, -310)],
  ] },
  d: { w: 1.10, strokes: [
    // `a`, with the stem run all the way up to the top line instead of stopping at the
    // midline. Same circle, same return pass up the right flank — so `a`, `d`, `g` and `q`
    // all teach one shape and differ only in how far the stem travels.
    //
    // The push-up past the midline is a second `retrace`: the pen climbs the ascender and
    // comes straight back down it, which is the whole reason `d` needs the two-line
    // treatment in the first place.
    [
      cubic(1.00, 1.50, 1.00, 1.21, 0.77, 1.00, 0.555, 1.00),
      cubic(0.555, 1.00, 0.31, 1.00, 0.11, 1.22, 0.11, 1.50),
      cubic(0.11, 1.50, 0.11, 1.78, 0.31, 2.00, 0.555, 2.00),
      cubic(0.555, 2.00, 0.70, 2.00, 0.84, 1.90, 0.927, 1.657),
      retrace(cubic(0.927, 1.657, 0.98, 1.46, 1.00, 1.21, 1.00, 1.00)),
      retrace(line(1.00, 1.00, 1.00, 0)),
      line(1.00, 0, 1.00, 2),
    ],
  ] },
  e: { w: 1.00, strokes: [
    [line(0.04, 1.52, 0.96, 1.52), arc(0.50, 1.50, 0.46, 0.50, 2.5, -296)],
  ] },
  f: { w: 1.16, strokes: [
    [arc(0.70, 0.52, 0.44, 0.52, -22, -180), line(0.26, 0.52, 0.26, 2)],
    [line(0.02, 1.00, 0.80, 1.00)],
  ] },
  g: { w: 1.10, strokes: [
    // `a`'s construction, carried on down into a descender that hooks left. The hook's
    // centre follows the stem: 0.34 left of it, so moving the stem to 1.00 moves the arc
    // to 0.66 with it.
    [
      cubic(1.00, 1.50, 1.00, 1.21, 0.77, 1.00, 0.555, 1.00),
      cubic(0.555, 1.00, 0.31, 1.00, 0.11, 1.22, 0.11, 1.50),
      cubic(0.11, 1.50, 0.11, 1.78, 0.31, 2.00, 0.555, 2.00),
      cubic(0.555, 2.00, 0.70, 2.00, 0.84, 1.90, 0.927, 1.657),
      retrace(cubic(0.927, 1.657, 0.98, 1.46, 1.00, 1.21, 1.00, 1.00)),
      line(1.00, 1.00, 1.00, 2.52),
      arc(0.66, 2.52, 0.34, 0.46, 0, 152),
    ],
  ] },
  h: { w: 0.92, strokes: [
    // The arch leaves the stem as ONE continuous curve from the baseline, fitted to
    // the reference artwork rather than eyeballed.
    //
    // Measured from `Letter=H, State=Finished.svg`: that outline is a monoline pen
    // of width 30 on an x-height band of 130, so pushing the counter's left wall
    // back out along its own normal by the pen radius recovers the arch's
    // centreline. It self-checks — low down, the recovered point lands exactly on
    // the measured stem centre. The recovered flank does NOT sit on the stem and
    // then kink away at a springing point; it peels away continuously from the
    // baseline, gently at first (0.003 band off at 1.85, 0.037 at 1.55, 0.124 at
    // 1.25). A cubic fits that to an rms of 0.008 band, about a pixel.
    //
    // It is then SPLIT at the height where the flank clears half a pen (band 1.402
    // for the paper theme, the tighter of the two). Below the split the flank runs
    // inside the stem's own ink and stays a retrace, because painting it makes the
    // dashed guide draw the stem twice and go solid — the exact bug the renderer's
    // piece-splitting exists to avoid. Above the split it is real, separate ink.
    // de Casteljau keeps both halves exactly on the fitted curve.
    [
      line(0.10, 0, 0.10, 2),
      retrace(cubic(0.10, 2, 0.10, 1.807, 0.122, 1.587, 0.172, 1.402)),
      cubic(0.172, 1.402, 0.235, 1.174, 0.34, 1.00, 0.50, 1.00),
      cubic(0.50, 1.00, 0.79, 1.00, 0.90, 1.57, 0.90, 2.00),
    ],
  ] },
  i: { w: 0.40, strokes: [
    [line(0.20, 1.00, 0.20, 2)],
    dot(0.20, 0.50),
  ] },
  j: { w: 0.62, strokes: [
    // Shifted right by 0.24: the hook used to reach x = -0.22, outside the
    // glyph's own 0..w box, so every `j` sat off-centre on its card.
    [line(0.58, 1.00, 0.58, 2.52), arc(0.29, 2.52, 0.29, 0.46, 0, 158)],
    dot(0.58, 0.50),
  ] },
  k: { w: 0.94, strokes: [
    [line(0.10, 0, 0.10, 2)],
    [line(0.88, 1.00, 0.12, 1.56), line(0.12, 1.56, 0.92, 2)],
  ] },
  l: { w: 0.34, strokes: [
    [line(0.17, 0, 0.17, 2)],
  ] },
  m: { w: 1.42, strokes: [
    // Two of `n`'s arches on narrower legs (0.66 apart rather than 0.80, to fit two
    // in the same advance). Same fitted flank, same half-pen split; each arch
    // begins at the baseline where the previous leg lands, so the pen never lifts.
    [
      line(0.10, 1.00, 0.10, 2),
      retrace(cubic(0.10, 2, 0.10, 1.788, 0.12, 1.536, 0.172, 1.338)),
      cubic(0.172, 1.338, 0.224, 1.143, 0.306, 1.00, 0.43, 1.00),
      cubic(0.43, 1.00, 0.68, 1.00, 0.76, 1.58, 0.76, 2.00),
      retrace(cubic(0.76, 2, 0.76, 1.788, 0.78, 1.536, 0.832, 1.338)),
      cubic(0.832, 1.338, 0.884, 1.143, 0.966, 1.00, 1.09, 1.00),
      cubic(1.09, 1.00, 1.34, 1.00, 1.42, 1.58, 1.42, 2.00),
    ],
  ] },
  n: { w: 0.92, strokes: [
    // `h`'s arch on a short stem — fitted to `Letter=N`, which measures a hair
    // tighter than `H` (0.001 band off at 1.85 against 0.003). See `h` for method.
    [
      line(0.10, 1.00, 0.10, 2),
      retrace(cubic(0.10, 2, 0.10, 1.799, 0.118, 1.561, 0.173, 1.368)),
      cubic(0.173, 1.368, 0.232, 1.158, 0.333, 1.00, 0.50, 1.00),
      cubic(0.50, 1.00, 0.82, 1.00, 0.90, 1.58, 0.90, 2.00),
    ],
  ] },
  o: { w: 1.02, strokes: [
    [arc(0.51, 1.50, 0.49, 0.50, -50, -410)],
  ] },
  p: { w: 1.10, arrowBack: 0.9, strokes: [
    // `b`'s construction hung off a descender. The pen runs the stem down past the
    // baseline, then back up — straight through the descender, then peeling into the bowl
    // on `b`'s own fitted turn, which is reused verbatim so the two letters stay siblings.
    //
    // Split into two retraces only so the peel can be lifted from `b` unchanged; they are
    // consecutive, so they merge into one inner line in the guide.
    //
    // `arrowBack` for the same reason as `b`: the stroke finishes on the stem it drew.
    [
      line(0.10, 1.00, 0.10, 3),
      retrace(line(0.10, 3, 0.10, 2)),
      retrace(cubic(0.10, 2, 0.10, 1.79, 0.12, 1.54, 0.173, 1.343)),
      cubic(0.173, 1.343, 0.26, 1.10, 0.40, 1.00, 0.545, 1.00),
      cubic(0.545, 1.00, 0.79, 1.00, 0.99, 1.22, 0.99, 1.50),
      cubic(0.99, 1.50, 0.99, 1.78, 0.79, 2.00, 0.545, 2.00),
      cubic(0.545, 2.00, 0.33, 2.00, 0.10, 1.79, 0.10, 1.50),
    ],
  ] },
  q: { w: 1.10, strokes: [
    // `a`'s construction with a plain straight descender — no foot. Zaner-Bloser gives `q`
    // a right-curling hook and the shape reference does not; the reference wins here
    // because that is what was asked for. Stroke count, order and direction stay ZB's.
    [
      cubic(1.00, 1.50, 1.00, 1.21, 0.77, 1.00, 0.555, 1.00),
      cubic(0.555, 1.00, 0.31, 1.00, 0.11, 1.22, 0.11, 1.50),
      cubic(0.11, 1.50, 0.11, 1.78, 0.31, 2.00, 0.555, 2.00),
      cubic(0.555, 2.00, 0.70, 2.00, 0.84, 1.90, 0.927, 1.657),
      retrace(cubic(0.927, 1.657, 0.98, 1.46, 1.00, 1.21, 1.00, 1.00)),
      line(1.00, 1.00, 1.00, 3),
    ],
  ] },
  r: { w: 0.76, strokes: [
    // `n`'s shoulder, stopped at a terminal instead of arching back down.
    //
    // The flank here is `n`'s fitted curve, not `r`'s own: `r` has no second leg, so
    // its counter never closes into two spans and the wall-offset method that
    // recovers a centreline has nothing to bite on. The shoulder is the same shape
    // in this typeface, so borrowing `n`'s is sound — but it is borrowed, not
    // measured, and that is the one flank in this set that is not fitted directly.
    [
      line(0.14, 1.00, 0.14, 2),
      retrace(cubic(0.14, 2, 0.14, 1.79, 0.16, 1.54, 0.213, 1.343)),
      cubic(0.213, 1.343, 0.265, 1.145, 0.35, 1.00, 0.48, 1.00),
      cubic(0.48, 1.00, 0.62, 1.00, 0.76, 1.04, 0.76, 1.16),
    ],
  ] },
  s: { w: 0.86, strokes: [
    [
      cubic(0.80, 1.24, 0.74, 1.02, 0.08, 0.99, 0.08, 1.35),
      cubic(0.08, 1.35, 0.08, 1.63, 0.80, 1.60, 0.80, 1.90),
      cubic(0.80, 1.90, 0.80, 2.20, 0.20, 2.14, 0.06, 1.90),
    ],
  ] },
  t: { w: 0.94, strokes: [
    // Full ascender and no foot — ZB's `t` is a bare stem crossed at the
    // midline, so it differs from `l` only by the crossbar. The 3/4 height and
    // the curved foot were both mine, not the manuscript's.
    [line(0.38, 0, 0.38, 2)],
    [line(0.04, 1.00, 0.80, 1.00)],
  ] },
  u: { w: 0.92, strokes: [
    // Left half from the OLD `u`, right half from the ROTATED-`n` one, joined at the
    // bowl's bottom. Each half is taken verbatim, because each was already right:
    //
    //   LEFT  — straight down from the midline, then curving into the bowl. That is how a
    //           `u` is drawn, and the rotated version never had it: its left side started
    //           curving immediately and never stopped.
    //   RIGHT — the bowl rises and hands over to the return pass on `n`'s own fitted curve.
    //           That handover is the link between the two lines, and only the rotated
    //           version got it right; the old one ran the two passes flat on top of each
    //           other with nothing to see.
    //
    // The join is the bowl's lowest point. The old half ended at 0.475 and the new begins
    // at 0.50, so the old endpoint moves 3.5px to meet it — the only edit to either half.
    [
      line(0.10, 1.00, 0.10, 1.50),
      cubic(0.10, 1.50, 0.10, 1.84, 0.28, 2.00, 0.50, 2.00),
      cubic(0.50, 2.00, 0.667, 2.00, 0.768, 1.842, 0.827, 1.632),
      retrace(cubic(0.827, 1.632, 0.882, 1.439, 0.90, 1.201, 0.90, 1.00)),
      line(0.90, 1.00, 0.90, 2),
    ],
  ] },
  v: { w: 0.94, strokes: [
    [line(0.04, 1.00, 0.47, 2), line(0.47, 2, 0.90, 1.00)],
  ] },
  w: { w: 1.38, strokes: [
    [
      line(0.04, 1.00, 0.38, 2),
      line(0.38, 2, 0.69, 1.20),
      line(0.69, 1.20, 1.00, 2),
      line(1.00, 2, 1.34, 1.00),
    ],
  ] },
  x: { w: 0.90, strokes: [
    [line(0.06, 1.00, 0.84, 2)],
    [line(0.84, 1.00, 0.06, 2)],
  ] },
  y: { w: 0.96, strokes: [
    [line(0.06, 1.00, 0.50, 1.90)],
    [line(0.92, 1.00, 0.50, 1.90), line(0.50, 1.90, 0.20, 2.92)],
  ] },
  z: { w: 0.90, strokes: [
    [line(0.06, 1.00, 0.84, 1.00), line(0.84, 1.00, 0.06, 2), line(0.06, 2, 0.84, 2)],
  ] },
};

export const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/** The vertical extent a glyph actually uses, so the card can frame it. */
export function glyphBand(glyph) {
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const stroke of glyph.strokes) {
    for (const s of stroke) {
      const ys = s.k === 'line' ? [s.y1, s.y2]
        : s.k === 'arc' ? [s.cy - s.ry, s.cy + s.ry]
        : [s.y1, s.cy1, s.cy2, s.y2];
      for (const y of ys) { if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
  }
  return { y0, y1 };
}

export const glyphFor = (letter, upper) => (upper ? UPPER[letter] : LOWER[letter.toLowerCase()]);
