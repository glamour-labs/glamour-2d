import { expect, test } from 'vitest';
import { createActor } from 'xstate';
import type { GlamDoc } from '@glam/core';
import { toXState } from '../src/machine.js';

const clickDoc: GlamDoc = {
  schema: 'glamour/v0',
  canvas: { w: 100, h: 100 },
  nodes: [{ id: 'orb', type: 'circle', x: 50, y: 50, r: 20 }],
  machine: {
    initial: 'idle',
    states: {
      idle: { set: { 'orb.r': 20 }, on: { 'orb.click': 'active' } },
      active: { set: { 'orb.r': 72 }, on: { 'orb.click': 'idle' } },
    },
  },
};

test('pointer click event transitions idle -> active -> idle', () => {
  const { machine, eventForPointer } = toXState(clickDoc);
  const actor = createActor(machine);
  actor.start();
  expect(actor.getSnapshot().value).toBe('idle');

  const clickEvent = eventForPointer('orb', 'click');
  expect(clickEvent).toBe('PTR:orb.click');

  actor.send({ type: clickEvent! });
  expect(actor.getSnapshot().value).toBe('active');

  actor.send({ type: clickEvent! });
  expect(actor.getSnapshot().value).toBe('idle');
});

test('eventForPointer returns null for events outside the v1 wired set', () => {
  const { eventForPointer } = toXState(clickDoc);
  expect(eventForPointer('orb', 'press')).toBeNull();
  expect(eventForPointer('orb', 'tap')).toBeNull();
});

const inputDoc: GlamDoc = {
  schema: 'glamour/v0',
  canvas: { w: 100, h: 100 },
  inputs: { progress: 0 },
  nodes: [{ id: 'orb', type: 'circle', x: 50, y: 50, r: 20 }],
  machine: {
    initial: 'low',
    states: {
      low: { on: { 'progress > 0.5': 'high' } },
      high: { on: { 'progress <= 0.5': 'low' } },
    },
  },
};

test('input-condition keys transition on INPUT events guarded by evalCondition', () => {
  const { machine } = toXState(inputDoc);
  const actor = createActor(machine);
  actor.start();
  expect(actor.getSnapshot().value).toBe('low');

  actor.send({ type: 'INPUT', inputs: { progress: 0.2 } });
  expect(actor.getSnapshot().value).toBe('low');

  actor.send({ type: 'INPUT', inputs: { progress: 0.7 } });
  expect(actor.getSnapshot().value).toBe('high');
});

const ambiguousDoc: GlamDoc = {
  schema: 'glamour/v0',
  canvas: { w: 100, h: 100 },
  inputs: { a: 3 },
  nodes: [{ id: 'orb', type: 'circle', x: 50, y: 50, r: 20 }],
  machine: {
    initial: 'idle',
    states: {
      idle: { on: { 'a>b.click': 'active' } },
      active: {},
    },
  },
};

const eventDoc: GlamDoc = {
  schema: 'glamour/v0.1',
  canvas: { w: 100, h: 100 },
  nodes: [{ id: 'orb', type: 'circle', x: 50, y: 50, r: 20 }],
  machine: {
    initial: 'idle',
    states: {
      idle: { on: { '@SHOW_CHECK': 'checked' } },
      checked: {},
    },
  },
};

test('a host "@EVENT" on-key maps to a plain XState event of that name, via classifyOnKey\'s "event" kind', () => {
  const { machine } = toXState(eventDoc);
  const actor = createActor(machine);
  actor.start();
  expect(actor.getSnapshot().value).toBe('idle');

  actor.send({ type: 'SHOW_CHECK' });
  expect(actor.getSnapshot().value).toBe('checked');
});

test('an ambiguous on-key ("a>b.click": has both a comparison op and a dot) classifies as an input condition, matching validate — not as a raw pointer event (fix #8)', () => {
  const { machine } = toXState(ambiguousDoc);
  const actor = createActor(machine);
  actor.start();
  expect(actor.getSnapshot().value).toBe('idle');

  // Before the fix, machine.ts's own dot-based classifier (checking the dot
  // before checking for a comparison op) treated this key as a pointer key
  // and registered it verbatim as `on['PTR:a>b.click']`. That diverges from
  // validate.ts, which always checks condition-ops first. After the fix the
  // shared classifier makes both agree: this must NOT be reachable as a
  // synthetic pointer event.
  actor.send({ type: 'PTR:a>b.click' });
  expect(actor.getSnapshot().value).toBe('idle');
});
