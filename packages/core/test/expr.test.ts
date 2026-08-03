import { expect, test } from 'vitest';
import { evalExpr, evalCondition } from '../src/expr.js';

test('lerp + identifiers', () => {
  expect(evalExpr('lerp(20,220,progress)', { progress: 0.5 })).toBe(120);
});

test('rejects unknown identifier', () => {
  expect(() => evalExpr('foo + 1', {})).toThrow();
});

test('evalCondition numeric compare', () => {
  expect(evalCondition('progress > 0.5', { progress: 0.7 })).toBe(true);
  expect(evalCondition('progress > 0.5', { progress: 0.2 })).toBe(false);
});

test('evalCondition string equality', () => {
  expect(evalCondition('mood == happy', { mood: 'happy' })).toBe(true);
});

test('arithmetic + parens', () => {
  expect(evalExpr('(1 + 2) * 3', {})).toBe(9);
  expect(evalExpr('10 / 2 - 1', {})).toBe(4);
});

test('clamp / min / max / abs', () => {
  expect(evalExpr('clamp(150, 0, 100)', {})).toBe(100);
  expect(evalExpr('min(3, 7)', {})).toBe(3);
  expect(evalExpr('max(3, 7)', {})).toBe(7);
  expect(evalExpr('abs(-5)', {})).toBe(5);
});

test('unary minus', () => {
  expect(evalExpr('-5 + 2', {})).toBe(-3);
});

test('evalCondition all comparison ops', () => {
  expect(evalCondition('x <= 5', { x: 5 })).toBe(true);
  expect(evalCondition('x >= 5', { x: 4 })).toBe(false);
  expect(evalCondition('x != 5', { x: 4 })).toBe(true);
  expect(evalCondition('x == 5', { x: 5 })).toBe(true);
  expect(evalCondition('x < 5', { x: 4 })).toBe(true);
});

test('evalCondition throws on malformed condition', () => {
  expect(() => evalCondition('just-a-word', { x: 1 })).toThrow();
});

test('evalCondition throws on unknown input', () => {
  expect(() => evalCondition('ghost > 1', { x: 1 })).toThrow();
});

test('does not resolve identifiers via the prototype chain (constructor/__proto__/toString)', () => {
  expect(() => evalExpr('constructor', {})).toThrow(/unknown identifier/);
  expect(() => evalExpr('toString', {})).toThrow(/unknown identifier/);
  expect(() => evalExpr('hasOwnProperty', {})).toThrow(/unknown identifier/);
});

test('a pathologically deep/long expression throws a normal (caught) error, not a stack overflow', () => {
  const bomb = '('.repeat(1e5);
  let caught: unknown;
  try {
    evalExpr(bomb, {});
  } catch (err) {
    caught = err;
  }
  expect(caught).toBeInstanceOf(Error);
  expect(caught).not.toBeInstanceOf(RangeError);
});
