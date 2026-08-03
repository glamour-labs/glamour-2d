import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Konva's non-browser path conditionally `require()`s node `canvas`,
      // which Vite otherwise tries (and fails) to bundle for the browser.
      // Everything we import resolves to Konva's browser build, so this
      // should never actually execute — cheap insurance per the plan's
      // bundler-risk review (mirrors packages/player/tsup.config.ts).
      canvas: path.resolve(dirname, 'src/canvas-shim.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./test/setup.ts'],
  },
});
