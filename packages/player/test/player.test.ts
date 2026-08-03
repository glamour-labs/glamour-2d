import { afterEach, beforeEach, expect, test } from 'vitest';
import type { GlamDoc } from '@glam/core';
import { renderGlamour, type GlamPlayer } from '../src/player.js';

const doc: GlamDoc = {
  schema: 'glamour/v0',
  canvas: { w: 200, h: 200 },
  inputs: { progress: 0 },
  nodes: [
    { id: 'orb', type: 'circle', x: 50, y: 50, r: 20, fill: '#4c7dff' },
    { id: 'bar', type: 'rect', x: 0, y: 0, w: 20, h: 10, fill: '#5ad67d' },
  ],
  bind: [{ node: 'bar', prop: 'w', expr: 'lerp(20,220,progress)' }],
  machine: {
    initial: 'idle',
    states: {
      idle: { set: { 'orb.r': 20 }, on: { 'orb.click': 'active' } },
      active: { set: { 'orb.r': 72 }, on: { 'orb.click': 'idle' } },
    },
    transition: { ms: 200, ease: 'linear' },
  },
};

let mount: HTMLElement;
let player: GlamPlayer;

// Test-only reach into the Konva nodes the player built internally, so pointer
// events can be simulated deterministically (via Konva's own `.fire`) without
// depending on jsdom's layout/bounding-rect support for real coordinate hit-testing.
interface KonvaNodeForTest {
  fire(eventName: string): void;
  radius(): number;
  width(): number;
}
function byIdForTest(p: GlamPlayer): Record<string, KonvaNodeForTest> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (p as unknown as { __byId: Record<string, KonvaNodeForTest> }).__byId;
}

// Test-only reach into the player's internal run-loop tick, so loop/wander
// advancement can be driven with injected timestamps rather than depending
// on real rAF timing (matches the approach in loop.test.ts).
function tickForTest(p: GlamPlayer): (time: number) => void {
  return (p as unknown as { __tick: (time: number) => void }).__tick;
}

beforeEach(() => {
  mount = document.createElement('div');
  document.body.appendChild(mount);
});

afterEach(() => {
  player?.destroy();
  mount.remove();
});

test('mounts and starts at the machine initial state', () => {
  player = renderGlamour(doc, mount, { instantTransitions: true });
  expect(player.getState()).toBe('idle');
});

test('click on a wired node transitions state and applies the instant state set', () => {
  player = renderGlamour(doc, mount, { instantTransitions: true });
  const byId = byIdForTest(player);
  byId.orb.fire('click');
  expect(player.getState()).toBe('active');
  expect(byId.orb.radius()).toBe(72);
});

test('setInput recomputes bound properties', () => {
  player = renderGlamour(doc, mount, { instantTransitions: true });
  const byId = byIdForTest(player);
  player.setInput('progress', 1);
  expect(byId.bar.width()).toBe(220);
});

test('destroy stops the actor and tears down the stage without throwing', () => {
  player = renderGlamour(doc, mount, { instantTransitions: true });
  expect(() => player.destroy()).not.toThrow();
});

test('play()/pause() are no-ops (but present) on a v0 doc with no loops/wander', () => {
  player = renderGlamour(doc, mount, { instantTransitions: true });
  expect(() => player.play()).not.toThrow();
  expect(() => player.pause()).not.toThrow();
});

const eventDoc: GlamDoc = {
  schema: 'glamour/v0.1',
  canvas: { w: 100, h: 100 },
  nodes: [
    { id: 'orb', type: 'circle', x: 50, y: 50, r: 20 },
    { id: 'crab', type: 'circle', x: 10, y: 10, r: 5, emit: 'pick' },
  ],
  loops: [{ node: 'crab', prop: 'x', from: 0, to: 100, ms: 1000, mode: 'alternate' }],
  machine: {
    initial: 'idle',
    states: {
      idle: { on: { '@SHOW_CHECK': 'checked' } },
      checked: {},
    },
  },
};

test('player.send("SHOW_CHECK") transitions a doc whose idle state has on:{"@SHOW_CHECK":"checked"}', () => {
  player = renderGlamour(eventDoc, mount, { instantTransitions: true });
  expect(player.getState()).toBe('idle');
  player.send('SHOW_CHECK');
  expect(player.getState()).toBe('checked');
});

test('clicking a node with emit:"pick" fires the `on` callback with {event, node}', () => {
  player = renderGlamour(eventDoc, mount, { instantTransitions: true });
  const byId = byIdForTest(player);
  const received: { event: string; node: string }[] = [];
  const unsub = player.on((e) => received.push(e));

  byId.crab.fire('click');
  expect(received).toEqual([{ event: 'pick', node: 'crab' }]);

  unsub();
  byId.crab.fire('click');
  expect(received).toHaveLength(1); // unsubscribed — no further calls
});

test('a throwing `on` listener does not stop other listeners from firing (or break dispatch)', () => {
  player = renderGlamour(eventDoc, mount, { instantTransitions: true });
  const byId = byIdForTest(player);
  const received: { event: string; node: string }[] = [];

  player.on(() => {
    throw new Error('boom');
  });
  player.on((e) => received.push(e));

  expect(() => byId.crab.fire('click')).not.toThrow();
  expect(received).toEqual([{ event: 'pick', node: 'crab' }]);
});

test('pause() halts loop advancement; play() resumes it', () => {
  player = renderGlamour(eventDoc, mount, { instantTransitions: true });
  const byId = byIdForTest(player);
  const tick = tickForTest(player);

  tick(0);
  tick(500); // alternate loop peak
  expect(byId.crab.x()).toBeCloseTo(100, 5);

  player.pause();
  tick(750); // ignored while paused
  expect(byId.crab.x()).toBeCloseTo(100, 5);

  player.play();
  tick(1000); // resumes from the same elapsed-time base -> back to `from`
  expect(byId.crab.x()).toBeCloseTo(0, 5);
});

const orbDoc: GlamDoc = {
  schema: 'glamour/v0.1',
  canvas: { w: 200, h: 200 },
  nodes: [
    { id: 'eyeL', type: 'circle', x: -5, y: -5, r: 3, group: 'face' },
    { id: 'eyeR', type: 'circle', x: 5, y: -5, r: 3, group: 'face' },
  ],
  groups: [{ id: 'face', x: 100, y: 100 }],
  wander: [{ target: 'face', cx: 100, cy: 100, rx: 40, ry: 40, stepMs: 1000 }],
};

test('mounting an orb-style doc (a wander on a group) auto-animates — the group\'s x changes across manually-driven ticks, with no explicit play() call', () => {
  player = renderGlamour(orbDoc, mount);
  const byId = byIdForTest(player) as unknown as Record<string, { x(): number }>;
  const tick = tickForTest(player);

  expect(byId.face.x()).toBe(100); // seeded resting frame (wander center)
  tick(0);
  tick(500);
  const moved = byId.face.x();
  expect(moved).not.toBe(100); // auto-started — no player.play() was called above
});

test('destroy() halts further mutation of a wandering group', () => {
  player = renderGlamour(orbDoc, mount);
  const byId = byIdForTest(player) as unknown as Record<string, { x(): number }>;
  const tick = tickForTest(player);

  tick(0);
  tick(500);
  const beforeDestroy = byId.face.x();
  player.destroy();
  tick(2000); // driven post-destroy; must not move the (now-destroyed) node further
  expect(byId.face.x()).toBe(beforeDestroy);
});

test('play() after destroy() is a no-op — does not restart the run-loop on a destroyed stage', () => {
  player = renderGlamour(orbDoc, mount);
  const byId = byIdForTest(player) as unknown as Record<string, { x(): number }>;
  const tick = tickForTest(player);

  tick(0);
  tick(500);
  const beforeDestroy = byId.face.x();
  player.destroy();

  expect(() => player.play()).not.toThrow();
  expect(() => tick(2000)).not.toThrow();
  expect(byId.face.x()).toBe(beforeDestroy); // no further mutation of the destroyed node
});

test('a v0 doc with no loops/wander starts no run-loop at all (__tick is a no-op)', () => {
  player = renderGlamour(doc, mount, { instantTransitions: true });
  const tick = tickForTest(player);
  expect(() => tick(0)).not.toThrow();
  expect(() => tick(9999)).not.toThrow();
});

test('set() imperatively updates a node prop (host-drives per element)', () => {
  player = renderGlamour(doc, mount, { instantTransitions: true });
  const byId = byIdForTest(player);
  player.set('orb', 'fill', '#35c46a');
  expect(byId.orb.fill()).toBe('#35c46a');
  // radius-family clamp still applies through set()
  player.set('orb', 'r', -10);
  expect(byId.orb.radius()).toBe(0);
  // unknown node / prop is a silent no-op (no throw)
  expect(() => player.set('ghost', 'fill', '#000')).not.toThrow();
  expect(() => player.set('orb', 'bogus', 1)).not.toThrow();
});
