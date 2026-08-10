// Node-only entry point (`@glamour-labs/player/node`). Kept separate from the default
// browser entry (`src/index.ts`) because these statically import `node:fs` /
// `node:path` / `node:url`, which cannot resolve in a browser bundle.
export { exportInlineHTML } from './export.js';
// v2: headless render moved here from `@glamour-labs/core`. The WebGL backend has no
// in-process rasterizer, so this drives a real headless Chromium.
export { renderToPNG } from './render-node.js';
export type { RenderOpts } from './render-node.js';
// Render-environment diagnosis, so a caller (`glam doctor`) can report what is
// missing BEFORE attempting a render, and branch on the fault rather than
// pattern-matching an error string.
export {
  diagnoseRenderEnv,
  findUmdBundle,
  GlamRenderEnvError,
  isGlobalInstall,
  playwrightInstallHint,
  umdBundleCandidates,
  EXIT_MISSING_RENDER_DEP,
} from './diagnose.js';
export type { EnvCheck, RenderEnvFault } from './diagnose.js';
