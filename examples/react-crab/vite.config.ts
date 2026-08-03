import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Konva's non-browser path conditionally require()s node `canvas`; alias
      // it away for the browser bundle (mirrors the studio + player configs).
      canvas: path.resolve(dirname, 'src/canvas-shim.ts'),
    },
  },
});
