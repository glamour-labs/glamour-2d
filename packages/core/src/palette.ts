import type { GlamNode } from './types.js';
import type { Op } from './ops.js';

/**
 * Named, composable op fragments — the AI-facing vocabulary for common
 * interactive patterns. Each returns a plain `Op[]` meant to be fed straight
 * into `applyOps(doc, ops)`.
 *
 * Note on `hoverGrow`'s `by`: palette functions are pure and receive no doc,
 * so they cannot read a node's current radius to compute a relative delta.
 * `by` is therefore the ABSOLUTE radius applied on hover (default 60), not a
 * multiplier or increment — pass an explicit target for precise control.
 */
export const palette = {
  hoverGrow(id: string, by = 60): Op[] {
    return [
      { op: 'defineState', name: 'idle', state: { on: { [`${id}.hover`]: 'hover' } } },
      {
        op: 'defineState',
        name: 'hover',
        state: { set: { [`${id}.r`]: by }, on: { [`${id}.leave`]: 'idle' } },
      },
      { op: 'setInitial', name: 'idle' },
    ];
  },

  clickToggle(id: string, a: Partial<GlamNode>, b: Partial<GlamNode>): Op[] {
    const setA = Object.fromEntries(Object.entries(a).map(([k, v]) => [`${id}.${k}`, v as number | string]));
    const setB = Object.fromEntries(Object.entries(b).map(([k, v]) => [`${id}.${k}`, v as number | string]));
    return [
      { op: 'defineState', name: 'idle', state: { set: setA, on: { [`${id}.click`]: 'active' } } },
      { op: 'defineState', name: 'active', state: { set: setB, on: { [`${id}.click`]: 'idle' } } },
      { op: 'setInitial', name: 'idle' },
    ];
  },

  progressBar(id: string, input: string): Op[] {
    return [{ op: 'addBinding', bind: { node: id, prop: 'w', expr: `lerp(20, 220, ${input})` } }];
  },

  fadeIn(id: string): Op[] {
    return [
      { op: 'defineState', name: 'visible', state: { set: { [`${id}.opacity`]: 1 } } },
      { op: 'setInitial', name: 'visible' },
    ];
  },
};

export function listPrimitives(): { name: string; signature: string; description: string }[] {
  return [
    {
      name: 'hoverGrow',
      signature: 'hoverGrow(id: string, by?: number): Op[]',
      description: 'Adds idle/hover states; node grows to radius `by` (default 60) on hover, reverts on leave.',
    },
    {
      name: 'clickToggle',
      signature: 'clickToggle(id: string, a: Partial<GlamNode>, b: Partial<GlamNode>): Op[]',
      description: 'Adds idle/active states holding prop sets `a`/`b`; click toggles between them.',
    },
    {
      name: 'progressBar',
      signature: 'progressBar(id: string, input: string): Op[]',
      description: 'Binds a rect node\'s width to `lerp(20, 220, <input>)` so it fills as the input goes 0→1.',
    },
    {
      name: 'fadeIn',
      signature: 'fadeIn(id: string): Op[]',
      description: 'Adds a `visible` state (opacity 1) as the machine initial, fading the node in via the transition tween.',
    },
  ];
}
