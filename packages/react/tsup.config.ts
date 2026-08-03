import { defineConfig } from 'tsup';

// React wrapper for the Glamour player. `react`/`react-dom` are peers (external,
// not bundled) so the host app supplies its single React copy. Konva's browser
// build comes in transitively via @glam/player.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  platform: 'browser',
  external: ['react', 'react-dom', 'react/jsx-runtime'],
});
