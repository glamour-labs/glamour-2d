// Drive-and-assert harness — headless behavioral testing for ANY glamour.
//
// The reason this exists: Glamour's runtime is fully drivable and inspectable
// out of the box, so an agent (or CI) can exercise an interactive document the
// way a real user would — including *mid-interaction* ("half go": drag partway,
// then look) — and assert the outcome. That is the concrete thing Rive can't
// give an AI: not just "does it render", but "drive it, freeze it, check it".
//
// Scope: this tests everything OBJECTIVE — ink strokes + trace scores, ink
// accumulation, input-driven binds, machine transitions (via input/`@EVENT`),
// continuous `loops`/`wander`, and any node's live props at any instant. It does
// NOT judge *feel* (smooth / stuck / floaty) — that still needs a real device.
//
// Not draw-letter-specific: point it at any `.glam`.

import {
  renderGlamour,
  type GlamPlayer,
  type GlamStrokeEvent,
  type GlamEmitEvent,
  type GlamPointerEvent,
  type GlamGuidedEvent,
} from './player.js';
import type { GlamDoc } from '@glam/core';

/** A node's live, readable props at the moment of the call. */
export interface NodeSnapshot {
  x: number;
  y: number;
  opacity: number;
  rotation: number;
  /** present for `stroke` nodes (the live/guide polyline). */
  points?: number[];
}

export interface Harness {
  /** the underlying player, if you need something the harness doesn't wrap. */
  player: GlamPlayer;

  // ---- drive (chainable) ----
  /** pointer-down at canvas coords (starts a drag / a fresh ink stroke). */
  down(x: number, y: number): Harness;
  /** pointer-move to canvas coords (inks while a drag is active). */
  move(x: number, y: number): Harness;
  /** pointer-up (ends the drag → fires onStroke). Defaults to the last point. */
  up(x?: number, y?: number): Harness;
  /** FULL go: down → moves through every point → up. Returns the stroke event. */
  stroke(path: Array<[number, number]>): GlamStrokeEvent | undefined;
  /** HALF go: down → moves, but NO up. Leaves the interaction mid-drag so you
   *  can inspect the in-progress state. Call `up()` yourself to finish. */
  dragTo(path: Array<[number, number]>): Harness;
  /** drive an input (input-condition transitions + `bind` expressions). */
  setInput(name: string, value: number | string): Harness;
  /** fire a host `@EVENT` to the machine. */
  send(event: string): Harness;
  /** advance continuous motion (`loops`/`wander`) by `ms` of virtual time. */
  tick(ms: number): Harness;

  // ---- inspect (any instant) ----
  /** read a node's live props (or null if no such node). */
  node(id: string): NodeSnapshot | null;
  /** current machine state name (`''` if no machine). */
  state(): string;
  /** completed ink strokes, in order. */
  strokes: GlamStrokeEvent[];
  /** node `emit` clicks that bubbled up, in order. */
  emits: GlamEmitEvent[];
  /** raw pointer stream, in order. */
  pointers: GlamPointerEvent[];
  /** guided-ink progress events ({index, progress, done}), in order. */
  guided: GlamGuidedEvent[];
  /** the most recent completed stroke, if any. */
  lastStroke(): GlamStrokeEvent | undefined;
  /** empty the collected logs (strokes/emits/pointers). */
  clearLog(): Harness;

  // ---- lifecycle ----
  destroy(): void;
}

interface HarnessOpts {
  /** mount element (default: a fresh detached div appended to document.body). */
  mount?: HTMLElement;
}

// The player exposes non-enumerable test hooks; the harness is their sanctioned
// consumer (jsdom has no real pointer hit-testing, so we drive the entrypoint
// directly rather than dispatching DOM PointerEvents).
interface PlayerHooks {
  __pointer(type: 'down' | 'move' | 'up', x: number, y: number): void;
  __byId: Record<string, Konvaish>;
  __tick(time: number): void;
}
interface Konvaish {
  x(): number;
  y(): number;
  opacity(): number;
  rotation(): number;
  points?(): number[];
}

export function createHarness(doc: GlamDoc, opts: HarnessOpts = {}): Harness {
  const owned = !opts.mount;
  const mount = opts.mount ?? document.createElement('div');
  if (owned && typeof document !== 'undefined') document.body.appendChild(mount);

  const player = renderGlamour(doc, mount);
  const hooks = player as unknown as PlayerHooks;

  const strokes: GlamStrokeEvent[] = [];
  const emits: GlamEmitEvent[] = [];
  const pointers: GlamPointerEvent[] = [];
  const guided: GlamGuidedEvent[] = [];
  player.onStroke((e) => strokes.push(e));
  player.on((e) => emits.push(e));
  player.onPointer((e) => pointers.push(e));
  player.onGuided((e) => guided.push(e));

  let lastX = 0;
  let lastY = 0;
  let clock = 0;
  let clockStarted = false;

  const h: Harness = {
    player,
    strokes,
    emits,
    pointers,
    guided,

    down(x, y) {
      lastX = x;
      lastY = y;
      hooks.__pointer('down', x, y);
      return h;
    },
    move(x, y) {
      lastX = x;
      lastY = y;
      hooks.__pointer('move', x, y);
      return h;
    },
    up(x = lastX, y = lastY) {
      hooks.__pointer('up', x, y);
      return h;
    },
    stroke(path) {
      const before = strokes.length;
      const [x0, y0] = path[0];
      h.down(x0, y0);
      for (let i = 1; i < path.length; i++) h.move(path[i][0], path[i][1]);
      h.up();
      return strokes[before]; // the stroke this drag produced (if the doc inks)
    },
    dragTo(path) {
      const [x0, y0] = path[0];
      h.down(x0, y0);
      for (let i = 1; i < path.length; i++) h.move(path[i][0], path[i][1]);
      return h; // deliberately no up() — inspect mid-drag, finish with .up()
    },
    setInput(name, value) {
      player.setInput(name, value);
      return h;
    },
    send(event) {
      player.send(event);
      return h;
    },
    tick(ms) {
      if (!clockStarted) {
        player.play();
        hooks.__tick(0);
        clockStarted = true;
      }
      clock += ms;
      hooks.__tick(clock);
      return h;
    },

    node(id) {
      const k = hooks.__byId[id];
      if (!k) return null;
      return {
        x: k.x(),
        y: k.y(),
        opacity: k.opacity(),
        rotation: k.rotation(),
        points: typeof k.points === 'function' ? [...k.points()] : undefined,
      };
    },
    state() {
      return player.getState();
    },
    lastStroke() {
      return strokes[strokes.length - 1];
    },
    clearLog() {
      strokes.length = 0;
      emits.length = 0;
      pointers.length = 0;
      guided.length = 0;
      return h;
    },

    destroy() {
      player.destroy();
      if (owned) mount.remove();
    },
  };
  return h;
}
