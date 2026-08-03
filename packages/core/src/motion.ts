import type { Ease, GlamLoop, GlamWander } from './types.js';

/**
 * Pure easing curves over a 0..1 phase — shared by `loopValueAt` and
 * `Wander`. Same shapes as Konva's Easings, reimplemented here (no Konva
 * dependency in core's pure motion math — Konva only enters at the scene/
 * player layer).
 */
function applyEase(ease: Ease | undefined, phase: number): number {
  switch (ease) {
    case 'easeIn':
      return phase * phase;
    case 'easeOut':
      return 1 - (1 - phase) * (1 - phase);
    case 'easeInOut':
      return phase < 0.5 ? 2 * phase * phase : 1 - ((-2 * phase + 2) ** 2) / 2;
    case 'backInOut': {
      // Spring overshoot on both ends — intentionally leaves [0,1] mid-curve.
      const c2 = 1.70158 * 1.525;
      return phase < 0.5
        ? ((2 * phase) ** 2 * ((c2 + 1) * 2 * phase - c2)) / 2
        : ((2 * phase - 2) ** 2 * ((c2 + 1) * (2 * phase - 2) + c2) + 2) / 2;
    }
    case 'elasticOut': {
      // Settle-with-wobble; overshoots then rings down to 1.
      if (phase === 0 || phase === 1) return phase;
      const c4 = (2 * Math.PI) / 3;
      return 2 ** (-10 * phase) * Math.sin((phase * 10 - 0.75) * c4) + 1;
    }
    case 'linear':
    default:
      return phase;
  }
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

/**
 * Deterministic value of a `GlamLoop` at `elapsedMs`. `loop.ms` is the full
 * round-trip period. `alternate` is a triangle wave: phase 0→1 across
 * `[0, ms/2]` then 1→0 across `[ms/2, ms]`, peaking at `ms/2`. `loop`
 * (default) is a sawtooth: 0→1 over `ms`, wrapping. The 0..1 phase is eased
 * before lerping `from`→`to`.
 */
export function loopValueAt(loop: GlamLoop, elapsedMs: number): number {
  const mode = loop.mode ?? 'loop';
  const ms = loop.ms;
  // Guard against a zero/negative period — treat as always-settled at "from".
  if (!(ms > 0)) {
    return loop.from;
  }
  const t = ((elapsedMs % ms) + ms) % ms; // wrap into [0, ms)

  let phase: number;
  if (mode === 'alternate') {
    const half = ms / 2;
    phase = t <= half ? t / half : (ms - t) / half;
  } else {
    phase = t / ms;
  }

  const eased = applyEase(loop.ease, phase);
  return lerp(loop.from, loop.to, eased);
}

interface Point {
  x: number;
  y: number;
}

/**
 * Deterministic free-drift motion within an ellipse. Starts at the ellipse
 * center `(cx, cy)`; each `stepMs` segment eases from the previous settled
 * point toward a freshly sampled target, then continues to the next.
 * `rng` is injected so behavior is fully deterministic/testable.
 */
export class Wander {
  private readonly w: GlamWander;
  private readonly rng: () => number;
  private readonly start: Point;
  // Sampled segment targets, cached by segment index (1-indexed, so
  // `targets[0]` is segment 1's target). Grows lazily as `valueAt` is asked
  // about later segments — each segment's target is drawn from `rng()`
  // exactly ONCE, the first time it's needed, regardless of how many times
  // `valueAt` is subsequently called within (or before) that segment. This
  // is what keeps `valueAt` stable per segment when driven by a stateful rng
  // (e.g. the player's `Math.random`) — see motion.test.ts's C1 regression.
  private readonly targets: Point[] = [];

  constructor(w: GlamWander, rng: () => number) {
    this.w = w;
    this.rng = rng;
    this.start = { x: w.cx, y: w.cy };
  }

  /** Samples the next target uniformly within the ellipse disk. */
  private sampleTarget(): Point {
    const { cx, cy, rx, ry } = this.w;
    const a = 2 * Math.PI * this.rng();
    const rad = Math.sqrt(this.rng());
    return {
      x: cx + rad * Math.cos(a) * rx,
      y: cy + rad * Math.sin(a) * ry,
    };
  }

  /** Returns segment n's (1-indexed) target, sampling + caching it on first access. */
  private targetForSegment(n: number): Point {
    while (this.targets.length < n) {
      this.targets.push(this.sampleTarget());
    }
    return this.targets[n - 1] as Point;
  }

  valueAt(elapsedMs: number): Point {
    const { stepMs } = this.w;
    if (elapsedMs <= 0 || !(stepMs > 0)) {
      return { ...this.start };
    }

    // Segment n (1-indexed) covers the time range ((n-1)*stepMs, n*stepMs],
    // easing from the previous settled point to the nth sampled target —
    // so a boundary time (elapsedMs an exact multiple of stepMs) resolves
    // to phase 1 of that segment (i.e. exactly its target), not phase 0 of
    // the next one.
    const n = Math.ceil(elapsedMs / stepMs);

    const prev = n === 1 ? this.start : this.targetForSegment(n - 1);
    const target = this.targetForSegment(n);

    const segStart = (n - 1) * stepMs;
    const phase = (elapsedMs - segStart) / stepMs;
    const eased = applyEase(this.w.ease ?? 'easeInOut', phase);
    return {
      x: lerp(prev.x, target.x, eased),
      y: lerp(prev.y, target.y, eased),
    };
  }
}
