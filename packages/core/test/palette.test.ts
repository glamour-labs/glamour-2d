import { expect, test } from 'vitest';
import { applyOps } from '../src/ops.js';
import { validate } from '../src/validate.js';
import { palette, listPrimitives } from '../src/palette.js';
import type { GlamDoc } from '../src/types.js';

function baseDoc(): GlamDoc {
  return {
    schema: 'glamour/v0',
    canvas: { w: 100, h: 100 },
    nodes: [{ id: 'orb', type: 'circle', x: 50, y: 50, r: 20, fill: '#4c7dff' }],
  };
}

test('hoverGrow yields a valid doc with idle/hover states and an orb.hover transition', () => {
  const doc = applyOps(baseDoc(), palette.hoverGrow('orb'));
  const r = validate(doc);
  expect(r.ok).toBe(true);
  expect(doc.machine?.states.idle).toBeDefined();
  expect(doc.machine?.states.hover).toBeDefined();
  expect(doc.machine?.states.idle?.on?.['orb.hover']).toBe('hover');
});

test('clickToggle yields a valid doc that toggles between two prop sets', () => {
  const doc = applyOps(baseDoc(), palette.clickToggle('orb', { r: 20 }, { r: 40 }));
  const r = validate(doc);
  expect(r.ok).toBe(true);
  expect(doc.machine?.initial).toBeDefined();
});

test('progressBar yields a valid doc with a lerp binding', () => {
  const doc: GlamDoc = {
    schema: 'glamour/v0',
    canvas: { w: 100, h: 100 },
    inputs: { progress: 0 },
    nodes: [{ id: 'bar', type: 'rect', x: 0, y: 0, w: 20, h: 10 }],
  };
  const result = applyOps(doc, palette.progressBar('bar', 'progress'));
  const r = validate(result);
  expect(r.ok).toBe(true);
  expect(result.bind?.some((b) => b.node === 'bar' && b.prop === 'w')).toBe(true);
});

test('fadeIn yields a valid doc', () => {
  const doc = applyOps(baseDoc(), palette.fadeIn('orb'));
  const r = validate(doc);
  expect(r.ok).toBe(true);
});

test('listPrimitives returns at least 4 entries with name/signature/description', () => {
  const list = listPrimitives();
  expect(list.length).toBeGreaterThanOrEqual(4);
  for (const entry of list) {
    expect(typeof entry.name).toBe('string');
    expect(typeof entry.signature).toBe('string');
    expect(typeof entry.description).toBe('string');
  }
});
