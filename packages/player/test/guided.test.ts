import { afterEach, expect, test } from 'vitest';
import type { GlamDoc } from '@glam/core';
import { createHarness, type Harness } from '../src/harness.js';

let h: Harness;
afterEach(() => h?.destroy());

// densify a vertex path into small steps, the way a real finger-drag streams moves
function dense(vertices: Array<[number, number]>, step = 8): Array<[number, number]> {
  const out: Array<[number, number]> = [vertices[0]];
  for (let i = 1; i < vertices.length; i++) {
    const [x0, y0] = vertices[i - 1];
    const [x1, y1] = vertices[i];
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / step));
    for (let k = 1; k <= n; k++) out.push([x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n]);
  }
  return out;
}

// a single guided stroke: a check-ish path (down-right, then up-right). Not a letter.
const guidedDoc: GlamDoc = {
  schema: 'glamour/v0.1',
  canvas: { w: 220, h: 220 },
  nodes: [
    { id: 'ink', type: 'stroke', x: 0, y: 0, points: [], stroke: '#1a1a1a', strokeWidth: 12 },
    { id: 'handle', type: 'circle', x: 20, y: 120, r: 16, fill: '#1c9ff2' },
  ],
  guided: { strokes: [{ path: [20, 120, 90, 180, 200, 40], into: 'ink', handle: 'handle' }], emit: 'checked' },
};

test('resting: ink empty, handle seeded at the path start', () => {
  h = createHarness(guidedDoc);
  expect(h.node('ink')!.points).toEqual([]); // no ink until the drag starts
  expect(h.node('handle')!.x).toBeCloseTo(20, 1);
  expect(h.node('handle')!.y).toBeCloseTo(120, 1);
});

test('full go: dragging the handle along the path completes and fires done + emit', () => {
  h = createHarness(guidedDoc);
  h.stroke(dense([[20, 120], [90, 180], [200, 40]]));
  const last = h.guided[h.guided.length - 1];
  expect(last.done).toBe(true);
  expect(last.index).toBe(0);
  expect(h.emits.map((e) => e.event)).toContain('checked');
  expect(h.node('ink')!.points!.length).toBeGreaterThan(4); // ink drawn along the path
});

test('HALF GO: stop partway → progress < 1, no done, ink is partial, handle moved', () => {
  h = createHarness(guidedDoc);
  h.dragTo(dense([[20, 120], [90, 180]])); // to the elbow only, no up()
  expect(h.guided.some((e) => e.done)).toBe(false);
  const p = h.guided[h.guided.length - 1].progress;
  expect(p).toBeGreaterThan(0);
  expect(p).toBeLessThan(1);
  expect(h.node('handle')!.y).toBeGreaterThan(120); // handle rode down the path
});

test('forgiving: releasing partway STAYS (no reset, no complete)', () => {
  h = createHarness(guidedDoc);
  h.stroke(dense([[20, 120], [90, 180]])); // full down+up to the elbow, but not the end
  expect(h.guided.some((e) => e.done)).toBe(false); // did not complete
  expect(h.node('ink')!.points!.length).toBeGreaterThan(2); // ink stayed (not cleared)
});

test('wrong-way: dragging far off the path does not advance', () => {
  h = createHarness(guidedDoc);
  h.dragTo(dense([[20, 120], [20, 210], [20, 215]])); // straight down, away from the path
  const p = h.guided.length ? h.guided[h.guided.length - 1].progress : 0;
  expect(p).toBeLessThan(0.2);
});

// two guided strokes (e.g. an equals sign): each drawn in order
const twoStroke: GlamDoc = {
  schema: 'glamour/v0.1',
  canvas: { w: 200, h: 200 },
  nodes: [
    { id: 'a', type: 'stroke', x: 0, y: 0, points: [], stroke: '#1a1a1a' },
    { id: 'b', type: 'stroke', x: 0, y: 0, points: [], stroke: '#1a1a1a' },
    { id: 'h1', type: 'circle', x: 40, y: 70, r: 16, fill: '#1c9ff2' },
    { id: 'h2', type: 'circle', x: 40, y: 130, r: 16, fill: '#1c9ff2' },
  ],
  guided: {
    strokes: [
      { path: [40, 70, 160, 70], into: 'a', handle: 'h1' },
      { path: [40, 130, 160, 130], into: 'b', handle: 'h2' },
    ],
  },
};

test('multi-stroke: strokes complete in order (index 0 then 1), and accumulate', () => {
  h = createHarness(twoStroke);
  h.stroke(dense([[40, 70], [160, 70]]));   // stroke 0
  h.stroke(dense([[40, 130], [160, 130]])); // stroke 1
  const dones = h.guided.filter((e) => e.done).map((e) => e.index);
  expect(dones).toEqual([0, 1]);
  expect(h.node('a')!.points!.length).toBeGreaterThan(2);
  expect(h.node('b')!.points!.length).toBeGreaterThan(2); // stroke 0 not erased
});

// A path SHORTER than the projector's own 52px forward window. This is the
// degenerate end of the length distribution — the dot on a lowercase `i` is a
// ~6px stroke — and it used to be unfinishable: `win = 52/total` exceeded 1,
// so the sample grid stepped straight over the end (0, 0.36, 0.71, break) and
// progress saturated below every completion gate. Regression guard.
const tinyDoc: GlamDoc = {
  schema: 'glamour/v0.1',
  canvas: { w: 200, h: 200 },
  nodes: [
    { id: 'ink', type: 'stroke', x: 0, y: 0, points: [], stroke: '#1a1a1a', strokeWidth: 22 },
    { id: 'handle', type: 'circle', x: 100, y: 98, r: 14, fill: '#2e9e5b' },
  ],
  // 5.6px — the ACTUAL length of the dot on a lowercase `i` at worksheet pen
  // weight. The length matters: the old sample grid stepped in `2/total`, so it
  // happened to land exactly on t=1 whenever `total` was an even divisor — 6.0px
  // passed under the bug. Picking a round number here would make this test green
  // against the unfixed code, which is precisely how the first version of this
  // guard was hollow. Verified by mutation: revert the clamp and this goes red.
  guided: { strokes: [{ path: [100, 98, 100, 103.6], into: 'ink', handle: 'handle' }], emit: 'dotted' },
};

test('a guided path shorter than the 52px projection window still completes', () => {
  h = createHarness(tinyDoc);
  h.stroke(dense([[100, 98], [100, 103.6]], 2));
  const last = h.guided[h.guided.length - 1];
  expect(last.done).toBe(true);
  expect(last.progress).toBe(1);
  expect(h.emits.map((e) => e.event)).toContain('dotted');
});

test('a short path is still gated on grabbing the handle first', () => {
  // The clamp must not make a tiny stroke complete itself. A press that never
  // lands within the grab radius must not start a drag at all.
  //
  // Note what is NOT asserted: that a *grabbed* tiny path can be missed. It
  // cannot, and should not be — a 6px dot inside a 60px tolerance is finished
  // by any press near it, which is the right behaviour for a dot. Precision is
  // the wrong thing to demand of a full stop.
  h = createHarness(tinyDoc);
  h.stroke(dense([[190, 190], [186, 184]], 3));
  expect(h.guided.some((e) => e.done)).toBe(false);
  expect(h.node('ink')!.points).toEqual([]);
});
