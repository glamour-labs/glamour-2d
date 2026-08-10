/**
 * Render-environment diagnosis — the single source of truth for "can this
 * install produce a PNG?", shared by `renderToPNG` and `glam doctor`.
 *
 * Why this exists as its own module: headless render has three independent
 * prerequisites (the playwright package, the Chromium binary it downloads
 * separately, and our own built UMD bundle), and each one fails differently
 * and is fixed differently. Collapsing them into one "playwright is required"
 * message — which is what this codebase did before — sends anyone debugging it
 * to the wrong fix and produces an identical error on the retry.
 *
 * That matters more than usual here because the cast-glamour skill makes
 * `glam render` a MANDATORY self-verify step, so the party reading these
 * messages is very often an AI agent with no other signal to go on. Every
 * message below therefore names which prerequisite failed and the exact
 * command that repairs it.
 */

import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Exit code reserved for "the environment can't render", distinct from a bad
 * document (1) or bad usage (2). Lets a caller branch on *install this* rather
 * than re-reading prose.
 */
export const EXIT_MISSING_RENDER_DEP = 3;

export type RenderEnvFault = 'playwright-missing' | 'chromium-missing' | 'bundle-missing';

/** A failure of the environment, never of the document being rendered. */
export class GlamRenderEnvError extends Error {
  readonly fault: RenderEnvFault;
  readonly exitCode = EXIT_MISSING_RENDER_DEP;
  /** The shell command that fixes it, ready to run. */
  readonly fix: string;

  constructor(fault: RenderEnvFault, message: string, fix: string) {
    super(`${message}\n\nFix:\n  ${fix}`);
    this.name = 'GlamRenderEnvError';
    this.fault = fault;
    this.fix = fix;
  }
}

/**
 * Where the built UMD player bundle could be.
 *
 * Two candidates because this module runs both bundled (`dist/node.js`, where
 * the bundle is a sibling) and straight from source under vitest (`src/`, where
 * it is at `../dist`). Resolved relative to this module rather than by package
 * name: the package's `exports` map deliberately does not expose
 * `./package.json`, so a name-based lookup throws ERR_PACKAGE_PATH_NOT_EXPORTED.
 */
export function umdBundleCandidates(): string[] {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return [
    path.join(here, 'glam-player.umd.js'),
    path.join(here, '..', 'dist', 'glam-player.umd.js'),
  ];
}

/** The bundle's path, or null when it hasn't been built. */
export function findUmdBundle(): string | null {
  for (const candidate of umdBundleCandidates()) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/** How this copy of the code is being run. Reported by `glam doctor`. */
export type InstallKind = 'source-checkout' | 'global-install' | 'project-dependency';

/**
 * Classify how this module is installed.
 *
 * This decides which install command leads, because they are NOT
 * interchangeable: a globally-installed CLI resolves `playwright` from the
 * global node_modules root and will never see a package added to the project's
 * devDependencies. Getting this backwards is the trap that made the old message
 * useless — it always said `pnpm add -D playwright`, a no-op for the global
 * install most authors have.
 *
 * The question is "which tree was this installed into?", and it is answered by
 * comparing the INSTALL ROOT — the directory holding the outermost `node_modules`
 * on this module's path — against the working directory:
 *
 *   - no `node_modules` on the path at all  -> a source checkout
 *   - install root is cwd or an ancestor    -> a project dependency
 *   - anywhere else                          -> a global install
 *
 * Note the direction. Two earlier versions asked "does the module path start
 * with cwd?", which is backwards: a project's `node_modules` sits at cwd or
 * ABOVE it, never below. That bug survived one fix because it is invisible
 * unless you run from a parent directory — and it then mislabelled a real
 * global install as a project dependency, because nvm puts the global root
 * under `$HOME` and `$HOME` was the cwd. Both times the wrong install command
 * was printed first.
 */
export function installKind(): InstallKind {
  return classifyInstall(path.resolve(fileURLToPath(import.meta.url)), path.resolve(process.cwd()));
}

/**
 * The pure half of `installKind`, split out so the cases that actually broke can
 * be tested with real paths. `import.meta.url` cannot be injected, so without
 * this the global-install branch is only reachable by publishing and installing
 * — which is exactly how the bug shipped twice.
 */
export function classifyInstall(selfPath: string, cwd: string): InstallKind {
  const marker = `${path.sep}node_modules${path.sep}`;

  const firstNodeModules = selfPath.indexOf(marker);
  if (firstNodeModules === -1) return 'source-checkout';

  const installRoot = selfPath.slice(0, firstNodeModules);
  const rootCoversCwd = cwd === installRoot || cwd.startsWith(installRoot + path.sep);

  return rootCoversCwd ? 'project-dependency' : 'global-install';
}

/**
 * True when playwright must be installed globally rather than into a project.
 * A source checkout takes the project-style command (`pnpm add -D`), since that
 * is what a workspace wants.
 */
export function isGlobalInstall(): boolean {
  return installKind() === 'global-install';
}

/** Install commands for playwright, likeliest-correct first. */
export function playwrightInstallHint(): string {
  const globalFirst = isGlobalInstall();
  const asGlobal = 'npm install -g playwright && npx playwright install chromium';
  const asProject = 'pnpm add -D playwright && npx playwright install chromium';
  return globalFirst
    ? `${asGlobal}\n  # or, if glam is a project dependency: ${asProject}`
    : `${asProject}\n  # or, if you installed glam globally: ${asGlobal}`;
}

export interface EnvCheck {
  name: string;
  ok: boolean;
  /** What was found (a resolved path, a version, or the reason it failed). */
  detail: string;
  /** Present only when `ok` is false. */
  fix?: string;
}

interface ChromiumProbe {
  executablePath?: () => string;
  launch(opts?: { args?: string[] }): Promise<{ close(): Promise<void> }>;
}

/**
 * Run every render prerequisite and report all of them.
 *
 * Deliberately does NOT stop at the first failure: someone with neither
 * playwright nor a built bundle should learn both in one run instead of
 * discovering the second only after fixing the first.
 */
export async function diagnoseRenderEnv(): Promise<EnvCheck[]> {
  const checks: EnvCheck[] = [];

  const bundle = findUmdBundle();
  checks.push(
    bundle
      ? { name: 'player UMD bundle', ok: true, detail: bundle }
      : {
          name: 'player UMD bundle',
          ok: false,
          detail: `not found; looked in:\n    ${umdBundleCandidates().join('\n    ')}`,
          fix: 'pnpm --filter @glamour-labs/player build   # only needed in a source checkout',
        },
  );

  let chromium: ChromiumProbe | null = null;
  try {
    const mod = (await import('playwright')) as unknown as { chromium: ChromiumProbe };
    chromium = mod.chromium;
    checks.push({ name: 'playwright package', ok: true, detail: 'resolved' });
  } catch (err) {
    checks.push({
      name: 'playwright package',
      ok: false,
      detail: err instanceof Error ? err.message.split('\n')[0] : String(err),
      fix: playwrightInstallHint(),
    });
  }

  if (chromium) {
    // Actually launch, rather than stat'ing `executablePath()`.
    //
    // Those are different binaries: `executablePath()` names the HEADED
    // chromium, while a default `launch()` uses the headless shell. Checking
    // one and running the other lets doctor report "ok" on an install that
    // cannot render (and "FAIL" on one that can) — and a diagnostic nobody can
    // trust is worse than no diagnostic. A real launch costs ~1s and answers
    // the question the command actually claims to answer.
    try {
      const browser = await chromium.launch({
        args: ['--enable-unsafe-swiftshader', '--hide-scrollbars'],
      });
      await browser.close();
      const exe = safeExecutablePath(chromium);
      checks.push({
        name: 'chromium browser',
        ok: true,
        detail: exe ? `launches · ${exe}` : 'launches',
      });
    } catch (err) {
      checks.push({
        name: 'chromium browser',
        ok: false,
        detail: err instanceof Error ? err.message.split('\n')[0] : String(err),
        fix: 'npx playwright install chromium',
      });
    }
  }

  return checks;
}

/** `executablePath()` throws on some channels; it's a nicety, never a gate. */
function safeExecutablePath(chromium: ChromiumProbe): string | null {
  try {
    const exe = chromium.executablePath?.();
    return exe && existsSync(exe) ? exe : null;
  } catch {
    return null;
  }
}
