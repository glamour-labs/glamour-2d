import { afterEach, expect, test } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { GlamDoc } from '@glamour-labs/core';
import { Glamour, type GlamGuidedEvent } from '../src/index.js';

afterEach(cleanup);

// A single guided stroke — a straight diagonal, so the drag path and the
// authored path are the same line and no projection subtlety is in play. The
// guided mechanics themselves are covered in the player suite; what this file
// proves is only that the React binding forwards them.
const guidedDoc: GlamDoc = {
  schema: 'glamour/v0.1',
  canvas: { w: 200, h: 200 },
  nodes: [
    { id: 'ink', type: 'stroke', x: 0, y: 0, points: [], stroke: '#1a1a1a', strokeWidth: 12 },
    { id: 'handle', type: 'circle', x: 20, y: 20, r: 16, fill: '#1c9ff2' },
  ],
  guided: { strokes: [{ path: [20, 20, 180, 180], into: 'ink', handle: 'handle' }] },
};

// Drives a real pointer drag across the mounted canvas. These tests run in a
// real Chromium (see vitest.workspace.ts — the `browser` project), so Konva's
// own hit-testing is live and DOM PointerEvents are the honest input path.
function drag(canvas: HTMLCanvasElement, from: [number, number], to: [number, number], steps = 20) {
  const rect = canvas.getBoundingClientRect();
  const at = (x: number, y: number) =>
    ({ clientX: rect.left + x, clientY: rect.top + y, pointerId: 1, bubbles: true }) as const;

  canvas.dispatchEvent(new PointerEvent('pointerdown', at(from[0], from[1])));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = from[0] + (to[0] - from[0]) * t;
    const y = from[1] + (to[1] - from[1]) * t;
    canvas.dispatchEvent(new PointerEvent('pointermove', at(x, y)));
  }
  canvas.dispatchEvent(new PointerEvent('pointerup', at(to[0], to[1])));
}

test('forwards guided-ink progress to the onGuided prop, ending with done', () => {
  const events: GlamGuidedEvent[] = [];
  const { container } = render(<Glamour doc={guidedDoc} onGuided={(e) => events.push(e)} />);
  const canvas = container.querySelector('canvas') as HTMLCanvasElement;

  drag(canvas, [20, 20], [180, 180]);

  expect(events.length).toBeGreaterThan(1); // a stream, not one terminal event
  expect(events.every((e) => e.index === 0)).toBe(true);
  const last = events[events.length - 1];
  expect(last.done).toBe(true);
  expect(last.progress).toBeCloseTo(1, 2);
});

test('progress rises monotonically across the drag', () => {
  const events: GlamGuidedEvent[] = [];
  const { container } = render(<Glamour doc={guidedDoc} onGuided={(e) => events.push(e)} />);
  drag(container.querySelector('canvas') as HTMLCanvasElement, [20, 20], [180, 180]);

  const progresses = events.map((e) => e.progress);
  for (let i = 1; i < progresses.length; i++) {
    expect(progresses[i]).toBeGreaterThanOrEqual(progresses[i - 1]);
  }
});

test('a new onGuided identity does NOT remount the canvas', () => {
  const { container, rerender } = render(<Glamour doc={guidedDoc} onGuided={() => {}} />);
  const first = container.querySelector('canvas');
  rerender(<Glamour doc={guidedDoc} onGuided={() => {}} />);
  expect(container.querySelector('canvas')).toBe(first);
});

test('a guided doc renders without an onGuided prop', () => {
  const { container } = render(<Glamour doc={guidedDoc} />);
  const canvas = container.querySelector('canvas') as HTMLCanvasElement;
  expect(canvas).toBeTruthy();
  expect(() => drag(canvas, [20, 20], [180, 180])).not.toThrow();
});
