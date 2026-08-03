// The browser/UMD build entry (`glam-player.umd.js`, global `window.Glam`).
// Deliberately excludes `exportInlineHTML` (src/export.ts), which statically
// imports `node:fs` and cannot run inside a plain <script> page.
import { buildScene } from '@glam/core';
import { renderGlamour } from './player.js';
import { toXState } from './machine.js';
import { GlamCanvasElement, defineGlamCanvas } from './webcomponent.js';

export type { GlamPlayer, RenderGlamourOpts } from './player.js';
export type { ToXStateResult } from './machine.js';

defineGlamCanvas();

// `buildScene` is exposed on the UMD global so the headless renderer
// (`render-node.ts`) can build a scene and apply a named state directly —
// mirroring what v1's in-process `renderToPNG` did — rather than going through
// the full player and guessing at a state hook.
export { buildScene, renderGlamour, toXState, GlamCanvasElement, defineGlamCanvas };
