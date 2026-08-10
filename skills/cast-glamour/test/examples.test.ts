import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { validate } from '@glamour-labs/core';
// v2: headless render lives in the player (headless Chromium), not core.
import { renderToPNG } from '@glamour-labs/player/node';

const here = dirname(fileURLToPath(import.meta.url));
const examplesDir = join(here, '..', 'examples');
const files = readdirSync(examplesDir).filter((f) => f.endsWith('.glam'));

test('examples directory is not empty', () => {
  expect(files.length).toBeGreaterThan(0);
});

describe.each(files)('%s', (file) => {
  const doc = JSON.parse(readFileSync(join(examplesDir, file), 'utf8'));

  test('passes core validate', () => {
    const result = validate(doc);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  test('renders to a PNG without throwing', async () => {
    const png = await renderToPNG(doc);
    expect(Buffer.isBuffer(png)).toBe(true);
    expect(png.subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    expect(png.length).toBeGreaterThan(100);
  });
});
