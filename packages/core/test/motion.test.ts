import { expect, test } from 'vitest';
import { loopValueAt, Wander } from '../src/motion.js';
import type { GlamLoop, GlamWander } from '../src/types.js';

function loop(overrides: Partial<GlamLoop> = {}): GlamLoop {
  return { node: 'n', prop: 'x', from: 0, to: 100, ms: 1000, ...overrides };
}

test('loopValueAt: alternate mode peaks at ms/2', () => {
  expect(loopValueAt(loop({ mode: 'alternate' }), 500)).toBeCloseTo(100, 5);
});

test('loopValueAt: alternate mode returns to "from" at ms (full round trip)', () => {
  expect(loopValueAt(loop({ mode: 'alternate' }), 1000)).toBeCloseTo(0, 5);
});

test('loopValueAt: alternate mode is at "from" at t=0', () => {
  expect(loopValueAt(loop({ mode: 'alternate' }), 0)).toBeCloseTo(0, 5);
});

test('loopValueAt: loop mode (sawtooth) wraps to "from" at t=ms', () => {
  expect(loopValueAt(loop({ mode: 'loop' }), 1000)).toBeCloseTo(0, 5);
});

test('loopValueAt: loop mode is halfway at ms/2', () => {
  expect(loopValueAt(loop({ mode: 'loop' }), 500)).toBeCloseTo(50, 5);
});

test('loopValueAt: default mode is "loop" (sawtooth) when omitted', () => {
  expect(loopValueAt(loop(), 500)).toBeCloseTo(50, 5);
  expect(loopValueAt(loop(), 999)).toBeCloseTo(99.9, 1);
});

test('loopValueAt: loop mode wraps past one full period (t > ms)', () => {
  expect(loopValueAt(loop({ mode: 'loop' }), 1500)).toBeCloseTo(50, 5);
});

test('loopValueAt: eases the phase before lerping (easeIn is not linear at the midpoint)', () => {
  const linearMid = loopValueAt(loop({ mode: 'loop', ease: 'linear' }), 500);
  const easedMid = loopValueAt(loop({ mode: 'loop', ease: 'easeIn' }), 500);
  expect(linearMid).toBeCloseTo(50, 5);
  expect(easedMid).not.toBeCloseTo(50, 5);
});

function scriptedRng(values: number[]): () => number {
  let i = 0;
  return () => {
    const v = values[i % values.length];
    i++;
    return v as number;
  };
}

function wanderSpec(overrides: Partial<GlamWander> = {}): GlamWander {
  return { target: 'face', cx: 50, cy: 50, rx: 20, ry: 10, stepMs: 1000, ...overrides };
}

test('Wander: at t=0 is exactly the ellipse center (cx, cy)', () => {
  const w = new Wander(wanderSpec(), scriptedRng([0.25, 0.5]));
  const p = w.valueAt(0);
  expect(p.x).toBeCloseTo(50, 5);
  expect(p.y).toBeCloseTo(50, 5);
});

test('Wander: a radius draw of 0 lands exactly at (cx, cy)', () => {
  // rad = sqrt(rng()) = sqrt(0) = 0, regardless of the angle draw.
  const w = new Wander(wanderSpec(), scriptedRng([0.1, 0, 0.9, 0]));
  const p = w.valueAt(1000); // fully settled into the first sampled target
  expect(p.x).toBeCloseTo(50, 5);
  expect(p.y).toBeCloseTo(50, 5);
});

test('Wander: every sampled target over >=20 steps stays within the ellipse', () => {
  // 40 draws => up to 20 (angle, radius) target pairs.
  const rngValues = Array.from({ length: 40 }, (_, i) => (i * 0.137) % 1);
  const w = new Wander(wanderSpec(), scriptedRng(rngValues));
  const { cx, cy, rx, ry, stepMs } = wanderSpec();
  for (let step = 1; step <= 20; step++) {
    const p = w.valueAt(step * stepMs);
    const norm = ((p.x - cx) / rx) ** 2 + ((p.y - cy) / ry) ** 2;
    expect(norm).toBeLessThanOrEqual(1 + 1e-9);
  }
});

test('Wander: eases within a segment (position at stepMs/2 is not the linear midpoint)', () => {
  const w = new Wander(wanderSpec({ ease: 'easeIn' }), scriptedRng([0, 1])); // a=0, rad=1 -> target (cx+rx, cy)
  const mid = w.valueAt(500);
  const linearMid = { x: 50 + 20 / 2, y: 50 };
  expect(mid.x).not.toBeCloseTo(linearMid.x, 5);
});

/**
 * A deterministic-but-STATEFUL rng (mulberry32): unlike `scriptedRng` above,
 * every draw returns a genuinely different value, the same way `Math.random`
 * behaves when the player wires it in (loop.ts). Reproducible for the test,
 * but exercises the same "advances on every call" property that exposed C1.
 */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('Wander: valueAt is stable within a segment regardless of how many times it is called (C1/I1 memoization)', () => {
  // stepMs:1000 -> both t=500 and t=516 fall in segment n=1 (same segment).
  // With a stateful rng (fresh draws every call, exactly like the player's
  // Math.random), a correct implementation must sample segment 1's target
  // ONCE and cache it — so both calls land on the SAME eased curve. The bug
  // (pre-fix): `valueAt` re-samples the target from segment 1 up to n on
  // EVERY call, so a stateful rng hands back a fresh (different) target each
  // time `valueAt` is invoked, even though it's still segment 1 -> the two
  // points imply two different segment targets, i.e. a jitter jump instead
  // of continuous easing.
  const spec = wanderSpec({ cx: 50, cy: 50, rx: 100, ry: 100, stepMs: 1000, ease: 'easeInOut' });
  const w = new Wander(spec, mulberry32(12345));

  const p1 = w.valueAt(500); // phase 0.5 -> eased 0.5 (easeInOut symmetric point)
  const p2 = w.valueAt(516); // phase 0.516 -> eased ~0.5318, 16ms later in the SAME segment

  // Back out the implied segment target from each point, given the known
  // start point (cx,cy) and the known eased phase at each elapsedMs. If the
  // target was sampled once and cached, both points imply the SAME target.
  // If re-sampled per-call, the implied targets diverge by up to the full
  // ellipse span.
  function impliedTarget(p: { x: number; y: number }, eased: number) {
    return {
      x: spec.cx + (p.x - spec.cx) / eased,
      y: spec.cy + (p.y - spec.cy) / eased,
    };
  }
  const eased500 = 1 - ((-2 * 0.5 + 2) ** 2) / 2; // 0.5
  const eased516 = 1 - ((-2 * 0.516 + 2) ** 2) / 2; // ~0.5318
  const target1 = impliedTarget(p1, eased500);
  const target2 = impliedTarget(p2, eased516);

  expect(target2.x).toBeCloseTo(target1.x, 3);
  expect(target2.y).toBeCloseTo(target1.y, 3);

  // Also assert directly: 16ms of drift within a 1000ms segment must be a
  // small fraction of the ellipse (devil traced ~10px jumps on a much
  // smaller ellipse; here the diameter is 200, so a real jump would dwarf 5px).
  const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  expect(dist).toBeLessThan(5);
});

test('Wander: RNG is still called exactly twice per NEW segment, not per valueAt call', () => {
  let calls = 0;
  const countingRng = (): number => {
    calls++;
    return mulberry32(7)();
  };
  const w = new Wander(wanderSpec({ stepMs: 1000 }), countingRng);
  w.valueAt(500); // segment 1 -> should sample once (2 rng calls)
  w.valueAt(700); // still segment 1 -> should NOT sample again
  w.valueAt(999); // still segment 1
  expect(calls).toBe(2);
  w.valueAt(1500); // segment 2 -> one more sample (2 more rng calls)
  expect(calls).toBe(4);
});

test('backInOut overshoots below 0 early and above 1 late (spring, v1.1)', () => {
  const loop = { node: 'n', prop: 'x', from: 0, to: 100, ms: 1000, ease: 'backInOut' as const };
  // early phase should dip below `from` (anticipation)
  const early = loopValueAt(loop, 80);
  expect(early).toBeLessThan(0);
  // late phase should overshoot above `to` before settling
  const late = loopValueAt(loop, 920);
  expect(late).toBeGreaterThan(100);
  // phase 0 rests at `from`; near end-of-cycle (before the wrap at ms) it
  // settles at `to` (t == ms wraps to phase 0 by sawtooth design).
  expect(loopValueAt(loop, 0)).toBeCloseTo(0);
  expect(loopValueAt(loop, 999)).toBeCloseTo(100, 0);
});

test('elasticOut overshoots then settles to `to` (v1.1)', () => {
  const loop = { node: 'n', prop: 'x', from: 0, to: 100, ms: 1000, ease: 'elasticOut' as const };
  expect(loopValueAt(loop, 0)).toBeCloseTo(0);
  expect(loopValueAt(loop, 999)).toBeCloseTo(100, 0);
  // the first ring-down peak (early) exceeds the target
  const overshoot = loopValueAt(loop, 100);
  expect(overshoot).toBeGreaterThan(100);
});
