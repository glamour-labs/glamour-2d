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

test('keepInk leaves the finished stroke standing', () => {
  h = createHarness(oneStroke);
  h.demo({ keepInk: true });

  expect(h.node('ink')!.points!.length).toBeGreaterThan(4); // still drawn
  const last = h.guided.filter((e) => e.demo).at(-1)!;
  expect(last.done).toBe(true);
  expect(last.progress).toBe(1); // reports what is on the canvas, not 0
});

test('keepInk demos ACCUMULATE across strokes — the letter builds up', () => {
  h = createHarness(twoStroke);

  h.demo({ index: 0, keepInk: true });
  const afterFirst = h.node('ink1')!.points!.length;
  expect(afterFirst).toBeGreaterThan(4);

  h.demo({ index: 1, keepInk: true });
  // The point of the flag: stroke 1 is untouched by stroke 2's demo. Without it,
  // starting the second demo clears the first (cancel-clears-outgoing).
  expect(h.node('ink1')!.points!.length).toBe(afterFirst);
  expect(h.node('ink2')!.points!.length).toBeGreaterThan(4);
});

test('a plain demo clears only its OWN stroke; kept ink is the host to clean up', () => {
  h = createHarness(twoStroke);
  h.demo({ index: 0, keepInk: true }); // leave stroke 1 standing
  const kept = h.node('ink1')!.points!.length;
  expect(kept).toBeGreaterThan(4);

  h.demo({ index: 1 }); // a plain demo: hands ITS stroke back blank
  expect(h.node('ink2')!.points).toEqual([]);
  // ...and does NOT tidy up after the earlier keep-ink run. Ending a demo clears
  // the demo's own stroke, and that one already finished — so this is `resetGuided`'s
  // job, which is exactly why it exists.
  expect(h.node('ink1')!.points!.length).toBe(kept);
});

test('interrupting a keep-ink demo mid-write does not wipe what it had drawn', () => {
  h = createHarness(twoStroke);
  // Frames have to be injected by hand here: the harness's `demo()` always runs to
  // completion, and this test is specifically about a demo caught IN FLIGHT.
  const step = (h.player as unknown as { __demoFrame(t: number): void }).__demoFrame;
  void h.player.demoGuided({ index: 0, durationMs: 1000, holdMs: 0, keepInk: true });
  step(0);
  step(500); // half written
  const partial = h.node('ink1')!.points!.length;
  expect(partial).toBeGreaterThan(0);

  h.player.demoGuided({ index: 1, keepInk: true }); // interrupt with another keep-ink run
  // The partial stroke survives: a keep-ink interruption must not clear, or a
  // stroke-by-stroke demonstration would lose whatever it was mid-way through.
  expect(h.node('ink1')!.points!.length).toBe(partial);
});

test('resetGuided wipes an accumulated demonstration and returns to stroke 1', () => {
  h = createHarness(twoStroke);
  h.demo({ index: 0, keepInk: true });
  h.demo({ index: 1, keepInk: true });
  expect(h.node('ink1')!.points!.length).toBeGreaterThan(4);
  expect(h.node('ink2')!.points!.length).toBeGreaterThan(4);

  h.player.resetGuided();
  expect(h.node('ink1')!.points).toEqual([]);
  expect(h.node('ink2')!.points).toEqual([]);
  expect(h.node('h1')!.x).toBeCloseTo(40, 0); // first stroke's handle, at its start
  expect(h.node('h1')!.y).toBeCloseTo(80, 0);

  // And the user can now draw stroke 1 — the cursor really went back.
  h.clearLog();
  h.stroke(dense([[40, 80], [180, 80]]));
  const done = h.guided.filter((e) => !e.demo && e.done);
  expect(done.length).toBe(1);
  expect(done[0].index).toBe(0);
});

test('resetGuided after real progress lets the whole letter be redrawn', () => {
  h = createHarness(twoStroke);
  h.stroke(dense([[40, 80], [180, 80]])); // stroke 1 really drawn
  h.player.resetGuided();
  h.clearLog();

  // Both strokes again, from the top.
  h.stroke(dense([[40, 80], [180, 80]]));
  h.stroke(dense([[40, 140], [180, 140]]));
  const dones = h.guided.filter((e) => !e.demo && e.done).map((e) => e.index);
  expect(dones).toEqual([0, 1]);
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

test('setMany applies every prop, skipping unknown nodes and props', () => {
  h = createHarness(twoStroke);
  h.player.setMany([
    ['h1', 'x', 111],
    ['h1', 'y', 222],
    ['h2', 'opacity', 0.5],
    ['nope', 'x', 5], // unknown node: skipped, never thrown
    ['h1', 'bogusProp', 1], // unknown prop: skipped, never thrown
  ]);
  expect(h.node('h1')!.x).toBe(111);
  expect(h.node('h1')!.y).toBe(222);
  expect(h.node('h2')!.opacity).toBe(0.5);
});

test('setMany leaves the same state as the equivalent run of set calls', () => {
  // The repaint saving itself is structural — one draw after the loop rather than
  // one per prop — and is not observable from the public surface, so this asserts
  // the part that is: the two paths are interchangeable in effect.
  h = createHarness(twoStroke);
  h.player.setMany([
    ['h1', 'x', 10],
    ['h2', 'x', 20],
  ]);
  expect([h.node('h1')!.x, h.node('h2')!.x]).toEqual([10, 20]);

  h.player.set('h1', 'x', 30);
  h.player.set('h2', 'x', 40);
  expect([h.node('h1')!.x, h.node('h2')!.x]).toEqual([30, 40]);
});

test('setMany with nothing to do is a no-op', () => {
  h = createHarness(twoStroke);
  expect(() => h.player.setMany([])).not.toThrow();
});
