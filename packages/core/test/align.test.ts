/**
 * `align` / `valign` on a text node.
 *
 * A text node's x/y has always been the PEN ORIGIN — the left edge of the first
 * glyph, on the top of the line. Anyone wanting a label centred in a shape
 * therefore had to subtract half the string's width themselves, and the only
 * cheap way to do that without a font engine is to guess a fixed fraction of
 * the font size. That guess is exact for one advance width and wrong for every
 * other: in bold Arial a "I" (0.278em) lands 0.16em left of where it was asked
 * for and a "W" (0.944em) 0.17em right, which is visible as soon as two
 * different letters share a layout.
 *
 * These assertions are on measured INK, not on the arithmetic, because the
 * arithmetic being right is not the claim — the claim is that the glyph is
 * where the caller asked for it. They run in a real browser for the same reason
 * the image tests do: Canvas2D is the actual text engine here.
 */
import { expect, test } from 'vitest';
import { buildScene } from '../src/scene.js';
import type { GlamDoc, GlamNode } from '../src/types.js';

const W = 400;
const H = 160;

function doc(nodes: GlamNode[]): GlamDoc {
  return { schema: 'glamour/v0.1', canvas: { w: W, h: H, bg: '#ffffff' }, nodes };
}

/** Horizontal ink extent of everything drawn, in canvas units. */
function inkSpan(scene: ReturnType<typeof buildScene>): { min: number; max: number; centre: number } {
  const canvas = scene.stage.toCanvas() as HTMLCanvasElement;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const sx = canvas.width / W;
  let min = Infinity;
  let max = -Infinity;
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const o = (y * canvas.width + x) * 4;
      if (d[o + 3] > 20 && d[o] < 90 && d[o + 1] < 90 && d[o + 2] < 90) {
        if (x < min) min = x;
        if (x > max) max = x;
      }
    }
  }
  if (max < 0) throw new Error('no ink found — the text did not draw');
  return { min: min / sx, max: max / sx, centre: (min + max) / 2 / sx };
}

/** Vertical ink extent, same idea. */
function inkRows(scene: ReturnType<typeof buildScene>): { min: number; max: number; centre: number } {
  const canvas = scene.stage.toCanvas() as HTMLCanvasElement;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const sy = canvas.height / H;
  let min = Infinity;
  let max = -Infinity;
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const o = (y * canvas.width + x) * 4;
      if (d[o + 3] > 20 && d[o] < 90 && d[o + 1] < 90 && d[o + 2] < 90) {
        if (y < min) min = y;
        if (y > max) max = y;
      }
    }
  }
  if (max < 0) throw new Error('no ink found — the text did not draw');
  return { min: min / sy, max: max / sy, centre: (min + max) / 2 / sy };
}

function drawn(nodes: GlamNode[]) {
  const scene = buildScene(doc(nodes));
  scene.layer.draw();
  return scene;
}

const BASE = { type: 'text' as const, y: 30, size: 60, fill: '#000000', fontStyle: 'bold' };

test('omitting align leaves the pen-origin behaviour every existing document relies on', () => {
  const scene = drawn([{ ...BASE, id: 't', x: 100, text: 'H' }]);
  const ink = inkSpan(scene);
  // The pen sits at x, so ink starts at x plus a small left side bearing and
  // never before it.
  expect(ink.min).toBeGreaterThanOrEqual(99);
  expect(ink.min).toBeLessThan(112);
  scene.destroy();
});

test('align:center puts glyphs of very different widths on the same centre', () => {
  // The whole point: "I" and "W" differ by 0.67em of advance, which is what a
  // fixed-fraction guess cannot absorb.
  const narrow = drawn([{ ...BASE, id: 't', x: 200, text: 'I', align: 'center' }]);
  const wide = drawn([{ ...BASE, id: 't', x: 200, text: 'W', align: 'center' }]);
  const a = inkSpan(narrow).centre;
  const b = inkSpan(wide).centre;
  narrow.destroy();
  wide.destroy();

  // Both land on the requested x, and therefore on each other. The tolerance is
  // side-bearing asymmetry, not slop in the placement.
  expect(Math.abs(a - 200)).toBeLessThan(3);
  expect(Math.abs(b - 200)).toBeLessThan(3);
  expect(Math.abs(a - b)).toBeLessThan(3);
});

test('align:right ends the line on x', () => {
  const scene = drawn([{ ...BASE, id: 't', x: 300, text: 'AB', align: 'right' }]);
  const ink = inkSpan(scene);
  expect(ink.max).toBeLessThanOrEqual(301);
  expect(ink.max).toBeGreaterThan(288);
  scene.destroy();
});

test('valign:middle puts the INK on y, not the line box', () => {
  const top = drawn([{ ...BASE, id: 't', x: 60, y: 40, text: 'H' }]);
  const mid = drawn([{ ...BASE, id: 't', x: 60, y: 40, text: 'H', valign: 'middle' }]);
  const a = inkRows(top).centre;
  const b = inkRows(mid).centre;
  top.destroy();
  mid.destroy();

  expect(a).toBeGreaterThan(b); // middle lifts the glyph
  // The ink itself lands on y — this is the assertion a line-box centring
  // would fail, since it leaves a capital about 0.18em (11px here) high.
  expect(Math.abs(b - 40)).toBeLessThan(2);
});

test('valign:middle holds for a descender, where line-box and ink disagree most', () => {
  const scene = drawn([{ ...BASE, id: 't', x: 60, y: 40, text: 'y', valign: 'middle' }]);
  const rows = inkRows(scene);
  scene.destroy();
  expect(Math.abs(rows.centre - 40)).toBeLessThan(2);
});

test('centring survives the animation raster ladder', () => {
  // A node that has rendered at two sizes switches to the coarse ladder, where
  // the bitmap is reused and its metrics scaled. Alignment is applied on top of
  // those scaled metrics, so it has to hold at a size the ladder rounds up.
  const scene = buildScene(doc([{ ...BASE, id: 't', x: 200, text: 'G', align: 'center' }]));
  scene.layer.draw();
  scene.byId.t.fontSize(53); // not a multiple of 16 — forces the scaled path
  scene.layer.draw();
  const ink = inkSpan(scene);
  expect(Math.abs(ink.centre - 200)).toBeLessThan(3);
  scene.destroy();
});

test('a centred label is tappable where it is drawn, not where the pen is', () => {
  const scene = buildScene(doc([{ ...BASE, id: 't', x: 200, text: 'W', align: 'center', valign: 'middle' }]));
  scene.layer.draw();
  // Just left of the requested centre is inside a centred "W" and outside a
  // pen-origin one, which is exactly the regression this guards.
  expect(scene.getIntersection({ x: 190, y: 30 })?._docId).toBe('t');
  scene.destroy();
});

test('a text node renders in the family it asks for', () => {
  // Two families with visibly different metrics: if fontFamily were ignored,
  // both would rasterise identically and the widths would match exactly.
  const a = drawn([{ ...BASE, id: 't', x: 20, text: 'MMM', fontFamily: 'Arial' }]);
  const wa = inkSpan(a).max - inkSpan(a).min;
  a.destroy();
  const b = drawn([{ ...BASE, id: 't', x: 20, text: 'MMM', fontFamily: 'Times New Roman' }]);
  const wb = inkSpan(b).max - inkSpan(b).min;
  b.destroy();
  expect(Math.abs(wa - wb)).toBeGreaterThan(2);
});

test('an unknown family falls back rather than drawing nothing', () => {
  const scene = drawn([{ ...BASE, id: 't', x: 20, text: 'AB', fontFamily: 'NoSuchFamilyHere' }]);
  // The assertion is simply that ink exists — inkSpan throws when it does not.
  const ink = inkSpan(scene);
  expect(ink.max).toBeGreaterThan(ink.min);
  scene.destroy();
});

test('centring still holds when the family is overridden', () => {
  const scene = drawn([
    { ...BASE, id: 't', x: 200, text: 'W', fontFamily: 'Georgia', align: 'center' },
  ]);
  expect(Math.abs(inkSpan(scene).centre - 200)).toBeLessThan(4);
  scene.destroy();
});

test('a document-level fontFamily applies without repeating it on every node', () => {
  const withDoc: GlamDoc = {
    schema: 'glamour/v0.1',
    canvas: { w: W, h: H, bg: '#ffffff' },
    fontFamily: 'Times New Roman',
    nodes: [{ ...BASE, id: 't', x: 20, text: 'MMM' }],
  };
  const a = buildScene(withDoc);
  a.layer.draw();
  const wa = inkSpan(a).max - inkSpan(a).min;
  a.destroy();

  // Same nodes, no document default -> the last-resort family instead.
  const b = drawn([{ ...BASE, id: 't', x: 20, text: 'MMM' }]);
  const wb = inkSpan(b).max - inkSpan(b).min;
  b.destroy();
  expect(Math.abs(wa - wb)).toBeGreaterThan(2);
});

test('a node fontFamily beats the document default', () => {
  const mk = (nodeFamily?: string) => {
    const d: GlamDoc = {
      schema: 'glamour/v0.1',
      canvas: { w: W, h: H, bg: '#ffffff' },
      fontFamily: 'Times New Roman',
      nodes: [{ ...BASE, id: 't', x: 20, text: 'MMM', ...(nodeFamily ? { fontFamily: nodeFamily } : {}) }],
    };
    const s = buildScene(d);
    s.layer.draw();
    const w = inkSpan(s).max - inkSpan(s).min;
    s.destroy();
    return w;
  };
  // Overriding back to the last-resort family must differ from the doc default.
  expect(Math.abs(mk('Arial') - mk())).toBeGreaterThan(2);
});
