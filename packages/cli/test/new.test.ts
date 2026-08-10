import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { starterDoc as coreStarterDoc, validate } from '@glamour-labs/core';
import { newCommand, starterDoc } from '../src/commands/new.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'glam-cli-new-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

test('writes a starter .glam that validates ok', () => {
  const target = path.join(dir, 'demo.glam');
  const written = newCommand(target);

  expect(written).toBe(target);
  expect(existsSync(target)).toBe(true);

  const doc = JSON.parse(readFileSync(target, 'utf8'));
  const result = validate(doc);
  expect(result.ok).toBe(true);
  expect(result.errors).toEqual([]);
});

test('cli starterDoc is single-sourced from @glamour-labs/core, not a hand-typed duplicate (fix #12)', () => {
  expect(starterDoc).toEqual(coreStarterDoc);
});
