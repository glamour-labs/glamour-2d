/**
 * Rung 2: trace-matching — pure geometry, no Konva, no host. Given a TARGET
 * polyline (the shape the user should follow) and a DRAWN polyline (what they
 * actually inked), score how well the drawing traced the target.
 *
 * Deliberately pure + deterministic so it lives in core and is unit-testable in
 * isolation. It returns SIGNALS, not a pass/fail verdict — the host decides the
 * threshold (mission rule: game logic stays in React). Both paths are flat
 * `[x0,y0,x1,y1,...]` arrays, same convention as a Konva.Line's `points`.
 */

export interface TraceResult {
  /** 0..1 — fraction of target vertices with a drawn point within `tolerance`. */
  coverage: number;
  /** 0..1 — fraction of drawn vertices that stray off every target segment. */
  stray: number;
  /** did the stroke START near the target's first point (right direction)? */
  startOk: boolean;
  /** did the stroke END near the target's last point? */
  endOk: boolean;
  /** 0..1 combined score: coverage penalized by stray. Host picks the threshold. */
  score: number;
}

interface Pt {
  x: number;
  y: number;
}

function toPts(flat: number[]): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) {
    out.push({ x: flat[i] as number, y: flat[i + 1] as number });
  }
  return out;
}

function dist2(a: Pt, b: Pt): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

/** Euclidean distance from point p to segment ab (not squared). */
function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lenSq = abx * abx + aby * aby;
  if (lenSq === 0) return Math.sqrt(dist2(p, a)); // degenerate segment
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const proj: Pt = { x: a.x + t * abx, y: a.y + t * aby };
  return Math.sqrt(dist2(p, proj));
}

export function traceMatch(target: number[], drawn: number[], tolerance: number): TraceResult {
  const T = toPts(target);
  const D = toPts(drawn);
  const empty: TraceResult = { coverage: 0, stray: 1, startOk: false, endOk: false, score: 0 };
  if (T.length === 0 || D.length === 0 || !(tolerance > 0)) {
    return empty;
  }
  const tol2 = tolerance * tolerance;

  // Coverage: each target vertex is "reached" if any drawn point is within
  // tolerance of it — did the ink pass through the whole target?
  let covered = 0;
  for (const t of T) {
    for (const d of D) {
      if (dist2(t, d) <= tol2) {
        covered++;
        break;
      }
    }
  }
  const coverage = covered / T.length;

  // Stray: each drawn point is "on path" if within tolerance of any target
  // SEGMENT (not just a vertex) — did they scribble off the shape?
  let strayCount = 0;
  for (const d of D) {
    let onPath = false;
    if (T.length === 1) {
      onPath = dist2(d, T[0] as Pt) <= tol2;
    } else {
      for (let i = 0; i + 1 < T.length; i++) {
        if (distToSegment(d, T[i] as Pt, T[i + 1] as Pt) <= tolerance) {
          onPath = true;
          break;
        }
      }
    }
    if (!onPath) strayCount++;
  }
  const stray = strayCount / D.length;

  const startOk = dist2(D[0] as Pt, T[0] as Pt) <= tol2;
  const endOk = dist2(D[D.length - 1] as Pt, T[T.length - 1] as Pt) <= tol2;
  const score = Math.max(0, Math.min(1, coverage * (1 - stray)));

  return { coverage, stray, startOk, endOk, score };
}
