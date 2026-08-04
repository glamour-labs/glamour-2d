import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate, type GlamDoc } from '@glam/core';
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
      const list = c.mode === 'easy' ? doc.guided!.strokes : doc.ink!.strokes!;
      list.forEach((s: { into: string }, i: number) => {
        expect(s.into, label).toBe(`ink${i + 1}`);
        expect(strokeNodes.has(s.into), `${label} → ${s.into}`).toBe(true);
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

  it('keeps every guided path long enough for the player to project onto', () => {
    // The runtime scans a fixed 52px forward window; a path shorter than that
    // would complete on the first pointermove.
    for (const c of combos.filter((x) => x.mode === 'easy')) {
      const doc = buildDoc({ letter: c.letter, upper: c.upper, mode: c.mode, theme: c.theme }) as GlamDoc;
      doc.guided!.strokes.forEach((s, i) => {
        let len = 0;
        for (let k = 2; k < s.path.length; k += 2) {
          len += Math.hypot(s.path[k] - s.path[k - 2], s.path[k + 1] - s.path[k - 1]);
        }
        // `i`/`j` dots are deliberately tiny — everything else is a real stroke.
        const min = ['i', 'j'].includes(c.letter.toLowerCase()) && i === 1 ? 1 : 60;
        expect(len, `${c.theme}/${c.caseKey}/${c.letter} stroke ${i + 1}`).toBeGreaterThan(min);
      });
    }
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
