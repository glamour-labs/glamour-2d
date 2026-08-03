import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { newCommand } from '../src/commands/new.js';
import { previewCommand } from '../src/commands/preview.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'glam-cli-preview-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

test('rejects an invalid doc instead of silently serving it (fix #9)', async () => {
  const file = path.join(dir, 'invalid.glam');
  writeFileSync(
    file,
    JSON.stringify({ schema: 'glamour/v0', canvas: { w: 1, h: 1 }, nodes: [{ id: 'a' }] }),
  );

  await expect(previewCommand(file)).rejects.toThrow();
});

test('serves the exported inline HTML at / on an ephemeral port', async () => {
  const file = path.join(dir, 'demo.glam');
  newCommand(file);

  const handle = await previewCommand(file);
  try {
    expect(handle.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/$/);

    const res = await fetch(handle.url);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('window.Glam');
  } finally {
    await handle.close();
  }
});
