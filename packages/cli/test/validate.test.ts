import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { newCommand } from '../src/commands/new.js';
import { validateCommand } from '../src/commands/validate.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'glam-cli-validate-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

test('a valid file yields ok with no errors', () => {
  const file = path.join(dir, 'demo.glam');
  newCommand(file);

  const result = validateCommand(file);
  expect(result.ok).toBe(true);
  expect(result.errors).toEqual([]);
});

test('a file with an unknown bind node yields errors mentioning the node id', () => {
  const file = path.join(dir, 'broken.glam');
  writeFileSync(
    file,
    JSON.stringify({
      schema: 'glamour/v0',
      canvas: { w: 100, h: 100 },
      nodes: [{ id: 'orb', type: 'circle', x: 0, y: 0, r: 10 }],
      bind: [{ node: 'ghost', prop: 'w', expr: '1' }],
    }),
    'utf8',
  );

  const result = validateCommand(file);
  expect(result.ok).toBe(false);
  expect(result.errors.join()).toMatch(/ghost/);
});
