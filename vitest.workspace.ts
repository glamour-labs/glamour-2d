import react from '@vitejs/plugin-react';
import { defineWorkspace } from 'vitest/config';

/**
 * v2 splits the suite in two, which v1 did not have to do.
 *
 * The renderer is WebGL2, and jsdom has no GL context at all — v1 could run
 * everything in jsdom only because Konva needed a 2D context, which the native
 * `canvas` package supplied. So any test that builds a scene now runs in a REAL
 * Chromium; everything else (pure logic, node-only helpers, the headless render
 * path) stays in node, where it is faster and where `node:fs` still resolves.
 *
 * Adding a test means putting it in the right project below. A scene-building
 * test placed in `node` fails with "WebGL2 unavailable"; a `node:fs` test placed
 * in `browser` fails with "Module node:fs has been externalized".
 */

const browser = {
  enabled: true,
  provider: 'playwright' as const,
  name: 'chromium',
  headless: true,
  screenshotFailures: false,
};

export default defineWorkspace([
  {
    test: {
      name: 'node',
      include: [
        // Pure logic — no canvas needed.
        'packages/core/test/{expr,motion,onkey,ops,palette,schema,starterDoc,trace,validate}.test.ts',
        // Node-only helpers + the headless render path (drives its own browser).
        'packages/player/test/{export,machine,render-node}.test.ts',
        'packages/cli/test/**/*.test.ts',
        'packages/mcp/test/**/*.test.ts',
        'skills/*/test/**/*.test.ts',
        // The alphabet generator is pure geometry + validate, and its staleness
        // guard reads the committed .glam files off disk — node, not browser.
        'examples/alphabet/test/alphabet.test.ts',
      ],
      environment: 'node',
      // Headless-Chromium renders are ~1-2s each, several per file.
      testTimeout: 120_000,
      hookTimeout: 120_000,
    },
  },
  {
    plugins: [react()],
    test: {
      name: 'browser',
      include: [
        'packages/core/test/{scene,paint,context-loss}.test.ts',
        'packages/player/test/{player,ink,harness,guided,webcomponent,loop}.test.ts',
        'packages/react/test/**/*.test.{ts,tsx}',
        'apps/studio/test/**/*.test.{ts,tsx}',
        // Drives every guided letter through the REAL player, so it needs GL.
        'examples/alphabet/test/**/*.browser.test.ts',
      ],
      browser,
      testTimeout: 60_000,
    },
  },
]);
