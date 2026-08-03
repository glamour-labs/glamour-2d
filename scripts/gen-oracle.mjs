/**
 * Regenerate the oracle: render every `.glam` with v1's CLI into a reference dir.
 *
 * Exists because the freshness guard makes rebuilding v1 a two-step dance —
 * rebuilding invalidates the pre-rendered references, and `parity.mjs` then
 * (correctly) refuses to run. This is the second step, in one command.
 *
 * v1 needs Node 20 for its native `canvas` ABI — the very pin v2 dropped — so the
 * v1 CLI is invoked through that Node explicitly rather than whatever is on PATH.
 *
 * Usage:
 *   node scripts/gen-oracle.mjs <oracle-dir> [v1-repo]
 */

import { readdirSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { assertOracleBuildFresh, DEFAULT_V1_REPO } from './oracle-freshness.mjs';

const oracleDir = process.argv[2];
const v1Repo = process.argv[3] ?? process.env.GLAM_V1_REPO ?? DEFAULT_V1_REPO;
if (!oracleDir) {
  console.error('usage: node scripts/gen-oracle.mjs <oracle-dir> [v1-repo]');
  process.exit(1);
}

// Rendering from a stale v1 build would just bake the staleness into the
// references, so check before doing any work.
try {
  assertOracleBuildFresh(v1Repo);
} catch (err) {
  console.error(`\n${err.message}\n`);
  process.exit(2);
}

/** v1's Node. Its native `canvas` binary is built for this exact ABI. */
const V1_NODE = path.join(process.env.HOME ?? '', '.nvm/versions/node/v20.19.4/bin/node');
const node = existsSync(V1_NODE) ? V1_NODE : 'node';
if (node === 'node') {
  console.warn('warning: Node 20.19.4 not found — v1 render may fail on its native `canvas` ABI.\n');
}
const v1Cli = path.join(v1Repo, 'packages/cli/dist/cli.js');
if (!existsSync(v1Cli)) {
  console.error(`no v1 CLI at ${v1Cli} — run \`pnpm build\` in ${v1Repo} first.`);
  process.exit(1);
}

function findGlams(dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findGlams(full, acc);
    else if (entry.name.endsWith('.glam')) acc.push(full);
  }
  return acc;
}

// Fresh directory: a leftover PNG for a deleted document would otherwise linger
// and be compared forever.
rmSync(oracleDir, { recursive: true, force: true });
mkdirSync(oracleDir, { recursive: true });

// v1's own documents, plus v2's conformance docs (which v1 can still render —
// they use no v2-only format features, only v2-untested renderer paths).
const files = [
  ...findGlams(v1Repo).map((f) => ({ file: f, name: path.relative(v1Repo, f) })),
  ...findGlams('conformance').map((f) => ({ file: path.resolve(f), name: path.relative('.', f) })),
].filter(({ name }) => !name.startsWith('.claude/'));

let ok = 0;
const failed = [];
for (const { file, name } of files) {
  const out = path.join(oracleDir, `${name.replace(/\//g, '__').replace(/\.glam$/, '')}.png`);
  try {
    execFileSync(node, [v1Cli, 'render', file, '-o', out], { stdio: 'pipe' });
    ok++;
  } catch (err) {
    const msg = String(err.stderr ?? err.message ?? '').trim().split('\n').pop();
    failed.push({ name, msg });
  }
}

console.log(`oracle written to ${oracleDir}`);
console.log(`  rendered ${ok}/${files.length}`);
for (const f of failed) console.log(`  FAILED ${f.name} — ${f.msg}`);
// A document v1 cannot render has no reference; the parity gate reports it as
// NO-ORACLE rather than silently passing, so this is a warning, not an error.
process.exitCode = ok > 0 ? 0 : 1;
