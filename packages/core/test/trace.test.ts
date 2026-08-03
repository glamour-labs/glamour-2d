import { expect, test } from 'vitest';
import { traceMatch } from '../src/trace.js';

// A simple horizontal target line from (0,0) to (100,0), 6 vertices.
const target = [0, 0, 20, 0, 40, 0, 60, 0, 80, 0, 100, 0];

test('a perfect retrace scores ~1 with full coverage and no stray', () => {
  const r = traceMatch(target, target, 5);
  expect(r.coverage).toBe(1);
  expect(r.stray).toBe(0);
  expect(r.startOk).toBe(true);
  expect(r.endOk).toBe(true);
  expect(r.score).toBeCloseTo(1);
});

test('a slightly-wobbly trace within tolerance still scores high', () => {
  const drawn = [0, 2, 25, -3, 50, 3, 75, -2, 100, 1];
  const r = traceMatch(target, drawn, 6);
  expect(r.coverage).toBeGreaterThan(0.6);
  expect(r.stray).toBe(0);
  expect(r.score).toBeGreaterThan(0.6);
});

test('a scribble far off the path scores low and flags stray', () => {
  const drawn = [0, 80, 20, 90, 40, 85, 60, 95];
  const r = traceMatch(target, drawn, 5);
  expect(r.coverage).toBe(0);
  expect(r.stray).toBe(1);
  expect(r.score).toBe(0);
});

test('covering only half the path yields ~0.5 coverage', () => {
  const drawn = [0, 0, 20, 0, 40, 0]; // only first half
  const r = traceMatch(target, drawn, 5);
  expect(r.coverage).toBeCloseTo(0.5, 1);
  expect(r.startOk).toBe(true);
  expect(r.endOk).toBe(false); // never reached (100,0)
});

test('drawing in the wrong direction covers the path but flags start/end', () => {
  const reversed = [...target].reduce<number[]>((acc, _, i, arr) => {
    if (i % 2 === 0) acc.unshift(arr[i], arr[i + 1]);
    return acc;
  }, []);
  const r = traceMatch(target, reversed, 5);
  // coverage can be high (same points), but the stroke started at the far end
  expect(r.startOk).toBe(false);
  expect(r.endOk).toBe(false);
});

test('stray points between on-path points are penalized in the score', () => {
  // half the drawn points are on-path, half wander off
  const drawn = [0, 0, 20, 0, 40, 0, 60, 0, 80, 0, 100, 0, 50, 90, 60, 95];
  const r = traceMatch(target, drawn, 5);
  expect(r.coverage).toBe(1);
  expect(r.stray).toBeGreaterThan(0);
  expect(r.score).toBeLessThan(1); // penalized by stray
});

test('empty drawn or empty target returns a zero score, no throw', () => {
  expect(traceMatch(target, [], 5).score).toBe(0);
  expect(traceMatch([], target, 5).score).toBe(0);
  expect(traceMatch(target, target, 0).score).toBe(0); // non-positive tolerance
});

test('on-segment (between target vertices) counts as on-path, not stray', () => {
  // points lie ON the target segments but not on its vertices
  const drawn = [10, 0, 30, 0, 50, 0, 70, 0, 90, 0];
  const r = traceMatch(target, drawn, 3);
  expect(r.stray).toBe(0); // distance-to-segment, not distance-to-vertex
});
