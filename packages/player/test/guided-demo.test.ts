import { afterEach, expect, test } from 'vitest';
import type { GlamDoc } from '@glamour-labs/core';
import { createHarness, type Harness } from '../src/harness.js';

let h: Harness;
afterEach(() => h?.destroy());

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

const oneStroke: GlamDoc = {
  schema: 'glamour/v0.1',
  canvas: { w: 220, h: 220 },
  nodes: [
    { id: 'ink', type: 'stroke', x: 0, y: 0, points: [], stroke: '#1a1a1a', strokeWidth: 12 },
    { id: 'handle', type: 'circle', x: 20, y: 120, r: 16, fill: '#1c9ff2' },
  ],
  guided: { strokes: [{ path: [20, 120, 90, 180, 200, 40], into: 'ink', handle: 'handle' }], emit: 'checked' },
};

const twoStroke: GlamDoc = {
  schema: 'glamour/v0.1',
  canvas: { w: 220, h: 220 },
  nodes: [
    { id: 'ink1', type: 'stroke', x: 0, y: 0, points: [], stroke: '#1a1a1a', strokeWidth: 10 },
    { id: 'ink2', type: 'stroke', x: 0, y: 0, points: [], stroke: '#1a1a1a', strokeWidth: 10 },
    { id: 'h1', type: 'circle', x: 40, y: 80, r: 14, fill: '#1c9ff2' },
    { id: 'h2', type: 'circle', x: 40, y: 140, r: 14, fill: '#1c9ff2' },
  ],
  guided: {
    strokes: [
      { path: [40, 80, 180, 80], into: 'ink1', handle: 'h1' },
      { path: [40, 140, 180, 140], into: 'ink2', handle: 'h2' },
    ],
  },
};

test('the demo draws the stroke, then clears it so the user still has to', () => {
  h = createHarness(oneStroke);
  h.demo();

  const demoEvents = h.guided.filter((e) => e.demo);
  expect(demoEvents.length).toBeGreaterThan(3); // a stream, not one jump

  // Mid-demo the ink existed: some event reported real progress.
  expect(demoEvents.some((e) => e.progress > 0.4 && !e.done)).toBe(true);

  // It ends by handing back a BLANK stroke — the point of the whole feature.
  const last = demoEvents[demoEvents.length - 1];
  expect(last.done).toBe(true);
  expect(last.progress).toBe(0);
  expect(h.node('ink')!.points).toEqual([]);
  // ...and the handle is back at the path start, ready to be grabbed.
  expect(h.node('handle')!.x).toBeCloseTo(20, 0);
  expect(h.node('handle')!.y).toBeCloseTo(120, 0);
});

test('a demo does NOT advance the stroke — the user then draws the same one', () => {
  h = createHarness(oneStroke);
  h.demo();
  h.clearLog();

  h.stroke(dense([[20, 120], [90, 180], [200, 40]]));

  const real = h.guided.filter((e) => !e.demo);
  const done = real.filter((e) => e.done);
  expect(done.length).toBe(1);
  expect(done[0].index).toBe(0); // still stroke 0, not skipped past
  expect(h.emits.map((e) => e.event)).toContain('checked');
});

test('progress during a demo is flagged, so a host can tell it from the user', () => {
  h = createHarness(oneStroke);
  h.demo();
  expect(h.guided.length).toBeGreaterThan(0);
  expect(h.guided.every((e) => e.demo === true)).toBe(true);

  h.clearLog();
  h.stroke(dense([[20, 120], [90, 180], [200, 40]]));
  expect(h.guided.length).toBeGreaterThan(0);
  expect(h.guided.every((e) => e.demo)).toBe(false);
});

test('pointer input is ignored while a demo plays', () => {
  h = createHarness(oneStroke);
  // Start a demo but do NOT drive it to completion, so it is still in flight.
  void h.player.demoGuided({ durationMs: 5000, holdMs: 0 });

  h.stroke(dense([[20, 120], [90, 180], [200, 40]]));
  expect(h.guided.some((e) => !e.demo)).toBe(false); // nothing from the drag
  expect(h.emits.length).toBe(0); // and certainly no completion
});

test('cancelling a demo clears its ink and hands control back', () => {
  h = createHarness(oneStroke);
  void h.player.demoGuided({ durationMs: 5000, holdMs: 0 });
  h.player.cancelGuidedDemo();

  expect(h.node('ink')!.points).toEqual([]);
  // The drag now works, which is what "control handed back" means.
  h.stroke(dense([[20, 120], [90, 180], [200, 40]]));
  expect(h.guided.filter((e) => !e.demo && e.done).length).toBe(1);
});

test('demoGuided defaults to the stroke the user is about to draw', () => {
  h = createHarness(twoStroke);

  h.demo(); // stroke 0
  expect(h.guided.filter((e) => e.demo).every((e) => e.index === 0)).toBe(true);
  h.stroke(dense([[40, 80], [180, 80]])); // user draws stroke 0

  h.clearLog();
  h.demo(); // no index passed -> should now be stroke 1
  const idx = [...new Set(h.guided.filter((e) => e.demo).map((e) => e.index))];
  expect(idx).toEqual([1]);
});

test('a demo of a later stroke leaves earlier ink alone', () => {
  h = createHarness(twoStroke);
  h.stroke(dense([[40, 80], [180, 80]])); // stroke 0 really drawn
  const inkedAfterFirst = h.node('ink1')!.points!.length;
  expect(inkedAfterFirst).toBeGreaterThan(2);

  h.demo({ index: 1 });
  // Clearing stroke 1's ink must not wipe the stroke the user already earned.
  expect(h.node('ink1')!.points!.length).toBe(inkedAfterFirst);
  expect(h.node('ink2')!.points).toEqual([]);
});

test('destroy resolves a demo in flight rather than leaving a host awaiting', async () => {
  const local = createHarness(oneStroke);
  const pending = local.player.demoGuided({ durationMs: 100_000, holdMs: 0 });
  local.destroy();
  await expect(pending).resolves.toBeUndefined();
});

test('demoGuided on a doc with no guided block resolves without throwing', async () => {
  const plain: GlamDoc = {
    schema: 'glamour/v0',
    canvas: { w: 100, h: 100 },
    nodes: [{ id: 'dot', type: 'circle', x: 50, y: 50, r: 10, fill: '#000' }],
  };
  h = createHarness(plain);
  await expect(h.player.demoGuided()).resolves.toBeUndefined();
});
