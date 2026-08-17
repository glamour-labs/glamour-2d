import { evalExpr } from './expr.js';
import type { GlamDoc, GlamNode } from './types.js';
import { GlRenderer, parseColor, type Paint, type Rgba, type ShadowPaint } from './gl/renderer.js';
import { Mesh, dashify, tensionize, arcLengths, segsFor } from './gl/mesh.js';
import { measureText, rasterizeText, textKey, type TextRaster } from './gl/text.js';
import { getImage, fitBox, type ImageFit } from './gl/image.js';

/**
 * v2: the scene is backed by WebGL2 (gl/renderer.ts) instead of Konva.
 *
 * The node handles below deliberately keep Konva's chainable accessor shape
 * (`k.radius()` / `k.radius(48)` / `k.points([...])`), because `player.ts`,
 * `loop.ts`, `harness.ts` and every `.glam` prop mapping already speak it. That
 * makes this a rasterizer swap rather than a rewrite of the whole runtime — the
 * format, the state machine, bindings, ink and guided strokes are untouched.
 *
 * `stage` and `layer` survive as thin shims for the same reason: `player.ts`
 * calls `stage.on(...)`, `stage.getPointerPosition()` and `layer.draw()`.
 */

export type GlamNodeHandle = NodeHandle;

export interface SceneHandle {
  stage: StageShim;
  layer: LayerShim;
  byId: Record<string, NodeHandle>;
  setInput(name: string, value: number | string): void;
  applyStateSet(set: Record<string, number | string>, transitionMs: number, ease: string): void;
  getIntersection(pt: { x: number; y: number }): NodeHandle | null;
  destroy(): void;
  /** True while the WebGL context is unavailable (lost, awaiting restore). */
  readonly isContextLost: boolean;
}

/**
 * Maps a doc-facing prop name to the node accessor method name. The method
 * names are inherited from Konva on purpose — see the note at the top of the
 * file. Single-sourced here; `loop.ts` imports it rather than re-declaring.
 */
export const PROP_TO_METHOD: Record<string, string> = {
  x: 'x',
  y: 'y',
  r: 'radius',
  w: 'width',
  h: 'height',
  rx: 'radiusX',
  ry: 'radiusY',
  innerRadius: 'innerRadius',
  outerRadius: 'outerRadius',
  angle: 'angle',
  cornerRadius: 'cornerRadius',
  text: 'text',
  size: 'fontSize',
  fontStyle: 'fontStyle',
  align: 'align',
  valign: 'valign',
  fill: 'fill',
  stroke: 'stroke',
  strokeWidth: 'strokeWidth',
  opacity: 'opacity',
  rotation: 'rotation',
  shadowBlur: 'shadowBlur',
  shadowOpacity: 'shadowOpacity',
  cap: 'cap',
  // `image` nodes. Settable at runtime on purpose: one document with twelve
  // image nodes can show twelve different pictures, which is what a host
  // binding backend content to a scene actually needs.
  src: 'src',
  fit: 'fit',
};

/** Kept as an alias so v1 imports keep resolving during the port. */
export const PROP_TO_KONVA_METHOD = PROP_TO_METHOD;

export function methodFor(prop: string): string {
  const method = PROP_TO_METHOD[prop];
  if (!method) throw new Error(`unknown prop "${prop}"`);
  return method;
}

/** Alias for v1 call sites. */
export const konvaMethodFor = methodFor;

/**
 * Props that map to a radius/arc dimension, which must never go negative. The
 * overshoot easings (`backInOut`, `elasticOut`) intentionally leave [0,1], so a
 * tween toward 0 can undershoot — clamping at the apply boundary preserves the
 * spring look while keeping the geometry valid.
 */
export const NON_NEGATIVE_PROPS = new Set([
  'r', 'rx', 'ry', 'innerRadius', 'outerRadius', 'cornerRadius',
]);

export function clampPropValue(prop: string, value: number): number {
  return NON_NEGATIVE_PROPS.has(prop) ? Math.max(0, value) : value;
}

const NON_NEGATIVE_METHODS = new Set(
  [...NON_NEGATIVE_PROPS].map((p) => PROP_TO_METHOD[p] as string),
);

/** Strings no numeric interpolation can handle — always applied instantly. */
function isInstantOnlyProp(prop: string): boolean {
  return prop === 'text' || prop === 'fontStyle' || prop === 'align' || prop === 'valign';
}

type PropValue = number | string | number[] | boolean | undefined;

const ACCESSORS = [
  'x', 'y', 'radius', 'width', 'height', 'radiusX', 'radiusY',
  'innerRadius', 'outerRadius', 'angle', 'cornerRadius',
  'text', 'fontSize', 'fontStyle', 'fill', 'stroke', 'strokeWidth',
  'opacity', 'rotation', 'shadowBlur', 'shadowOpacity',
  'shadowOffsetX', 'shadowOffsetY', 'shadowColor', 'listening',
] as const;

/**
 * Polyline-only accessors, attached ONLY to `stroke` nodes — matching Konva,
 * where `points` existed on Line and nowhere else. The harness feature-detects
 * with `typeof k.points === 'function'` before spreading the result, so exposing
 * a `points()` that returns undefined on a circle throws on the spread.
 */
const STROKE_ACCESSORS = ['points', 'dash', 'tension', 'closed'] as const;

/** Image-only accessors, attached ONLY to `image` nodes — same rule as above. */
const IMAGE_ACCESSORS = ['src', 'fit'] as const;

/** Arc-only accessor. */
const ARC_ACCESSORS = ['cap'] as const;

/** Text-only accessors, so a host can re-align a label at runtime. */
const TEXT_ACCESSORS = ['align', 'valign'] as const;

/** Konva class names, kept so type-assertion tests stay meaningful. */
const CLASS_NAMES: Record<string, string> = {
  circle: 'Circle',
  ellipse: 'Ellipse',
  arc: 'Arc',
  rect: 'Rect',
  text: 'Text',
  stroke: 'Line',
  image: 'Image',
  group: 'Group',
};

/**
 * One drawable (or a group). Props live in a flat bag; the accessor methods are
 * generated over it so the shape matches what the rest of the runtime calls.
 */
export class NodeHandle {
  _docId = '';
  readonly kind: GlamNode['type'] | 'group';
  readonly props: Record<string, PropValue> = {};
  parent: NodeHandle | null = null;
  children: NodeHandle[] = [];
  gradient: GlamNode['fillGradient'];
  private scene: SceneCore | null = null;
  private raster: { key: string; value: TextRaster | null } | null = null;
  /**
   * Set once a node is seen rendering at a SECOND font size — i.e. its size is
   * animating. See `textRaster`.
   */
  private sizeAnimates = false;
  private lastRasterSize = -1;
  private listeners = new Map<string, Array<(e?: unknown) => void>>();

  constructor(kind: GlamNode['type'] | 'group', scene: SceneCore | null) {
    this.kind = kind;
    this.scene = scene;
    const names: string[] = [...ACCESSORS];
    if (kind === 'stroke') names.push(...STROKE_ACCESSORS);
    if (kind === 'image') names.push(...IMAGE_ACCESSORS);
    if (kind === 'arc') names.push(...ARC_ACCESSORS);
    if (kind === 'text') names.push(...TEXT_ACCESSORS);
    for (const name of names) {
      // Konva semantics: no-arg reads, one-arg writes and returns `this`.
      (this as unknown as Record<string, unknown>)[name] = (v?: PropValue): unknown => {
        if (v === undefined) return this.props[name];
        this.props[name] = v;
        // NOT fontSize: `textRaster` compares a key that already includes the
        // size, so dropping the raster here is redundant — and it defeats the
        // ladder, because an animating node would throw away the very bitmap
        // the ladder exists to reuse.
        if (name === 'text' || name === 'fontStyle' || name === 'fill') {
          this.raster = null;
        }
        this.scene?.markDirty();
        return this;
      };
    }
  }

  /**
   * Konva-style per-node event subscription. The wired set is `click`,
   * `mouseenter`, `mouseleave` — the same three the player maps to doc-facing
   * `click`/`hover`/`leave`. Dispatch is driven by SceneCore's pointer stream.
   */
  on(events: string, handler: (e?: unknown) => void): void {
    for (const ev of events.split(/\s+/).filter(Boolean)) {
      const list = this.listeners.get(ev) ?? [];
      list.push(handler);
      this.listeners.set(ev, list);
    }
  }

  /** Fire one event. Each listener is isolated so a thrower can't stop the rest. */
  fire(ev: string): void {
    for (const handler of this.listeners.get(ev) ?? []) {
      try {
        handler({ type: ev, target: this });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`glam scene: "${ev}" listener threw`, err);
      }
    }
  }

  /** Konva-compatible type name (`Circle`, `Ellipse`, `Arc`, `Rect`, `Text`, `Line`). */
  getClassName(): string {
    return CLASS_NAMES[this.kind] ?? 'Shape';
  }

  /**
   * Which paint wins. v1 had to flip Konva's `fillPriority` explicitly for a
   * gradient to show at all; v2 derives it, but the accessor stays so the
   * paint-layer tests keep asserting the same contract.
   */
  fillPriority(): string {
    if (!this.gradient) return 'color';
    return this.gradient.type === 'linear' ? 'linear-gradient' : 'radial-gradient';
  }

  /** v2 always draws round caps/joins, exactly as v1 configured Konva.Line. */
  lineCap(): string {
    return 'round';
  }

  lineJoin(): string {
    return 'round';
  }

  /** Absolute position including any group offset — matches Konva. */
  getAbsolutePosition(): { x: number; y: number } {
    let x = num(this.props.x);
    let y = num(this.props.y);
    let p = this.parent;
    while (p) {
      x += num(p.props.x);
      y += num(p.props.y);
      p = p.parent;
    }
    return { x, y };
  }

  /**
   * Drop the cached text raster. Called after a WebGL context restore: the GPU
   * texture is gone, and the renderer's cache keys off this raster's identity,
   * so a fresh object is what makes it re-upload.
   */
  invalidateRaster(): void {
    this.raster = null;
  }

  /**
   * Cached text raster, re-rasterized only when a text-affecting prop changed.
   *
   * A node whose `size` ANIMATES is a different problem from one that simply
   * has a size. The cache keys on the spec, size included, so a label growing
   * with the shape it sits in misses on every single frame and re-rasterizes —
   * measured at roughly 0.75ms per label per frame, which with a handful of
   * them on screen is most of a frame budget. The original note here assumed
   * "`size` changes are rare"; animated text breaks that assumption completely.
   *
   * The fix is to rasterize on a coarse LADDER and scale the quad by the
   * remainder, so a sweep from 5px to 190px reuses a handful of bitmaps instead
   * of minting one per frame. Because that trades a little crispness, a node
   * opts in by BEHAVING like an animation: the first size a node renders at is
   * rasterized exactly, and only when a second, different size arrives does it
   * move to the ladder. Static documents are therefore byte-identical, and only
   * the nodes that actually animate pay the (invisible) resampling cost.
   */
  textRaster(dpr: number): TextRaster | null {
    if (this.kind !== 'text') return null;
    const wanted = num(this.props.fontSize, 16);
    if (this.lastRasterSize >= 0 && this.lastRasterSize !== wanted) this.sizeAnimates = true;
    this.lastRasterSize = wanted;

    // Round UP to the ladder: downscaling a crisp bitmap reads clean, upscaling
    // does not.
    const step = 16;
    const rasterSize = this.sizeAnimates ? Math.max(step, Math.ceil(wanted / step) * step) : wanted;

    const spec = {
      text: String(this.props.text ?? ''),
      size: rasterSize,
      fontFamily: DEFAULT_FONT_FAMILY,
      fontStyle: normalizeFontStyle(this.props.fontStyle),
      fill: String(this.props.fill ?? '#000000'),
      dpr,
    };
    const key = textKey(spec);
    if (!this.raster || this.raster.key !== key) {
      this.raster = { key, value: rasterizeText(spec) };
    }
    const base = this.raster.value;
    if (!base) return null;

    // Same bitmap, metrics scaled to the size actually asked for. Callers use
    // w/h/padX/padY to place the quad, so scaling those places it correctly
    // without touching the geometry or paint code.
    const k = rasterSize === wanted ? 1 : wanted / rasterSize;
    const w = base.w * k;
    const h = base.h * k;
    const padX = base.padX * k;
    const padY = base.padY * k;
    const inkTop = base.inkTop * k;
    const inkBottom = base.inkBottom * k;

    // Alignment rides on the padding for the same reason: geometry, paint and
    // hit-testing all derive the quad from padX/padY, so shifting those is the
    // one place that moves every one of them consistently.
    const a = this.alignShift({ advW: w - padX * 2, lineH: h - padY * 2, inkTop, inkBottom });
    if (k === 1 && a.dx === 0 && a.dy === 0) return base;
    return { source: base.source, w, h, padX: padX + a.dx, padY: padY + a.dy, inkTop, inkBottom };
  }

  /**
   * How far to pull the text box back so the requested part of it lands on the
   * node's x/y.
   *
   * The two axes deliberately measure different things.
   *
   * Horizontally it is the ADVANCE width, not the ink: a label whose text
   * changes must not slide sideways because the new string happens to have
   * tighter side bearings, so a row of centred labels stays on a common grid.
   *
   * Vertically it is the INK, not the line box. A top-baselined line box
   * reserves height for accents and descenders that a row of capitals never
   * uses, so centring the box sits the letters about 0.18em high — small on a
   * paragraph, glaring on a single letter inside a circle.
   */
  alignShift(m: { advW: number; lineH: number; inkTop: number; inkBottom: number }): {
    dx: number;
    dy: number;
  } {
    if (this.kind !== 'text') return { dx: 0, dy: 0 };
    const align = this.props.align;
    const valign = this.props.valign;
    const dx = align === 'center' ? m.advW / 2 : align === 'right' ? m.advW : 0;
    const dy =
      valign === 'middle'
        ? (m.inkTop + m.inkBottom) / 2
        : valign === 'bottom'
          ? m.inkBottom
          : 0;
    return { dx, dy };
  }

  textSize(): { w: number; h: number; inkTop: number; inkBottom: number } {
    return measureText({
      text: String(this.props.text ?? ''),
      size: num(this.props.fontSize, 16),
      fontFamily: DEFAULT_FONT_FAMILY,
      fontStyle: normalizeFontStyle(this.props.fontStyle),
      fill: String(this.props.fill ?? '#000000'),
      dpr: 1,
    });
  }
}

// The generated accessors are attached in the constructor, so declare them for
// TypeScript. Each is read-with-no-arg / write-with-one-arg.
export interface NodeHandle {
  x(): number; x(v: number): NodeHandle;
  y(): number; y(v: number): NodeHandle;
  radius(): number; radius(v: number): NodeHandle;
  width(): number; width(v: number): NodeHandle;
  height(): number; height(v: number): NodeHandle;
  radiusX(): number; radiusX(v: number): NodeHandle;
  radiusY(): number; radiusY(v: number): NodeHandle;
  innerRadius(): number; innerRadius(v: number): NodeHandle;
  outerRadius(): number; outerRadius(v: number): NodeHandle;
  angle(): number; angle(v: number): NodeHandle;
  cornerRadius(): number; cornerRadius(v: number): NodeHandle;
  text(): string; text(v: string): NodeHandle;
  fontSize(): number; fontSize(v: number): NodeHandle;
  fontStyle(): string; fontStyle(v: string): NodeHandle;
  fill(): string; fill(v: string): NodeHandle;
  stroke(): string; stroke(v: string): NodeHandle;
  strokeWidth(): number; strokeWidth(v: number): NodeHandle;
  opacity(): number; opacity(v: number): NodeHandle;
  rotation(): number; rotation(v: number): NodeHandle;
  shadowBlur(): number; shadowBlur(v: number): NodeHandle;
  shadowOpacity(): number; shadowOpacity(v: number): NodeHandle;
  shadowOffsetX(): number; shadowOffsetX(v: number): NodeHandle;
  shadowOffsetY(): number; shadowOffsetY(v: number): NodeHandle;
  shadowColor(): string; shadowColor(v: string): NodeHandle;
  listening(): boolean; listening(v: boolean): NodeHandle;
  // Attached ONLY on `stroke` nodes at runtime (see STROKE_ACCESSORS), but
  // declared unconditionally: v1's Konva nodes were `any`, so call sites like
  // `player.ts`'s ink handling assume these exist on the node they hold. The
  // runtime restriction is what matters — it is what lets the harness's
  // `typeof k.points === 'function'` probe correctly say "not a polyline".
  points(): number[]; points(v: number[]): NodeHandle;
  dash(): number[]; dash(v: number[]): NodeHandle;
  tension(): number; tension(v: number): NodeHandle;
  closed(): boolean; closed(v: boolean): NodeHandle;
}

/** The three pointer events the player wires per node. */
const NODE_EVENTS = { click: 'click', enter: 'mouseenter', leave: 'mouseleave' } as const;

function num(v: PropValue, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

/**
 * The implicit text family. The `.glam` format has no `fontFamily` field, so v1
 * inherited Konva.Text's default of bare 'Arial'. Kept as exactly that (no
 * fallback list) so the two backends resolve the same family name — a fallback
 * chain let Chromium and node-canvas pick different fonts, which showed up as a
 * width mismatch on text-heavy docs in the parity run.
 */
const DEFAULT_FONT_FAMILY = 'Arial';

function normalizeFontStyle(v: PropValue): string {
  const s = typeof v === 'string' ? v : 'normal';
  // CSS wants style before weight; some canvas font parsers drop the reverse.
  return s === 'bold italic' ? 'italic bold' : s;
}

/* ------------------------------- stage / layer ------------------------------ */

type PointerHandler = (evt: { type: string }) => void;

/** Minimal stand-in for Konva.Stage — only what player.ts actually calls. */
export class StageShim {
  private pointer: { x: number; y: number } | null = null;
  /** The pointer that owns the current drag; others are ignored while it draws. */
  private activePointerId: number | null = null;
  /** Where every currently-down pointer went down. Needed because ownership is
   *  decided by which pointer MOVES, which can be any of them. */
  private downAt = new Map<number, { x: number; y: number }>();
  /** Has the owner actually drawn yet? Until it has, ownership is provisional. */
  private activeMoved = false;
  private handlers = new Map<string, PointerHandler[]>();
  private detach: Array<() => void> = [];

  constructor(
    readonly canvas: HTMLCanvasElement | OffscreenCanvas,
    readonly w: number,
    readonly h: number,
  ) {
    if (!isDomCanvas(canvas)) return;
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) {
      const fn = (ev: Event): void => {
        const pe = ev as PointerEvent;
        // A drag follows ONE pointer. Without this the stream is a merge of
        // every active touch: on a tablet a second finger landing anywhere on
        // the canvas emits a `down` that clears the in-progress ink and an `up`
        // that finalises (and, for ink docs, spends) the stroke the first finger
        // was still drawing. A child resting a palm loses the letter.
        //
        // Forget a pointer the moment it lifts — BEFORE the not-the-owner reject
        // below, which used to return first and so only ever cleaned up after
        // the owner. Two bugs came out of that: `downAt` grew without bound, and
        // a stale entry meant a merely HOVERING pen or mouse (down earlier as a
        // non-owner, never cleared) could satisfy the movement-steal and take the
        // drag away from a finger that was really drawing — handing the host a
        // synthetic `pointerdown` at a stale origin the user never touched.
        if (type === 'pointerup' || type === 'pointercancel') this.downAt.delete(pe.pointerId);
        if (type === 'pointerdown') {
          // Ownership is decided by which pointer DRAWS, not by which lands
          // first. "First down wins" broke palm-lands-first; "last down wins
          // until someone moves" broke the mirror case, where the finger is
          // down and a palm settles before the child starts moving. Either
          // ordering happens on a tablet, so neither ordering can be the rule.
          //
          // Every down is a candidate. The most recent one is the provisional
          // owner, so a tap still works (a dot never moves). But the moment a
          // candidate actually moves, it takes the drag — see pointermove.
          this.downAt.set(pe.pointerId, { x: pe.clientX, y: pe.clientY });
          if (this.activePointerId !== null && this.activeMoved) return;
          this.claim(canvas as HTMLCanvasElement, pe.pointerId);
        } else if (this.activePointerId !== null && pe.pointerId !== this.activePointerId) {
          // Not the owner — but a non-owner that starts DRAWING while the owner
          // sits still is the one we actually want, so the steal has to be
          // considered before the reject, not after it.
          const from = type === 'pointermove' && !this.activeMoved
            ? this.downAt.get(pe.pointerId)
            : undefined;
          if (!from || (pe.clientX - from.x) ** 2 + (pe.clientY - from.y) ** 2 <= 36) return;
          // Hand the drag over, and re-announce the down at the new pointer's
          // origin so the host starts a fresh stroke rather than continuing the
          // resting pointer's.
          this.claim(canvas as HTMLCanvasElement, pe.pointerId);
          this.pointer = this.toStage(canvas, from.x, from.y);
          for (const handler of this.handlers.get('pointerdown') ?? []) handler({ type: 'pointerdown' });
          this.activeMoved = true;
        }
        if (type === 'pointermove' && !this.activeMoved) {
          // 6px: past a resting finger's jitter, short of a deliberate stroke.
          const from = this.downAt.get(pe.pointerId);
          if (from && (pe.clientX - from.x) ** 2 + (pe.clientY - from.y) ** 2 > 36) {
            this.activeMoved = true;
          }
        }
        this.pointer = this.toStage(canvas, pe.clientX, pe.clientY);
        const key = type === 'pointercancel' ? 'pointerup' : type;
        if (key === 'pointerup' && pe.pointerId === this.activePointerId) this.releaseActive();
        for (const handler of this.handlers.get(key) ?? []) handler({ type: key });
      };
      canvas.addEventListener(type, fn);
      this.detach.push(() => canvas.removeEventListener(type, fn));
    }
    // The backstop. Fires whenever capture ends — including the ordinary
    // implicit release after `pointerup`, where the id is already null, and the
    // cases that would otherwise strand it (the element is removed, the browser
    // revokes capture, capture was never granted and the pointer went away).
    const onLost = (ev: Event): void => {
      const pe = ev as PointerEvent;
      if (pe.pointerId === this.activePointerId) this.releaseActive();
    };
    canvas.addEventListener('lostpointercapture', onLost);
    this.detach.push(() => canvas.removeEventListener('lostpointercapture', onLost));
  }

  private toStage(canvas: HTMLCanvasElement | OffscreenCanvas, cx: number, cy: number): { x: number; y: number } {
    const rect = (canvas as HTMLCanvasElement).getBoundingClientRect();
    const sx = rect.width > 0 ? this.w / rect.width : 1;
    const sy = rect.height > 0 ? this.h / rect.height : 1;
    return { x: (cx - rect.left) * sx, y: (cy - rect.top) * sy };
  }

  /** Make `id` the owner, moving pointer capture with it. */
  private claim(canvas: HTMLCanvasElement, id: number): void {
    if (this.activePointerId !== null && this.activePointerId !== id) {
      try { canvas.releasePointerCapture?.(this.activePointerId); } catch { /* already gone */ }
    }
    this.activePointerId = id;
    this.activeMoved = false;
    try { canvas.setPointerCapture?.(id); } catch { /* refused; lostpointercapture backstops */ }
  }

  private releaseActive(): void {
    this.activePointerId = null;
    this.activeMoved = false;
  }

  on(event: string, handler: PointerHandler): void {
    const key = event.split(' ')[0];
    const list = this.handlers.get(key) ?? [];
    list.push(handler);
    this.handlers.set(key, list);
  }

  getPointerPosition(): { x: number; y: number } | null {
    return this.pointer;
  }

  /**
   * A READABLE 2D snapshot of the rendered surface, named after
   * Konva.Stage#toCanvas so pixel-level tests keep working unchanged.
   *
   * It has to be a copy: a canvas that has handed out a `webgl2` context can
   * never also return a `2d` one, so `getContext('2d')` on the live canvas is
   * null. `drawImage` from the GL canvas works because the renderer keeps
   * `preserveDrawingBuffer` on.
   */
  toCanvas(): HTMLCanvasElement {
    const src = this.canvas as HTMLCanvasElement;
    const out = document.createElement('canvas');
    out.width = src.width;
    out.height = src.height;
    const ctx = out.getContext('2d');
    if (ctx) {
      ctx.setTransform(src.width / this.w, 0, 0, src.height / this.h, 0, 0);
      ctx.drawImage(src, 0, 0, this.w, this.h);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    return out;
  }

  /** Test seam: the harness has no real pointer, so it injects positions. */
  __setPointer(pt: { x: number; y: number } | null): void {
    this.pointer = pt;
  }

  destroy(): void {
    for (const off of this.detach) off();
    this.detach = [];
    this.handlers.clear();
  }
}

/** Minimal stand-in for Konva.Layer — `draw()` is the whole contract. */
export class LayerShim {
  constructor(private readonly core: SceneCore) {}
  draw(): void {
    this.core.draw();
  }
  getIntersection(pt: { x: number; y: number }): NodeHandle | null {
    return this.core.hitTest(pt);
  }
}

function isDomCanvas(c: unknown): c is HTMLCanvasElement {
  return typeof HTMLCanvasElement !== 'undefined' && c instanceof HTMLCanvasElement;
}

/* ---------------------------------- tweens --------------------------------- */

interface Tween {
  node: NodeHandle;
  method: string;
  from: number;
  to: number;
  start: number;
  durationMs: number;
  ease: string;
  clamp: boolean;
}

/**
 * The tween easing curves. Exported as `applyEaseForTest` so the frame-parity
 * gate can compare them numerically against Konva.Easings — the curve itself is
 * the thing most likely to be subtly wrong, and pixels are a poor way to see it.
 */
export function applyEaseForTest(name: string, phase: number): number {
  return applyEase(name, phase);
}

function applyEase(name: string, phase: number): number {
  switch (name) {
    case 'easeIn': return phase * phase;
    case 'easeOut': return 1 - (1 - phase) * (1 - phase);
    case 'easeInOut':
      return phase < 0.5 ? 2 * phase * phase : 1 - ((-2 * phase + 2) ** 2) / 2;
    case 'backInOut': {
      const c2 = 1.70158 * 1.525;
      return phase < 0.5
        ? ((2 * phase) ** 2 * ((c2 + 1) * 2 * phase - c2)) / 2
        : ((2 * phase - 2) ** 2 * ((c2 + 1) * (2 * phase - 2) + c2) + 2) / 2;
    }
    case 'elasticOut': {
      if (phase === 0 || phase === 1) return phase;
      const c4 = (2 * Math.PI) / 3;
      return 2 ** (-10 * phase) * Math.sin((phase * 10 - 0.75) * c4) + 1;
    }
    case 'linear':
    default:
      return phase;
  }
}

/* ------------------------------- the scene core ---------------------------- */

class SceneCore {
  readonly byId: Record<string, NodeHandle> = {};
  readonly display: NodeHandle[] = [];
  readonly stage: StageShim;
  readonly layer: LayerShim;
  bg: Rgba;
  private renderer: GlRenderer | null = null;
  private mesh = new Mesh();
  private tweens: Tween[] = [];
  private raf: number | null = null;
  private dirty = true;
  private destroyed = false;
  private ownsCanvas = false;
  private hoverNode: NodeHandle | null = null;

  constructor(
    readonly doc: GlamDoc,
    readonly canvas: HTMLCanvasElement | OffscreenCanvas,
    readonly dpr: number,
    ownsCanvas: boolean,
  ) {
    this.ownsCanvas = ownsCanvas;
    this.bg = parseColor(doc.canvas.bg, { r: 1, g: 1, b: 1, a: 0 });
    this.stage = new StageShim(canvas, doc.canvas.w, doc.canvas.h);
    this.layer = new LayerShim(this);
    this.renderer = new GlRenderer(canvas, doc.canvas.w, doc.canvas.h, dpr);
    // A restored context has no GPU state at all, so the whole scene has to be
    // repainted — and every text node must re-upload, because the renderer's
    // texture cache is keyed on raster identity.
    this.renderer.onRestored = () => {
      for (const node of this.display) node.invalidateRaster();
      this.dirty = true;
      this.draw();
    };
    this.renderer.onLost = () => {
      this.dirty = true;
    };
    this.attachPointerDispatch();
  }

  /**
   * Konva dispatched click/mouseenter/mouseleave per node off its own hit graph.
   * Here the stage's pointer stream is hit-tested and the same three events are
   * fired, so `player.ts`'s `target.on('click', …)` wiring is unchanged.
   */
  private attachPointerDispatch(): void {
    let downNode: NodeHandle | null = null;
    this.stage.on('pointerdown', () => {
      const pt = this.stage.getPointerPosition();
      downNode = pt ? this.hitTest(pt) : null;
    });
    this.stage.on('pointerup', () => {
      const pt = this.stage.getPointerPosition();
      const up = pt ? this.hitTest(pt) : null;
      // A click is press-and-release on the SAME node, matching Konva.
      if (up && up === downNode) up.fire(NODE_EVENTS.click);
      downNode = null;
    });
    this.stage.on('pointermove', () => {
      const pt = this.stage.getPointerPosition();
      const over = pt ? this.hitTest(pt) : null;
      if (over === this.hoverNode) return;
      this.hoverNode?.fire(NODE_EVENTS.leave);
      over?.fire(NODE_EVENTS.enter);
      this.hoverNode = over;
    });
  }

  /** Test/harness seam: synthesize a click the way Konva's hit graph would. */
  __dispatchClickAt(pt: { x: number; y: number }): NodeHandle | null {
    const hit = this.hitTest(pt);
    if (hit) hit.fire(NODE_EVENTS.click);
    return hit;
  }

  markDirty(): void {
    this.dirty = true;
  }

  /* ------------------------------- drawing -------------------------------- */

  draw(): void {
    if (this.destroyed || !this.renderer) return;
    // While the context is lost every GL call fails; the renderer no-ops
    // internally, but returning early also skips the per-node tessellation work.
    if (this.renderer.isContextLost) return;
    const r = this.renderer;
    r.begin(this.bg);
    for (const node of this.display) this.drawOne(r, node);
    this.dirty = false;
  }

  private drawOne(r: GlRenderer, node: NodeHandle): void {
    const alpha = clamp01(num(node.props.opacity, 1)) * this.inheritedAlpha(node);
    if (alpha <= 0) return;
    const abs = node.getAbsolutePosition();
    const rot = num(node.props.rotation);
    const shadow = this.shadowFor(node);
    const paint = this.paintFor(node, abs, rot);
    if (paint) {
      r.drawNode((m) => this.buildGeometry(m, node, abs, rot), paint, alpha, shadow);
    }
    // Konva painted fill AND stroke on the same shape. Missing this dropped the
    // outline ring off every stroked circle/rect (caught by the crab's eyes in
    // the first parity run), so a stroked shape gets a second outline pass.
    const outline = this.outlinePaint(node);
    if (outline) {
      r.drawNode(
        (m) => this.buildOutline(m, node, abs, rot),
        outline.paint,
        alpha,
        paint ? undefined : shadow,
      );
    }
  }

  /**
   * The stroke paint for a shape that also has a fill. Returns null for
   * `stroke`-type nodes drawn as polylines (already stroked) and for shapes with
   * no stroke colour or zero width.
   */
  private outlinePaint(node: NodeHandle): { paint: Paint; width: number } | null {
    const color = typeof node.props.stroke === 'string' ? node.props.stroke : undefined;
    if (!color) return null;
    const width = num(node.props.strokeWidth, 0);
    if (width <= 0) return null;
    // A polyline `stroke` node is already painted with its stroke colour; only
    // the filled-polygon variant needs a separate outline pass.
    if (node.kind === 'stroke') {
      const filled = node.props.closed === true
        && typeof node.props.fill === 'string' && !!node.props.fill;
      if (!filled) return null;
    }
    const rgba = parseColor(color);
    if (rgba.a <= 0) return null;
    return { paint: { kind: 'solid', color: rgba }, width };
  }

  /** Tessellate a shape's outline as a closed stroked polyline. */
  private buildOutline(m: Mesh, node: NodeHandle, abs: { x: number; y: number }, rot: number): void {
    const from = m.v.length;
    const width = num(node.props.strokeWidth, 1);
    const pts = outlinePoints(node);
    if (pts.length >= 4) m.polyline(pts, width, true);
    m.rotateFrom(from, 0, 0, rot);
    m.translateFrom(from, abs.x, abs.y);
  }

  private inheritedAlpha(node: NodeHandle): number {
    let a = 1;
    let p = node.parent;
    while (p) {
      a *= clamp01(num(p.props.opacity, 1));
      p = p.parent;
    }
    return a;
  }

  /** Tessellate one node in absolute canvas pixels. */
  private buildGeometry(m: Mesh, node: NodeHandle, abs: { x: number; y: number }, rot: number): void {
    const from = m.v.length;
    switch (node.kind) {
      case 'circle':
        m.circle(0, 0, num(node.props.radius));
        break;
      case 'ellipse':
        m.ellipse(0, 0, num(node.props.radiusX), num(node.props.radiusY));
        break;
      case 'arc':
        m.ring(
          0, 0,
          num(node.props.innerRadius),
          num(node.props.outerRadius),
          num(node.props.angle),
          node.props.cap === 'round' ? 'round' : 'butt',
        );
        break;
      case 'rect':
        m.rect(0, 0, num(node.props.width), num(node.props.height), num(node.props.cornerRadius));
        break;
      case 'image': {
        // An image takes whichever shape props it was given, and that shape IS
        // the crop: the mesh becomes the stencil, so an image node carrying
        // rx/ry is a round-cropped picture with no clipping machinery at all.
        const rx = num(node.props.radiusX);
        const ry = num(node.props.radiusY);
        const r = num(node.props.radius);
        if (r > 0) m.circle(0, 0, r);
        else if (rx > 0 && ry > 0) m.ellipse(0, 0, rx, ry);
        else m.rect(0, 0, num(node.props.width), num(node.props.height), num(node.props.cornerRadius));
        break;
      }
      case 'text': {
        // Cover the FULL padded raster, so the stencil mask and the texture
        // quad have identical extent (a smaller mask would clip the glyph).
        const r = node.textRaster(this.dpr);
        if (r) m.rect(-r.padX, -r.padY, r.w, r.h);
        else {
          const size = node.textSize();
          const a = node.alignShift({
            advW: size.w,
            lineH: size.h,
            inkTop: size.inkTop,
            inkBottom: size.inkBottom,
          });
          m.rect(-a.dx, -a.dy, size.w, size.h);
        }
        break;
      }
      case 'stroke': {
        const raw = Array.isArray(node.props.points) ? (node.props.points as number[]) : [];
        if (raw.length < 2) break;
        const closed = node.props.closed === true;
        const tension = num(node.props.tension);
        const pts = tension ? tensionize(raw, tension, closed) : raw;
        // A closed stroke with a fill paints as a polygon (sparkles, silhouettes);
        // otherwise it is a stroked polyline, optionally dashed.
        if (closed && typeof node.props.fill === 'string' && node.props.fill) {
          m.polygon(pts);
        } else {
          const width = num(node.props.strokeWidth, 1);
          const dash = Array.isArray(node.props.dash) ? (node.props.dash as number[]) : null;
          if (dash && dash.length >= 1 && dash[0] > 0) {
            for (const seg of dashify(pts, dash)) m.polyline(seg, width, false);
          } else {
            m.polyline(pts, width, closed);
          }
        }
        break;
      }
      default:
        return;
    }
    m.rotateFrom(from, 0, 0, rot);
    m.translateFrom(from, abs.x, abs.y);
  }

  private paintFor(node: NodeHandle, abs: { x: number; y: number }, rot = 0): Paint | null {
    if (node.kind === 'image') {
      const src = typeof node.props.src === 'string' ? node.props.src : '';
      if (!src) return null;
      // Ask, never wait. If the bytes have not landed the node draws nothing
      // this frame and the loader wakes us when they do — without that callback
      // a still scene would load its pictures and never show them.
      const rec = getImage(src, () => this.markDirty());
      if (rec.state !== 'ready' || !rec.source) return null;

      // The node's own box, in absolute pixels, matching the geometry above.
      const r = num(node.props.radius);
      const rx = num(node.props.radiusX);
      const ry = num(node.props.radiusY);
      const box =
        r > 0
          ? { x: abs.x - r, y: abs.y - r, w: r * 2, h: r * 2 }
          : rx > 0 && ry > 0
            ? { x: abs.x - rx, y: abs.y - ry, w: rx * 2, h: ry * 2 }
            : { x: abs.x, y: abs.y, w: num(node.props.width), h: num(node.props.height) };
      if (box.w <= 0 || box.h <= 0) return null;

      const fit = (node.props.fit as ImageFit) ?? 'cover';
      const mapped = fitBox(box, rec.w, rec.h, fit);
      // Keyed for the renderer's texture cache: one upload per source, however
      // many nodes point at it.
      (rec.source as unknown as { __glamKey?: string }).__glamKey = `img:${src}`;
      return {
        kind: 'texture',
        source: rec.source,
        x: mapped.x,
        y: mapped.y,
        w: mapped.w,
        h: mapped.h,
        // The stencil is rotated geometry, so the sampler rotates with it.
        originX: abs.x,
        originY: abs.y,
        rot,
      };
    }

    if (node.kind === 'text') {
      const raster = node.textRaster(this.dpr);
      if (!raster) return null;
      // Tag the raster so the renderer's texture cache can key on it.
      (raster.source as unknown as { __glamKey?: string }).__glamKey =
        `${node._docId}:${textKey({
          text: String(node.props.text ?? ''),
          size: num(node.props.fontSize, 16),
          fontFamily: DEFAULT_FONT_FAMILY,
          fontStyle: normalizeFontStyle(node.props.fontStyle),
          fill: String(node.props.fill ?? '#000'),
          dpr: this.dpr,
        })}`;
      // Shift back by the baked-in padding so the glyph origin lands on the
      // node's x/y, matching Konva.Text.
      return {
        kind: 'texture',
        source: raster.source,
        x: abs.x - raster.padX,
        y: abs.y - raster.padY,
        w: raster.w,
        h: raster.h,
        // The stencil mask is rotated geometry, so the sampler has to rotate too.
        originX: abs.x,
        originY: abs.y,
        rot,
      };
    }

    if (node.gradient) {
      const g = node.gradient;
      const stops = g.stops.map((s) => ({ offset: s.offset, color: parseColor(s.color) }));
      if (g.type === 'linear') {
        const f = g.from ?? { x: 0, y: 0 };
        const t = g.to ?? { x: 0, y: 0 };
        return {
          kind: 'gradient',
          gradient: {
            kind: 'linear',
            from: [abs.x + f.x, abs.y + f.y],
            to: [abs.x + t.x, abs.y + t.y],
            startRadius: 0,
            endRadius: 0,
            stops,
          },
        };
      }
      const c = g.center ?? { x: 0, y: 0 };
      return {
        kind: 'gradient',
        gradient: {
          kind: 'radial',
          from: [abs.x + c.x, abs.y + c.y],
          to: [abs.x + c.x, abs.y + c.y],
          startRadius: g.startRadius ?? 0,
          endRadius: g.endRadius ?? 0,
          stops,
        },
      };
    }

    // A stroke node paints with `stroke`; every other shape with `fill`. A
    // closed stroke carrying a fill is a filled polygon (see buildGeometry).
    const isFilledPolygon = node.kind === 'stroke'
      && node.props.closed === true
      && typeof node.props.fill === 'string'
      && !!node.props.fill;
    const source = node.kind === 'stroke' && !isFilledPolygon ? node.props.stroke : node.props.fill;
    const color = parseColor(typeof source === 'string' ? source : undefined);
    if (color.a <= 0) return null;
    return { kind: 'solid', color };
  }

  private shadowFor(node: NodeHandle): ShadowPaint | undefined {
    const raw = node.props.shadowColor;
    if (typeof raw !== 'string' || !raw) return undefined;
    const blur = num(node.props.shadowBlur);
    if (blur <= 0) return undefined;
    const base = parseColor(raw);
    const op = node.props.shadowOpacity === undefined ? 1 : clamp01(num(node.props.shadowOpacity, 1));
    return {
      color: { ...base, a: base.a * op },
      blur,
      offsetX: num(node.props.shadowOffsetX),
      offsetY: num(node.props.shadowOffsetY),
    };
  }

  /* ------------------------------ hit testing ----------------------------- */

  /**
   * Geometric hit-test, topmost first. Deliberately NOT a GPU colour-ID
   * readback: `readPixels` stalls the pipeline, and pointermove would pay that
   * cost every event. Analytic tests are exact and free.
   */
  hitTest(pt: { x: number; y: number }): NodeHandle | null {
    for (let i = this.display.length - 1; i >= 0; i--) {
      const node = this.display[i];
      if (node.props.listening === false) continue;
      if (clamp01(num(node.props.opacity, 1)) <= 0) continue;
      if (this.hits(node, pt)) return node;
    }
    return null;
  }

  private hits(node: NodeHandle, pt: { x: number; y: number }): boolean {
    const abs = node.getAbsolutePosition();
    const rot = num(node.props.rotation);
    // Move the probe into the node's local, unrotated frame.
    let lx = pt.x - abs.x;
    let ly = pt.y - abs.y;
    if (rot) {
      const a = (-rot * Math.PI) / 180;
      const ca = Math.cos(a), sa = Math.sin(a);
      const rx = lx * ca - ly * sa;
      ly = lx * sa + ly * ca;
      lx = rx;
    }
    switch (node.kind) {
      case 'circle': {
        const r = num(node.props.radius);
        return lx * lx + ly * ly <= r * r;
      }
      case 'ellipse': {
        const rx = num(node.props.radiusX), ry = num(node.props.radiusY);
        if (rx <= 0 || ry <= 0) return false;
        return (lx * lx) / (rx * rx) + (ly * ly) / (ry * ry) <= 1;
      }
      case 'arc': {
        const inner = num(node.props.innerRadius), outer = num(node.props.outerRadius);
        const d = Math.hypot(lx, ly);
        if (d < inner || d > outer) return false;
        const sweep = num(node.props.angle);
        if (Math.abs(sweep) >= 360) return true;
        let a = (Math.atan2(ly, lx) * 180) / Math.PI;
        if (a < 0) a += 360;
        const end = ((sweep % 360) + 360) % 360;
        return sweep >= 0 ? a <= end : a >= 360 - end;
      }
      case 'rect': {
        const w = num(node.props.width), h = num(node.props.height);
        return lx >= 0 && lx <= w && ly >= 0 && ly <= h;
      }
      case 'text': {
        // The hit box has to follow the alignment, or a centred label stays
        // tappable only where it USED to be drawn.
        const s = node.textSize();
        const a = node.alignShift({
          advW: s.w,
          lineH: s.h,
          inkTop: s.inkTop,
          inkBottom: s.inkBottom,
        });
        return lx >= -a.dx && lx <= s.w - a.dx && ly >= -a.dy && ly <= s.h - a.dy;
      }
      case 'stroke': {
        const raw = Array.isArray(node.props.points) ? (node.props.points as number[]) : [];
        if (raw.length < 2) return false;
        const closed = node.props.closed === true;
        const tension = num(node.props.tension);
        const pts = tension ? tensionize(raw, tension, closed) : raw;
        if (closed && typeof node.props.fill === 'string' && node.props.fill) {
          return pointInPolygon(pts, lx, ly);
        }
        const hw = Math.max(num(node.props.strokeWidth, 1) / 2, 1);
        return distToPolyline(pts, lx, ly, closed) <= hw;
      }
      default:
        return false;
    }
  }

  /* -------------------------------- tweening ------------------------------ */

  addTween(node: NodeHandle, method: string, to: number, durationMs: number, ease: string): void {
    const current = num((node as unknown as Record<string, () => number>)[method]());
    // Replace any in-flight tween on the same target/prop so a rapid state
    // flip-flop does not stack two interpolations onto one value.
    this.tweens = this.tweens.filter((t) => !(t.node === node && t.method === method));
    this.tweens.push({
      node,
      method,
      from: current,
      to,
      start: now(),
      durationMs,
      ease,
      clamp: NON_NEGATIVE_METHODS.has(method),
    });
    this.startTicker();
  }

  private startTicker(): void {
    if (this.raf !== null || this.destroyed) return;
    if (typeof requestAnimationFrame !== 'function') {
      // No rAF (node, tests): settle tweens immediately so state is coherent.
      this.settleTweens();
      return;
    }
    const step = (): void => {
      this.raf = null;
      if (this.destroyed) return;
      const live = this.tickTweens(now());
      this.draw();
      if (live) this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  /** Advance tweens; returns true while any is still running. */
  private tickTweens(t: number): boolean {
    if (this.tweens.length === 0) return false;
    const keep: Tween[] = [];
    for (const tw of this.tweens) {
      const phase = tw.durationMs <= 0 ? 1 : Math.min(1, (t - tw.start) / tw.durationMs);
      const eased = applyEase(tw.ease, phase);
      let v = tw.from + (tw.to - tw.from) * eased;
      if (tw.clamp && v < 0) v = 0;
      (tw.node as unknown as Record<string, (n: number) => void>)[tw.method](v);
      if (phase < 1) keep.push(tw);
    }
    this.tweens = keep;
    return keep.length > 0;
  }

  private settleTweens(): void {
    for (const tw of this.tweens) {
      let v = tw.to;
      if (tw.clamp && v < 0) v = 0;
      (tw.node as unknown as Record<string, (n: number) => void>)[tw.method](v);
    }
    this.tweens = [];
    this.draw();
  }

  /** Test/headless seam: drive tweens deterministically. */
  __tickTweens(t: number): boolean {
    const live = this.tickTweens(t);
    this.draw();
    return live;
  }

  readPixels(): Uint8Array {
    if (!this.renderer) throw new Error('scene: renderer destroyed');
    return this.renderer.readPixels();
  }

  get isContextLost(): boolean {
    return this.renderer?.isContextLost ?? false;
  }

  /** Test seam: force a WebGL context loss/restore cycle. */
  __simulateContextLoss(restoreAfterMs = 0): boolean {
    return this.renderer?.__simulateContextLoss(restoreAfterMs) ?? false;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.raf !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.raf);
    }
    this.raf = null;
    this.tweens = [];
    this.stage.destroy();
    this.renderer?.destroy();
    this.renderer = null;
    if (this.ownsCanvas && isDomCanvas(this.canvas)) this.canvas.remove();
  }
}

function now(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * A shape's outline as a closed point ring, in the node's local frame — the path
 * Konva would have stroked. Rounded rect corners are approximated with short
 * arcs so a stroked `cornerRadius` still reads round.
 */
function outlinePoints(node: NodeHandle): number[] {
  const p = node.props;
  const ring = (rx: number, ry: number): number[] => {
    if (rx <= 0 || ry <= 0) return [];
    const n = segsFor(Math.max(rx, ry));
    const out: number[] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      out.push(Math.cos(a) * rx, Math.sin(a) * ry);
    }
    return out;
  };
  switch (node.kind) {
    case 'circle': {
      const r = num(p.radius);
      return ring(r, r);
    }
    case 'ellipse':
      return ring(num(p.radiusX), num(p.radiusY));
    case 'rect': {
      const w = num(p.width), h = num(p.height);
      if (w <= 0 || h <= 0) return [];
      const cr = Math.max(0, Math.min(num(p.cornerRadius), Math.min(w, h) / 2));
      if (cr < 0.01) return [0, 0, w, 0, w, h, 0, h];
      const out: number[] = [];
      const corner = (cx: number, cy: number, a0: number): void => {
        const segs = 6;
        for (let i = 0; i <= segs; i++) {
          const a = a0 + (Math.PI / 2) * (i / segs);
          out.push(cx + Math.cos(a) * cr, cy + Math.sin(a) * cr);
        }
      };
      corner(cr, cr, Math.PI);
      corner(w - cr, cr, -Math.PI / 2);
      corner(w - cr, h - cr, 0);
      corner(cr, h - cr, Math.PI / 2);
      return out;
    }
    case 'arc': {
      const inner = Math.max(0, num(p.innerRadius));
      const outer = num(p.outerRadius);
      if (outer <= 0) return [];
      const sweep = (num(p.angle) * Math.PI) / 180;
      const n = Math.max(3, Math.ceil(segsFor(outer) * (Math.abs(sweep) / (Math.PI * 2))));
      const out: number[] = [];
      for (let i = 0; i <= n; i++) {
        const a = (sweep * i) / n;
        out.push(Math.cos(a) * outer, Math.sin(a) * outer);
      }
      for (let i = n; i >= 0; i--) {
        const a = (sweep * i) / n;
        out.push(Math.cos(a) * inner, Math.sin(a) * inner);
      }
      return out;
    }
    case 'stroke': {
      const raw = Array.isArray(p.points) ? (p.points as number[]) : [];
      const tension = num(p.tension);
      return tension ? tensionize(raw, tension, true) : raw.slice();
    }
    default:
      return [];
  }
}

function distToPolyline(pts: readonly number[], px: number, py: number, closed: boolean): number {
  let best = Infinity;
  const n = pts.length;
  const last = closed ? n : n - 2;
  for (let i = 0; i + 1 < last + 1 && i + 1 < n; i += 2) {
    const x0 = pts[i], y0 = pts[i + 1];
    const x1 = pts[(i + 2) % n], y1 = pts[(i + 3) % n];
    if (i + 2 >= n && !closed) break;
    const dx = x1 - x0, dy = y1 - y0;
    const l2 = dx * dx + dy * dy;
    const t = l2 < 1e-9 ? 0 : Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / l2));
    best = Math.min(best, Math.hypot(px - (x0 + dx * t), py - (y0 + dy * t)));
  }
  if (!Number.isFinite(best) && n >= 2) best = Math.hypot(px - pts[0], py - pts[1]);
  return best;
}

function pointInPolygon(pts: readonly number[], px: number, py: number): boolean {
  let inside = false;
  const n = pts.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = pts[i * 2], yi = pts[i * 2 + 1];
    const xj = pts[j * 2], yj = pts[j * 2 + 1];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/* --------------------------------- builder -------------------------------- */

export interface BuildSceneOpts {
  /** Device pixel ratio for the backing store. Defaults to 1 (deterministic). */
  dpr?: number;
  /** Reuse an existing canvas instead of creating one inside `container`. */
  canvas?: HTMLCanvasElement | OffscreenCanvas;
}

/**
 * Build a scene. The v1 signature took an injected Konva as its first argument;
 * v2 has no such dependency, so the renderer is created internally.
 */
export function buildScene(doc: GlamDoc, container?: unknown, opts: BuildSceneOpts = {}): SceneHandle {
  const dpr = opts.dpr ?? 1;
  let canvas = opts.canvas;
  let owns = false;
  if (!canvas) {
    if (typeof document === 'undefined') {
      throw new Error(
        'buildScene: no canvas available. In node, use renderToPNG (headless Chromium) — '
        + 'the WebGL backend has no in-process rasterizer.',
      );
    }
    canvas = document.createElement('canvas');
    owns = true;
    canvas.width = Math.round(doc.canvas.w * dpr);
    canvas.height = Math.round(doc.canvas.h * dpr);
    canvas.style.width = `${doc.canvas.w}px`;
    canvas.style.height = `${doc.canvas.h}px`;
    canvas.style.display = 'block';
    canvas.style.touchAction = 'none';
    const mount = resolveContainer(container);
    if (mount) mount.appendChild(canvas);
  }

  const core = new SceneCore(doc, canvas, dpr, owns);

  // Display order mirrors Konva's layer children exactly: groups are added
  // first (in doc.groups order), then ungrouped nodes in doc.nodes order. A
  // grouped node therefore paints at its GROUP's z-position, not its own index
  // in doc.nodes — a documented v1 quirk that parity requires preserving.
  const groupById: Record<string, NodeHandle> = {};
  for (const group of doc.groups ?? []) {
    const g = new NodeHandle('group', core);
    g._docId = group.id;
    g.x(group.x);
    g.y(group.y);
    core.byId[group.id] = g;
    groupById[group.id] = g;
  }

  const ungrouped: NodeHandle[] = [];
  for (const node of doc.nodes) {
    const h = buildNodeHandle(node, core);
    core.byId[node.id] = h;
    const parent = node.group !== undefined ? groupById[node.group] : undefined;
    if (parent) {
      h.parent = parent;
      parent.children.push(h);
    } else {
      ungrouped.push(h);
    }
  }
  for (const group of doc.groups ?? []) {
    core.display.push(...(groupById[group.id]?.children ?? []));
  }
  core.display.push(...ungrouped);

  const inputs: Record<string, number | string> = { ...(doc.inputs ?? {}) };
  const binds = doc.bind ?? [];

  function numericScope(): Record<string, number> {
    const scope: Record<string, number> = {};
    for (const [k, v] of Object.entries(inputs)) {
      if (typeof v === 'number') scope[k] = v;
    }
    return scope;
  }

  function recomputeBindings(): void {
    const scope = numericScope();
    for (const bind of binds) {
      const target = core.byId[bind.node];
      if (!target) continue;
      const value = evalExpr(bind.expr, scope);
      const method = methodFor(bind.prop);
      (target as unknown as Record<string, (v: number) => void>)[method](
        clampPropValue(bind.prop, value),
      );
    }
  }

  recomputeBindings();

  // Seed the static resting frame once, after bindings: loops rest at `from`,
  // wander targets rest at their ellipse centre. Keeps the first painted frame
  // (and the headless render) deterministic and matched to where motion starts.
  for (const loop of doc.loops ?? []) {
    const target = core.byId[loop.node];
    if (!target) continue;
    const method = methodFor(loop.prop);
    (target as unknown as Record<string, (v: number) => void>)[method](
      clampPropValue(loop.prop, loop.from),
    );
  }
  for (const wander of doc.wander ?? []) {
    const target = core.byId[wander.target];
    if (!target) continue;
    target.x(wander.cx);
    target.y(wander.cy);
  }

  core.draw();

  function setInput(name: string, value: number | string): void {
    inputs[name] = value;
    recomputeBindings();
    core.draw();
  }

  function applyStateSet(
    set: Record<string, number | string>,
    transitionMs: number,
    easeName: string,
  ): void {
    for (const [key, value] of Object.entries(set)) {
      const dotIdx = key.indexOf('.');
      const nodeId = key.slice(0, dotIdx);
      const prop = key.slice(dotIdx + 1);
      const method = methodFor(prop);
      const target = core.byId[nodeId];
      if (!target) continue;
      const instant = isInstantOnlyProp(prop) || typeof value !== 'number' || transitionMs <= 0;
      if (instant) {
        const v = typeof value === 'number' && NON_NEGATIVE_METHODS.has(method)
          ? Math.max(0, value)
          : value;
        (target as unknown as Record<string, (v: number | string) => void>)[method](v);
      } else {
        core.addTween(target, method, value, transitionMs, easeName);
      }
    }
    core.draw();
  }

  function getIntersection(pt: { x: number; y: number }): NodeHandle | null {
    return core.hitTest(pt);
  }

  const handle: SceneHandle = {
    stage: core.stage,
    layer: core.layer,
    byId: core.byId,
    setInput,
    applyStateSet,
    getIntersection,
    destroy: () => core.destroy(),
    get isContextLost() {
      return core.isContextLost;
    },
  };
  // Non-enumerable seams for the headless renderer and tests.
  Object.defineProperty(handle, '__core', { value: core, enumerable: false });
  return handle;
}

function buildNodeHandle(node: GlamNode, core: SceneCore): NodeHandle {
  const h = new NodeHandle(node.type, core);
  h._docId = node.id;
  h.gradient = node.fillGradient;
  const p = h.props;
  p.x = node.x;
  p.y = node.y;
  if (node.fill !== undefined) p.fill = node.fill;
  if (node.stroke !== undefined) p.stroke = node.stroke;
  if (node.strokeWidth !== undefined) p.strokeWidth = node.strokeWidth;
  p.opacity = node.opacity ?? 1;
  p.rotation = node.rotation ?? 0;
  if (node.shadowColor !== undefined) p.shadowColor = node.shadowColor;
  if (node.shadowBlur !== undefined) p.shadowBlur = node.shadowBlur;
  if (node.shadowOpacity !== undefined) p.shadowOpacity = node.shadowOpacity;
  if (node.shadowOffsetX !== undefined) p.shadowOffsetX = node.shadowOffsetX;
  if (node.shadowOffsetY !== undefined) p.shadowOffsetY = node.shadowOffsetY;

  switch (node.type) {
    case 'circle':
      p.radius = node.r ?? 0;
      break;
    case 'ellipse':
      p.radiusX = node.rx ?? 0;
      p.radiusY = node.ry ?? 0;
      break;
    case 'arc':
      p.innerRadius = node.innerRadius ?? 0;
      p.outerRadius = node.outerRadius ?? 0;
      p.angle = node.angle ?? 0;
      // Default 'butt' so every existing document renders byte-identically.
      p.cap = node.cap ?? 'butt';
      break;
    case 'rect':
      p.width = node.w ?? 0;
      p.height = node.h ?? 0;
      p.cornerRadius = node.cornerRadius ?? 0;
      break;
    case 'text':
      p.text = node.text ?? '';
      p.fontSize = node.size ?? 16;
      p.fontStyle = normalizeFontStyle(node.fontStyle ?? 'normal');
      // Defaults are the pen origin, which is what every document written
      // before these existed already assumes.
      p.align = node.align ?? 'left';
      p.valign = node.valign ?? 'top';
      break;
    case 'stroke':
      p.points = [...(node.points ?? [])];
      p.tension = node.tension ?? 0;
      p.closed = node.closed ?? false;
      if (node.dash) p.dash = [...node.dash];
      break;
    case 'image':
      // Takes whichever shape it was given — circle, ellipse or rect — because
      // that shape is also the crop.
      p.radius = node.r ?? 0;
      p.radiusX = node.rx ?? 0;
      p.radiusY = node.ry ?? 0;
      p.width = node.w ?? 0;
      p.height = node.h ?? 0;
      p.cornerRadius = node.cornerRadius ?? 0;
      p.src = node.src ?? '';
      p.fit = node.fit ?? 'cover';
      break;
    default:
      throw new Error(`scene: unknown node type "${node.type as string}"`);
  }
  return h;
}

function resolveContainer(container: unknown): HTMLElement | null {
  if (!container) return null;
  if (typeof container === 'string') {
    return typeof document === 'undefined' ? null : document.getElementById(container);
  }
  if (typeof HTMLElement !== 'undefined' && container instanceof HTMLElement) return container;
  return null;
}

/** Re-exported so the headless path can reach arc-length helpers. */
export { arcLengths };
