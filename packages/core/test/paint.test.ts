import { expect, test } from 'vitest';
import { buildScene } from '../src/scene.js';
import type { GlamDoc } from '../src/types.js';

function pixelAt(scene: ReturnType<typeof buildScene>, x: number, y: number): Uint8ClampedArray {
  const canvas = scene.stage.toCanvas() as { getContext: (t: string) => CanvasRenderingContext2D };
  return canvas.getContext('2d').getImageData(x, y, 1, 1).data;
}

test('builds an ellipse node with radiusX/radiusY (v1.1)', () => {
  const d: GlamDoc = {
    schema: 'glamour/v0.1',
    canvas: { w: 200, h: 200 },
    nodes: [{ id: 'eye', type: 'ellipse', x: 100, y: 100, rx: 40, ry: 20, fill: '#fff' }],
  };
  const scene = buildScene(d);
  expect(scene.byId.eye.getClassName()).toBe('Ellipse');
  expect(scene.byId.eye.radiusX()).toBe(40);
  expect(scene.byId.eye.radiusY()).toBe(20);
  scene.destroy();
});

test('builds an arc node with inner/outer radius and angle (v1.1)', () => {
  const d: GlamDoc = {
    schema: 'glamour/v0.1',
    canvas: { w: 200, h: 200 },
    nodes: [
      {
        id: 'ring',
        type: 'arc',
        x: 100,
        y: 100,
        innerRadius: 40,
        outerRadius: 50,
        angle: 270,
        fill: '#5ad67d',
      },
    ],
  };
  const scene = buildScene(d);
  expect(scene.byId.ring.getClassName()).toBe('Arc');
  expect(scene.byId.ring.innerRadius()).toBe(40);
  expect(scene.byId.ring.outerRadius()).toBe(50);
  expect(scene.byId.ring.angle()).toBe(270);
  scene.destroy();
});

test('rect honors cornerRadius (v1.1)', () => {
  const d: GlamDoc = {
    schema: 'glamour/v0.1',
    canvas: { w: 100, h: 100 },
    nodes: [{ id: 'card', type: 'rect', x: 10, y: 10, w: 60, h: 40, cornerRadius: 12 }],
  };
  const scene = buildScene(d);
  expect(scene.byId.card.cornerRadius()).toBe(12);
  scene.destroy();
});

test('text honors fontStyle bold (v1.1)', () => {
  const d: GlamDoc = {
    schema: 'glamour/v0.1',
    canvas: { w: 100, h: 100 },
    nodes: [{ id: 't', type: 'text', x: 0, y: 0, text: 'Hi', size: 20, fontStyle: 'bold' }],
  };
  const scene = buildScene(d);
  expect(scene.byId.t.fontStyle()).toBe('bold');
  scene.destroy();
});

test('shadow props flow through to the Konva node (v1.1)', () => {
  const d: GlamDoc = {
    schema: 'glamour/v0.1',
    canvas: { w: 100, h: 100 },
    nodes: [
      {
        id: 'orb',
        type: 'circle',
        x: 50,
        y: 50,
        r: 20,
        fill: '#4c7dff',
        shadowColor: '#4c7dff',
        shadowBlur: 18,
        shadowOpacity: 0.8,
      },
    ],
  };
  const scene = buildScene(d);
  expect(scene.byId.orb.shadowColor()).toBe('#4c7dff');
  expect(scene.byId.orb.shadowBlur()).toBe(18);
  expect(scene.byId.orb.shadowOpacity()).toBeCloseTo(0.8);
  scene.destroy();
});

test('a node with no shadow has shadow disabled (no regression)', () => {
  const d: GlamDoc = {
    schema: 'glamour/v0',
    canvas: { w: 100, h: 100 },
    nodes: [{ id: 'orb', type: 'circle', x: 50, y: 50, r: 20, fill: '#fff' }],
  };
  const scene = buildScene(d);
  // Konva does not paint a shadow when shadowColor is unset.
  expect(scene.byId.orb.shadowColor()).toBeFalsy();
  scene.destroy();
});

test('radial gradient sets fillPriority and actually paints (live pixel check, v1.1)', () => {
  const d: GlamDoc = {
    schema: 'glamour/v0.1',
    canvas: { w: 100, h: 100 },
    nodes: [
      {
        id: 'orb',
        type: 'circle',
        x: 50,
        y: 50,
        r: 48,
        fillGradient: {
          type: 'radial',
          center: { x: 0, y: 0 },
          startRadius: 0,
          endRadius: 48,
          stops: [
            { offset: 0, color: '#ffffff' },
            { offset: 1, color: '#0000ff' },
          ],
        },
      },
    ],
  };
  const scene = buildScene(d);
  expect(scene.byId.orb.fillPriority()).toBe('radial-gradient');
  // center should read near-white, the rim near-blue — proves the gradient
  // paints, not just that props were set.
  const center = pixelAt(scene, 50, 50);
  expect(center[0]).toBeGreaterThan(200); // white-ish center
  expect(center[2]).toBeGreaterThan(200);
  const rim = pixelAt(scene, 50, 94); // near bottom rim
  expect(rim[2]).toBeGreaterThan(rim[0]); // blue dominates at the rim
  scene.destroy();
});

test('linear gradient sets fillPriority and paints a gradient across a rect (live pixel check, v1.1)', () => {
  const d: GlamDoc = {
    schema: 'glamour/v0.1',
    canvas: { w: 100, h: 100 },
    nodes: [
      {
        id: 'bar',
        type: 'rect',
        x: 0,
        y: 0,
        w: 100,
        h: 100,
        fillGradient: {
          type: 'linear',
          from: { x: 0, y: 0 },
          to: { x: 100, y: 0 },
          stops: [
            { offset: 0, color: '#ff0000' },
            { offset: 1, color: '#0000ff' },
          ],
        },
      },
    ],
  };
  const scene = buildScene(d);
  expect(scene.byId.bar.fillPriority()).toBe('linear-gradient');
  const left = pixelAt(scene, 5, 50);
  const right = pixelAt(scene, 95, 50);
  expect(left[0]).toBeGreaterThan(left[2]); // red on the left
  expect(right[2]).toBeGreaterThan(right[0]); // blue on the right
  scene.destroy();
});

test('arc angle can be animated via applyStateSet (v1.1)', () => {
  const d: GlamDoc = {
    schema: 'glamour/v0.1',
    canvas: { w: 100, h: 100 },
    nodes: [{ id: 'ring', type: 'arc', x: 50, y: 50, innerRadius: 20, outerRadius: 30, angle: 0 }],
  };
  const scene = buildScene(d);
  scene.applyStateSet({ 'ring.angle': 180 }, 0, 'linear');
  expect(scene.byId.ring.angle()).toBe(180);
  scene.destroy();
});

test('builds a stroke node as a Konva.Line with round caps (Rung 2)', () => {
  const d: GlamDoc = {
    schema: 'glamour/v0.1',
    canvas: { w: 200, h: 200 },
    nodes: [
      { id: 'ink', type: 'stroke', x: 0, y: 0, points: [10, 10, 50, 50], stroke: '#222', strokeWidth: 4 },
    ],
  };
  const scene = buildScene(d);
  expect(scene.byId.ink.getClassName()).toBe('Line');
  expect(scene.byId.ink.points()).toEqual([10, 10, 50, 50]);
  expect(scene.byId.ink.lineCap()).toBe('round');
  scene.destroy();
});

test('applyStateSet clamps a radius to >= 0 (instant path) — overshoot MUST-FIX regression', () => {
  const d: GlamDoc = {
    schema: 'glamour/v0.1',
    canvas: { w: 100, h: 100 },
    nodes: [{ id: 'orb', type: 'circle', x: 50, y: 50, r: 20 }],
  };
  const scene = buildScene(d);
  scene.applyStateSet({ 'orb.r': -30 }, 0, 'linear');
  expect(scene.byId.orb.radius()).toBe(0); // never negative -> no canvas throw
  scene.destroy();
});

test('a bind driving a radius negative is clamped (no canvas throw)', () => {
  const d: GlamDoc = {
    schema: 'glamour/v0.1',
    canvas: { w: 100, h: 100 },
    inputs: { k: 10 },
    nodes: [{ id: 'orb', type: 'circle', x: 50, y: 50, r: 20, fill: '#fff' }],
    bind: [{ node: 'orb', prop: 'r', expr: '30 - k * 6' }], // 30 - 60 = -30
  };
  const scene = buildScene(d); // recomputeBindings runs at build
  expect(scene.byId.orb.radius()).toBe(0); // clamped, not -30
  scene.setInput('k', 100); // -570 -> still clamped on recompute
  expect(scene.byId.orb.radius()).toBe(0);
  scene.destroy();
});

test('a negative loop.from on a radius is clamped when the resting frame seeds', () => {
  const d: GlamDoc = {
    schema: 'glamour/v0.1',
    canvas: { w: 100, h: 100 },
    nodes: [{ id: 'orb', type: 'circle', x: 50, y: 50, r: 20, fill: '#fff' }],
    loops: [{ node: 'orb', prop: 'r', from: -5, to: 30, ms: 1000 }],
  };
  const scene = buildScene(d); // seeds resting frame at loop.from
  expect(scene.byId.orb.radius()).toBe(0); // clamped, not -5
  scene.destroy();
});

test('clampPropValue clamps radius-family props but leaves x/opacity alone', async () => {
  const { clampPropValue } = await import('../src/scene.js');
  expect(clampPropValue('r', -5)).toBe(0);
  expect(clampPropValue('rx', -1)).toBe(0);
  expect(clampPropValue('innerRadius', -9)).toBe(0);
  expect(clampPropValue('cornerRadius', -2)).toBe(0);
  expect(clampPropValue('x', -50)).toBe(-50); // position can be negative
  expect(clampPropValue('r', 12)).toBe(12); // positive unchanged
});
