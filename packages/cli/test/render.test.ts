import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { newCommand } from '../src/commands/new.js';
import { renderCommand } from '../src/commands/render.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'glam-cli-render-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

test('renders the starter file to a PNG', async () => {
  const src = path.join(dir, 'demo.glam');
  const out = path.join(dir, 'demo.png');
  newCommand(src);

  const png = await renderCommand(src, out);

  expect(statSync(out).size).toBeGreaterThan(1000);
  expect(png.length).toBeGreaterThan(1000);
  const bytes = readFileSync(out);
  expect(bytes.subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
});

test('accepts a --state option targeting a named machine state', async () => {
  const src = path.join(dir, 'demo.glam');
  const out = path.join(dir, 'active.png');
  newCommand(src);

  const png = await renderCommand(src, out, { state: 'active' });

  expect(png.subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
});
