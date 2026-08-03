import { expect, test } from 'vitest';
import { parseDoc } from '../src/schema.js';

test('accepts a minimal valid doc', () => {
  const r = parseDoc({ schema: 'glamour/v0', canvas: { w: 100, h: 100 }, nodes: [] });
  expect(r.ok).toBe(true);
});

test('rejects wrong schema id', () => {
  const r = parseDoc({ schema: 'nope', canvas: { w: 1, h: 1 }, nodes: [] });
  expect(r.ok).toBe(false);
});

test('rejects a node missing id', () => {
  const r = parseDoc({
    schema: 'glamour/v0',
    canvas: { w: 1, h: 1 },
    nodes: [{ type: 'circle', x: 0, y: 0 }],
  });
  expect(r.ok).toBe(false);
});

test('accepts a glamour/v0.1 doc with loops, wander, groups, and node group/emit', () => {
  const r = parseDoc({
    schema: 'glamour/v0.1',
    canvas: { w: 100, h: 100 },
    nodes: [
      { id: 'eye', type: 'circle', x: 5, y: 5, r: 4, group: 'face', emit: 'pick' },
    ],
    groups: [{ id: 'face', x: 10, y: 20 }],
    loops: [{ node: 'eye', prop: 'x', from: 0, to: 100, ms: 1000 }],
    wander: [{ target: 'face', cx: 50, cy: 50, rx: 20, ry: 10, stepMs: 800 }],
  });
  expect(r.ok).toBe(true);
});

test('a v0 doc (no new fields) still parses ok', () => {
  const r = parseDoc({ schema: 'glamour/v0', canvas: { w: 100, h: 100 }, nodes: [] });
  expect(r.ok).toBe(true);
});

test('rejects a loop missing "to"', () => {
  const r = parseDoc({
    schema: 'glamour/v0.1',
    canvas: { w: 100, h: 100 },
    nodes: [{ id: 'eye', type: 'circle', x: 5, y: 5, r: 4 }],
    loops: [{ node: 'eye', prop: 'x', from: 0, ms: 1000 }],
  });
  expect(r.ok).toBe(false);
});
