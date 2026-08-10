import { defineConfig } from 'tsup';

// React wrapper for the Glamour player. `react`/`react-dom` are peers (external,
// not bundled) so the host app supplies its single React copy. The WebGL2
// renderer comes in transitively via @glamour-labs/player.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  platform: 'browser',
  external: ['react', 'react-dom', 'react/jsx-runtime'],
  // `'use client'` MUST be injected here rather than written at the top of
  // src/index.ts. esbuild does not preserve a source directive's position
  // through bundling — it gets hoisted below the bundle preamble, where it is
  // no longer a directive prologue and silently degrades to a dead string
  // expression. A banner is emitted verbatim as the first bytes of the file.
  //
  // Without it, importing <Glamour> from a React Server Component (Next.js App
  // Router, the default in Next 13+) throws at build time: the component holds
  // refs, effects and a live WebGL2 context, none of which can exist on the
  // server.
  banner: { js: "'use client';" },
});
