// NOTE: the `'use client'` directive for this entry is injected by tsup's
// `banner` (see tsup.config.ts), NOT written here — esbuild relocates a source
// directive below the bundle preamble, which makes it a no-op. Everything this
// package exports is client-only: the player owns a live WebGL2 context.
export { Glamour } from './Glamour.js';
export type { GlamourProps, GlamourHandle } from './Glamour.js';
// Re-export the event types a host binds against, so consumers import them from
// one place (@glamour-labs/react) rather than reaching into @glamour-labs/player.
export type {
  GlamEmitEvent,
  GlamGuidedEvent,
  GlamPointerEvent,
  GlamStrokeEvent,
} from '@glamour-labs/player';
export type { GlamDoc } from '@glamour-labs/core';
