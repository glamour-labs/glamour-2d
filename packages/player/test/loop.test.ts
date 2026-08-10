import { afterEach, beforeEach, expect, test } from 'vitest';
import { buildScene, konvaMethodFor, type GlamDoc, type SceneHandle } from '@glamour-labs/core';
import { RunLoop } from '../src/loop.js';

const doc: GlamDoc = {
  schema: 'glamour/v0.1',
  canvas: { w: 200, h: 200 },
  nodes: [{ id: 'crab', type: 'circle', x: 50, y: 50, r: 10 }],
  loops: [{ node: 'crab', prop: 'x', from: 0, to: 100, ms: 1000, mode: 'alternate' }],
};

let mount: HTMLElement;
let scene: SceneHandle;
let loop: RunLoop | undefined;

beforeEach(() => {
  mount = document.createElement('div');
  document.body.appendChild(mount);
  scene = buildScene(doc, mount);
});

afterEach(() => {
  loop?.destroy();
  loop = undefined;
  scene.destroy();
  mount.remove();
});

test('an alternate loop moves the prop toward `to` then back, driven by manual ticks', () => {
  loop = new RunLoop(doc, scene.byId, scene.layer);
  // buildScene already seeded the resting frame at loop.from.
  expect(scene.byId.crab.x()).toBe(0);

  loop.play();
  loop.tick(0); // establishes t0, elapsed 0
  expect(scene.byId.crab.x()).toBe(0);

  loop.tick(500); // elapsed 500 == ms/2 -> peak of the triangle wave
  expect(scene.byId.crab.x()).toBeCloseTo(100, 5);

  loop.tick(1000); // elapsed 1000 == ms -> back down to `from`
  expect(scene.byId.crab.x()).toBeCloseTo(0, 5);
});

test('pause halts advancement; play resumes', () => {
  loop = new RunLoop(doc, scene.byId, scene.layer);
  loop.play();
  loop.tick(0);
  loop.tick(250);
  const midway = scene.byId.crab.x();
  expect(midway).toBeGreaterThan(0);

  loop.pause();
  loop.tick(900); // should be ignored while paused
  expect(scene.byId.crab.x()).toBe(midway);

  loop.play();
  loop.tick(500); // elapsed still measured from the original t0 (0) -> peak
  expect(scene.byId.crab.x()).toBeCloseTo(100, 5);
});

test('RunLoop resolves loop props via the single-sourced @glamour-labs/core konvaMethodFor (fix: de-duped from loop.ts)', () => {
  // Regression for the PROP_TO_KONVA_METHOD/konvaMethodFor de-dup: loop.ts no
  // longer declares its own copy — it imports directly from @glamour-labs/core, so
  // both scene.ts and loop.ts always resolve a doc-facing prop name to the
  // exact same Konva accessor.
  expect(konvaMethodFor('r')).toBe('radius');
  expect(() => konvaMethodFor('bogus')).toThrow(/unknown prop/);

  loop = new RunLoop(doc, scene.byId, scene.layer);
  loop.play();
  loop.tick(0);
  loop.tick(1000);
  expect(scene.byId.crab.x()).toBeCloseTo(0, 5); // resolves loop.prop "x" fine end-to-end
});

test('a doc with no loops/wander leaves the run-loop a no-op', () => {
  const staticDoc: GlamDoc = {
    schema: 'glamour/v0',
    canvas: { w: 100, h: 100 },
    nodes: [{ id: 'a', type: 'circle', x: 10, y: 10, r: 5 }],
  };
  const staticScene = buildScene(staticDoc, document.createElement('div'));
  const staticLoop = new RunLoop(staticDoc, staticScene.byId, staticScene.layer);
  staticLoop.play();
  staticLoop.tick(0);
  staticLoop.tick(5000);
  expect(staticScene.byId.a.x()).toBe(10);
  staticLoop.destroy();
  staticScene.destroy();
});
