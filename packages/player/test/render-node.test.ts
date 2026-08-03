import { expect, test } from 'vitest';
import { renderToPNG } from '../src/render-node.js';
import type { GlamDoc } from '@glam/core';

const validDoc: GlamDoc = {
  schema: 'glamour/v0',
  canvas: { w: 640, h: 300, bg: '#12151b' },
  inputs: { progress: 0 },
  nodes: [
    { id: 'orb', type: 'circle', x: 200, y: 150, r: 48, fill: '#4c7dff' },
    { id: 'bar', type: 'rect', x: 300, y: 170, w: 20, h: 10, fill: '#5ad67d' },
  ],
  bind: [{ node: 'bar', prop: 'w', expr: 'lerp(20, 220, progress)' }],
  machine: {
    initial: 'idle',
    states: {
      idle: { set: { 'orb.r': 48, 'orb.fill': '#4c7dff' }, on: { 'orb.click': 'active' } },
      active: { set: { 'orb.r': 72, 'orb.fill': '#ff9f43' }, on: { 'orb.click': 'idle' } },
    },
    transition: { ms: 250, ease: 'easeOut' },
  },
};

test('renders a valid doc to a real PNG buffer', async () => {
  const buf = await renderToPNG(validDoc);
  expect(Buffer.isBuffer(buf)).toBe(true);
  expect(buf.length).toBeGreaterThan(1000);
  expect(buf.subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
});

test('rejects an invalid doc', async () => {
  await expect(renderToPNG({ schema: 'nope' } as unknown as GlamDoc)).rejects.toThrow();
});

test('renders with a named state applied', async () => {
  const buf = await renderToPNG(validDoc, { state: 'active' });
  expect(buf.subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
});
