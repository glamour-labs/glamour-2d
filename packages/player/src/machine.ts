import { createMachine, type AnyStateMachine } from 'xstate';
import { classifyOnKey, evalCondition, type GlamDoc } from '@glam/core';

/** v1 wired pointer events — the only ones the player actually fires. */
const WIRED_POINTER_EVENTS = new Set(['click', 'hover', 'leave']);

interface InputEvent {
  type: 'INPUT';
  inputs: Record<string, number | string>;
}

export interface ToXStateResult {
  machine: AnyStateMachine;
  eventForPointer(nodeId: string, ev: string): string | null;
}

/**
 * Maps a doc's `machine` (plain data) to an XState v5 machine.
 * - Pointer keys ("<nodeId>.<click|hover|leave>") become `PTR:<key>` events.
 * - Everything else is treated as an input-condition key ("<input> <op> <value>")
 *   and becomes a guarded transition on the `INPUT` event, the guard calling
 *   core's `evalCondition` against the event's live inputs snapshot.
 */
export function toXState(doc: GlamDoc): ToXStateResult {
  const machineDoc = doc.machine;
  if (!machineDoc) {
    throw new Error('toXState: doc.machine is required');
  }

  // XState's config typing is intentionally not modeled here (dynamic, doc-driven);
  // the returned `machine` is exposed as the typed `AnyStateMachine`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const states: Record<string, any> = {};

  for (const [stateName, stateDef] of Object.entries(machineDoc.states)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const on: Record<string, any> = {};
    const inputTransitions: { target: string; cond: string }[] = [];

    for (const [key, target] of Object.entries(stateDef.on ?? {})) {
      // Single-sourced with validate.ts (fix #8): classifyOnKey always checks
      // condition-ops before the dot, so an ambiguous key (e.g. "a>b.click")
      // is classified identically here and in validate — it was previously
      // possible for this dot-first check to disagree with validate.
      const classified = classifyOnKey(key);
      if (classified.kind === 'event') {
        // v0.1: a host-sent "@EVENT" key becomes a plain XState event named
        // after it (no prefix — `player.send(event)` forwards it verbatim).
        on[classified.event] = target;
      } else if (classified.kind === 'pointer' && WIRED_POINTER_EVENTS.has(classified.event)) {
        on[`PTR:${key}`] = target;
      } else if (classified.kind === 'condition') {
        inputTransitions.push({ target, cond: key });
      }
      // 'unknown' or a pointer with a non-wired event: validate should have
      // already rejected the doc; silently skip rather than crash the player.
    }

    if (inputTransitions.length > 0) {
      on.INPUT = inputTransitions.map(({ target, cond }) => ({
        target,
        guard: ({ event }: { event: InputEvent }) => evalCondition(cond, event.inputs),
      }));
    }

    states[stateName] = { on };
  }

  const machine = createMachine({
    id: 'glam',
    initial: machineDoc.initial,
    states,
  }) as AnyStateMachine;

  function eventForPointer(nodeId: string, ev: string): string | null {
    if (!WIRED_POINTER_EVENTS.has(ev)) return null;
    return `PTR:${nodeId}.${ev}`;
  }

  return { machine, eventForPointer };
}
