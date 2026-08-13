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
    {
      id: 'arrow',
      type: 'stroke',
      x: 20,
      y: 120,
      points: [0, -10, 7, 6, -7, 6],
      closed: true,
      fill: '#1c9ff2',
    },
  ],
  guided: {
    strokes: [{ path: [20, 120, 90, 180, 200, 40], into: 'ink', handle: 'handle', arrow: 'arrow' }],
    emit: 'checked',
  },
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

test('setGuidedProgress trims the ink and carries the handle to that point', () => {
  h = createHarness(twoStroke); // a straight 40->180 path, so the tip is arithmetic
  h.player.setGuidedProgress(0, 0.5);

  expect(h.node('ink1')!.points!.length).toBeGreaterThan(2);
  expect(h.node('h1')!.x).toBeCloseTo(110, 0);
  expect(h.node('h1')!.y).toBeCloseTo(80, 0);

  h.player.setGuidedProgress(0, 1);
  expect(h.node('h1')!.x).toBeCloseTo(180, 0);
});

test('t is clamped, and 0 hands back a blank stroke', () => {
  h = createHarness(twoStroke);
  h.player.setGuidedProgress(0, 5);
  expect(h.node('h1')!.x).toBeCloseTo(180, 0);

  h.player.setGuidedProgress(0, 0);
  expect(h.node('ink1')!.points).toEqual([]);
  expect(h.node('h1')!.x).toBeCloseTo(40, 0);
});

test('the arrow turns to the path tangent as progress moves', () => {
  h = createHarness(oneStroke); // path turns a corner, so the tangent must change
  h.player.setGuidedProgress(0, 0.1);
  const early = h.node('arrow')!.rotation;
  h.player.setGuidedProgress(0, 0.9);
  expect(h.node('arrow')!.rotation).not.toBeCloseTo(early, 1);
});

test('painting a stroke fires no guided event — the host asked, it already knows', () => {
  h = createHarness(oneStroke);
  h.writeGuided(0);
  expect(h.guided.length).toBe(0);
  expect(h.emits.length).toBe(0);
});

test('being shown a stroke does NOT advance the cursor — the user still draws it', () => {
  h = createHarness(oneStroke);
  h.writeGuided(0);
  h.player.resetGuided();

  h.stroke(dense([[20, 120], [90, 180], [200, 40]]));

  const done = h.guided.filter((e) => e.done);
  expect(done.length).toBe(1);
  expect(done[0].index).toBe(0); // still stroke 0, not skipped past
  expect(h.emits.map((e) => e.event)).toContain('checked');
});

test('strokes accumulate: painting stroke 2 leaves stroke 1 standing', () => {
  h = createHarness(twoStroke);
  h.writeGuided(0);
  const first = h.node('ink1')!.points!.length;
  expect(first).toBeGreaterThan(2);

  h.writeGuided(1);
  // Each stroke paints into its OWN `into` node, so building up a whole letter
  // needs no flag — it is what happens unless the host clears.
  expect(h.node('ink1')!.points!.length).toBe(first);
  expect(h.node('ink2')!.points!.length).toBeGreaterThan(2);
});

test('an out-of-range index is a no-op', () => {
  h = createHarness(twoStroke);
  expect(() => {
    h.player.setGuidedProgress(-1, 0.5);
    h.player.setGuidedProgress(9, 0.5);
  }).not.toThrow();
  expect(h.node('ink1')!.points).toEqual([]);
  expect(h.node('ink2')!.points).toEqual([]);
});

test('setGuidedProgress on a doc with no guided block does nothing', () => {
  const plain: GlamDoc = {
    schema: 'glamour/v0',
    canvas: { w: 100, h: 100 },
    nodes: [{ id: 'dot', type: 'circle', x: 50, y: 50, r: 10, fill: '#000' }],
  };
  h = createHarness(plain);
  expect(() => h.player.setGuidedProgress(0, 0.5)).not.toThrow();
});

test('a stroke under a finger is not the host to move', () => {
  h = createHarness(twoStroke);
  h.down(40, 80).move(110, 80); // mid-drag, halfway along
  const mid = h.node('h1')!.x;

  h.player.setGuidedProgress(0, 0);
  expect(h.node('h1')!.x).toBeCloseTo(mid, 0); // unmoved
});

test('disabling input stops drags, and dropping one already in flight', () => {
  h = createHarness(oneStroke);
  h.player.setGuidedInputEnabled(false);

  h.stroke(dense([[20, 120], [90, 180], [200, 40]]));
  expect(h.guided.length).toBe(0); // nothing from the drag
  expect(h.emits.length).toBe(0); // and certainly no completion

  // ...and now the host CAN paint, because the finger has been let go of.
  h.player.setGuidedProgress(0, 1);
  expect(h.node('ink')!.points!.length).toBeGreaterThan(2);
});

test('re-enabling input hands control back to the pointer', () => {
  h = createHarness(oneStroke);
  h.player.setGuidedInputEnabled(false);
  h.writeGuided(0);
  h.player.resetGuided();
  h.player.setGuidedInputEnabled(true);

  h.stroke(dense([[20, 120], [90, 180], [200, 40]]));
  expect(h.guided.filter((e) => e.done).length).toBe(1);
});

test('resetGuided wipes an accumulated demonstration and returns to stroke 1', () => {
  h = createHarness(twoStroke);
  h.writeGuided(0);
  h.writeGuided(1);
  expect(h.node('ink1')!.points!.length).toBeGreaterThan(2);
  expect(h.node('ink2')!.points!.length).toBeGreaterThan(2);

  h.player.resetGuided();
  expect(h.node('ink1')!.points).toEqual([]);
  expect(h.node('ink2')!.points).toEqual([]);
  expect(h.node('h1')!.x).toBeCloseTo(40, 0); // first stroke's handle, at its start
  expect(h.node('h1')!.y).toBeCloseTo(80, 0);

  // And the user can now draw stroke 1 — the cursor really went back.
  h.clearLog();
  h.stroke(dense([[40, 80], [180, 80]]));
  const done = h.guided.filter((e) => e.done);
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
  expect(h.guided.filter((e) => e.done).map((e) => e.index)).toEqual([0, 1]);
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
