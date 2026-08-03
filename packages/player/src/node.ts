// Node-only entry point (`@glam/player/node`). Kept separate from the default
// browser entry (`src/index.ts`) because these statically import `node:fs` /
// `node:path` / `node:url`, which cannot resolve in a browser bundle.
export { exportInlineHTML } from './export.js';
// v2: headless render moved here from `@glam/core`. The WebGL backend has no
// in-process rasterizer, so this drives a real headless Chromium.
export { renderToPNG } from './render-node.js';
export type { RenderOpts } from './render-node.js';
