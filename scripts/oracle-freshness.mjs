/**
 * Oracle freshness guard.
 *
 * Both parity gates measure v2 against v1's *build*. If that build is stale, the
 * gates silently compare v2 against out-of-date v1 behaviour and report confident
 * nonsense. This is not hypothetical — it already happened: v1's `dist/` was a day
 * behind its source and predated `dash` support entirely, which inflated every
 * dashed document's diff and made `letter-h-easy` read 1.03% when the true figure
 * was 0.10%.
 *
 * Documenting that was not enough. This makes it impossible to run a gate against
 * a stale oracle at all.
 *
 * Two independent checks, because there are two ways to be stale:
 *   1. v1's `dist/` older than v1's `src/`  — the build itself is out of date.
 *   2. the oracle PNGs older than v1's `dist/` — the references were rendered from
 *      an earlier build, even though v1 is now current.
 */

import { readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';

/** Newest mtime (ms) under `dir`, or 0 if it does not exist. */
function newestMtime(dir, filter = () => true, depth = 0) {
  if (!existsSync(dir) || depth > 8) return 0;
  let newest = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      newest = Math.max(newest, newestMtime(full, filter, depth + 1));
    } else if (filter(entry.name)) {
      newest = Math.max(newest, statSync(full).mtimeMs);
    }
  }
  return newest;
}

const isSource = (name) => /\.(ts|tsx|mjs|js|json)$/.test(name);
const isBuilt = (name) => /\.(js|mjs)$/.test(name);
const isPng = (name) => name.endsWith('.png');
const ago = (ms) => {
  const s = Math.round(ms / 1000);
  if (s < 90) return `${s}s`;
  if (s < 5400) return `${Math.round(s / 60)}m`;
  return `${(s / 3600).toFixed(1)}h`;
};

/**
 * Throw unless v1's build is newer than v1's sources.
 *
 * @param {string} v1Repo path to the v1 (oracle) repo
 */
export function assertOracleBuildFresh(v1Repo) {
  const pkgs = path.join(v1Repo, 'packages');
  if (!existsSync(pkgs)) {
    throw new Error(`oracle freshness: no packages/ under ${v1Repo} — is that the v1 repo?`);
  }

  let worst = null;
  for (const pkg of readdirSync(pkgs, { withFileTypes: true })) {
    if (!pkg.isDirectory()) continue;
    const src = path.join(pkgs, pkg.name, 'src');
    const dist = path.join(pkgs, pkg.name, 'dist');
    if (!existsSync(src) || !existsSync(dist)) continue;
    const srcAt = newestMtime(src, isSource);
    const distAt = newestMtime(dist, isBuilt);
    if (srcAt > distAt) {
      const lag = srcAt - distAt;
      if (!worst || lag > worst.lag) worst = { pkg: pkg.name, lag, srcAt, distAt };
    }
  }

  if (worst) {
    throw new Error(
      `ORACLE IS STALE — refusing to run.\n\n`
      + `  ${v1Repo}/packages/${worst.pkg}: src/ is ${ago(worst.lag)} newer than dist/.\n\n`
      + `The gate would compare v2 against out-of-date v1 behaviour and report\n`
      + `confident nonsense. This exact failure already produced one wrong result\n`
      + `(a stale bundle with no \`dash\` support inflated every dashed document).\n\n`
      + `Fix:\n`
      + `  cd ${v1Repo} && pnpm build\n`
      + `then regenerate the oracle PNGs before re-running.`,
    );
  }
}

/**
 * Throw unless the oracle PNGs were rendered from the current v1 build.
 *
 * @param {string} v1Repo path to the v1 (oracle) repo
 * @param {string} oracleDir directory of reference PNGs
 */
export function assertOracleRendersFresh(v1Repo, oracleDir) {
  const distAt = newestMtime(path.join(v1Repo, 'packages'), isBuilt);
  const pngAt = newestMtime(oracleDir, isPng);
  if (pngAt === 0) {
    throw new Error(`oracle freshness: no PNGs found in ${oracleDir}`);
  }
  if (distAt > pngAt) {
    throw new Error(
      `ORACLE RENDERS ARE STALE — refusing to run.\n\n`
      + `  ${oracleDir} PNGs are ${ago(distAt - pngAt)} older than ${v1Repo}'s build.\n\n`
      + `v1 was rebuilt after these references were rendered, so they no longer\n`
      + `describe v1's current behaviour.\n\n`
      + `Fix: re-render the oracle from the current v1 build, then re-run.`,
    );
  }
}

/** Default oracle location — v1 is retired in place and kept as the spec. */
export const DEFAULT_V1_REPO = path.join(process.env.HOME ?? '', 'Project', 'glamour');
