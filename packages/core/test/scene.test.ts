import { expect, test } from 'vitest';
import { buildScene } from '../src/scene.js';
import type { GlamDoc } from '../src/types.js';

function doc(): GlamDoc {
  return {
    schema: 'glamour/v0',
    canvas: { w: 640, h: 300, bg: '#12151b' },
    inputs: { progress: 0 },
    nodes: [
      { id: 'orb', type: 'circle', x: 200, y: 150, r: 48, fill: '#4c7dff' },
      { id: 'bar', type: 'rect', x: 300, y: 170, w: 20, h: 10, fill: '#5ad67d' },
    ],
    bind: [{ node: 'bar', prop: 'w', expr: 'lerp(20, 220, progress)' }],
  };
}

test('builds a scene graph from the doc', () => {
  const scene = buildScene(doc());
  expect(scene.byId.orb).toBeDefined();
  expect(scene.byId.bar).toBeDefined();
  expect(scene.byId.orb.radius()).toBe(48);
  scene.destroy();
});

test('setInput recomputes bound props', () => {
  const scene = buildScene(doc());
  scene.setInput('progress', 1);
  expect(scene.byId.bar.width()).toBe(220);
  scene.destroy();
});

test('getIntersection hit-tests the pixel graph', () => {
  const scene = buildScene(doc());
  const hit = scene.getIntersection({ x: 200, y: 150 });
  expect(hit).toBeTruthy();
  expect(hit._docId).toBe('orb');
  const miss = scene.getIntersection({ x: 5, y: 5 });
  expect(miss === null || miss === undefined).toBe(true);
  scene.destroy();
});

test('applyStateSet tweens/sets target props', () => {
  const scene = buildScene(doc());
  scene.applyStateSet({ 'orb.r': 72, 'orb.fill': '#ff9f43' }, 0, 'linear');
  expect(scene.byId.orb.radius()).toBe(72);
  expect(scene.byId.orb.fill()).toBe('#ff9f43');
  scene.destroy();
});

test('initial inputs are applied through bindings at build time', () => {
  const d = doc();
  d.inputs = { progress: 0.5 };
  const scene = buildScene(d);
  expect(scene.byId.bar.width()).toBe(120);
  scene.destroy();
});

test('canvas.bg is actually painted (honored in headless render, not just container CSS)', () => {
  const d = doc();
  d.canvas.bg = '#ff0000';
  const scene = buildScene(d);
  // read a pixel in an empty corner of the real rendered canvas
  const canvas = scene.stage.toCanvas() as { getContext: (t: string) => CanvasRenderingContext2D };
  const px = canvas.getContext('2d').getImageData(5, 5, 1, 1).data;
  expect(px[3]).toBeGreaterThan(200); // opaque background, not transparent
  expect(px[0]).toBeGreaterThan(200); // red channel
  expect(px[1]).toBeLessThan(60);
  expect(px[2]).toBeLessThan(60);
  scene.destroy();
});

test('applyStateSet applies a non-numeric prop (text) instantly, even with transitionMs > 0 (fix #5)', () => {
  const d: GlamDoc = {
    schema: 'glamour/v0',
    canvas: { w: 100, h: 100 },
    nodes: [{ id: 'label', type: 'text', x: 0, y: 0, text: 'Waiting' }],
  };
  const scene = buildScene(d);
  scene.applyStateSet({ 'label.text': 'Done' }, 250, 'linear');
  // Konva.Tween would try to numerically interpolate a string target,
  // producing NaN — text must be set immediately, not tweened.
  expect(scene.byId.label.text()).toBe('Done');
  scene.destroy();
});

test('applyStateSet still tweens numeric props alongside an instant text set in the same call', () => {
  const d: GlamDoc = {
    schema: 'glamour/v0',
    canvas: { w: 100, h: 100 },
    nodes: [
      { id: 'label', type: 'text', x: 0, y: 0, text: 'Waiting' },
      { id: 'orb', type: 'circle', x: 50, y: 50, r: 20 },
    ],
  };
  const scene = buildScene(d);
  scene.applyStateSet({ 'label.text': 'Done', 'orb.r': 40 }, 0, 'linear');
  expect(scene.byId.label.text()).toBe('Done');
  expect(scene.byId.orb.radius()).toBe(40);
  scene.destroy();
});

test('buildScene builds a Konva.Group per doc.groups, nesting matching nodes (v0.1)', () => {
  const d: GlamDoc = {
    schema: 'glamour/v0.1',
    canvas: { w: 200, h: 200 },
    nodes: [{ id: 'eye', type: 'circle', x: 5, y: 5, r: 4, group: 'face' }],
    groups: [{ id: 'face', x: 10, y: 20 }],
  };
  const scene = buildScene(d);
  expect(scene.byId.face).toBeDefined();
  expect(scene.byId.face.x()).toBe(10);
  expect(scene.byId.face.y()).toBe(20);
  // moving the group moves the eye's absolute position
  const before = scene.byId.eye.getAbsolutePosition();
  scene.byId.face.x(50);
  const after = scene.byId.eye.getAbsolutePosition();
  expect(after.x).toBe(before.x + 40);
  // getIntersection at the eye's absolute point still returns the leaf node
  const hit = scene.getIntersection(scene.byId.eye.getAbsolutePosition());
  expect(hit?._docId).toBe('eye');
  scene.destroy();
});

test('buildScene: ungrouped nodes still work as before (v0.1 doc, no group field)', () => {
  const d: GlamDoc = {
    schema: 'glamour/v0.1',
    canvas: { w: 100, h: 100 },
    nodes: [{ id: 'orb', type: 'circle', x: 50, y: 50, r: 10 }],
  };
  const scene = buildScene(d);
  expect(scene.byId.orb.radius()).toBe(10);
  scene.destroy();
});

test('buildScene seeds the resting frame: loop node prop starts at loop.from', () => {
  const d: GlamDoc = {
    schema: 'glamour/v0.1',
    canvas: { w: 300, h: 300 },
    nodes: [{ id: 'crab', type: 'circle', x: 999, y: 0, r: 10 }],
    loops: [{ node: 'crab', prop: 'x', from: 20, to: 280, ms: 1000, mode: 'alternate' }],
  };
  const scene = buildScene(d);
  expect(scene.byId.crab.x()).toBe(20);
  scene.destroy();
});

test('buildScene seeds the resting frame: wander target starts at (cx, cy)', () => {
  const d: GlamDoc = {
    schema: 'glamour/v0.1',
    canvas: { w: 300, h: 300 },
    nodes: [{ id: 'eye', type: 'circle', x: 999, y: 999, r: 4, group: 'face' }],
    groups: [{ id: 'face', x: 10, y: 20 }],
    wander: [{ target: 'face', cx: 150, cy: 150, rx: 40, ry: 20, stepMs: 800 }],
  };
  const scene = buildScene(d);
  expect(scene.byId.face.x()).toBe(150);
  expect(scene.byId.face.y()).toBe(150);
  scene.destroy();
});

test('buildScene seeds a wander target that is a plain node (not a group)', () => {
  const d: GlamDoc = {
    schema: 'glamour/v0.1',
    canvas: { w: 300, h: 300 },
    nodes: [{ id: 'orb', type: 'circle', x: 999, y: 999, r: 10 }],
    wander: [{ target: 'orb', cx: 60, cy: 70, rx: 10, ry: 10, stepMs: 800 }],
  };
  const scene = buildScene(d);
  expect(scene.byId.orb.x()).toBe(60);
  expect(scene.byId.orb.y()).toBe(70);
  scene.destroy();
});

// --- single-pointer discipline (StageShim) ----------------------------------
// These drive REAL DOM PointerEvents on the canvas, deliberately: the player's
// `__pointer` test hook bypasses StageShim entirely, so tests written against
// it cannot see this layer at all. A previous version of the pointer guard had
// no coverage for exactly that reason.
function pointerScene() {
  const mount = document.createElement('div');
  document.body.appendChild(mount);
  const scene = buildScene(
    { schema: 'glamour/v0.1', canvas: { w: 100, h: 100 }, nodes: [] } as GlamDoc,
    mount,
  );
  const seen: Array<string> = [];
  for (const ev of ['pointerdown', 'pointermove', 'pointerup']) {
    scene.stage.on(ev, () => seen.push(ev));
  }
  const canvas = mount.querySelector('canvas')!;
  const fire = (type: string, pointerId: number, clientX = 10, clientY = 10) =>
    canvas.dispatchEvent(new PointerEvent(type, { pointerId, bubbles: true, clientX, clientY }));
  return { scene, mount, canvas, seen, fire };
}

test('a drag follows one pointer: a second finger is ignored while the first DRAWS', () => {
  const { scene, mount, seen, fire } = pointerScene();
  fire('pointerdown', 1, 10, 10);
  fire('pointermove', 1, 40, 40);  // finger 1 is really drawing
  fire('pointerdown', 2, 90, 90);  // second finger lands
  fire('pointermove', 2, 95, 95);
  fire('pointerup', 2, 95, 95);    // and lifts — must not end finger 1's stroke
  fire('pointermove', 1, 60, 60);
  fire('pointerup', 1, 60, 60);
  expect(seen).toEqual(['pointerdown', 'pointermove', 'pointermove', 'pointerup']);
  scene.destroy();
  mount.remove();
});

test('a palm that lands FIRST does not own the drag — the pointer that draws does', () => {
  // The palm-first case. Ownership is provisional until the owner moves, so a
  // resting pointer is displaced by one that actually traces. Without this the
  // palm owns the canvas, every event from the drawing finger is dropped with
  // no ink and no message, and the palm's own jitter gets scored as the stroke.
  const { scene, mount, seen, fire } = pointerScene();
  fire('pointerdown', 6, 80, 80);   // palm
  fire('pointermove', 6, 81, 80);   // ...wobbling, but not drawing
  fire('pointerdown', 7, 10, 10);   // index finger arrives and takes over
  fire('pointermove', 7, 40, 40);
  fire('pointermove', 7, 70, 70);
  fire('pointerup', 7, 70, 70);
  // The finger's whole stroke is delivered; the palm contributed one move.
  expect(seen).toEqual(['pointerdown', 'pointermove', 'pointerdown', 'pointermove', 'pointermove', 'pointerup']);
  scene.destroy();
  mount.remove();
});

test('a palm that lands SECOND, before the finger moves, does not steal the drag', () => {
  // The mirror of the palm-first case, and the one an earlier "last down wins
  // until someone moves" rule broke outright: the finger is already down but
  // has not started, the palm settles, and the finger's entire trace was then
  // dropped. Ownership follows whichever pointer actually draws.
  const { scene, mount, seen, fire } = pointerScene();
  fire('pointerdown', 7, 10, 10);   // index finger, not moving yet
  fire('pointerdown', 6, 80, 80);   // palm settles
  fire('pointermove', 7, 40, 40);   // the finger starts tracing
  fire('pointermove', 7, 70, 70);
  fire('pointerup', 7, 70, 70);
  // Two downs reach the host (the provisional palm, then the finger re-claiming),
  // but the finger's moves and its up are all delivered.
  expect(seen.filter((e) => e !== 'pointerdown')).toEqual(['pointermove', 'pointermove', 'pointerup']);
  expect(seen[seen.length - 1]).toBe('pointerup');
  scene.destroy();
  mount.remove();
});

test('a lifted pointer is forgotten, so a hovering one cannot steal the drag', () => {
  // `downAt` used to be cleaned only for the owner, because the delete sat after
  // the not-the-owner reject. So a pen or mouse that had been down earlier as a
  // non-owner kept its entry forever, and a later HOVER move — no button, no
  // contact — satisfied the movement-steal and took the drag from a finger that
  // was actually drawing, restarting the host's stroke at a stale origin.
  const { scene, mount, seen, fire } = pointerScene();
  fire('pointerdown', 2, 80, 80);   // a pen touches down as a non-owner...
  fire('pointerdown', 1, 10, 10);
  fire('pointermove', 1, 40, 40);   // ...finger 1 takes the drag by drawing
  fire('pointerup', 2, 80, 80);     // ...and the pen lifts
  fire('pointerup', 1, 40, 40);     // ...then the finger finishes its stroke
  seen.length = 0;
  fire('pointerdown', 3, 12, 12);   // a fresh gesture by another finger
  fire('pointermove', 2, 200, 200); // the lifted pen merely HOVERS across
  fire('pointermove', 3, 30, 30);
  fire('pointerup', 3, 30, 30);
  // Only finger 3's own events; the hover contributed nothing.
  expect(seen).toEqual(['pointerdown', 'pointermove', 'pointerup']);
  scene.destroy();
  mount.remove();
});

test('a tap lands even while another pointer is resting on the canvas', () => {
  // A palm resting and the child TAPPING a dot with a finger. The steal rule
  // cannot help here — a tap never moves — so this is carried by the down path
  // treating a motionless owner as replaceable. Without it, `i` and `j` become
  // untappable whenever a hand is resting on the card.
  const { scene, mount, seen, fire } = pointerScene();
  fire('pointerdown', 6, 80, 80);  // palm rests
  seen.length = 0;
  fire('pointerdown', 7, 20, 20);  // finger taps the dot
  fire('pointerup', 7, 20, 20);
  expect(seen).toEqual(['pointerdown', 'pointerup']);
  scene.destroy();
  mount.remove();
});

test('a tap still works — a motionless owner is provisional, not ignored', () => {
  // Provisional ownership must not break tap-to-draw-a-dot, which never moves.
  const { scene, mount, seen, fire } = pointerScene();
  fire('pointerdown', 1, 50, 50);
  fire('pointerup', 1, 50, 50);
  expect(seen).toEqual(['pointerdown', 'pointerup']);
  scene.destroy();
  mount.remove();
});

test('the owner lifting frees the canvas for the next pointer', () => {
  const { scene, mount, seen, fire } = pointerScene();
  fire('pointerdown', 1);
  fire('pointerup', 1);
  fire('pointerdown', 2);
  fire('pointerup', 2);
  expect(seen).toEqual(['pointerdown', 'pointerup', 'pointerdown', 'pointerup']);
  scene.destroy();
  mount.remove();
});

test('the canvas asks to capture the owning pointer', () => {
  // Scope, stated plainly: this pins that we CALL setPointerCapture. It does
  // not — cannot — prove the browser then delivers pointerup off-element,
  // because Chromium silently refuses capture for synthetic PointerEvents, so
  // no test at this layer can observe real capture. That half was verified with
  // trusted mouse input in a browser (press inside, release far outside:
  // gotpointercapture -> pointerup -> lostpointercapture, canvas stayed live).
  //
  // Without this test, deleting the capture call leaves the suite fully green —
  // measured — while reintroducing a permanently dead canvas for mouse users.
  const mount = document.createElement('div');
  document.body.appendChild(mount);
  const scene = buildScene(
    { schema: 'glamour/v0.1', canvas: { w: 100, h: 100 }, nodes: [] } as GlamDoc,
    mount,
  );
  const canvas = mount.querySelector('canvas')!;
  const captured: number[] = [];
  canvas.setPointerCapture = (id: number) => { captured.push(id); };
  canvas.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 42, bubbles: true, clientX: 5, clientY: 5 }));
  expect(captured).toEqual([42]);
  scene.destroy();
  mount.remove();
});

test('losing the pointer frees the canvas — a press released off-canvas must not kill it', () => {
  // The regression this exists for: a mouse gets NO implicit pointer capture,
  // so pressing inside the canvas and releasing outside delivers no pointerup
  // at all. Without a release path the owner id is stranded and every later
  // pointer is discarded — the canvas is dead until reload. Capture makes the
  // up arrive; `lostpointercapture` is the backstop when it does not.
  const { scene, mount, canvas, seen, fire } = pointerScene();
  fire('pointerdown', 1);
  seen.length = 0;
  canvas.dispatchEvent(new PointerEvent('lostpointercapture', { pointerId: 1, bubbles: true }));
  fire('pointerdown', 2); // a completely new interaction must work
  fire('pointermove', 2);
  fire('pointerup', 2);
  expect(seen).toEqual(['pointerdown', 'pointermove', 'pointerup']);
  scene.destroy();
  mount.remove();
});

test('pointercancel releases the owner', () => {
  const { scene, mount, canvas, seen, fire } = pointerScene();
  fire('pointerdown', 1);
  canvas.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1, bubbles: true }));
  seen.length = 0;
  fire('pointerdown', 2);
  fire('pointerup', 2);
  expect(seen).toEqual(['pointerdown', 'pointerup']);
  scene.destroy();
  mount.remove();
});
