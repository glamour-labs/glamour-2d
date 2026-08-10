import { describe, expect, test } from 'vitest';
import type { GlamDoc } from '@glamour-labs/core';
import { handlers } from '../src/tools.js';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

describe('mcp tool handlers', () => {
  test('scripted session: new_scene -> add_node -> apply_primitive -> validate -> render_preview', () => {
    const { doc: doc1, result: r1 } = handlers.new_scene({ w: 200, h: 200 }, null);
    expect(r1.created).toBe(true);
    expect(doc1?.schema).toBe('glamour/v0');

    const { doc: doc2, result: r2 } = handlers.add_node(
      { node: { id: 'orb', type: 'circle', x: 100, y: 100, r: 40, fill: 'tomato' } },
      doc1,
    );
    expect(r2.added).toBe('orb');
    expect(doc2?.nodes).toHaveLength(1);

    const { doc: doc3, result: r3 } = handlers.apply_primitive({ name: 'hoverGrow', args: ['orb'] }, doc2);
    expect(r3.applied).toBe('hoverGrow');
    expect(doc3?.machine?.initial).toBe('idle');

    const { result: r4 } = handlers.validate({}, doc3);
    expect(r4.ok).toBe(true);
    expect(r4.errors).toEqual([]);

    return handlers.render_preview({}, doc3).then(({ result: r5 }) => {
      const bytes = Buffer.from(r5.png, 'base64');
      expect(bytes.subarray(0, 4).equals(PNG_SIGNATURE)).toBe(true);
      expect(bytes.length).toBeGreaterThan(100);
    });
  });

  test('list_primitives returns the palette catalogue without needing a doc', () => {
    const { result } = handlers.list_primitives({}, null);
    expect(result.length).toBeGreaterThanOrEqual(4);
  });

  test('validate on a doc with a dangling bind reports errors', () => {
    const doc: GlamDoc = {
      schema: 'glamour/v0',
      canvas: { w: 10, h: 10 },
      nodes: [{ id: 'a', type: 'circle', x: 0, y: 0, r: 1 }],
      bind: [{ node: 'ghost', prop: 'r', expr: '1' }],
    };
    const { result } = handlers.validate({}, doc);
    expect(result.ok).toBe(false);
    expect(result.errors.join()).toMatch(/ghost/);
  });

  test('mutating ops throw when there is no active scene', () => {
    expect(() => handlers.add_node({ node: { id: 'x', type: 'circle', x: 0, y: 0 } }, null)).toThrow(
      /no active scene/,
    );
  });
});
