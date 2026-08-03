import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: true,
    clean: true,
    sourcemap: true,
    platform: 'node',
  },
  {
    // Bin entry: needs the shebang so it's directly executable once installed
    // via package.json's `bin` field.
    entry: { cli: 'src/cli.ts' },
    format: ['esm'],
    dts: false,
    clean: false,
    sourcemap: true,
    platform: 'node',
    banner: { js: '#!/usr/bin/env node' },
  },
]);
