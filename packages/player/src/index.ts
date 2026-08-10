// Browser-safe entry point (`@glamour-labs/player`). Node-only helpers (e.g.
// `exportInlineHTML`, which statically imports `node:fs`/`node:path`/
// `node:url`) live in `./node.ts`, exposed as the `@glamour-labs/player/node`
// subpath export — see docs/superpowers/BUILD-NOTES.md finding #1.
export { renderGlamour } from './player.js';
export type {
  GlamPlayer,
  RenderGlamourOpts,
  GlamEmitEvent,
  GlamPointerEvent,
  GlamStrokeEvent,
  GlamGuidedEvent,
} from './player.js';
export { toXState } from './machine.js';
export type { ToXStateResult } from './machine.js';
export { GlamCanvasElement, defineGlamCanvas } from './webcomponent.js';
// Drive-and-assert harness — headless behavioral testing for any glamour.
export { createHarness } from './harness.js';
export type { Harness, NodeSnapshot } from './harness.js';
