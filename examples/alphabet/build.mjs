#!/usr/bin/env node
/**
 * Generate every alphabet-tracing `.glam`: 26 letters × upper/lower ×
 * easy/hard × 2 aesthetics = 208 documents, then validate each one.
 *
 *   node build.mjs            # write + validate everything
 *   node build.mjs --check    # validate only, fail if anything is stale
 */

import { writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDoc } from './src/build.mjs';
import { LETTERS } from './src/glyphs.mjs';
import { THEME_IDS } from './src/themes.mjs';
import { validate } from '@glam/core';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, 'glam');
const CHECK = process.argv.includes('--check');

export const MODES = ['easy', 'hard'];
export const CASES = [
  { key: 'upper', upper: true },
  { key: 'lower', upper: false },
];

/** Stable, guessable path — the playground builds these by string, not a manifest. */
export const docPath = (theme, caseKey, letter, mode) =>
  `${theme}/${caseKey}/${letter.toLowerCase()}-${mode}.glam`;

let written = 0;
let failed = 0;
const problems = [];

if (!CHECK && existsSync(OUT)) rmSync(OUT, { recursive: true });

for (const theme of THEME_IDS) {
  for (const c of CASES) {
    if (!CHECK) mkdirSync(resolve(OUT, theme, c.key), { recursive: true });
    for (const letter of LETTERS) {
      for (const mode of MODES) {
        const rel = docPath(theme, c.key, letter, mode);
        const doc = buildDoc({ letter, upper: c.upper, mode, theme });
        const res = validate(doc);
        if (!res.ok) {
          failed++;
          problems.push(`${rel}: ${res.errors.join('; ')}`);
          continue;
        }
        const json = JSON.stringify(doc);
        const file = resolve(OUT, rel);
        if (CHECK) {
          const onDisk = existsSync(file) ? readFileSync(file, 'utf8') : null;
          if (onDisk !== json) {
            failed++;
            problems.push(`${rel}: on-disk file is stale — re-run \`node build.mjs\``);
          }
        } else {
          writeFileSync(file, json);
        }
        written++;
      }
    }
  }
}

if (problems.length) {
  console.error(`\n${problems.length} problem(s):`);
  for (const p of problems.slice(0, 20)) console.error('  ' + p);
  if (problems.length > 20) console.error(`  … and ${problems.length - 20} more`);
  process.exit(1);
}

console.log(
  `${CHECK ? 'checked' : 'wrote'} ${written} documents ` +
  `(${THEME_IDS.length} themes × ${CASES.length} cases × ${LETTERS.length} letters × ${MODES.length} modes)` +
  `${failed ? ` — ${failed} failed` : ' — all valid'}`,
);
