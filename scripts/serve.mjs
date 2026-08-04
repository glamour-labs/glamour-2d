#!/usr/bin/env node
/**
 * Minimal static file server rooted at the repo, so the example pages (which
 * reference `/packages/player/dist/...` and `/examples/...` by absolute path)
 * can be opened as-is. No dependencies — this exists so `pnpm playground`
 * works from a fresh checkout without adding a server package.
 *
 *   node scripts/serve.mjs [port]
 */

import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, join, relative, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
const PORT = Number(process.argv[2] || process.env.PORT || 4321);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.glam': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.map': 'application/json; charset=utf-8',
};

createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  // Containment is checked with `relative`, not a string prefix. `startsWith(ROOT)`
  // looks equivalent and is not: it also admits any SIBLING whose path merely begins
  // with the root's characters — `/../<root-basename>-notes/secret.txt` resolves
  // outside the repo and passes a prefix test. A relative path that neither starts
  // with `..` nor is absolute is inside, with no such edge.
  let file = resolve(ROOT, '.' + (url.startsWith('/') ? url : `/${url}`));
  const rel = relative(ROOT, file);
  if (rel !== '' && (rel.startsWith('..') || isAbsolute(rel))) {
    res.writeHead(403).end('forbidden');
    return;
  }
  try {
    if (statSync(file).isDirectory()) file = join(file, 'index.html');
  } catch {
    res.writeHead(404).end('not found');
    return;
  }
  try {
    statSync(file);
  } catch {
    res.writeHead(404).end('not found');
    return;
  }
  res.writeHead(200, {
    'Content-Type': TYPES[extname(file)] || 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  createReadStream(file).pipe(res);
// Loopback only. This serves the whole repository with no auth; binding every
// interface would expose it to the LAN for the sake of a convenience nobody asked
// for. Set HOST to override deliberately.
}).listen(PORT, process.env.HOST || '127.0.0.1', () => {
  console.log(`glamour static server → http://localhost:${PORT}/`);
  console.log(`  alphabet game       → http://localhost:${PORT}/examples/alphabet/`);
  console.log(`  sketch playground   → http://localhost:${PORT}/examples/playground/`);
});
