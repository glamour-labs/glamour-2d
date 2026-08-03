import { expect, test } from 'vitest';
import { validate } from '../src/validate.js';
import type { GlamDoc } from '../src/types.js';

test('flags on-event referencing a missing node', () => {
  const doc = {
    schema: 'glamour/v0',
    canvas: { w: 1, h: 1 },
    nodes: [{ id: 'a', type: 'circle', x: 0, y: 0, r: 1 }],
    machine: { initial: 'idle', states: { idle: { on: { 'ghost.click': 'idle' } } } },
  };
  const r = validate(doc);
  expect(r.ok).toBe(false);
  expect(r.errors.join()).toMatch(/ghost/);
});

test('flags duplicate node ids', () => {
  const doc = {
    schema: 'glamour/v0',
    canvas: { w: 1, h: 1 },
    nodes: [
      { id: 'a', type: 'circle', x: 0, y: 0, r: 1 },
      { id: 'a', type: 'rect', x: 0, y: 0, w: 1, h: 1 },
    ],
  };
  const r = validate(doc);
  expect(r.ok).toBe(false);
  expect(r.errors.join()).toMatch(/duplicate/i);
});

test('flags bind referencing a missing node', () => {
  const doc = {
    schema: 'glamour/v0',
    canvas: { w: 1, h: 1 },
    nodes: [{ id: 'a', type: 'circle', x: 0, y: 0, r: 1 }],
    bind: [{ node: 'ghost', prop: 'r', expr: '1' }],
  };
  const r = validate(doc);
  expect(r.ok).toBe(false);
  expect(r.errors.join()).toMatch(/ghost/);
});

test('flags bind targeting a non-animatable prop', () => {
  const doc = {
    schema: 'glamour/v0',
    canvas: { w: 1, h: 1 },
    nodes: [{ id: 'a', type: 'circle', x: 0, y: 0, r: 1 }],
    bind: [{ node: 'a', prop: 'bogusProp', expr: '1' }],
  };
  const r = validate(doc);
  expect(r.ok).toBe(false);
  expect(r.errors.join()).toMatch(/bogusProp/);
});

test('flags machine.initial not in states', () => {
  const doc = {
    schema: 'glamour/v0',
    canvas: { w: 1, h: 1 },
    nodes: [],
    machine: { initial: 'nope', states: { idle: {} } },
  };
  const r = validate(doc);
  expect(r.ok).toBe(false);
  expect(r.errors.join()).toMatch(/nope/);
});

test('flags on target state not in states', () => {
  const doc = {
    schema: 'glamour/v0',
    canvas: { w: 1, h: 1 },
    nodes: [{ id: 'a', type: 'circle', x: 0, y: 0, r: 1 }],
    machine: { initial: 'idle', states: { idle: { on: { 'a.click': 'nowhere' } } } },
  };
  const r = validate(doc);
  expect(r.ok).toBe(false);
  expect(r.errors.join()).toMatch(/nowhere/);
});

test('flags on key with unknown event name', () => {
  const doc = {
    schema: 'glamour/v0',
    canvas: { w: 1, h: 1 },
    nodes: [{ id: 'a', type: 'circle', x: 0, y: 0, r: 1 }],
    machine: { initial: 'idle', states: { idle: { on: { 'a.tap': 'idle' } } } },
  };
  const r = validate(doc);
  expect(r.ok).toBe(false);
  expect(r.errors.join()).toMatch(/tap/);
});

test('accepts an input-condition on key referencing an existing input', () => {
  const doc = {
    schema: 'glamour/v0',
    canvas: { w: 1, h: 1 },
    inputs: { progress: 0 },
    nodes: [{ id: 'a', type: 'circle', x: 0, y: 0, r: 1 }],
    machine: { initial: 'idle', states: { idle: { on: { 'progress > 0.5': 'idle' } } } },
  };
  const r = validate(doc);
  expect(r.ok).toBe(true);
});

test('flags on key input-condition referencing unknown input', () => {
  const doc = {
    schema: 'glamour/v0',
    canvas: { w: 1, h: 1 },
    nodes: [{ id: 'a', type: 'circle', x: 0, y: 0, r: 1 }],
    machine: { initial: 'idle', states: { idle: { on: { 'ghostInput > 0.5': 'idle' } } } },
  };
  const r = validate(doc);
  expect(r.ok).toBe(false);
  expect(r.errors.join()).toMatch(/ghostInput/);
});

test('flags set targeting a missing node', () => {
  const doc = {
    schema: 'glamour/v0',
    canvas: { w: 1, h: 1 },
    nodes: [],
    machine: { initial: 'idle', states: { idle: { set: { 'ghost.r': 1 } } } },
  };
  const r = validate(doc);
  expect(r.ok).toBe(false);
  expect(r.errors.join()).toMatch(/ghost/);
});

test('flags set targeting a non-animatable prop', () => {
  const doc = {
    schema: 'glamour/v0',
    canvas: { w: 1, h: 1 },
    nodes: [{ id: 'a', type: 'circle', x: 0, y: 0, r: 1 }],
    machine: { initial: 'idle', states: { idle: { set: { 'a.bogusProp': 1 } } } },
  };
  const r = validate(doc);
  expect(r.ok).toBe(false);
  expect(r.errors.join()).toMatch(/bogusProp/);
});

test('a fully valid doc passes with no errors', () => {
  const doc = {
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
  const r = validate(doc);
  expect(r).toEqual({ ok: true, errors: [] });
});

test('rejects an invalid doc at the schema level too', () => {
  const r = validate({ schema: 'nope' });
  expect(r.ok).toBe(false);
  expect(r.errors.length).toBeGreaterThan(0);
});

function docWithBindExpr(expr: string) {
  return {
    schema: 'glamour/v0',
    canvas: { w: 1, h: 1 },
    inputs: { progress: 0 },
    nodes: [{ id: 'a', type: 'circle', x: 0, y: 0, r: 1 }],
    bind: [{ node: 'a', prop: 'r', expr }],
  };
}

test.each(['1 +', '(', 'foo(', 'unknownvar', ''])(
  'flags a bind.expr that fails to parse/evaluate: %j',
  (expr) => {
    const r = validate(docWithBindExpr(expr));
    expect(r.ok).toBe(false);
  },
);

test('the spec example bind.expr still validates ok', () => {
  const doc = docWithBindExpr('lerp(20, 220, progress)');
  const r = validate(doc);
  expect(r.ok).toBe(true);
});

test('flags a malformed condition on-key with an operator but no RHS ("progress>")', () => {
  const doc = {
    schema: 'glamour/v0',
    canvas: { w: 1, h: 1 },
    inputs: { progress: 0 },
    nodes: [{ id: 'a', type: 'circle', x: 0, y: 0, r: 1 }],
    machine: { initial: 'idle', states: { idle: { on: { 'progress>': 'idle' } } } },
  };
  const r = validate(doc);
  expect(r.ok).toBe(false);
});

test('a deeply nested bind.expr ("(".repeat(1e5)) is rejected without throwing (depth/length bomb)', () => {
  const doc = docWithBindExpr('('.repeat(1e5));
  expect(() => validate(doc)).not.toThrow();
  expect(validate(doc).ok).toBe(false);
});

test('flags a bind.expr referencing a non-whitelisted function', () => {
  const doc = docWithBindExpr('evil(1)');
  const r = validate(doc);
  expect(r.ok).toBe(false);
});

test('flags a "set" value whose type mismatches the prop kind (fix #5)', () => {
  const doc = {
    schema: 'glamour/v0',
    canvas: { w: 1, h: 1 },
    nodes: [{ id: 'c', type: 'circle', x: 0, y: 0, r: 1 }],
    machine: { initial: 'idle', states: { idle: { set: { 'c.r': 'x' } } } },
  };
  const r = validate(doc);
  expect(r.ok).toBe(false);
});

test('accepts a "set" targeting text with a string value', () => {
  const doc = {
    schema: 'glamour/v0',
    canvas: { w: 1, h: 1 },
    nodes: [{ id: 'label', type: 'text', x: 0, y: 0, text: 'hi' }],
    machine: { initial: 'idle', states: { idle: { set: { 'label.text': 'Done' } } } },
  };
  const r = validate(doc);
  expect(r.ok).toBe(true);
});

test('flags a loop referencing a missing node', () => {
  const doc = {
    schema: 'glamour/v0.1',
    canvas: { w: 1, h: 1 },
    nodes: [{ id: 'a', type: 'circle', x: 0, y: 0, r: 1 }],
    loops: [{ node: 'ghost', prop: 'x', from: 0, to: 10, ms: 500 }],
  };
  const r = validate(doc);
  expect(r.ok).toBe(false);
  expect(r.errors.join()).toMatch(/ghost/);
});

test('flags a loop targeting a non-animatable prop', () => {
  const doc = {
    schema: 'glamour/v0.1',
    canvas: { w: 1, h: 1 },
    nodes: [{ id: 'a', type: 'circle', x: 0, y: 0, r: 1 }],
    loops: [{ node: 'a', prop: 'text', from: 0, to: 10, ms: 500 }],
  };
  const r = validate(doc);
  expect(r.ok).toBe(false);
  expect(r.errors.join()).toMatch(/text/);
});

test('flags a wander target that does not exist as node or group', () => {
  const doc = {
    schema: 'glamour/v0.1',
    canvas: { w: 1, h: 1 },
    nodes: [{ id: 'a', type: 'circle', x: 0, y: 0, r: 1 }],
    wander: [{ target: 'ghost', cx: 0, cy: 0, rx: 10, ry: 10, stepMs: 500 }],
  };
  const r = validate(doc);
  expect(r.ok).toBe(false);
  expect(r.errors.join()).toMatch(/ghost/);
});

test('accepts a wander targeting a declared group', () => {
  const doc = {
    schema: 'glamour/v0.1',
    canvas: { w: 1, h: 1 },
    nodes: [{ id: 'eye', type: 'circle', x: 0, y: 0, r: 1, group: 'face' }],
    groups: [{ id: 'face', x: 0, y: 0 }],
    wander: [{ target: 'face', cx: 0, cy: 0, rx: 10, ry: 10, stepMs: 500 }],
  };
  const r = validate(doc);
  expect(r.ok).toBe(true);
});

test('flags a node.group referencing an undeclared group', () => {
  const doc = {
    schema: 'glamour/v0.1',
    canvas: { w: 1, h: 1 },
    nodes: [{ id: 'eye', type: 'circle', x: 0, y: 0, r: 1, group: 'ghostGroup' }],
  };
  const r = validate(doc);
  expect(r.ok).toBe(false);
  expect(r.errors.join()).toMatch(/ghostGroup/);
});

test('flags a group id colliding with a node id', () => {
  const doc = {
    schema: 'glamour/v0.1',
    canvas: { w: 1, h: 1 },
    nodes: [{ id: 'dup', type: 'circle', x: 0, y: 0, r: 1 }],
    groups: [{ id: 'dup', x: 0, y: 0 }],
  };
  const r = validate(doc);
  expect(r.ok).toBe(false);
  expect(r.errors.join()).toMatch(/dup/);
});

test('flags a duplicate group id', () => {
  const doc = {
    schema: 'glamour/v0.1',
    canvas: { w: 1, h: 1 },
    nodes: [],
    groups: [
      { id: 'g', x: 0, y: 0 },
      { id: 'g', x: 1, y: 1 },
    ],
  };
  const r = validate(doc);
  expect(r.ok).toBe(false);
  expect(r.errors.join()).toMatch(/duplicate/i);
});

test('accepts an "@EVENT" on key targeting a defined state, with no node/input required', () => {
  const doc = {
    schema: 'glamour/v0.1',
    canvas: { w: 1, h: 1 },
    nodes: [],
    machine: { initial: 'idle', states: { idle: { on: { '@SHOW_CHECK': 'checked' } }, checked: {} } },
  };
  const r = validate(doc);
  expect(r.ok).toBe(true);
});

test('flags a malformed "@" event on-key', () => {
  const doc = {
    schema: 'glamour/v0.1',
    canvas: { w: 1, h: 1 },
    nodes: [],
    machine: { initial: 'idle', states: { idle: { on: { '@bad-name': 'idle' } } } },
  };
  const r = validate(doc);
  expect(r.ok).toBe(false);
});

test('a full v0.1 doc (the orb shape: group + wander + @event) validates ok', () => {
  const doc = {
    schema: 'glamour/v0.1',
    canvas: { w: 300, h: 300 },
    nodes: [
      { id: 'eyeL', type: 'circle', x: -10, y: 0, r: 4, group: 'face' },
      { id: 'eyeR', type: 'circle', x: 10, y: 0, r: 4, group: 'face' },
      { id: 'mouth', type: 'circle', x: 0, y: 10, r: 3, group: 'face' },
      { id: 'body', type: 'circle', x: 150, y: 150, r: 60, emit: 'pick' },
    ],
    groups: [{ id: 'face', x: 150, y: 150 }],
    wander: [{ target: 'face', cx: 150, cy: 150, rx: 40, ry: 20, stepMs: 900 }],
    machine: {
      initial: 'idle',
      states: {
        idle: { on: { '@SHOW_CHECK': 'checked' } },
        checked: { set: { 'body.fill': '#5ad67d' } },
      },
    },
  };
  const r = validate(doc);
  expect(r).toEqual({ ok: true, errors: [] });
});

test('loop can target a group id, animating x/y (parity with wander)', () => {
  const doc: GlamDoc = {
    schema: 'glamour/v0.1',
    canvas: { w: 640, h: 360 },
    nodes: [{ id: 'body', type: 'circle', x: 0, y: 0, r: 20, group: 'crab' }],
    groups: [{ id: 'crab', x: 70, y: 250 }],
    loops: [{ node: 'crab', prop: 'x', from: 70, to: 560, ms: 3000, mode: 'alternate' }],
  };
  expect(validate(doc)).toEqual({ ok: true, errors: [] });
});

test('reserves "@INPUT" — an on-key of "@INPUT" collides with the internal input-condition event and is rejected', () => {
  const doc = {
    schema: 'glamour/v0.1',
    canvas: { w: 1, h: 1 },
    nodes: [],
    machine: { initial: 'idle', states: { idle: { on: { '@INPUT': 'idle' } }, checked: {} } },
  };
  const r = validate(doc);
  expect(r.ok).toBe(false);
  expect(r.errors.join()).toMatch(/INPUT/);
});

test('rejects a loop with ms <= 0', () => {
  const doc = {
    schema: 'glamour/v0.1',
    canvas: { w: 1, h: 1 },
    nodes: [{ id: 'a', type: 'circle', x: 0, y: 0, r: 1 }],
    loops: [{ node: 'a', prop: 'x', from: 0, to: 10, ms: 0 }],
  };
  const r = validate(doc);
  expect(r.ok).toBe(false);
  expect(r.errors.join()).toMatch(/ms/);
});

test('rejects a loop with negative ms', () => {
  const doc = {
    schema: 'glamour/v0.1',
    canvas: { w: 1, h: 1 },
    nodes: [{ id: 'a', type: 'circle', x: 0, y: 0, r: 1 }],
    loops: [{ node: 'a', prop: 'x', from: 0, to: 10, ms: -500 }],
  };
  const r = validate(doc);
  expect(r.ok).toBe(false);
});

test('rejects a wander with stepMs <= 0', () => {
  const doc = {
    schema: 'glamour/v0.1',
    canvas: { w: 1, h: 1 },
    nodes: [{ id: 'a', type: 'circle', x: 0, y: 0, r: 1 }],
    wander: [{ target: 'a', cx: 0, cy: 0, rx: 10, ry: 10, stepMs: 0 }],
  };
  const r = validate(doc);
  expect(r.ok).toBe(false);
  expect(r.errors.join()).toMatch(/stepMs/);
});

test('rejects a wander with rx <= 0', () => {
  const doc = {
    schema: 'glamour/v0.1',
    canvas: { w: 1, h: 1 },
    nodes: [{ id: 'a', type: 'circle', x: 0, y: 0, r: 1 }],
    wander: [{ target: 'a', cx: 0, cy: 0, rx: 0, ry: 10, stepMs: 500 }],
  };
  const r = validate(doc);
  expect(r.ok).toBe(false);
  expect(r.errors.join()).toMatch(/rx/);
});

test('rejects a wander with ry <= 0', () => {
  const doc = {
    schema: 'glamour/v0.1',
    canvas: { w: 1, h: 1 },
    nodes: [{ id: 'a', type: 'circle', x: 0, y: 0, r: 1 }],
    wander: [{ target: 'a', cx: 0, cy: 0, rx: 10, ry: -5, stepMs: 500 }],
  };
  const r = validate(doc);
  expect(r.ok).toBe(false);
  expect(r.errors.join()).toMatch(/ry/);
});

test('rejects a loop and a bind targeting the same node+prop (they fight at runtime)', () => {
  const doc = {
    schema: 'glamour/v0.1',
    canvas: { w: 1, h: 1 },
    nodes: [{ id: 'a', type: 'circle', x: 0, y: 0, r: 1 }],
    bind: [{ node: 'a', prop: 'x', expr: '1' }],
    loops: [{ node: 'a', prop: 'x', from: 0, to: 10, ms: 500 }],
  };
  const r = validate(doc);
  expect(r.ok).toBe(false);
  expect(r.errors.join()).toMatch(/conflict/i);
});

test('rejects a loop and a wander targeting the same node+prop', () => {
  const doc = {
    schema: 'glamour/v0.1',
    canvas: { w: 1, h: 1 },
    nodes: [{ id: 'a', type: 'circle', x: 0, y: 0, r: 1 }],
    wander: [{ target: 'a', cx: 0, cy: 0, rx: 10, ry: 10, stepMs: 500 }],
    loops: [{ node: 'a', prop: 'x', from: 0, to: 10, ms: 500 }],
  };
  const r = validate(doc);
  expect(r.ok).toBe(false);
  expect(r.errors.join()).toMatch(/conflict/i);
});

test('allows a loop and a wander on the same node when they target different props (loop y, wander x/y is inherent — use a group split instead)', () => {
  // Sanity check the conflict rule is scoped to node+prop, not just node:
  // a bind on a DIFFERENT prop of the same node must still be fine.
  const doc = {
    schema: 'glamour/v0.1',
    canvas: { w: 1, h: 1 },
    nodes: [{ id: 'a', type: 'circle', x: 0, y: 0, r: 1 }],
    bind: [{ node: 'a', prop: 'r', expr: '1' }],
    loops: [{ node: 'a', prop: 'x', from: 0, to: 10, ms: 500 }],
  };
  const r = validate(doc);
  expect(r.ok).toBe(true);
});

test('loop on a group rejects a non-x/y prop', () => {
  const doc: GlamDoc = {
    schema: 'glamour/v0.1',
    canvas: { w: 640, h: 360 },
    nodes: [{ id: 'body', type: 'circle', x: 0, y: 0, r: 20, group: 'crab' }],
    groups: [{ id: 'crab', x: 70, y: 250 }],
    loops: [{ node: 'crab', prop: 'r', from: 10, to: 30, ms: 1000 }],
  };
  const r = validate(doc);
  expect(r.ok).toBe(false);
  expect(r.errors.join()).toMatch(/group "crab" can only animate/);
});

test('accepts new v1.1 node types (ellipse, arc) with their props', () => {
  const doc: GlamDoc = {
    schema: 'glamour/v0.1',
    canvas: { w: 200, h: 200 },
    nodes: [
      { id: 'eye', type: 'ellipse', x: 50, y: 50, rx: 20, ry: 12 },
      { id: 'ring', type: 'arc', x: 100, y: 100, innerRadius: 30, outerRadius: 40, angle: 270 },
    ],
    bind: [{ node: 'ring', prop: 'angle', expr: 'lerp(0, 360, p)' }],
    inputs: { p: 0.5 },
  };
  const r = validate(doc);
  expect(r.errors.join()).toBe('');
  expect(r.ok).toBe(true);
});

test('rejects an invalid fontStyle typo', () => {
  const doc: GlamDoc = {
    schema: 'glamour/v0.1',
    canvas: { w: 100, h: 100 },
    nodes: [{ id: 't', type: 'text', x: 0, y: 0, text: 'Hi', fontStyle: 'boldish' }],
  };
  const r = validate(doc);
  expect(r.ok).toBe(false);
  expect(r.errors.join()).toMatch(/fontStyle/);
});

test('rejects a radial gradient with no positive endRadius (dead gradient)', () => {
  const doc: GlamDoc = {
    schema: 'glamour/v0.1',
    canvas: { w: 100, h: 100 },
    nodes: [
      {
        id: 'orb',
        type: 'circle',
        x: 50,
        y: 50,
        r: 40,
        fillGradient: { type: 'radial', stops: [{ offset: 0, color: '#fff' }, { offset: 1, color: '#000' }] },
      },
    ],
  };
  const r = validate(doc);
  expect(r.ok).toBe(false);
  expect(r.errors.join()).toMatch(/endRadius/);
});

test('rejects a linear gradient missing "to"', () => {
  const doc: GlamDoc = {
    schema: 'glamour/v0.1',
    canvas: { w: 100, h: 100 },
    nodes: [
      {
        id: 'bar',
        type: 'rect',
        x: 0,
        y: 0,
        w: 100,
        h: 20,
        fillGradient: { type: 'linear', stops: [{ offset: 0, color: '#fff' }, { offset: 1, color: '#000' }] },
      },
    ],
  };
  const r = validate(doc);
  expect(r.ok).toBe(false);
  expect(r.errors.join()).toMatch(/"to" point/);
});

test('rejects a gradient stop offset out of 0..1 range', () => {
  const doc: GlamDoc = {
    schema: 'glamour/v0.1',
    canvas: { w: 100, h: 100 },
    nodes: [
      {
        id: 'bar',
        type: 'rect',
        x: 0,
        y: 0,
        w: 100,
        h: 20,
        fillGradient: { type: 'linear', to: { x: 100, y: 0 }, stops: [{ offset: 0, color: '#fff' }, { offset: 1.5, color: '#000' }] },
      },
    ],
  };
  const r = validate(doc);
  expect(r.ok).toBe(false);
  expect(r.errors.join()).toMatch(/out of range/);
});

test('accepts an animatable cornerRadius bind on a rect (v1.1)', () => {
  const doc: GlamDoc = {
    schema: 'glamour/v0.1',
    canvas: { w: 100, h: 100 },
    nodes: [{ id: 'card', type: 'rect', x: 0, y: 0, w: 40, h: 40, cornerRadius: 4 }],
    inputs: { p: 0 },
    bind: [{ node: 'card', prop: 'cornerRadius', expr: 'lerp(0, 20, p)' }],
  };
  const r = validate(doc);
  expect(r.errors.join()).toBe('');
  expect(r.ok).toBe(true);
});

test('accepts a Rung 2 ink doc with a stroke target and a match path', () => {
  const doc: GlamDoc = {
    schema: 'glamour/v0.1',
    canvas: { w: 300, h: 300 },
    nodes: [
      { id: 'guide', type: 'stroke', x: 0, y: 0, points: [10, 10, 100, 100], stroke: '#ccc' },
      { id: 'ink', type: 'stroke', x: 0, y: 0, points: [], stroke: '#222', strokeWidth: 6 },
    ],
    ink: { into: 'ink', emit: 'traced', match: { target: [10, 10, 100, 100], tolerance: 20 } },
  };
  const r = validate(doc);
  expect(r.errors.join()).toBe('');
  expect(r.ok).toBe(true);
});

test('rejects ink.into referencing a non-stroke node', () => {
  const doc: GlamDoc = {
    schema: 'glamour/v0.1',
    canvas: { w: 100, h: 100 },
    nodes: [{ id: 'orb', type: 'circle', x: 0, y: 0, r: 10 }],
    ink: { into: 'orb' },
  };
  const r = validate(doc);
  expect(r.ok).toBe(false);
  expect(r.errors.join()).toMatch(/must be a "stroke" node/);
});

test('rejects ink.into referencing a missing node', () => {
  const doc: GlamDoc = {
    schema: 'glamour/v0.1',
    canvas: { w: 100, h: 100 },
    nodes: [{ id: 'ink', type: 'stroke', x: 0, y: 0 }],
    ink: { into: 'ghost' },
  };
  const r = validate(doc);
  expect(r.ok).toBe(false);
  expect(r.errors.join()).toMatch(/missing node/);
});

test('rejects an ink.match with a non-positive tolerance or malformed target', () => {
  const base = (match: unknown): GlamDoc => ({
    schema: 'glamour/v0.1',
    canvas: { w: 100, h: 100 },
    nodes: [{ id: 'ink', type: 'stroke', x: 0, y: 0 }],
    ink: { into: 'ink', match: match as { target: number[]; tolerance: number } },
  });
  expect(validate(base({ target: [0, 0, 10, 10], tolerance: 0 })).ok).toBe(false);
  expect(validate(base({ target: [0, 0, 10], tolerance: 5 })).ok).toBe(false); // odd length
  expect(validate(base({ target: [0, 0], tolerance: 5 })).ok).toBe(false); // < 2 points
});

test('accepts a multi-stroke ink doc (strokes list, one node per pen-stroke)', () => {
  const doc: GlamDoc = {
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
  expect(validate(doc).ok).toBe(true);
});

test('rejects ink that sets both into and strokes, or neither', () => {
  const nodes: GlamDoc['nodes'] = [{ id: 'ink0', type: 'stroke', x: 0, y: 0, points: [] }];
  const both: GlamDoc = {
    schema: 'glamour/v0.1', canvas: { w: 100, h: 100 }, nodes,
    ink: { into: 'ink0', strokes: [{ into: 'ink0' }] },
  };
  const neither: GlamDoc = {
    schema: 'glamour/v0.1', canvas: { w: 100, h: 100 }, nodes,
    ink: { emit: 'x' },
  };
  expect(validate(both).ok).toBe(false);
  expect(validate(neither).ok).toBe(false);
});

test('rejects a strokes[].into referencing a non-stroke node', () => {
  const doc: GlamDoc = {
    schema: 'glamour/v0.1', canvas: { w: 100, h: 100 },
    nodes: [{ id: 'orb', type: 'circle', x: 50, y: 50, r: 10 }],
    ink: { strokes: [{ into: 'orb' }] },
  };
  expect(validate(doc).ok).toBe(false);
});

test('rejects a negative static radius-family dimension (build-crash guard)', () => {
  const doc: GlamDoc = {
    schema: 'glamour/v0.1',
    canvas: { w: 100, h: 100 },
    nodes: [{ id: 'orb', type: 'circle', x: 50, y: 50, r: -10 }],
  };
  const r = validate(doc);
  expect(r.ok).toBe(false);
  expect(r.errors.join()).toMatch(/negative "r"/);
});

test('rejects a degenerate linear gradient (from == to)', () => {
  const doc: GlamDoc = {
    schema: 'glamour/v0.1',
    canvas: { w: 100, h: 100 },
    nodes: [
      {
        id: 'bar',
        type: 'rect',
        x: 0,
        y: 0,
        w: 50,
        h: 50,
        fillGradient: {
          type: 'linear',
          from: { x: 0, y: 0 },
          to: { x: 0, y: 0 },
          stops: [{ offset: 0, color: '#fff' }, { offset: 1, color: '#000' }],
        },
      },
    ],
  };
  const r = validate(doc);
  expect(r.ok).toBe(false);
  expect(r.errors.join()).toMatch(/degenerate/);
});

test('rejects non-ascending gradient stops', () => {
  const doc: GlamDoc = {
    schema: 'glamour/v0.1',
    canvas: { w: 100, h: 100 },
    nodes: [
      {
        id: 'bar',
        type: 'rect',
        x: 0,
        y: 0,
        w: 50,
        h: 50,
        fillGradient: {
          type: 'linear',
          to: { x: 50, y: 0 },
          stops: [{ offset: 0, color: '#fff' }, { offset: 0.8, color: '#888' }, { offset: 0.3, color: '#000' }],
        },
      },
    ],
  };
  const r = validate(doc);
  expect(r.ok).toBe(false);
  expect(r.errors.join()).toMatch(/ascending/);
});

test('rejects an invalid fontStyle in a machine state "set" (v1.1 parity with node-level)', () => {
  const doc: GlamDoc = {
    schema: 'glamour/v0.1',
    canvas: { w: 100, h: 100 },
    nodes: [{ id: 't', type: 'text', x: 0, y: 0, text: 'Hi' }],
    machine: {
      initial: 'idle',
      states: { idle: { set: { 't.fontStyle': 'boldish' } } },
    },
  };
  const r = validate(doc);
  expect(r.ok).toBe(false);
  expect(r.errors.join()).toMatch(/invalid fontStyle/);
});
