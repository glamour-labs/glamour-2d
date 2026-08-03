import { expect, test } from 'vitest';
import { applyOps } from '../src/ops.js';
import { validate } from '../src/validate.js';
import type { GlamDoc } from '../src/types.js';

function baseDoc(): GlamDoc {
  return {
    schema: 'glamour/v0',
    canvas: { w: 100, h: 100 },
    nodes: [{ id: 'orb', type: 'circle', x: 10, y: 10, r: 5, fill: '#000000' }],
  };
}

test('addNode then setProps updates fill', () => {
  const doc = baseDoc();
  const result = applyOps(doc, [
    { op: 'addNode', node: { id: 'bar', type: 'rect', x: 0, y: 0, w: 1, h: 1 } },
    { op: 'setProps', id: 'bar', props: { fill: '#ff0000' } },
  ]);
  const bar = result.nodes.find((n) => n.id === 'bar');
  expect(bar?.fill).toBe('#ff0000');
});

test('removeNode drops it', () => {
  const doc = baseDoc();
  const result = applyOps(doc, [{ op: 'removeNode', id: 'orb' }]);
  expect(result.nodes.find((n) => n.id === 'orb')).toBeUndefined();
});

test('addBinding appended', () => {
  const doc = baseDoc();
  const result = applyOps(doc, [
    { op: 'addBinding', bind: { node: 'orb', prop: 'r', expr: 'lerp(5,10,progress)' } },
  ]);
  expect(result.bind).toEqual([{ node: 'orb', prop: 'r', expr: 'lerp(5,10,progress)' }]);
});

test('setInput adds/updates an input', () => {
  const doc = baseDoc();
  const result = applyOps(doc, [{ op: 'setInput', name: 'progress', value: 0.5 }]);
  expect(result.inputs).toEqual({ progress: 0.5 });
});

test('defineState + setInitial build a machine', () => {
  const doc = baseDoc();
  const result = applyOps(doc, [
    { op: 'defineState', name: 'idle', state: { set: { 'orb.r': 5 } } },
    { op: 'defineState', name: 'active', state: { set: { 'orb.r': 10 } } },
    { op: 'setInitial', name: 'idle' },
  ]);
  expect(result.machine?.initial).toBe('idle');
  expect(result.machine?.states.active?.set).toEqual({ 'orb.r': 10 });
});

test('setProps on a missing id throws', () => {
  const doc = baseDoc();
  expect(() => applyOps(doc, [{ op: 'setProps', id: 'ghost', props: { fill: '#fff' } }])).toThrow();
});

test('removeNode on a missing id throws', () => {
  const doc = baseDoc();
  expect(() => applyOps(doc, [{ op: 'removeNode', id: 'ghost' }])).toThrow();
});

test('removeNode drops bind entries + machine on/set keys referencing the removed node, leaving the doc valid (fix #6)', () => {
  const doc: GlamDoc = {
    schema: 'glamour/v0',
    canvas: { w: 100, h: 100 },
    nodes: [
      { id: 'orb', type: 'circle', x: 10, y: 10, r: 5, fill: '#000000' },
      { id: 'bar', type: 'rect', x: 0, y: 0, w: 1, h: 1 },
    ],
    bind: [{ node: 'orb', prop: 'r', expr: '5' }],
    machine: {
      initial: 'idle',
      states: {
        idle: { set: { 'orb.r': 5 }, on: { 'orb.click': 'active' } },
        active: { set: { 'orb.r': 10 } },
      },
    },
  };

  const result = applyOps(doc, [{ op: 'removeNode', id: 'orb' }]);

  expect(result.nodes.find((n) => n.id === 'orb')).toBeUndefined();
  expect(result.bind).toEqual([]);
  expect(result.machine?.states.idle?.set).toEqual({});
  expect(result.machine?.states.idle?.on).toEqual({});
  expect(result.machine?.states.active?.set).toEqual({});

  const r = validate(result);
  expect(r.ok).toBe(true);
  expect(r.errors).toEqual([]);
});

test('setInitial on undefined state throws', () => {
  const doc = baseDoc();
  expect(() => applyOps(doc, [{ op: 'setInitial', name: 'ghost' }])).toThrow();
});

test('does not mutate the input doc', () => {
  const doc = baseDoc();
  const frozen = JSON.parse(JSON.stringify(doc));
  applyOps(doc, [
    { op: 'setProps', id: 'orb', props: { fill: '#ff0000' } },
    { op: 'addNode', node: { id: 'bar', type: 'rect', x: 0, y: 0, w: 1, h: 1 } },
  ]);
  expect(doc).toEqual(frozen);
});

test('returns a new doc object (not same reference)', () => {
  const doc = baseDoc();
  const result = applyOps(doc, [{ op: 'setInput', name: 'x', value: 1 }]);
  expect(result).not.toBe(doc);
});

test('applyOps clones inserted op payloads — mutating the op object after the call does not affect the returned doc (fix #7)', () => {
  const doc = baseDoc();
  const nodeOp = {
    op: 'addNode' as const,
    node: { id: 'bar', type: 'rect' as const, x: 0, y: 0, w: 1, h: 1, fill: '#000000' },
  };
  const bindOp = { op: 'addBinding' as const, bind: { node: 'orb', prop: 'r', expr: '5' } };
  const stateOp = {
    op: 'defineState' as const,
    name: 'idle',
    state: { set: { 'orb.r': 5 } },
  };

  const result = applyOps(doc, [nodeOp, bindOp, stateOp]);

  // Mutate every payload object after the fact.
  nodeOp.node.fill = '#ffffff';
  bindOp.bind.expr = 'evil()';
  stateOp.state.set['orb.r'] = 999;

  expect(result.nodes.find((n) => n.id === 'bar')?.fill).toBe('#000000');
  expect(result.bind?.[0]?.expr).toBe('5');
  expect(result.machine?.states.idle?.set).toEqual({ 'orb.r': 5 });
});
