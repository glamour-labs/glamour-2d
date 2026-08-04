/**
 * Glyph geometry — the segment vocabulary letterforms are authored in, and the
 * flattener that turns them into the flat [x,y,...] polylines a `.glam` stroke
 * node (and a `guided.path`) wants.
 *
 * ## The coordinate system
 *
 * Glyphs are authored in **band units**, not pixels. One unit = the height of
 * one band on a four-line writing rule:
 *
 *     y = 0  ── top line        (ascender / cap height)
 *     y = 1  ── midline         (x-height)
 *     y = 2  ── baseline
 *     y = 3  ── descender line
 *
 * x is in the same unit, starting at 0 on the glyph's own left edge, so a glyph
 * carries its natural width and nothing is distorted when it is scaled to the
 * card. Uppercase occupies y 0→2; x-height lowercase y 1→2; ascenders y 0→2;
 * descenders y 1→3.
 *
 * ## Angles
 *
 * Arc angles are degrees on a **y-down** canvas:
 *   0° = right · 90° = bottom · 180° = left · 270°/-90° = top.
 * Sweeping from a smaller angle to a larger one therefore runs *clockwise on
 * screen*; a larger→smaller sweep runs counter-clockwise. Letterforms care
 * about this — a lowercase `a` bowl is counter-clockwise ("around like a c"),
 * a `b` bowl is clockwise.
 */

const TAU = Math.PI * 2;
const rad = (deg) => (deg * Math.PI) / 180;

/** A straight segment from (x1,y1) to (x2,y2). */
export const line = (x1, y1, x2, y2) => ({ k: 'line', x1, y1, x2, y2 });

/**
 * An elliptical arc around (cx,cy) with radii (rx,ry), swept from `a0` to `a1`
 * degrees. a1 > a0 sweeps clockwise on screen; a1 < a0 counter-clockwise.
 */
export const arc = (cx, cy, rx, ry, a0, a1) => ({ k: 'arc', cx, cy, rx, ry, a0, a1 });

/**
 * Mark a segment as a **retrace** — pen motion that doubles back over ink that
 * is already there (`h`, `m`, `n`, `r` all slide back up the stem before
 * arching over). Retraces belong in the path the finger follows, but not in
 * the letter's visible outline, and not in a free-draw scoring target where
 * doubled points would skew coverage. Two paths come out of one glyph.
 */
export const retrace = (seg) => ({ ...seg, retrace: true });

/** A cubic Bézier — for the few shapes an arc can't say cleanly (S spines, J hooks). */
export const cubic = (x1, y1, cx1, cy1, cx2, cy2, x2, y2) => ({
  k: 'cubic', x1, y1, cx1, cy1, cx2, cy2, x2, y2,
});

const arcPoint = (s, t) => {
  const a = rad(s.a0 + (s.a1 - s.a0) * t);
  return [s.cx + s.rx * Math.cos(a), s.cy + s.ry * Math.sin(a)];
};

const cubicPoint = (s, t) => {
  const u = 1 - t;
  const b0 = u * u * u, b1 = 3 * u * u * t, b2 = 3 * u * t * t, b3 = t * t * t;
  return [
    b0 * s.x1 + b1 * s.cx1 + b2 * s.cx2 + b3 * s.x2,
    b0 * s.y1 + b1 * s.cy1 + b2 * s.cy2 + b3 * s.y2,
  ];
};

/** Rough arc length of a segment, in band units — drives the sample count. */
function segLength(s) {
  if (s.k === 'line') return Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
  if (s.k === 'arc') {
    // Ramanujan's ellipse perimeter, scaled to the swept fraction.
    const { rx, ry } = s;
    const h = ((rx - ry) ** 2) / ((rx + ry) ** 2 || 1);
    const perim = Math.PI * (rx + ry) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
    return (perim * Math.abs(rad(s.a1 - s.a0))) / TAU;
  }
  // Cubic: the control polygon is a serviceable upper bound for sample counting.
  return (
    Math.hypot(s.cx1 - s.x1, s.cy1 - s.y1) +
    Math.hypot(s.cx2 - s.cx1, s.cy2 - s.cy1) +
    Math.hypot(s.x2 - s.cx2, s.y2 - s.cy2)
  );
}

function segPoint(s, t) {
  if (s.k === 'line') return [s.x1 + (s.x2 - s.x1) * t, s.y1 + (s.y2 - s.y1) * t];
  if (s.k === 'arc') return arcPoint(s, t);
  return cubicPoint(s, t);
}

/**
 * Flatten a pen-stroke (an ordered list of segments) into a point list, in the
 * SAME band-unit space it was authored in.
 *
 * `step` is the target spacing in band units. A straight line needs only its
 * two endpoints — subdividing it buys nothing and costs bytes — so lines are
 * emitted whole and only curves are sampled.
 */
export function flattenStroke(segments, step) {
  const pts = [];
  const push = (p) => {
    const last = pts[pts.length - 1];
    // Drop duplicates at segment joins (and anything closer than a tenth of a
    // step, which would only add noise to the guided projection).
    if (last && Math.hypot(p[0] - last[0], p[1] - last[1]) < step * 0.1) return;
    pts.push(p);
  };
  for (const s of segments) {
    if (s.k === 'line') {
      push([s.x1, s.y1]);
      push([s.x2, s.y2]);
      continue;
    }
    const n = Math.max(2, Math.ceil(segLength(s) / step));
    for (let i = 0; i <= n; i++) push(segPoint(s, i / n));
  }
  return pts;
}

/** Bounding box of a flattened point list. */
export function bbox(points) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of points) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1 };
}

/** Map band-unit points into canvas pixels and flatten to [x,y,x,y,...]. */
export function toCanvas(points, { originX, originY, scale, round = 1 }) {
  const q = (v) => Number(v.toFixed(round));
  const out = [];
  for (const [x, y] of points) {
    out.push(q(originX + x * scale), q(originY + y * scale));
  }
  return out;
}

/** Total length of a flat [x,y,...] polyline. */
export function pathLength(flat) {
  let d = 0;
  for (let i = 2; i < flat.length; i += 2) {
    d += Math.hypot(flat[i] - flat[i - 2], flat[i + 1] - flat[i - 1]);
  }
  return d;
}

/** The tangent angle (degrees, y-down) at the end of a flat polyline. */
export function endTangent(flat, backUp = 12) {
  const n = flat.length / 2;
  const bx = flat[flat.length - 2];
  const by = flat[flat.length - 1];
  let ax = flat[0];
  let ay = flat[1];
  // Walk back from the tip until we are `backUp` px away — using the very last
  // pair alone makes the arrowhead jitter on a densely sampled curve.
  for (let i = n - 2; i >= 0; i--) {
    const px = flat[i * 2];
    const py = flat[i * 2 + 1];
    if (Math.hypot(bx - px, by - py) >= backUp) { ax = px; ay = py; break; }
  }
  return (Math.atan2(by - ay, bx - ax) * 180) / Math.PI;
}

/**
 * Resample a flat polyline to roughly even spacing. The guided-drag projector
 * in the player scans a fixed 52px forward window along the path, so wildly
 * uneven point spacing makes the drag feel faster on some segments than others.
 */
export function resample(flat, spacing) {
  const pts = [];
  for (let i = 0; i < flat.length; i += 2) pts.push([flat[i], flat[i + 1]]);
  if (pts.length < 2) return flat.slice();
  const out = [pts[0]];
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    const d = Math.hypot(bx - ax, by - ay);
    if (d === 0) continue;
    let t = spacing - carry;
    while (t < d) {
      out.push([ax + ((bx - ax) * t) / d, ay + ((by - ay) * t) / d]);
      t += spacing;
    }
    carry = (carry + d) % spacing;
  }
  const last = pts[pts.length - 1];
  const tail = out[out.length - 1];
  if (Math.hypot(last[0] - tail[0], last[1] - tail[1]) > spacing * 0.25) out.push(last);
  else out[out.length - 1] = last;
  const flatOut = [];
  for (const [x, y] of out) flatOut.push(Number(x.toFixed(1)), Number(y.toFixed(1)));
  return flatOut;
}
