import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate, traceMatch, type GlamDoc } from '@glamour-labs/core';
// @ts-expect-error — the generator is plain ESM JS, deliberately un-TypeScripted
// so it stays runnable with a bare `node build.mjs` from a fresh checkout.
import { buildDoc } from '../src/build.mjs';
// @ts-expect-error — see above
import { LETTERS, UPPER, LOWER } from '../src/glyphs.mjs';
// @ts-expect-error — see above
import { THEME_IDS } from '../src/themes.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

const CASES = [
  { key: 'upper', upper: true },
  { key: 'lower', upper: false },
] as const;
const MODES = ['easy', 'hard'] as const;

const combos = THEME_IDS.flatMap((theme: string) =>
  CASES.flatMap((c) =>
    LETTERS.flatMap((letter: string) =>
      MODES.map((mode) => ({ theme, caseKey: c.key, upper: c.upper, letter, mode })),
    ),
  ),
);

describe('glyph data', () => {
  it('covers all 52 glyphs', () => {
    expect(Object.keys(UPPER).sort().join('')).toBe(LETTERS.join(''));
    expect(Object.keys(LOWER).sort().join('')).toBe(LETTERS.join('').toLowerCase());
  });

  it('gives every glyph at least one pen-stroke, and every stroke at least one segment', () => {
    for (const [name, set] of [['UPPER', UPPER], ['LOWER', LOWER]] as const) {
      for (const [key, glyph] of Object.entries(set as Record<string, any>)) {
        expect(glyph.strokes.length, `${name} ${key}`).toBeGreaterThan(0);
        expect(glyph.w, `${name} ${key} width`).toBeGreaterThan(0);
        for (const stroke of glyph.strokes) expect(stroke.length, `${name} ${key}`).toBeGreaterThan(0);
      }
    }
  });

  it('keeps every glyph inside its writing bands', () => {
    // y < 0 would print above the ceiling line, y > 3 below the descender —
    // either means the card would clip the letter.
    for (const [name, set] of [['UPPER', UPPER], ['LOWER', LOWER]] as const) {
      for (const [key, glyph] of Object.entries(set as Record<string, any>)) {
        for (const stroke of glyph.strokes) {
          for (const seg of stroke) {
            const ys = seg.k === 'arc'
              ? [seg.cy - seg.ry, seg.cy + seg.ry]
              : seg.k === 'cubic'
                ? [seg.y1, seg.cy1, seg.cy2, seg.y2]
                : [seg.y1, seg.y2];
            for (const y of ys) {
              expect(y, `${name} ${key} y`).toBeGreaterThanOrEqual(-0.2);
              expect(y, `${name} ${key} y`).toBeLessThanOrEqual(3.2);
            }
          }
        }
      }
    }
  });
});

describe('generated documents', () => {
  it(`builds and validates all ${combos.length} documents`, () => {
    const bad: string[] = [];
    for (const c of combos) {
      const doc = buildDoc({ letter: c.letter, upper: c.upper, mode: c.mode, theme: c.theme }) as GlamDoc;
      const res = validate(doc);
      if (!res.ok) bad.push(`${c.theme}/${c.caseKey}/${c.letter}-${c.mode}: ${res.errors.join('; ')}`);
    }
    expect(bad).toEqual([]);
  });

  it('gives EASY a guided block and HARD an ink block, never both', () => {
    for (const c of combos) {
      const doc = buildDoc({ letter: c.letter, upper: c.upper, mode: c.mode, theme: c.theme }) as GlamDoc;
      const label = `${c.theme}/${c.caseKey}/${c.letter}-${c.mode}`;
      if (c.mode === 'easy') {
        expect(doc.guided, label).toBeTruthy();
        expect(doc.ink, label).toBeUndefined();
      } else {
        expect(doc.ink, label).toBeTruthy();
        expect(doc.guided, label).toBeUndefined();
      }
    }
  });

  it('wires one ink node per pen-stroke, and points every path at a real stroke node', () => {
    for (const c of combos) {
      const doc = buildDoc({ letter: c.letter, upper: c.upper, mode: c.mode, theme: c.theme }) as GlamDoc;
      const label = `${c.theme}/${c.caseKey}/${c.letter}-${c.mode}`;
      const strokeNodes = new Set(doc.nodes.filter((n) => n.type === 'stroke').map((n) => n.id));
      const allNodes = new Set(doc.nodes.map((n) => n.id));
      const list = c.mode === 'easy' ? doc.guided!.strokes : doc.ink!.strokes!;
      list.forEach((s: { into: string; handle?: string; arrow?: string }, i: number) => {
        expect(s.into, label).toBe(`ink${i + 1}`);
        expect(strokeNodes.has(s.into), `${label} → ${s.into}`).toBe(true);
        // The browser sweep hands the harness a stripped document (guided block
        // + only the nodes it names), so the claim that those ids resolve
        // against the FULL card is asserted here instead — cheaply, and where
        // the whole node list is already in hand.
        for (const ref of [s.handle, s.arrow]) {
          if (ref != null) expect(allNodes.has(ref), `${label} → ${ref}`).toBe(true);
        }
      });
    }
  });

  it('lights only stroke 1 at rest, so guidance arrives one stroke at a time', () => {
    for (const c of combos) {
      const doc = buildDoc({ letter: c.letter, upper: c.upper, mode: c.mode, theme: c.theme }) as GlamDoc;
      const label = `${c.theme}/${c.caseKey}/${c.letter}-${c.mode}`;
      for (const n of doc.nodes) {
        const m = /^g(\d+)_/.exec(n.id);
        if (!m) continue;
        expect(n.opacity, `${label} ${n.id}`).toBe(m[1] === '1' ? 1 : 0);
      }
    }
  });

  it('gives every guided path at least two distinct points', () => {
    // Deliberately NOT a minimum-length rule. An earlier version of this test
    // asserted every path cleared the player's 52px projection window and then
    // exempted `i` and `j` — the only two that did not — while both letters
    // were unfinishable in the shipped game. Whether a stroke can actually be
    // completed is now proved by driving the real runtime, in
    // `alphabet-guided.browser.test.ts`. This only guards degenerate geometry.
    for (const c of combos.filter((x) => x.mode === 'easy')) {
      const doc = buildDoc({ letter: c.letter, upper: c.upper, mode: c.mode, theme: c.theme }) as GlamDoc;
      doc.guided!.strokes.forEach((s, i) => {
        const label = `${c.theme}/${c.caseKey}/${c.letter} stroke ${i + 1}`;
        expect(s.path.length, label).toBeGreaterThanOrEqual(4);
        expect(s.path.length % 2, label).toBe(0);
        let len = 0;
        for (let k = 2; k < s.path.length; k += 2) {
          len += Math.hypot(s.path[k] - s.path[k - 2], s.path[k + 1] - s.path[k - 1]);
        }
        expect(len, label).toBeGreaterThan(0);
      });
    }
  });

  it('lets a careful trace pass every free-write stroke, and a scribble pass none', () => {
    // The free-write counterpart to the guided completability sweep. Nothing
    // covered this before, which is how a host-side heuristic that rejected any
    // stroke inking under 14px shipped — the dot on an `i` is a 5.6px target, so
    // `i` and `j` became unpassable while every test stayed green.
    //
    // Pure `traceMatch`, so it costs nothing: no scene, no browser.
    const PASS = 0.6;
    const unpassable: string[] = [];
    const falsePositives: string[] = [];
    for (const c of combos.filter((x) => x.mode === 'hard')) {
      const doc = buildDoc({ letter: c.letter, upper: c.upper, mode: c.mode, theme: c.theme }) as GlamDoc;
      doc.ink!.strokes!.forEach((s, i) => {
        const label = `${c.theme}/${c.caseKey}/${c.letter} stroke ${i + 1}`;
        const target = s.match!.target;
        const tol = s.match!.tolerance;

        // A careful child: the target path with a couple of pixels of wobble.
        const careful = target.map((v, k) => v + ((k % 4) - 1.5) * 2);
        const good = traceMatch(target, careful, tol);
        if (!(good.score >= PASS && good.startOk)) {
          unpassable.push(`${label}: score ${good.score.toFixed(2)} startOk ${good.startOk}`);
        }

        // A scribble in the opposite corner must NOT pass, or the verdict is
        // decorative and every letter is "correct".
        const scribble: number[] = [];
        for (let k = 0; k <= 24; k++) scribble.push(30 + k * 3, 40 + (k % 5) * 4);
        const bad = traceMatch(target, scribble, tol);
        if (bad.score >= PASS && bad.startOk) falsePositives.push(`${label}: scored ${bad.score.toFixed(2)}`);
      });
    }
    expect(unpassable).toEqual([]);
    expect(falsePositives).toEqual([]);
  });


  it('does not let a lazy straight swipe win a curved letter', () => {
    // The negative case that bites. A far-away scribble fails `startOk` for
    // every target in the corpus, so it can never detect the failure that
    // actually matters: a single straight chord from the start dot to the end
    // dot, which DOES start in the right place. At the original 1.15x-pen
    // tolerance that swipe passed 14 of the 68 curved strokes — a child who
    // drew a line instead of a `u` was told they were right.
    const PASS = 0.6;
    const arcLen = (t: number[]) => {
      let d = 0;
      for (let k = 2; k < t.length; k += 2) d += Math.hypot(t[k] - t[k - 2], t[k + 1] - t[k - 1]);
      return d;
    };
    const cheated: string[] = [];
    let curved = 0;
    for (const c of combos.filter((x) => x.mode === 'hard')) {
      const doc = buildDoc({ letter: c.letter, upper: c.upper, mode: c.mode, theme: c.theme }) as GlamDoc;
      doc.ink!.strokes!.forEach((s, i) => {
        const t = s.match!.target;
        const chordLen = Math.hypot(t[t.length - 2] - t[0], t[t.length - 1] - t[1]);
        // Only curved strokes: on a straight stroke the chord IS the letter.
        if (!(chordLen > 1 && arcLen(t) / chordLen > 1.15)) return;
        curved++;
        const swipe: number[] = [];
        for (let k = 0; k <= 40; k++) {
          swipe.push(t[0] + ((t[t.length - 2] - t[0]) * k) / 40, t[1] + ((t[t.length - 1] - t[1]) * k) / 40);
        }
        const r = traceMatch(t, swipe, s.match!.tolerance);
        if (r.score >= PASS && r.startOk) cheated.push(`${c.theme}/${c.caseKey}/${c.letter} stroke ${i + 1}`);
      });
    }
    expect(curved).toBeGreaterThan(60); // the sample is real, not an empty set

    // No stroke in the corpus can be won by a straight swipe.
    //
    // This once pinned `card/lower/b` as a known residual at 0.62: its single pen-stroke
    // is stem-then-bowl, so the straight chord from start to end runs down the stem and a
    // stem-only swipe covered enough of the target to pass. It closes when `b`'s bowl
    // returns onto the stem at mid-height, which makes the stem a smaller share of the
    // target. The hole is geometry, not tolerance — which is why tightening tolerance had
    // looked like the only fix and had rightly been refused.
    //
    // Pinned by identity, not by score, so a harmless tolerance tweak does not go red and
    // teach the next person to edit the number instead of asking why it moved. If anything
    // appears here, a letter has become cheatable and that is a teaching defect.
    expect(cheated).toEqual([]);
  });

  it('has the committed .glam files in sync with the generator', () => {
    // The playground fetches the files on disk, not the generator, so a stale
    // checkout would ship letters that no longer match the source of truth.
    const stale: string[] = [];
    for (const c of combos) {
      const rel = `glam/${c.theme}/${c.caseKey}/${c.letter.toLowerCase()}-${c.mode}.glam`;
      const file = resolve(ROOT, rel);
      if (!existsSync(file)) { stale.push(`${rel}: missing`); continue; }
      const expected = JSON.stringify(buildDoc({ letter: c.letter, upper: c.upper, mode: c.mode, theme: c.theme }));
      if (readFileSync(file, 'utf8') !== expected) stale.push(`${rel}: stale`);
    }
    expect(stale, 'run `node examples/alphabet/build.mjs`').toEqual([]);
  });
});
