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
  a: { w: 0.92, strokes: [
    // One stroke: the bowl closes, and the pen carries straight on down the
    // right side. The bridge from where the bowl closes to the top of the stem
    // is marked `retrace` so it stays in the path the finger follows without
    // being painted — the rendered `a` is unchanged, the motion is ZB's.
    [
      arc(0.46, 1.50, 0.44, 0.50, -30, -390),
      retrace(line(0.841, 1.25, 0.90, 1.02)),
      line(0.90, 1.02, 0.90, 2),
    ],
  ] },
  b: { w: 0.92, strokes: [
    [
      line(0.10, 0, 0.10, 2),
      retrace(line(0.10, 2, 0.10, 1.00)),
      arc(0.10, 1.50, 0.80, 0.50, -90, 90),
    ],
  ] },
  c: { w: 1.00, strokes: [
    [arc(0.50, 1.50, 0.48, 0.50, -50, -310)],
  ] },
  d: { w: 0.94, strokes: [
    // ZB: circle, then "push up to the top line, pull down". The push-up is a
    // real part of the motion and the code had no trace of it — the stem simply
    // started at the top and went down.
    [
      arc(0.46, 1.50, 0.44, 0.50, -30, -390),
      retrace(line(0.841, 1.25, 0.90, 1.02)),
      retrace(line(0.90, 1.02, 0.90, 0)),
      line(0.90, 0, 0.90, 2),
    ],
  ] },
  e: { w: 1.00, strokes: [
    [line(0.04, 1.52, 0.96, 1.52), arc(0.50, 1.50, 0.46, 0.50, 2.5, -296)],
  ] },
  f: { w: 1.16, strokes: [
    [arc(0.70, 0.52, 0.44, 0.52, -22, -180), line(0.26, 0.52, 0.26, 2)],
    [line(0.02, 1.00, 0.80, 1.00)],
  ] },
  g: { w: 0.94, strokes: [
    [
      arc(0.46, 1.50, 0.44, 0.50, -30, -390),
      retrace(line(0.841, 1.25, 0.90, 1.02)),
      line(0.90, 1.02, 0.90, 2.52),
      arc(0.56, 2.52, 0.34, 0.46, 0, 152),
    ],
  ] },
  h: { w: 0.92, strokes: [
    [
      line(0.10, 0, 0.10, 2),
      retrace(line(0.10, 2, 0.10, 1.38)),
      arc(0.50, 1.38, 0.40, 0.38, 180, 360),
      line(0.90, 1.38, 0.90, 2),
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
    [
      line(0.10, 1.00, 0.10, 2),
      retrace(line(0.10, 2, 0.10, 1.34)),
      arc(0.43, 1.34, 0.33, 0.34, 180, 360),
      line(0.76, 1.34, 0.76, 2),
      retrace(line(0.76, 2, 0.76, 1.34)),
      arc(1.09, 1.34, 0.33, 0.34, 180, 360),
      line(1.42, 1.34, 1.42, 2),
    ],
  ] },
  n: { w: 0.92, strokes: [
    [
      line(0.10, 1.00, 0.10, 2),
      retrace(line(0.10, 2, 0.10, 1.38)),
      arc(0.50, 1.38, 0.40, 0.38, 180, 360),
      line(0.90, 1.38, 0.90, 2),
    ],
  ] },
  o: { w: 1.02, strokes: [
    [arc(0.51, 1.50, 0.49, 0.50, -50, -410)],
  ] },
  p: { w: 0.92, strokes: [
    [
      line(0.10, 1.00, 0.10, 3),
      retrace(line(0.10, 3, 0.10, 1.00)),
      arc(0.10, 1.50, 0.80, 0.50, -90, 90),
    ],
  ] },
  q: { w: 1.34, strokes: [
    // Two faults here, not one. The lift, and a missing foot: ZB gives `q` a
    // hook that curls RIGHT — the mirror of `g`'s — and the code had a plain
    // straight descender. The sweep must DECREASE (counter-clockwise on a
    // y-down canvas) or the foot curls left and you have written a second `g`.
    [
      arc(0.46, 1.50, 0.44, 0.50, -30, -390),
      retrace(line(0.841, 1.25, 0.90, 1.02)),
      line(0.90, 1.02, 0.90, 2.56),
      arc(1.12, 2.56, 0.22, 0.42, 180, 20),
    ],
  ] },
  r: { w: 0.76, strokes: [
    [
      line(0.14, 1.00, 0.14, 2),
      retrace(line(0.14, 2, 0.14, 1.40)),
      arc(0.44, 1.40, 0.30, 0.40, 180, 328),
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
    [
      line(0.10, 1.00, 0.10, 1.58),
      arc(0.50, 1.58, 0.40, 0.42, 180, 0),
      // Push UP to the midline, then pull down to the baseline. Both matter:
      // without the push-up the right side starts at 1.58 and the glyph reads
      // as a lop-sided "ʋ" with a stunted shoulder — compare capital `U`,
      // which returns to the top line.
      line(0.90, 1.58, 0.90, 1.00),
      retrace(line(0.90, 1.00, 0.90, 1.58)),
      line(0.90, 1.58, 0.90, 2),
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
