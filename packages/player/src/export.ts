import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GlamDoc } from '@glam/core';

// Node-only helper (reads the built UMD bundle off disk) — deliberately kept
// out of the browser/UMD bundle graph (see umd-entry.ts) since `node:fs`
// cannot run in a browser <script> context.
const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const UMD_PATH = path.join(moduleDir, '..', 'dist', 'glam-player.umd.js');

const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);
const LINE_SEPARATOR_RE = new RegExp(LINE_SEPARATOR, 'g');
const PARAGRAPH_SEPARATOR_RE = new RegExp(PARAGRAPH_SEPARATOR, 'g');

/**
 * Neutralizes sequences that could let text embedded in an inline `<script>`
 * block break out of it (or corrupt the JS parse), without altering the
 * *meaning* of otherwise-valid JS/JSON:
 *  - Any case-variant of `</script` — the actual HTML-parser breakout vector
 *    (a raw `</script` anywhere inside a `<script>` element ends it, no
 *    matching `>` required). Escaping the `/` prevents that.
 *  - `<!--` — some (older/quirky) HTML parsers treat this as starting a
 *    comment inside script content, which can also be used to smuggle a
 *    premature close.
 *  - U+2028 / U+2029 (line/paragraph separator) — valid inside modern JS
 *    string literals, but historically treated as line terminators by some
 *    engines/tools, which can truncate a string outside of its intended
 *    literal.
 * Safe to apply to both the JSON payload (a JS string context) and the
 * built UMD source (should never legitimately contain these sequences
 * outside of string literals, so escaping them is a no-op there).
 */
function escapeForInlineScript(raw: string): string {
  return raw
    .replace(/<\/(script)/gi, '<\\/$1')
    .replace(/<!--/g, '<\\!--')
    .replace(LINE_SEPARATOR_RE, '\\u2028')
    .replace(PARAGRAPH_SEPARATOR_RE, '\\u2029');
}

/**
 * Bundles the built UMD player + the doc into a single self-contained HTML
 * string — the "standalone shareable piece" (openable offline, no server).
 * Requires `@glam/player` to have been built first (`npm run build`).
 */
export function exportInlineHTML(doc: GlamDoc): string {
  if (!existsSync(UMD_PATH)) {
    throw new Error(
      `exportInlineHTML: dist/glam-player.umd.js not found — build @glam/player first ` +
        `(npm run build --workspace=@glam/player).`,
    );
  }
  const umdSource = escapeForInlineScript(readFileSync(UMD_PATH, 'utf8'));
  const docJson = escapeForInlineScript(JSON.stringify(doc));

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Glamour</title>
</head>
<body>
<div id="mount"></div>
<script>
${umdSource}
</script>
<script>
window.__GLAM_DOC__ = ${docJson};
window.Glam.renderGlamour(window.__GLAM_DOC__, document.getElementById('mount'));
</script>
</body>
</html>
`;
}
