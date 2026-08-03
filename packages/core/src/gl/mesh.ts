/**
 * Triangle accumulation + tessellation for the WebGL2 backend.
 *
 * Every glamour primitive becomes triangles here. This is the work Konva's
 * Canvas2D path rasterizer used to do for free; owning it is the price of the
 * renderer swap. Vertices are position-only — colour is a uniform, because the
 * renderer draws one node at a time through a stencil pass (see renderer.ts),
 * so a per-vertex colour would be redundant.
 */

export class Mesh {
  v: number[] = [];

  clear(): void {
    this.v.length = 0;
  }

  get count(): number {
    return this.v.length / 2;
  }

  vert(x: number, y: number): void {
    this.v.push(x, y);
  }

  tri(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): void {
    this.v.push(ax, ay, bx, by, cx, cy);
  }

  quad(
    ax: number, ay: number, bx: number, by: number,
    cx: number, cy: number, dx: number, dy: number,
  ): void {
    this.tri(ax, ay, bx, by, cx, cy);
    this.tri(ax, ay, cx, cy, dx, dy);
  }

  /** Axis-aligned rect, optionally with rounded corners. */
  rect(x: number, y: number, w: number, h: number, cornerRadius = 0): void {
    const r = Math.max(0, Math.min(cornerRadius, Math.min(Math.abs(w), Math.abs(h)) / 2));
    if (r < 0.01) {
      this.quad(x, y, x + w, y, x + w, y + h, x, y + h);
      return;
    }
    // Middle band + top/bottom bands + four corner fans.
    this.quad(x, y + r, x + w, y + r, x + w, y + h - r, x, y + h - r);
    this.quad(x + r, y, x + w - r, y, x + w - r, y + r, x + r, y + r);
    this.quad(x + r, y + h - r, x + w - r, y + h - r, x + w - r, y + h, x + r, y + h);
    const corners: Array<[number, number, number]> = [
      [x + r, y + r, Math.PI],
      [x + w - r, y + r, -Math.PI / 2],
      [x + w - r, y + h - r, 0],
      [x + r, y + h - r, Math.PI / 2],
    ];
    for (const [cx, cy, a0] of corners) this.arcFan(cx, cy, r, a0, a0 + Math.PI / 2, 6);
  }

  /** Filled circle. */
  circle(cx: number, cy: number, r: number, segs = 0): void {
    this.ellipse(cx, cy, r, r, segs);
  }

  /** Filled ellipse. Segment count scales with size so big shapes stay smooth. */
  ellipse(cx: number, cy: number, rx: number, ry: number, segs = 0): void {
    if (rx <= 0 || ry <= 0) return;
    const n = segs || segsFor(Math.max(rx, ry));
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2;
      const a1 = ((i + 1) / n) * Math.PI * 2;
      this.tri(
        cx, cy,
        cx + Math.cos(a0) * rx, cy + Math.sin(a0) * ry,
        cx + Math.cos(a1) * rx, cy + Math.sin(a1) * ry,
      );
    }
  }

  /** Pie fan from a centre — used for rounded corners and caps. */
  arcFan(cx: number, cy: number, r: number, a0: number, a1: number, segs: number): void {
    for (let i = 0; i < segs; i++) {
      const t0 = a0 + ((a1 - a0) * i) / segs;
      const t1 = a0 + ((a1 - a0) * (i + 1)) / segs;
      this.tri(
        cx, cy,
        cx + Math.cos(t0) * r, cy + Math.sin(t0) * r,
        cx + Math.cos(t1) * r, cy + Math.sin(t1) * r,
      );
    }
  }

  /**
   * Ring segment — the `arc` node type. `angle` is in degrees, swept clockwise
   * from 0 = +x, matching Konva.Arc.
   */
  ring(cx: number, cy: number, inner: number, outer: number, angleDeg: number): void {
    const sweep = (angleDeg * Math.PI) / 180;
    if (Math.abs(sweep) < 1e-4 || outer <= 0) return;
    const n = Math.max(3, Math.ceil(segsFor(outer) * (Math.abs(sweep) / (Math.PI * 2))));
    const ri = Math.max(0, inner);
    for (let i = 0; i < n; i++) {
      const a0 = (sweep * i) / n;
      const a1 = (sweep * (i + 1)) / n;
      const c0 = Math.cos(a0), s0 = Math.sin(a0);
      const c1 = Math.cos(a1), s1 = Math.sin(a1);
      this.quad(
        cx + c0 * ri, cy + s0 * ri,
        cx + c0 * outer, cy + s0 * outer,
        cx + c1 * outer, cy + s1 * outer,
        cx + c1 * ri, cy + s1 * ri,
      );
    }
  }

  /**
   * Stroke a polyline: one expanded quad per segment plus a disc at every joint
   * and cap, so joins/caps read round. Overlapping triangles are harmless here
   * because the renderer resolves each node through a stencil union rather than
   * blending fragments — that is what kills the seam artifact a naive
   * quads-and-discs approach produces.
   */
  polyline(pts: readonly number[], width: number, closed = false): void {
    const hw = Math.max(width, 0.01) / 2;
    const n = pts.length;
    if (n < 4) {
      if (n === 2) this.circle(pts[0], pts[1], hw);
      return;
    }
    const last = closed ? n : n - 2;
    for (let i = 0; i < last; i += 2) {
      const x0 = pts[i], y0 = pts[i + 1];
      const x1 = pts[(i + 2) % n], y1 = pts[(i + 3) % n];
      let nx = y0 - y1, ny = x1 - x0;
      const len = Math.hypot(nx, ny);
      if (len < 1e-6) continue;
      nx = (nx / len) * hw;
      ny = (ny / len) * hw;
      this.quad(x0 + nx, y0 + ny, x1 + nx, y1 + ny, x1 - nx, y1 - ny, x0 - nx, y0 - ny);
    }
    const capSegs = segsFor(hw);
    for (let i = 0; i < n; i += 2) this.circle(pts[i], pts[i + 1], hw, capSegs);
  }

  /**
   * Fill a closed polygon. Uses ear clipping so concave shapes (the sparkle
   * stars, the crab silhouettes) fill correctly — a centroid fan would fail on
   * anything that is not star-convex.
   */
  polygon(pts: readonly number[]): void {
    const tris = earClip(pts);
    for (const [a, b, c] of tris) {
      this.tri(pts[a * 2], pts[a * 2 + 1], pts[b * 2], pts[b * 2 + 1], pts[c * 2], pts[c * 2 + 1]);
    }
  }

  /** Apply a rotation (degrees) about (ox, oy) to vertices added since `from`. */
  rotateFrom(from: number, ox: number, oy: number, deg: number): void {
    if (!deg) return;
    const a = (deg * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
    for (let i = from; i < this.v.length; i += 2) {
      const dx = this.v[i] - ox, dy = this.v[i + 1] - oy;
      this.v[i] = ox + dx * ca - dy * sa;
      this.v[i + 1] = oy + dx * sa + dy * ca;
    }
  }

  /** Translate vertices added since `from`. */
  translateFrom(from: number, dx: number, dy: number): void {
    if (!dx && !dy) return;
    for (let i = from; i < this.v.length; i += 2) {
      this.v[i] += dx;
      this.v[i + 1] += dy;
    }
  }
}

/** Circle segment count — enough that the polygon edge is sub-pixel. */
export function segsFor(r: number): number {
  return Math.max(8, Math.min(96, Math.ceil(Math.abs(r) * 1.6) + 8));
}

/**
 * Split a polyline into dash sub-paths by arc length. Konva expressed this as a
 * `dash` property; here it is geometry.
 */
export function dashify(pts: readonly number[], pattern: readonly number[]): number[][] {
  const on = pattern[0] ?? 0;
  const off = pattern[1] ?? on;
  if (on <= 0) return [pts.slice()];
  const cum = arcLengths(pts);
  const total = cum[cum.length - 1];
  const out: number[][] = [];
  let pos = 0;
  let guard = 0;
  while (pos < total && guard++ < 10000) {
    const seg = between(pts, cum, pos, Math.min(pos + on, total));
    if (seg.length >= 4) out.push(seg);
    pos += on + off;
  }
  return out;
}

/** Cumulative arc length at each vertex. */
export function arcLengths(pts: readonly number[]): number[] {
  const cum = [0];
  for (let i = 0; i + 3 < pts.length; i += 2) {
    cum.push(cum[cum.length - 1] + Math.hypot(pts[i + 2] - pts[i], pts[i + 3] - pts[i + 1]));
  }
  return cum;
}

/** Trim a polyline to `target` arc length, interpolating the exact tip. */
export function trim(pts: readonly number[], cum: readonly number[], target: number): number[] {
  if (target <= 0) return [];
  const total = cum[cum.length - 1];
  if (target >= total) return pts.slice();
  const out = [pts[0], pts[1]];
  for (let s = 0; s + 1 < cum.length; s++) {
    if (cum[s + 1] < target) {
      out.push(pts[(s + 1) * 2], pts[(s + 1) * 2 + 1]);
      continue;
    }
    const segLen = cum[s + 1] - cum[s];
    const t = segLen < 1e-6 ? 0 : (target - cum[s]) / segLen;
    out.push(
      pts[s * 2] + (pts[(s + 1) * 2] - pts[s * 2]) * t,
      pts[s * 2 + 1] + (pts[(s + 1) * 2 + 1] - pts[s * 2 + 1]) * t,
    );
    break;
  }
  return out;
}

/** Sub-path between two arc lengths. */
function between(pts: readonly number[], cum: readonly number[], a: number, b: number): number[] {
  const head = trim(pts, cum, b);
  if (head.length < 4) return [];
  const hc = arcLengths(head);
  const keep = hc[hc.length - 1] - a;
  if (keep <= 0) return [];
  const rev: number[] = [];
  for (let i = head.length - 2; i >= 0; i -= 2) rev.push(head[i], head[i + 1]);
  const cut = trim(rev, arcLengths(rev), keep);
  const back: number[] = [];
  for (let i = cut.length - 2; i >= 0; i -= 2) back.push(cut[i], cut[i + 1]);
  return back;
}

/**
 * Smooth a polyline the way Konva's `tension` did, so a tensioned stroke keeps
 * the same curve after the renderer swap.
 *
 * This is a faithful port of Konva's algorithm, not an approximation: a generic
 * cardinal spline uses a different parameterization and drifted ~4% on a
 * tension-0.5 stroke (caught by conformance/text-and-stroke.glam). Konva
 * expands each interior point into a control-point triple
 * (Util._getControlPoints), then draws quad -> cubics -> quad through them; we
 * do the same and flatten the curves into line segments.
 *
 * `closed` still uses the simpler cardinal path — Konva has a separate
 * closed-line routine, and closed tensioned strokes in the corpus are all
 * low-tension fills that already agree within threshold.
 */
export function tensionize(pts: readonly number[], tension: number, closed = false): number[] {
  if (!tension || pts.length < 6) return pts.slice();
  if (closed) return cardinalClosed(pts, tension);

  const tp = expandPoints(pts, tension);
  if (tp.length < 4) return pts.slice();

  const out: number[] = [pts[0], pts[1]];
  const lastOf = (): [number, number] => [out[out.length - 2], out[out.length - 1]];

  // Leading quadratic: control tp[0..1], end tp[2..3].
  flattenQuad(out, lastOf(), [tp[0], tp[1]], [tp[2], tp[3]]);

  // Interior cubics, consuming six values per span exactly as Konva does.
  let n = 4;
  while (n < tp.length - 2) {
    flattenCubic(
      out,
      lastOf(),
      [tp[n], tp[n + 1]],
      [tp[n + 2], tp[n + 3]],
      [tp[n + 4], tp[n + 5]],
    );
    n += 6;
  }

  // Trailing quadratic back to the real final point.
  flattenQuad(
    out,
    lastOf(),
    [tp[tp.length - 4], tp[tp.length - 3]],
    [pts[pts.length - 2], pts[pts.length - 1]],
  );
  return out;
}

/** Konva Util._getControlPoints. */
function controlPoints(
  x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, t: number,
): [number, number, number, number] {
  const d01 = Math.sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2);
  const d12 = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  const fa = (t * d01) / (d01 + d12);
  const fb = (t * d12) / (d01 + d12);
  return [
    x1 - fa * (x2 - x0), y1 - fa * (y2 - y0),
    x1 + fb * (x2 - x0), y1 + fb * (y2 - y0),
  ];
}

/** Konva Util._expandPoints. */
function expandPoints(p: readonly number[], tension: number): number[] {
  const out: number[] = [];
  for (let n = 2; n < p.length - 2; n += 2) {
    const cp = controlPoints(p[n - 2], p[n - 1], p[n], p[n + 1], p[n + 2], p[n + 3], tension);
    if (Number.isNaN(cp[0])) continue;
    out.push(cp[0], cp[1], p[n], p[n + 1], cp[2], cp[3]);
  }
  return out;
}

/** Segments per flattened curve span — sub-pixel at these scales. */
const CURVE_STEPS = 12;

function flattenQuad(
  out: number[], from: [number, number], c: [number, number], to: [number, number],
): void {
  for (let i = 1; i <= CURVE_STEPS; i++) {
    const t = i / CURVE_STEPS;
    const u = 1 - t;
    out.push(
      u * u * from[0] + 2 * u * t * c[0] + t * t * to[0],
      u * u * from[1] + 2 * u * t * c[1] + t * t * to[1],
    );
  }
}

function flattenCubic(
  out: number[], from: [number, number],
  c1: [number, number], c2: [number, number], to: [number, number],
): void {
  for (let i = 1; i <= CURVE_STEPS; i++) {
    const t = i / CURVE_STEPS;
    const u = 1 - t;
    out.push(
      u * u * u * from[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * to[0],
      u * u * u * from[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * to[1],
    );
  }
}

/** Cardinal spline, retained for closed tensioned outlines. */
function cardinalClosed(pts: readonly number[], tension: number): number[] {
  const n = pts.length / 2;
  const at = (i: number): [number, number] => {
    const j = (i + n) % n;
    return [pts[j * 2], pts[j * 2 + 1]];
  };
  const out: number[] = [];
  const steps = 8;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = at(i - 1);
    const [x1, y1] = at(i);
    const [x2, y2] = at(i + 1);
    const [x3, y3] = at(i + 2);
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      const m = tension;
      const b0 = -m * t3 + 2 * m * t2 - m * t;
      const b1 = (2 - m) * t3 + (m - 3) * t2 + 1;
      const b2 = (m - 2) * t3 + (3 - 2 * m) * t2 + m * t;
      const b3 = m * t3 - m * t2;
      out.push(x0 * b0 + x1 * b1 + x2 * b2 + x3 * b3, y0 * b0 + y1 * b1 + y2 * b2 + y3 * b3);
    }
  }
  const [lx, ly] = at(0);
  out.push(lx, ly);
  return out;
}

/** Ear clipping. Returns index triples into the point array. */
function earClip(pts: readonly number[]): Array<[number, number, number]> {
  const n = pts.length / 2;
  const out: Array<[number, number, number]> = [];
  if (n < 3) return out;
  const idx = Array.from({ length: n }, (_, i) => i);
  // Work in a consistent winding so the convexity test has a fixed sign.
  if (signedArea(pts, idx) < 0) idx.reverse();
  let guard = 0;
  while (idx.length > 3 && guard++ < n * n + 16) {
    let clipped = false;
    for (let i = 0; i < idx.length; i++) {
      const a = idx[(i + idx.length - 1) % idx.length];
      const b = idx[i];
      const c = idx[(i + 1) % idx.length];
      if (!isConvex(pts, a, b, c)) continue;
      let contains = false;
      for (const p of idx) {
        if (p === a || p === b || p === c) continue;
        if (pointInTri(pts, p, a, b, c)) { contains = true; break; }
      }
      if (contains) continue;
      out.push([a, b, c]);
      idx.splice(i, 1);
      clipped = true;
      break;
    }
    // Degenerate/self-intersecting ring — fall back to a centroid fan rather
    // than dropping the node entirely.
    if (!clipped) break;
  }
  if (idx.length === 3) out.push([idx[0], idx[1], idx[2]]);
  else if (idx.length > 3) {
    for (let i = 1; i + 1 < idx.length; i++) out.push([idx[0], idx[i], idx[i + 1]]);
  }
  return out;
}

function signedArea(pts: readonly number[], idx: readonly number[]): number {
  let a = 0;
  for (let i = 0; i < idx.length; i++) {
    const p = idx[i], q = idx[(i + 1) % idx.length];
    a += pts[p * 2] * pts[q * 2 + 1] - pts[q * 2] * pts[p * 2 + 1];
  }
  return a / 2;
}

function isConvex(pts: readonly number[], a: number, b: number, c: number): boolean {
  const cross = (pts[b * 2] - pts[a * 2]) * (pts[c * 2 + 1] - pts[a * 2 + 1])
    - (pts[b * 2 + 1] - pts[a * 2 + 1]) * (pts[c * 2] - pts[a * 2]);
  return cross > 0;
}

function pointInTri(pts: readonly number[], p: number, a: number, b: number, c: number): boolean {
  const px = pts[p * 2], py = pts[p * 2 + 1];
  const s = (x0: number, y0: number, x1: number, y1: number): number =>
    (x1 - x0) * (py - y0) - (y1 - y0) * (px - x0);
  const d1 = s(pts[a * 2], pts[a * 2 + 1], pts[b * 2], pts[b * 2 + 1]);
  const d2 = s(pts[b * 2], pts[b * 2 + 1], pts[c * 2], pts[c * 2 + 1]);
  const d3 = s(pts[c * 2], pts[c * 2 + 1], pts[a * 2], pts[a * 2 + 1]);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}
