import { expect, test } from 'vitest';
import { buildScene } from '../src/scene.js';
import type { GlamDoc } from '../src/types.js';

/**
 * WebGL context loss has no Canvas2D equivalent, so v1 never needed handling and
 * v2 inherited none. Without it a lost context blanks the canvas permanently.
 *
 * These tests drive the real `WEBGL_lose_context` extension rather than faking
 * the events, so they exercise the same path the browser takes.
 */

function doc(): GlamDoc {
  return {
    schema: 'glamour/v0.1',
    canvas: { w: 120, h: 80, bg: '#ffffff' },
    nodes: [
      { id: 'orb', type: 'circle', x: 40, y: 40, r: 24, fill: '#1c9ff2' },
      { id: 'label', type: 'text', x: 70, y: 30, text: 'hi', size: 14, fill: '#111111' },
    ],
  };
}

/** Count non-background pixels, via a readable 2D snapshot of the GL canvas. */
function inkPixels(scene: ReturnType<typeof buildScene>): number {
  const canvas = scene.stage.toCanvas();
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context on the snapshot canvas');
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    // Anything that is not near-white counts as drawn content.
    if (data[i] < 240 || data[i + 1] < 240 || data[i + 2] < 240) n++;
  }
  return n;
}

const waitFor = async (pred: () => boolean, ms = 4000): Promise<void> => {
  const started = performance.now();
  while (!pred()) {
    if (performance.now() - started > ms) throw new Error('waitFor timed out');
    await new Promise((r) => setTimeout(r, 25));
  }
};

test('a lost context is reported and does not throw on draw', () => {
  const scene = buildScene(doc());
  try {
    expect(scene.isContextLost).toBe(false);
    const core = (scene as unknown as { __core: { __simulateContextLoss(ms?: number): boolean } }).__core;
    // -1 means "do not auto-restore", so we can observe the lost state itself.
    // Assert support rather than skipping: a silent skip would let this file
    // pass while exercising nothing at all.
    expect(core.__simulateContextLoss(-1), 'WEBGL_lose_context must be available').toBe(true);
    expect(scene.isContextLost).toBe(true);
    // The whole point: drawing while lost must degrade, not explode.
    expect(() => scene.layer.draw()).not.toThrow();
    expect(() => scene.setInput('nope', 1)).not.toThrow();
    expect(() => scene.applyStateSet({ 'orb.r': 10 }, 0, 'linear')).not.toThrow();
  } finally {
    scene.destroy();
  }
});

test('the scene repaints itself after the context is restored', async () => {
  const scene = buildScene(doc());
  try {
    const before = inkPixels(scene);
    expect(before).toBeGreaterThan(0);

    const core = (scene as unknown as { __core: { __simulateContextLoss(ms?: number): boolean } }).__core;
    expect(core.__simulateContextLoss(10), 'WEBGL_lose_context must be available').toBe(true);
    expect(scene.isContextLost).toBe(true);
    await waitFor(() => !scene.isContextLost);

    // Restoration must have rebuilt every GPU resource AND repainted, with no
    // caller involvement — including the text node, whose GPU texture died with
    // the context.
    const after = inkPixels(scene);
    expect(after).toBeGreaterThan(0);
    // Same scene, same props: the repaint must reproduce the same coverage.
    // A loose 10% band absorbs antialiasing noise while still catching a
    // partial repaint (e.g. shapes back but the text texture never re-uploaded).
    expect(Math.abs(after - before) / before).toBeLessThan(0.1);
  } finally {
    scene.destroy();
  }
});

test('a text node re-uploads its texture after a restore', async () => {
  const scene = buildScene({
    schema: 'glamour/v0.1',
    canvas: { w: 140, h: 60, bg: '#ffffff' },
    nodes: [{ id: 'label', type: 'text', x: 10, y: 16, text: 'restore me', size: 20, fill: '#111111' }],
  });
  try {
    const before = inkPixels(scene);
    expect(before).toBeGreaterThan(0);
    const core = (scene as unknown as { __core: { __simulateContextLoss(ms?: number): boolean } }).__core;
    expect(core.__simulateContextLoss(10)).toBe(true);
    await waitFor(() => !scene.isContextLost);
    // Compare COVERAGE, not merely "something is drawn": a restored context often
    // keeps presenting the stale pre-loss frame until the next draw, so `> 0`
    // passes even when nothing was repainted. Text is the resource that needs its
    // CPU raster invalidated on restore, because the renderer's texture cache
    // keys on raster identity.
    const after = inkPixels(scene);
    expect(after).toBeGreaterThan(0);
    expect(Math.abs(after - before) / before).toBeLessThan(0.1);
  } finally {
    scene.destroy();
  }
});

test('destroy() after a loss does not throw', () => {
  const scene = buildScene(doc());
  const core = (scene as unknown as { __core: { __simulateContextLoss(ms?: number): boolean } }).__core;
  core.__simulateContextLoss(-1);
  expect(() => scene.destroy()).not.toThrow();
});
