/**
 * `image` node — the first paint in the format that arrives asynchronously.
 *
 * These run in a real browser because the node's whole point is a decoded
 * bitmap uploaded as a GL texture: a jsdom stub would assert the arithmetic and
 * miss whether anything was actually drawn, which is the only interesting part.
 *
 * The fixture is a 2x1 PNG — left half red, right half blue — so a pixel probe
 * can tell not just THAT the image drew but which way round and where, which is
 * what catches a flipped or mis-mapped UV box.
 */
import { expect, test, beforeEach } from 'vitest';
import { buildScene } from '../src/scene.js';
import { clearImageCache, fitBox, peekImage } from '../src/gl/image.js';
import type { GlamDoc } from '../src/types.js';

/** 2x1 PNG: left pixel #ff0000, right pixel #0000ff. */
const RED_BLUE_2x1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAIAAAB7QOjdAAAADUlEQVR4nGP4zwAE/wEHAAH/4iOeWQAAAABJRU5ErkJggg==';

function pixelAt(scene: ReturnType<typeof buildScene>, x: number, y: number): Uint8ClampedArray {
  const canvas = scene.stage.toCanvas() as { getContext: (t: string) => CanvasRenderingContext2D };
  return canvas.getContext('2d').getImageData(x, y, 1, 1).data;
}

/** Wait until the node's source has settled, or give up loudly. */
async function settled(src: string, tries = 60): Promise<void> {
  for (let i = 0; i < tries; i++) {
    const rec = peekImage(src);
    if (rec && rec.state !== 'loading') return;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error(`image never settled: ${src.slice(0, 40)}`);
}

beforeEach(() => clearImageCache());

test('an image node draws its picture, cropped to its own shape', async () => {
  const doc: GlamDoc = {
    schema: 'glamour/v0.1',
    canvas: { w: 120, h: 120, bg: '#ffffff' },
    nodes: [{ id: 'pic', type: 'image', x: 60, y: 60, r: 40, src: RED_BLUE_2x1, fit: 'fill' }],
  };
  const scene = buildScene(doc);
  expect(scene.byId.pic.getClassName()).toBe('Image');

  // The first draw is what ASKS for the picture — nothing loads until a frame
  // needs it. Then the loader's callback marks the scene dirty and the second
  // draw actually paints it.
  scene.layer.draw();
  await settled(RED_BLUE_2x1);
  scene.layer.draw();

  // Inside the circle: red on the left half, blue on the right.
  const left = pixelAt(scene, 40, 60);
  const right = pixelAt(scene, 80, 60);
  expect(left[0]).toBeGreaterThan(180);
  expect(left[2]).toBeLessThan(80);
  expect(right[2]).toBeGreaterThan(180);
  expect(right[0]).toBeLessThan(80);

  // Outside the circle the background survives — the node's geometry IS the
  // crop, so a corner must be untouched even though the texture box is square.
  const corner = pixelAt(scene, 6, 6);
  expect(corner[0]).toBeGreaterThan(240);
  expect(corner[1]).toBeGreaterThan(240);
  expect(corner[2]).toBeGreaterThan(240);
  scene.destroy();
});

test('a node whose source has not arrived draws nothing, and never throws', () => {
  const doc: GlamDoc = {
    schema: 'glamour/v0.1',
    canvas: { w: 60, h: 60, bg: '#ffffff' },
    nodes: [{ id: 'pic', type: 'image', x: 30, y: 30, r: 20, src: 'https://example.invalid/x.png' }],
  };
  const scene = buildScene(doc);
  expect(() => scene.layer.draw()).not.toThrow();
  const mid = pixelAt(scene, 30, 30);
  expect(mid[0]).toBeGreaterThan(240);
  scene.destroy();
});

test('src is settable at runtime, so one document can show many pictures', async () => {
  const doc: GlamDoc = {
    schema: 'glamour/v0.1',
    canvas: { w: 120, h: 120, bg: '#ffffff' },
    nodes: [{ id: 'pic', type: 'image', x: 60, y: 60, r: 40, fit: 'fill' }],
  };
  const scene = buildScene(doc);
  const node = scene.byId.pic as unknown as { src: (v?: string) => unknown };
  expect(typeof node.src).toBe('function');

  node.src(RED_BLUE_2x1);
  scene.layer.draw();
  await settled(RED_BLUE_2x1);
  scene.layer.draw();
  expect(pixelAt(scene, 40, 60)[0]).toBeGreaterThan(180);
  scene.destroy();
});

test('fit maps the texture box without touching the shader', () => {
  const box = { x: 0, y: 0, w: 100, h: 100 };
  // A 2:1 picture in a square hole.
  const cover = fitBox(box, 200, 100, 'cover');
  expect(cover.h).toBe(100);
  expect(cover.w).toBe(200); // overflows, and the stencil crops it
  expect(cover.x).toBe(-50); // centred

  const contain = fitBox(box, 200, 100, 'contain');
  expect(contain.w).toBe(100);
  expect(contain.h).toBe(50); // whole picture, bands above and below
  expect(contain.y).toBe(25);

  expect(fitBox(box, 200, 100, 'fill')).toEqual(box);
});

test('an arc can taper: round caps extend the band past its own sweep', () => {
  const make = (cap: 'butt' | 'round'): GlamDoc => ({
    schema: 'glamour/v0.1',
    canvas: { w: 200, h: 200, bg: '#ffffff' },
    nodes: [
      {
        id: 'band', type: 'arc', x: 100, y: 100,
        innerRadius: 50, outerRadius: 70, angle: 40, rotation: 0,
        fill: '#000000', ...(cap === 'round' ? { cap } : {}),
      },
    ],
  });

  // Just BEFORE the band's start angle: empty with a square end, covered by the
  // cap's disc with a round one. That difference is the whole feature.
  const probeX = 100 + Math.cos(-0.12) * 60;
  const probeY = 100 + Math.sin(-0.12) * 60;

  const butt = buildScene(make('butt'));
  butt.layer.draw();
  const buttPx = pixelAt(butt, Math.round(probeX), Math.round(probeY));
  butt.destroy();

  const round = buildScene(make('round'));
  round.layer.draw();
  const roundPx = pixelAt(round, Math.round(probeX), Math.round(probeY));
  round.destroy();

  expect(buttPx[0]).toBeGreaterThan(200); // background
  expect(roundPx[0]).toBeLessThan(80); // inked by the cap
});

test('arc defaults to butt, so existing documents are untouched', () => {
  const doc: GlamDoc = {
    schema: 'glamour/v0.1',
    canvas: { w: 100, h: 100 },
    nodes: [{ id: 'a', type: 'arc', x: 50, y: 50, innerRadius: 10, outerRadius: 20, angle: 90 }],
  };
  const scene = buildScene(doc);
  expect((scene.byId.a as unknown as { cap: () => string }).cap()).toBe('butt');
  scene.destroy();
});

test('a text node with a STATIC size rasterizes exactly — existing docs untouched', () => {
  const doc: GlamDoc = {
    schema: 'glamour/v0.1',
    canvas: { w: 200, h: 100, bg: '#ffffff' },
    nodes: [{ id: 't', type: 'text', x: 20, y: 40, text: 'Ag', size: 37, fill: '#000' }],
  };
  const scene = buildScene(doc);
  const node = scene.byId.t as unknown as { textRaster: (d: number) => { h: number } | null };
  const first = node.textRaster(1);
  // 37 is not on the 16px ladder; an exact raster proves the ladder is not
  // applied until a node is seen animating.
  const second = node.textRaster(1);
  expect(first).not.toBeNull();
  expect(second!.h).toBe(first!.h);
  scene.destroy();
});

test('an ANIMATING text node reuses one bitmap across a size sweep', () => {
  const doc: GlamDoc = {
    schema: 'glamour/v0.1',
    canvas: { w: 400, h: 200, bg: '#ffffff' },
    nodes: [{ id: 't', type: 'text', x: 20, y: 40, text: 'C', size: 20, fill: '#000' }],
  };
  const scene = buildScene(doc);
  const k = scene.byId.t as unknown as {
    fontSize: (v?: number) => unknown;
    textRaster: (d: number) => { source: unknown; h: number } | null;
  };
  k.textRaster(1); // first size: exact
  k.fontSize(21);
  const a = k.textRaster(1); // second size: now laddered
  const sourceA = a!.source;

  // Sweep across sizes that all round up to the same ladder step.
  for (const s of [22, 25, 28, 31]) {
    k.fontSize(s);
    const r = k.textRaster(1);
    expect(r!.source).toBe(sourceA); // same bitmap, no re-rasterize
    expect(r!.h).toBeCloseTo((a!.h / 21) * s, 5); // metrics scaled to the ask
  }
  scene.destroy();
});

test('a still document paints the picture on its own, with no second draw', async () => {
  const doc: GlamDoc = {
    schema: 'glamour/v0.1',
    canvas: { w: 120, h: 120, bg: '#ffffff' },
    nodes: [{ id: 'pic', type: 'image', x: 60, y: 60, r: 40, src: RED_BLUE_2x1, fit: 'fill' }],
  };
  const scene = buildScene(doc);

  // The ONLY draw this test ever asks for. No tween keeps a loop alive here, so
  // if the loader's dirty mark does not schedule its own frame the picture is
  // never painted — which is exactly the bug this guards.
  scene.layer.draw();
  await settled(RED_BLUE_2x1);
  for (let i = 0; i < 5; i++) await new Promise((r) => requestAnimationFrame(() => r(null)));

  const left = pixelAt(scene, 40, 60);
  expect(left[0]).toBeGreaterThan(180);
  expect(left[2]).toBeLessThan(80);
});
