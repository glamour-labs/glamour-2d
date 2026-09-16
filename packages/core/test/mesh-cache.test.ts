import { expect, test } from 'vitest';
import { buildScene } from '../src/scene.js';
import type { GlamDoc } from '../src/types.js';

/**
 * The guard on the geometry cache.
 *
 * Node meshes are tessellated once and reused until a prop in `GEOM_PROPS`
 * bumps the node's `geomVersion`. That set is hand-written, so the failure mode
 * is silent: miss a prop, and the node keeps drawing its OLD shape forever while
 * every accessor still reports the new value. No existing test catches that —
 * they check accessor return values or a single render, never both across a
 * mutation.
 *
 * So each case here changes one shape-affecting prop THROUGH the accessor and
 * asserts the drawn pixels actually moved. A stale cache fails these; a correct
 * one passes regardless of how the cache is implemented.
 */

function inkCount(scene: ReturnType<typeof buildScene>): number {
  const canvas = scene.stage.toCanvas() as {
    width: number;
    height: number;
    getContext: (t: string) => CanvasRenderingContext2D;
  };
  const d = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  let ink = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 8) ink++;
  return ink;
}

function pixelAt(scene: ReturnType<typeof buildScene>, x: number, y: number): Uint8ClampedArray {
  const canvas = scene.stage.toCanvas() as { getContext: (t: string) => CanvasRenderingContext2D };
  return canvas.getContext('2d').getImageData(x, y, 1, 1).data;
}

/** Grow a shape prop and assert the painted area grows with it. */
function expectGrows(doc: GlamDoc, node: string, prop: string, from: number, to: number): void {
  const scene = buildScene(doc);
  scene.layer.draw();
  const before = inkCount(scene);
  expect(before, `${node}.${prop}: nothing was drawn at ${prop}=${from}`).toBeGreaterThan(0);

  const handle = scene.byId[node] as unknown as Record<string, (v: number) => void>;
  handle[prop](to);
  scene.layer.draw();
  const after = inkCount(scene);

  expect(
    after,
    `${node}.${prop} ${from} -> ${to} did not change the drawn pixels — a stale cached mesh`,
  ).toBeGreaterThan(before);
  scene.destroy();
}

const canvas = { w: 200, h: 200 };

test('circle radius invalidates the cached mesh', () => {
  expectGrows(
    { schema: 'glamour/v0.1', canvas, nodes: [{ id: 'c', type: 'circle', x: 100, y: 100, r: 20, fill: '#fff' }] },
    'c', 'radius', 20, 60,
  );
});

test('ellipse radiusX invalidates the cached mesh', () => {
  expectGrows(
    { schema: 'glamour/v0.1', canvas, nodes: [{ id: 'e', type: 'ellipse', x: 100, y: 100, rx: 20, ry: 40, fill: '#fff' }] },
    'e', 'radiusX', 20, 70,
  );
});

test('rect width invalidates the cached mesh', () => {
  expectGrows(
    { schema: 'glamour/v0.1', canvas, nodes: [{ id: 'r', type: 'rect', x: 20, y: 20, w: 40, h: 40, fill: '#fff' }] },
    'r', 'width', 40, 140,
  );
});

test('arc outerRadius invalidates the cached mesh', () => {
  expectGrows(
    {
      schema: 'glamour/v0.1', canvas,
      nodes: [{ id: 'a', type: 'arc', x: 100, y: 100, innerRadius: 10, outerRadius: 20, angle: 270, fill: '#fff' }],
    },
    'a', 'outerRadius', 20, 80,
  );
});

test('stroke strokeWidth invalidates the cached mesh', () => {
  expectGrows(
    {
      schema: 'glamour/v0.1', canvas,
      nodes: [{ id: 's', type: 'stroke', x: 20, y: 100, points: [0, 0, 160, 0], stroke: '#fff', strokeWidth: 2 }],
    },
    's', 'strokeWidth', 2, 24,
  );
});

test('stroke points invalidate the cached mesh', () => {
  const doc: GlamDoc = {
    schema: 'glamour/v0.1', canvas,
    nodes: [{ id: 's', type: 'stroke', x: 20, y: 100, points: [0, 0, 40, 0], stroke: '#fff', strokeWidth: 6 }],
  };
  const scene = buildScene(doc);
  scene.layer.draw();
  const before = inkCount(scene);
  (scene.byId.s as unknown as { points: (v: number[]) => void }).points([0, 0, 160, 0]);
  scene.layer.draw();
  expect(inkCount(scene), 'a longer polyline drew the same area — stale cached mesh').toBeGreaterThan(before);
  scene.destroy();
});

test('a node that only MOVES keeps its shape — the cache is reused, not wrong', () => {
  const doc: GlamDoc = {
    schema: 'glamour/v0.1', canvas,
    nodes: [{ id: 'c', type: 'circle', x: 60, y: 100, r: 30, fill: '#ffffff' }],
  };
  const scene = buildScene(doc);
  scene.layer.draw();
  const area = inkCount(scene);
  expect(pixelAt(scene, 60, 100)[3]).toBeGreaterThan(200);

  (scene.byId.c as unknown as { x: (v: number) => void }).x(140);
  scene.layer.draw();

  // Same amount of ink, in a new place. This is the case the cache exists for,
  // and the one a transform bug would break.
  expect(inkCount(scene), 'moving a node changed how much it painted').toBe(area);
  expect(pixelAt(scene, 140, 100)[3], 'the node did not arrive at its new x').toBeGreaterThan(200);
  expect(pixelAt(scene, 60, 100)[3], 'the node left ink behind at its old x').toBeLessThan(50);
  scene.destroy();
});
