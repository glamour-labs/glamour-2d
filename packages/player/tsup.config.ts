import { defineConfig } from 'tsup';

// v2 has no Konva and no native `canvas`, so the defensive canvas alias v1
// carried is gone. `playwright` must stay EXTERNAL: it is a node-only, heavy,
// dynamically-imported dependency of the headless renderer, and bundling it
// pulls in chromium-bidi's unresolvable deep requires.
const NODE_EXTERNAL = ['playwright', 'playwright-core'];

// NOTE: tsup runs these three configs CONCURRENTLY. None of them may set
// `clean: true` — a clean racing a sibling's write deleted `glam-player.umd.js`
// mid-build, which surfaced as an intermittent "UMD bundle not found" from
// renderToPNG. `dist` is removed once by the package's build script instead.
export default defineConfig([
  {
    // Browser-safe library entry (`@glam/player`) for bundler consumers
    // (Studio). Excludes `exportInlineHTML` — see src/node.ts / src/index.ts.
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: true,
    clean: false, // dist is cleaned once by the build script — see below
    sourcemap: true,
    platform: 'browser',
  },
  {
    // Node-only entry (`@glam/player/node`) for Node/bundler consumers that
    // need `exportInlineHTML` (e.g. the CLI). Statically imports `node:fs`/
    // `node:path`/`node:url`, so it must stay out of the browser entry above.
    entry: ['src/node.ts'],
    format: ['esm'],
    dts: true,
    clean: false,
    sourcemap: true,
    platform: 'node',
    external: NODE_EXTERNAL,
  },
  {
    // Standalone browser bundle: a single <script> exposing `window.Glam`.
    // Force-bundles all deps (xstate, @glam/core) — nothing external.
    entry: { 'glam-player': 'src/umd-entry.ts' },
    format: ['iife'],
    globalName: 'Glam',
    dts: false,
    clean: false,
    sourcemap: true,
    platform: 'browser',
    noExternal: [/.*/],
    // tsup defaults iife output to "<name>.global.js"; we want the exact
    // "glam-player.umd.js" filename the plan specifies.
    outExtension: () => ({ js: '.umd.js' }),
  },
]);
