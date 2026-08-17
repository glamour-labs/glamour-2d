/**
 * Images for the WebGL2 backend.
 *
 * Every other paint in this renderer is available the instant it is asked for:
 * a colour is a number, a gradient is numbers, and text is rasterised
 * synchronously through Canvas2D. An image is the first thing in the format
 * that ARRIVES LATER — it comes over the network, it can fail, and the frame
 * that first asks for it cannot have it.
 *
 * So the contract here is deliberately small and non-blocking:
 *
 *   - asking for an image never throws and never waits; it returns the current
 *     state and starts the load if this is the first ask;
 *   - a node whose image is not ready simply draws nothing that frame, rather
 *     than drawing a placeholder the document did not ask for;
 *   - when the bytes land, the loader calls back so the scene can mark itself
 *     dirty and repaint. Without that a static scene would load its images and
 *     never show them, because nothing else would ever request a frame.
 *
 * The cache is keyed by `src` and shared across nodes on purpose: twelve
 * bubbles showing one placeholder is one decode and one GPU upload, not twelve.
 */

export type ImageState = 'loading' | 'ready' | 'failed';

export interface ImageRecord {
  state: ImageState;
  /** Ready only when `state === 'ready'`; feed straight to texImage2D. */
  source: HTMLImageElement | null;
  /** Natural pixel size, needed to compute cover/contain boxes. */
  w: number;
  h: number;
}

const cache = new Map<string, ImageRecord>();
const waiting = new Map<string, Set<() => void>>();

/** Test seam: drop everything so a suite starts from a known state. */
export function clearImageCache(): void {
  cache.clear();
  waiting.clear();
}

/** Current state without starting a load — for assertions and diagnostics. */
export function peekImage(src: string): ImageRecord | undefined {
  return cache.get(src);
}

/**
 * Get an image, starting the load on first ask.
 *
 * `onSettle` fires once per caller when the state leaves `loading` — including
 * on failure, so a caller that wants to fall back is told rather than left
 * waiting. Registering the same callback repeatedly is harmless; it is held in
 * a Set and dropped once the record settles.
 */
export function getImage(src: string, onSettle?: () => void): ImageRecord {
  const hit = cache.get(src);
  if (hit) {
    if (hit.state === 'loading' && onSettle) {
      const set = waiting.get(src) ?? new Set();
      set.add(onSettle);
      waiting.set(src, set);
    }
    return hit;
  }

  const rec: ImageRecord = { state: 'loading', source: null, w: 0, h: 0 };
  cache.set(src, rec);
  if (onSettle) waiting.set(src, new Set([onSettle]));

  // No DOM (a Node-side validate or a unit test): stay 'loading' forever rather
  // than inventing a failure, since nothing can render here anyway.
  if (typeof Image === 'undefined') return rec;

  const settle = () => {
    const cbs = waiting.get(src);
    waiting.delete(src);
    if (cbs) for (const cb of cbs) cb();
  };

  const img = new Image();
  // Textures come from a CDN in practice; without this the upload taints the
  // context and the draw fails in a way that is very hard to read back from.
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    rec.state = 'ready';
    rec.source = img;
    rec.w = img.naturalWidth || img.width;
    rec.h = img.naturalHeight || img.height;
    settle();
  };
  img.onerror = () => {
    rec.state = 'failed';
    settle();
  };
  img.src = src;
  return rec;
}

export type ImageFit = 'cover' | 'contain' | 'fill';

export interface FitBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Where to map the texture so it fills `box` under the requested fit.
 *
 * The shader samples UVs across this box and discards outside it, and the
 * node's own geometry is already the stencil — so fit needs no shader support
 * at all. `cover` returns a box LARGER than the node, and the stencil crops the
 * overflow; `contain` returns a smaller one, and the remainder stays
 * transparent. That is the whole mechanism.
 */
export function fitBox(box: FitBox, imgW: number, imgH: number, fit: ImageFit = 'cover'): FitBox {
  if (fit === 'fill' || imgW <= 0 || imgH <= 0) return box;
  const scale =
    fit === 'cover'
      ? Math.max(box.w / imgW, box.h / imgH)
      : Math.min(box.w / imgW, box.h / imgH);
  const w = imgW * scale;
  const h = imgH * scale;
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h };
}
