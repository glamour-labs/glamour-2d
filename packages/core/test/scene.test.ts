import { expect, test } from 'vitest';
import { buildScene } from '../src/scene.js';
import type { GlamDoc } from '../src/types.js';

function doc(): GlamDoc {
  return {
    schema: 'glamour/v0',
    canvas: { w: 640, h: 300, bg: '#12151b' },
    inputs: { progress: 0 },
    nodes: [
      { id: 'orb', type: 'circle', x: 200, y: 150, r: 48, fill: '#4c7dff' },
      { id: 'bar', type: 'rect', x: 300, y: 170, w: 20, h: 10, fill: '#5ad67d' },
    ],
    bind: [{ node: 'bar', prop: 'w', expr: 'lerp(20, 220, progress)' }],
  };
}

test('builds a scene graph from the doc', () => {
  const scene = buildScene(doc());
  expect(scene.byId.orb).toBeDefined();
  expect(scene.byId.bar).toBeDefined();
  expect(scene.byId.orb.radius()).toBe(48);
  scene.destroy();
});

test('setInput recomputes bound props', () => {
  const scene = buildScene(doc());
  scene.setInput('progress', 1);
  expect(scene.byId.bar.width()).toBe(220);
  scene.destroy();
});

test('getIntersection hit-tests the pixel graph', () => {
  const scene = buildScene(doc());
  const hit = scene.getIntersection({ x: 200, y: 150 });
  expect(hit).toBeTruthy();
  expect(hit._docId).toBe('orb');
  const miss = scene.getIntersection({ x: 5, y: 5 });
  expect(miss === null || miss === undefined).toBe(true);
  scene.destroy();
});

test('applyStateSet tweens/sets target props', () => {
  const scene = buildScene(doc());
  scene.applyStateSet({ 'orb.r': 72, 'orb.fill': '#ff9f43' }, 0, 'linear');
  expect(scene.byId.orb.radius()).toBe(72);
  expect(scene.byId.orb.fill()).toBe('#ff9f43');
  scene.destroy();
});

test('initial inputs are applied through bindings at build time', () => {
  const d = doc();
  d.inputs = { progress: 0.5 };
  const scene = buildScene(d);
  expect(scene.byId.bar.width()).toBe(120);
  scene.destroy();
});

test('canvas.bg is actually painted (honored in headless render, not just container CSS)', () => {
  const d = doc();
  d.canvas.bg = '#ff0000';
  const scene = buildScene(d);
  // read a pixel in an empty corner of the real rendered canvas
  const canvas = scene.stage.toCanvas() as { getContext: (t: string) => CanvasRenderingContext2D };
  const px = canvas.getContext('2d').getImageData(5, 5, 1, 1).data;
  expect(px[3]).toBeGreaterThan(200); // opaque background, not transparent
  expect(px[0]).toBeGreaterThan(200); // red channel
  expect(px[1]).toBeLessThan(60);
  expect(px[2]).toBeLessThan(60);
  scene.destroy();
});

test('applyStateSet applies a non-numeric prop (text) instantly, even with transitionMs > 0 (fix #5)', () => {
  const d: GlamDoc = {
    schema: 'glamour/v0',
    canvas: { w: 100, h: 100 },
    nodes: [{ id: 'label', type: 'text', x: 0, y: 0, text: 'Waiting' }],
  };
  const scene = buildScene(d);
  scene.applyStateSet({ 'label.text': 'Done' }, 250, 'linear');
  // Konva.Tween would try to numerically interpolate a string target,
  // producing NaN — text must be set immediately, not tweened.
  expect(scene.byId.label.text()).toBe('Done');
  scene.destroy();
});

test('applyStateSet still tweens numeric props alongside an instant text set in the same call', () => {
  const d: GlamDoc = {
    schema: 'glamour/v0',
    canvas: { w: 100, h: 100 },
    nodes: [
      { id: 'label', type: 'text', x: 0, y: 0, text: 'Waiting' },
      { id: 'orb', type: 'circle', x: 50, y: 50, r: 20 },
    ],
  };
  const scene = buildScene(d);
  scene.applyStateSet({ 'label.text': 'Done', 'orb.r': 40 }, 0, 'linear');
  expect(scene.byId.label.text()).toBe('Done');
  expect(scene.byId.orb.radius()).toBe(40);
  scene.destroy();
});

test('buildScene builds a Konva.Group per doc.groups, nesting matching nodes (v0.1)', () => {
  const d: GlamDoc = {
    schema: 'glamour/v0.1',
    canvas: { w: 200, h: 200 },
    nodes: [{ id: 'eye', type: 'circle', x: 5, y: 5, r: 4, group: 'face' }],
    groups: [{ id: 'face', x: 10, y: 20 }],
  };
  const scene = buildScene(d);
  expect(scene.byId.face).toBeDefined();
  expect(scene.byId.face.x()).toBe(10);
  expect(scene.byId.face.y()).toBe(20);
  // moving the group moves the eye's absolute position
  const before = scene.byId.eye.getAbsolutePosition();
  scene.byId.face.x(50);
  const after = scene.byId.eye.getAbsolutePosition();
  expect(after.x).toBe(before.x + 40);
  // getIntersection at the eye's absolute point still returns the leaf node
  const hit = scene.getIntersection(scene.byId.eye.getAbsolutePosition());
  expect(hit?._docId).toBe('eye');
  scene.destroy();
});

test('buildScene: ungrouped nodes still work as before (v0.1 doc, no group field)', () => {
  const d: GlamDoc = {
    schema: 'glamour/v0.1',
    canvas: { w: 100, h: 100 },
    nodes: [{ id: 'orb', type: 'circle', x: 50, y: 50, r: 10 }],
  };
  const scene = buildScene(d);
  expect(scene.byId.orb.radius()).toBe(10);
  scene.destroy();
});

test('buildScene seeds the resting frame: loop node prop starts at loop.from', () => {
  const d: GlamDoc = {
    schema: 'glamour/v0.1',
    canvas: { w: 300, h: 300 },
    nodes: [{ id: 'crab', type: 'circle', x: 999, y: 0, r: 10 }],
    loops: [{ node: 'crab', prop: 'x', from: 20, to: 280, ms: 1000, mode: 'alternate' }],
  };
  const scene = buildScene(d);
  expect(scene.byId.crab.x()).toBe(20);
  scene.destroy();
});

test('buildScene seeds the resting frame: wander target starts at (cx, cy)', () => {
  const d: GlamDoc = {
    schema: 'glamour/v0.1',
    canvas: { w: 300, h: 300 },
    nodes: [{ id: 'eye', type: 'circle', x: 999, y: 999, r: 4, group: 'face' }],
    groups: [{ id: 'face', x: 10, y: 20 }],
    wander: [{ target: 'face', cx: 150, cy: 150, rx: 40, ry: 20, stepMs: 800 }],
  };
  const scene = buildScene(d);
  expect(scene.byId.face.x()).toBe(150);
  expect(scene.byId.face.y()).toBe(150);
  scene.destroy();
});

test('buildScene seeds a wander target that is a plain node (not a group)', () => {
  const d: GlamDoc = {
    schema: 'glamour/v0.1',
    canvas: { w: 300, h: 300 },
    nodes: [{ id: 'orb', type: 'circle', x: 999, y: 999, r: 10 }],
    wander: [{ target: 'orb', cx: 60, cy: 70, rx: 10, ry: 10, stepMs: 800 }],
  };
  const scene = buildScene(d);
  expect(scene.byId.orb.x()).toBe(60);
  expect(scene.byId.orb.y()).toBe(70);
  scene.destroy();
});
