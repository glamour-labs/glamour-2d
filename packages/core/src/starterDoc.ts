import type { GlamDoc } from './types.js';

/**
 * The spec's example doc (docs/superpowers/specs/2026-07-22-glamour-design.md
 * §4) — a minimal, fully-wired `glamour/v0` scene. Single-sourced here (fix
 * #12) so the CLI's `glam new` starter and Studio's default document are
 * derived from the same object instead of two hand-typed copies drifting
 * apart. Must always pass core `validate`.
 */
export const starterDoc: GlamDoc = {
  schema: 'glamour/v0',
  canvas: { w: 640, h: 300, bg: '#12151b' },
  inputs: { progress: 0 },
  nodes: [
    { id: 'orb', type: 'circle', x: 200, y: 150, r: 48, fill: '#4c7dff' },
    { id: 'bar', type: 'rect', x: 300, y: 170, w: 20, h: 10, fill: '#5ad67d' },
  ],
  bind: [{ node: 'bar', prop: 'w', expr: 'lerp(20, 220, progress)' }],
  machine: {
    initial: 'idle',
    states: {
      idle: { set: { 'orb.r': 48, 'orb.fill': '#4c7dff' }, on: { 'orb.click': 'active' } },
      active: { set: { 'orb.r': 72, 'orb.fill': '#ff9f43' }, on: { 'orb.click': 'idle' } },
    },
    transition: { ms: 250, ease: 'easeOut' },
  },
};
