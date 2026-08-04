import { describe, expect, test } from 'vitest';
import { createHarness } from '@glam/player';
import type { GlamDoc } from '@glam/core';
// @ts-expect-error — the generator is plain ESM JS on purpose
import { buildDoc } from '../src/build.mjs';
// @ts-expect-error — see above
import { LETTERS } from '../src/glyphs.mjs';
// @ts-expect-error — see above
import { THEME_IDS } from '../src/themes.mjs';

/**
 * Every guided letter must be finishable.
 *
 * This runs the REAL player, not a re-implementation of its maths. A previous
 * version of this guard asserted that no guided path was shorter than the
 * projector's 52px window — and then exempted `i` and `j` by name, which were
 * the only two paths that violated it. Both letters were unfinishable in the
 * shipped game and the guard passed anyway. A test whose exceptions are the
 * bug is worse than no test, because it reads as coverage.
 *
 * So: drive each stroke the way a child's finger would and assert the runtime
 * says `done`. Nothing is exempt.
 */

/** Densify an authored path into steps, the way a real drag streams moves. */
function dense(flat: number[], step = 8): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < flat.length; i += 2) pts.push([flat[i], flat[i + 1]]);
  const out: Array<[number, number]> = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / step));
    for (let k = 1; k <= n; k++) out.push([x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n]);
  }
  return out;
}

const CASES = [
  { key: 'upper', upper: true },
  { key: 'lower', upper: false },
] as const;

describe('every guided letter can actually be finished', () => {
  for (const theme of THEME_IDS as string[]) {
    for (const c of CASES) {
      // Slow on purpose: 26 real WebGL scenes per case, and scene construction
      // — not the drag — is what costs. Measured at 20-120s per case depending
      // on theme (the card theme carries more nodes). That is a real tax on the
      // suite, and it buys the one property nothing cheaper can prove: that the
      // game is winnable. The bug it exists for shipped two unfinishable
      // letters past a green test run.
      test(`${theme} · ${c.key}`, { timeout: 300_000 }, () => {
        const unfinished: string[] = [];
        for (const letter of LETTERS as string[]) {
          const doc = buildDoc({ letter, upper: c.upper, mode: 'easy', theme }) as GlamDoc;
          const h = createHarness(doc);
          try {
            doc.guided!.strokes.forEach((s, i) => {
              h.stroke(dense(s.path));
              const done = h.guided.some((e) => e.index === i && e.done);
              if (!done) {
                const len = s.path.length / 2;
                unfinished.push(`${theme}/${c.key}/${letter} stroke ${i + 1} (${len} pts)`);
              }
            });
          } finally {
            h.destroy();
          }
        }
        expect(unfinished).toEqual([]);
      });
    }
  }
});

describe('a guided letter is not finishable by accident', () => {
  test('a drag that never grabs the handle leaves the letter untouched', () => {
    // Guards the opposite failure from the one above: the completion path must
    // still require the child to start in the right place.
    const doc = buildDoc({ letter: 'A', upper: true, mode: 'easy', theme: 'paper' }) as GlamDoc;
    const h = createHarness(doc);
    try {
      // A confident swipe right across the card, starting nowhere near stroke 1.
      h.stroke([[20, 420], [120, 420], [240, 420], [380, 420]]);
      expect(h.guided.some((e) => e.done)).toBe(false);
      expect(h.node('ink1')!.points).toEqual([]);
    } finally {
      h.destroy();
    }
  });
});
