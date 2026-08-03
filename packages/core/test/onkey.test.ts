import { expect, test } from 'vitest';
import { classifyOnKey } from '../src/onkey.js';
import { splitCondition } from '../src/expr.js';

test('splitCondition parses a well-formed numeric condition', () => {
  expect(splitCondition('progress > 0.5')).toEqual({ input: 'progress', op: '>', raw: '0.5' });
});

test('splitCondition parses the longer two-char ops before the shorter ones', () => {
  expect(splitCondition('progress >= 0.5')).toEqual({ input: 'progress', op: '>=', raw: '0.5' });
  expect(splitCondition('progress <= 0.5')).toEqual({ input: 'progress', op: '<=', raw: '0.5' });
  expect(splitCondition('mood == happy')).toEqual({ input: 'mood', op: '==', raw: 'happy' });
});

test('splitCondition returns null for a missing RHS (malformed)', () => {
  expect(splitCondition('progress>')).toBeNull();
});

test('splitCondition returns null when there is no operator at all', () => {
  expect(splitCondition('orb.click')).toBeNull();
});

test('classifyOnKey classifies a pointer key ("<node>.<event>")', () => {
  expect(classifyOnKey('orb.click')).toEqual({ kind: 'pointer', node: 'orb', event: 'click' });
});

test('classifyOnKey classifies a condition key over a pointer-looking key', () => {
  expect(classifyOnKey('progress > 0.5')).toEqual({
    kind: 'condition',
    input: 'progress',
    op: '>',
    raw: '0.5',
  });
});

test('classifyOnKey resolves the "a>b.click" ambiguous key as a condition, not a pointer (fix #8)', () => {
  // A key containing both a comparison operator AND a dot is ambiguous: a
  // naive dot-based classifier would read it as pointer node "b" event
  // "click"; the canonical classifier must always check condition-ops first,
  // matching validate's long-standing priority.
  expect(classifyOnKey('a>b.click')).toEqual({
    kind: 'condition',
    input: 'a',
    op: '>',
    raw: 'b.click',
  });
});

test('classifyOnKey returns "unknown" for a malformed key (no op, no dot)', () => {
  expect(classifyOnKey('just-a-word')).toEqual({ kind: 'unknown' });
});

test('classifyOnKey classifies an "@EVENT" key as event (v0.1 host-sent events)', () => {
  expect(classifyOnKey('@SHOW_CHECK')).toEqual({ kind: 'event', event: 'SHOW_CHECK' });
});

test('classifyOnKey checks "@EVENT" first, before condition/pointer classification', () => {
  // Even though this contains no dot or operator that would otherwise match,
  // this asserts event-form is matched via its own dedicated first-branch,
  // not stumbled into by falling through condition/pointer parsing.
  expect(classifyOnKey('@a1_2')).toEqual({ kind: 'event', event: 'a1_2' });
});

test('classifyOnKey does not classify a malformed "@" key (bad chars) as event', () => {
  expect(classifyOnKey('@bad-name')).toEqual({ kind: 'unknown' });
});
