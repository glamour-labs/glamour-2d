import { splitCondition } from './expr.js';

export type OnKeyClassification =
  | { kind: 'event'; event: string }
  | { kind: 'pointer'; node: string; event: string }
  | { kind: 'condition'; input: string; op: string; raw: string }
  | { kind: 'unknown' };

const EVENT_KEY_RE = /^@[A-Za-z0-9_]+$/;

/**
 * Parses a machine `on` key into a host-event form (`@EVENT`), a pointer
 * form (`node.event`), or an input-condition form (`input <op> value`).
 * Single-sourced (fix #8): this is the ONE place that decides
 * event-vs-pointer-vs-condition, used by both `validate.ts` and the
 * player's `machine.ts` mapping, so an ambiguous key (one containing both
 * a comparison operator AND a dot, e.g. "a>b.click") is classified
 * identically everywhere. `@EVENT` is checked FIRST — a key of that literal
 * shape can't also be a pointer or condition key — then condition-ops,
 * matching the original `validate.ts` priority, so a stray dot in the RHS
 * of a condition (as in "a>b.click") never gets misread as a pointer key.
 */
export function classifyOnKey(key: string): OnKeyClassification {
  if (key.startsWith('@')) {
    if (EVENT_KEY_RE.test(key)) {
      return { kind: 'event', event: key.slice(1) };
    }
    return { kind: 'unknown' };
  }
  const condition = splitCondition(key);
  if (condition) {
    return { kind: 'condition', ...condition };
  }
  const dotIdx = key.indexOf('.');
  if (dotIdx > 0) {
    return { kind: 'pointer', node: key.slice(0, dotIdx), event: key.slice(dotIdx + 1) };
  }
  return { kind: 'unknown' };
}
