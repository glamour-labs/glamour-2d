import { afterEach, expect, test } from 'vitest';
import type { GlamDoc } from '@glamour-labs/core';
import { createHarness, type Harness } from '../src/harness.js';

let h: Harness;
afterEach(() => h?.destroy());

// ---- ink: trace scoring (single stroke) ----
const inkDoc: GlamDoc = {
  schema: 'glamour/v0.1',
  canvas: { w: 200, h: 200 },
  nodes: [
    { id: 'guide', type: 'stroke', x: 0, y: 0, points: [10, 10, 100, 100], stroke: '#ccc' },
    { id: 'ink', type: 'stroke', x: 0, y: 0, points: [], stroke: '#222', strokeWidth: 6 },
  ],
  ink: { into: 'ink', emit: 'traced', match: { target: [10, 10, 55, 55, 100, 100], tolerance: 20 } },
};

test('stroke() drives a full drag and returns the trace score', () => {
  h = createHarness(inkDoc);
  const e = h.stroke([[10, 10], [55, 55], [100, 100]]);
  expect(e?.event).toBe('traced');
  expect(e?.match?.score).toBeGreaterThan(0.8);
  expect(e?.match?.startOk).toBe(true);
});

test('an off-path scribble scores low (host would reject)', () => {
  h = createHarness(inkDoc);
  const e = h.stroke([[180, 10], [180, 60], [180, 120]]);
  expect(e?.match?.score).toBeLessThan(0.2);
});

test('HALF GO: dragTo leaves ink mid-drag with NO stroke event until up()', () => {
  h = createHarness(inkDoc);
  h.dragTo([[10, 10], [55, 55]]); // no up
  expect(h.strokes).toHaveLength(0); // not finished
  expect(h.node('ink')!.points!.length).toBeGreaterThan(0); // but ink is being drawn
  h.up(); // now finish
  expect(h.strokes).toHaveLength(1);
});

// ---- ink: multi-stroke accumulation ----
const multiDoc: GlamDoc = {
  schema: 'glamour/v0.1',
  canvas: { w: 200, h: 200 },
  nodes: [
    { id: 'ink0', type: 'stroke', x: 0, y: 0, points: [], stroke: '#222' },
    { id: 'ink1', type: 'stroke', x: 0, y: 0, points: [], stroke: '#222' },
  ],
  ink: {
    emit: 'traced',
    strokes: [
      { into: 'ink0', match: { target: [10, 10, 50, 50], tolerance: 20 } },
      { into: 'ink1', match: { target: [100, 10, 100, 50], tolerance: 20 } },
    ],
  },
};

test('multi-stroke: strokes accumulate, and onStroke reports index + done', () => {
  h = createHarness(multiDoc);
  h.stroke([[10, 10], [50, 50]]);
  h.stroke([[100, 10], [100, 50]]);
  expect(h.node('ink0')!.points!.length).toBeGreaterThan(0);
  expect(h.node('ink1')!.points!.length).toBeGreaterThan(0); // stroke 0 NOT erased
  expect(h.strokes.map((s) => [s.index, s.done])).toEqual([[0, false], [1, true]]);
});

// ---- input-driven bind ----
const bindDoc: GlamDoc = {
  schema: 'glamour/v0',
  canvas: { w: 300, h: 100 },
  inputs: { progress: 0 },
  nodes: [{ id: 'bar', type: 'rect', x: 10, y: 40, w: 20, h: 10, fill: '#5ad67d' }],
  bind: [{ node: 'bar', prop: 'w', expr: 'lerp(20, 220, progress)' }],
};

test('setInput drives a bound prop', () => {
  h = createHarness(bindDoc);
  expect(h.node('bar')!.x).toBe(10);
  h.setInput('progress', 1);
  // width is a Konva method not surfaced in NodeSnapshot, so read via the node:
  expect((h.player as unknown as { __byId: Record<string, { width(): number }> }).__byId.bar.width()).toBeCloseTo(220, 3);
});

// ---- machine: input-condition + @EVENT transitions ----
const machineDoc: GlamDoc = {
  schema: 'glamour/v0.1',
  canvas: { w: 100, h: 100 },
  inputs: { level: 0 },
  nodes: [{ id: 'orb', type: 'circle', x: 50, y: 50, r: 10 }],
  machine: {
    initial: 'idle',
    states: {
      idle: { on: { 'level > 0.5': 'hot', '@RESET': 'idle' } },
      hot: { on: { '@RESET': 'idle' } },
    },
  },
};

test('machine transitions via input condition and via @EVENT', () => {
  h = createHarness(machineDoc);
  expect(h.state()).toBe('idle');
  h.setInput('level', 1);
  expect(h.state()).toBe('hot');
  h.send('RESET');
  expect(h.state()).toBe('idle');
});

// ---- continuous motion: tick advances a loop ----
const loopDoc: GlamDoc = {
  schema: 'glamour/v0.1',
  canvas: { w: 200, h: 200 },
  nodes: [{ id: 'crab', type: 'circle', x: 0, y: 50, r: 10 }],
  loops: [{ node: 'crab', prop: 'x', from: 0, to: 100, ms: 1000, mode: 'alternate' }],
};

test('tick() advances continuous motion', () => {
  h = createHarness(loopDoc);
  expect(h.node('crab')!.x).toBe(0);
  h.tick(500); // half of a 1000ms alternate round-trip → peak
  expect(h.node('crab')!.x).toBeCloseTo(100, 3);
});
