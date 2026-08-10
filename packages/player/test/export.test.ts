import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, expect, test } from 'vitest';
import type { GlamDoc } from '@glamour-labs/core';
import { exportInlineHTML } from '../src/export.js';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.join(testDir, '..');
const repoRoot = path.join(pkgRoot, '..', '..');
const tsupBin = path.join(repoRoot, 'node_modules', '.bin', 'tsup');
const umdPath = path.join(pkgRoot, 'dist', 'glam-player.umd.js');

const doc: GlamDoc = {
  schema: 'glamour/v0',
  canvas: { w: 10, h: 10 },
  nodes: [{ id: 'orb', type: 'circle', x: 5, y: 5, r: 3 }],
};

beforeAll(() => {
  // exportInlineHTML embeds the *real* built bundle, so build it once here
  // rather than depending on a build step having already run.
  execFileSync(tsupBin, [], { cwd: pkgRoot, stdio: 'pipe' });
}, 120_000);

test('bundles the built UMD player + doc JSON behind a window.Glam boot script', () => {
  const html = exportInlineHTML(doc);
  expect(html).toContain('<script');
  expect(html).toContain('window.Glam');
  expect(html).toContain(JSON.stringify(doc));
  expect(html.toLowerCase()).toContain('<!doctype html>');
  expect(html).toMatch(/id="mount"/);
});

test('the built UMD bundle has no top-level require("canvas")', () => {
  expect(existsSync(umdPath)).toBe(true);
  const src = readFileSync(umdPath, 'utf8');
  expect(src).not.toMatch(/require\(["']canvas["']\)/);
});

test('escapes </script> breakout in a hostile doc field (XSS regression)', () => {
  const hostileDoc: GlamDoc = {
    schema: 'glamour/v0',
    canvas: { w: 10, h: 10 },
    nodes: [
      {
        id: 'orb',
        type: 'text',
        x: 0,
        y: 0,
        text: '</script><img src=x onerror=alert(1)>',
      },
    ],
  };
  const html = exportInlineHTML(hostileDoc);

  // Exactly the two intentional closing </script> tags from the template
  // (one for the inlined UMD source, one for the boot script) must survive —
  // no extra one smuggled in via the hostile `text` field.
  const closingTags = html.match(/<\/script>/gi) ?? [];
  expect(closingTags.length).toBe(2);

  // The hostile payload must not appear as a literal tag breakout: no raw
  // "</script><img" sequence anywhere in the output.
  expect(html).not.toMatch(/<\/script><img/i);

  // The payload's content is still present (just neutralized), proving we
  // escaped rather than silently dropped the field.
  expect(html).toContain('img src=x onerror=alert(1)');
});

test('escapes U+2028/U+2029 in the embedded doc JSON (JS string terminator breakout)', () => {
  const lineSep = String.fromCharCode(0x2028);
  const paraSep = String.fromCharCode(0x2029);
  const hostileDoc: GlamDoc = {
    schema: 'glamour/v0',
    canvas: { w: 10, h: 10 },
    nodes: [{ id: 'orb', type: 'text', x: 0, y: 0, text: `a${lineSep}b${paraSep}c` }],
  };
  const html = exportInlineHTML(hostileDoc);
  expect(html).not.toContain(lineSep);
  expect(html).not.toContain(paraSep);
  expect(html).toContain('\\u2028');
  expect(html).toContain('\\u2029');
});

test('a case-variant </SCRIPT breakout is also neutralized', () => {
  const hostileDoc: GlamDoc = {
    schema: 'glamour/v0',
    canvas: { w: 10, h: 10 },
    nodes: [{ id: 'orb', type: 'text', x: 0, y: 0, text: '</SCRIPT ><script>alert(2)</script >' }],
  };
  const html = exportInlineHTML(hostileDoc);
  const closingTags = html.match(/<\/script/gi) ?? [];
  // Only the two intentional closing tags from the template should be a real
  // "</script" prefix; the payload's variants must have been broken up.
  expect(closingTags.length).toBe(2);
});
