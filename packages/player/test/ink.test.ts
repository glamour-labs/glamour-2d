import { afterEach, beforeEach, expect, test } from 'vitest';
import type { GlamDoc } from '@glamour-labs/core';
import {
  renderGlamour,
  type GlamPlayer,
  type GlamPointerEvent,
  type GlamStrokeEvent,
} from '../src/player.js';

// Rung 2 tests drive pointer handling through the `__pointer(type,x,y)` test
// hook, since jsdom has no real pointer positions for stage.getPointerPosition().
function pointerForTest(
  p: GlamPlayer,
): (type: 'down' | 'move' | 'up', x: number, y: number) => void {
  return (p as unknown as { __pointer: (t: 'down' | 'move' | 'up', x: number, y: number) => void })
    .__pointer;
}
function pointsForTest(p: GlamPlayer, id: string): number[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byId = (p as unknown as { __byId: Record<string, any> }).__byId;
  return byId[id].points() as number[];
}

const inkDoc: GlamDoc = {
  schema: 'glamour/v0.1',
  canvas: { w: 200, h: 200 },
  nodes: [
    { id: 'guide', type: 'stroke', x: 0, y: 0, points: [10, 10, 100, 100], stroke: '#ccc' },
    { id: 'ink', type: 'stroke', x: 0, y: 0, points: [], stroke: '#222', strokeWidth: 6 },
  ],
  ink: {
    into: 'ink',
    emit: 'traced',
    match: { target: [10, 10, 55, 55, 100, 100], tolerance: 20 },
  },
};

let mount: HTMLElement;
let player: GlamPlayer;

beforeEach(() => {
  mount = document.createElement('div');
  document.body.appendChild(mount);
});

afterEach(() => {
  player?.destroy();
  mount.remove();
});

test('a pointer drag inks points into the `into` stroke node', () => {
  player = renderGlamour(inkDoc, mount);
  const fire = pointerForTest(player);
  fire('down', 10, 10);
  fire('move', 55, 55);
  fire('move', 100, 100);
  fire('up', 100, 100);
  // ink node (at origin) should now hold the drawn polyline
  expect(pointsForTest(player, 'ink')).toEqual([10, 10, 55, 55, 100, 100]);
});

test('onPointer receives the raw down/move/up stream in canvas coords', () => {
  player = renderGlamour(inkDoc, mount);
  const seen: GlamPointerEvent[] = [];
  player.onPointer((e) => seen.push(e));
  const fire = pointerForTest(player);
  fire('down', 5, 5);
  fire('move', 30, 30);
  fire('up', 60, 60);
  expect(seen.map((e) => e.type)).toEqual(['down', 'move', 'up']);
  expect(seen[1]).toEqual({ type: 'move', x: 30, y: 30 });
});

test('onStroke fires on stroke end with the drawn points and a trace-match score', () => {
  player = renderGlamour(inkDoc, mount);
  const strokes: GlamStrokeEvent[] = [];
  player.onStroke((e) => strokes.push(e));
  const fire = pointerForTest(player);
  // trace right along the target path -> high score
  fire('down', 10, 10);
  fire('move', 55, 55);
  fire('move', 100, 100);
  fire('up', 100, 100);
  expect(strokes).toHaveLength(1);
  expect(strokes[0].event).toBe('traced');
  expect(strokes[0].match).toBeDefined();
  expect(strokes[0].match?.score).toBeGreaterThan(0.8);
  expect(strokes[0].match?.startOk).toBe(true);
  expect(strokes[0].match?.endOk).toBe(true);
});

test('a scribble far off the target scores low (host would reject)', () => {
  player = renderGlamour(inkDoc, mount);
  const strokes: GlamStrokeEvent[] = [];
  player.onStroke((e) => strokes.push(e));
  const fire = pointerForTest(player);
  fire('down', 180, 10);
  fire('move', 180, 60);
  fire('up', 180, 120);
  expect(strokes[0].match?.score).toBeLessThan(0.2);
});

test('a new stroke starts fresh (previous ink is cleared on the next pointerdown)', () => {
  player = renderGlamour(inkDoc, mount);
  const fire = pointerForTest(player);
  fire('down', 10, 10);
  fire('move', 50, 50);
  fire('up', 50, 50);
  fire('down', 90, 90); // second stroke
  fire('up', 90, 90);
  expect(pointsForTest(player, 'ink')).toEqual([90, 90]);
});

const multiDoc: GlamDoc = {
  schema: 'glamour/v0.1',
  canvas: { w: 200, h: 200 },
  nodes: [
    { id: 'ink0', type: 'stroke', x: 0, y: 0, points: [], stroke: '#222', strokeWidth: 6 },
    { id: 'ink1', type: 'stroke', x: 0, y: 0, points: [], stroke: '#222', strokeWidth: 6 },
  ],
  ink: {
    emit: 'traced',
    strokes: [
      { into: 'ink0', match: { target: [10, 10, 50, 50], tolerance: 20 } },
      { into: 'ink1', match: { target: [100, 10, 100, 50], tolerance: 20 } },
    ],
  },
};

test('multi-stroke: finished strokes accumulate (a new pen-down does NOT clear the previous stroke node)', () => {
  player = renderGlamour(multiDoc, mount);
  const fire = pointerForTest(player);
  // stroke 0
  fire('down', 10, 10);
  fire('move', 50, 50);
  fire('up', 50, 50);
  // stroke 1 — a fresh pen-down
  fire('down', 100, 10);
  fire('move', 100, 50);
  fire('up', 100, 50);
  // both persist: stroke 0's ink was NOT erased by starting stroke 1
  expect(pointsForTest(player, 'ink0')).toEqual([10, 10, 50, 50]);
  expect(pointsForTest(player, 'ink1')).toEqual([100, 10, 100, 50]);
});

test('multi-stroke: onStroke reports index + done, and scores each stroke against its own target', () => {
  player = renderGlamour(multiDoc, mount);
  const strokes: GlamStrokeEvent[] = [];
  player.onStroke((e) => strokes.push(e));
  const fire = pointerForTest(player);
  fire('down', 10, 10);
  fire('move', 50, 50);
  fire('up', 50, 50);
  fire('down', 100, 10);
  fire('move', 100, 50);
  fire('up', 100, 50);
  expect(strokes).toHaveLength(2);
  expect(strokes[0].index).toBe(0);
  expect(strokes[0].done).toBe(false);
  expect(strokes[0].match?.score).toBeGreaterThan(0.8);
  expect(strokes[1].index).toBe(1);
  expect(strokes[1].done).toBe(true);
  expect(strokes[1].match?.score).toBeGreaterThan(0.8);
});

test('multi-stroke: pen activity after the last stroke is a no-op (letter is complete)', () => {
  player = renderGlamour(multiDoc, mount);
  const fire = pointerForTest(player);
  ['down', 'up'].forEach(() => {});
  fire('down', 10, 10); fire('up', 50, 50); // stroke 0
  fire('down', 100, 10); fire('up', 100, 50); // stroke 1 (last)
  const strokes: GlamStrokeEvent[] = [];
  player.onStroke((e) => strokes.push(e));
  fire('down', 5, 5); fire('up', 5, 5); // extra — should not fire or draw
  expect(strokes).toHaveLength(0);
});

test('a doc without ink still exposes onPointer and does not throw on pointer events', () => {
  const plain: GlamDoc = {
    schema: 'glamour/v0',
    canvas: { w: 100, h: 100 },
    nodes: [{ id: 'orb', type: 'circle', x: 50, y: 50, r: 10 }],
  };
  player = renderGlamour(plain, mount);
  const seen: GlamPointerEvent[] = [];
  player.onPointer((e) => seen.push(e));
  const fire = pointerForTest(player);
  expect(() => {
    fire('down', 10, 10);
    fire('up', 10, 10);
  }).not.toThrow();
  expect(seen.map((e) => e.type)).toEqual(['down', 'up']);
});

test('a throwing onStroke listener does not break others', () => {
  player = renderGlamour(inkDoc, mount);
  let reached = false;
  player.onStroke(() => {
    throw new Error('boom');
  });
  player.onStroke(() => {
    reached = true;
  });
  const fire = pointerForTest(player);
  fire('down', 10, 10);
  fire('up', 10, 10);
  expect(reached).toBe(true);
});

// --- degenerate touches -----------------------------------------------------
// The runtime advances one pen-stroke per pen-up and cannot hand one back, so
// what it accepts as "a stroke" decides whether one stray touch costs the host
// every stroke already drawn.
const dotDoc: GlamDoc = {
  schema: 'glamour/v0.1',
  canvas: { w: 200, h: 200 },
  nodes: [
    { id: 'a', type: 'stroke', x: 0, y: 0, points: [], stroke: '#111', strokeWidth: 20 },
    { id: 'b', type: 'stroke', x: 0, y: 0, points: [], stroke: '#111', strokeWidth: 20 },
  ],
  ink: {
    strokes: [
      { into: 'a', match: { target: [100, 40, 100, 90, 100, 140], tolerance: 26 } },
      // A dot: the correct input is a stationary press, not a drag.
      { into: 'b', match: { target: [100, 22, 100, 28], tolerance: 26 } },
    ],
    emit: 'strokeDone',
  },
};

test('a stationary tap ON the stroke start counts - that is how a dot is drawn', () => {
  player = renderGlamour(dotDoc, mount);
  const strokes: GlamStrokeEvent[] = [];
  player.onStroke((e) => strokes.push(e));
  const fire = pointerForTest(player);
  fire('down', 100, 40); fire('move', 100, 90); fire('move', 100, 140); fire('up', 100, 140);
  fire('down', 100, 25); fire('up', 100, 25); // the dot, tapped
  expect(strokes.length).toBe(2);
  expect(strokes[1].done).toBe(true);
  expect(strokes[1].match!.startOk).toBe(true);
  expect(strokes[1].match!.score).toBeGreaterThanOrEqual(0.6);
});

test('a stationary tap far from the stroke start is ignored, not spent', () => {
  player = renderGlamour(dotDoc, mount);
  const strokes: GlamStrokeEvent[] = [];
  player.onStroke((e) => strokes.push(e));
  const fire = pointerForTest(player);
  fire('down', 20, 190); fire('up', 20, 190); // a resting finger in the corner
  expect(strokes.length).toBe(0);             // no event at all
  expect(pointsForTest(player, 'a')).toEqual([]); // and no ink left behind
  // ...and the stroke index did not move: stroke 1 is still stroke 1.
  fire('down', 100, 40); fire('move', 100, 90); fire('move', 100, 140); fire('up', 100, 140);
  expect(strokes.length).toBe(1);
  expect(strokes[0].index).toBe(0);
  expect(strokes[0].match!.startOk).toBe(true);
});

test('a motionless tap ON a long stroke\'s start is an accident, not an attempt', () => {
  // Touch down, hesitate, lift — right where you were about to start from. The
  // most ordinary accidental press there is, and an earlier guard shaped as
  // "unmoved AND away from the start" let it straight through, where it cost
  // the child every stroke already drawn.
  player = renderGlamour(dotDoc, mount);
  const strokes: GlamStrokeEvent[] = [];
  player.onStroke((e) => strokes.push(e));
  const fire = pointerForTest(player);
  fire('down', 100, 40); fire('up', 100, 40); // exactly the stroke-1 start
  expect(strokes.length).toBe(0);
  // The stroke was not spent: the real attempt still lands on stroke 1.
  fire('down', 100, 40); fire('move', 100, 90); fire('move', 100, 140); fire('up', 100, 140);
  expect(strokes.length).toBe(1);
  expect(strokes[0].index).toBe(0);
  expect(strokes[0].match!.score).toBeGreaterThanOrEqual(0.6);
});

test('a single pixel of jitter does not turn an accident into an attempt', () => {
  // A resting finger never holds still to sub-pixel precision, so a guard keyed
  // on "zero pointermove events" is defeated by the very thing it targets.
  player = renderGlamour(dotDoc, mount);
  const strokes: GlamStrokeEvent[] = [];
  player.onStroke((e) => strokes.push(e));
  const fire = pointerForTest(player);
  fire('down', 20, 190); fire('move', 21, 190); fire('up', 21, 190);
  expect(strokes.length).toBe(0);
});

test('a short but MOVED stroke is still a real attempt, and is scored', () => {
  // Only an unmoved sample is discarded. A deliberate small scribble in the
  // wrong place must still be judged - silently swallowing it would be its own
  // kind of lie.
  player = renderGlamour(dotDoc, mount);
  const strokes: GlamStrokeEvent[] = [];
  player.onStroke((e) => strokes.push(e));
  const fire = pointerForTest(player);
  // 40px of ink: well past half the 26px tolerance, so it reads as deliberate.
  fire('down', 20, 190); fire('move', 40, 190); fire('move', 60, 190); fire('up', 60, 190);
  expect(strokes.length).toBe(1);
  expect(strokes[0].match!.startOk).toBe(false);
});
