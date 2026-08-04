import { createActor, type Actor, type AnyStateMachine } from 'xstate';
import {
  buildScene,
  traceMatch,
  PROP_TO_METHOD,
  clampPropValue,
  type GlamDoc,
  type TraceResult,
} from '@glam/core';
import { toXState } from './machine.js';
import { RunLoop, hasMotion } from './loop.js';

export interface GlamEmitEvent {
  event: string;
  node: string;
}

/** Rung 2: a raw pointer sample in canvas (stage) coordinates. */
export interface GlamPointerEvent {
  type: 'down' | 'move' | 'up';
  x: number;
  y: number;
}

/** Rung 2: fires when a pointer-drawn ink stroke completes. */
export interface GlamStrokeEvent {
  /** doc.ink.emit (or the per-stroke emit), when the doc named one. */
  event?: string;
  /** the inked polyline, flat [x0,y0,x1,y1,...] in the ink node's local coords. */
  points: number[];
  /** present only when a match target is configured — the host judges pass/fail. */
  match?: TraceResult;
  /** multi-stroke only: which pen-stroke this was (0-based). */
  index?: number;
  /** multi-stroke only: true when this was the final pen-stroke of the letter. */
  done?: boolean;
}

/** Guided ink: fires as the user drags the handle along the authored path. */
export interface GlamGuidedEvent {
  /** which guided stroke (0-based). */
  index: number;
  /** how far along that stroke's path, 0..1. */
  progress: number;
  /** true when this stroke just completed (progress reached the end). */
  done: boolean;
}

export interface GlamPlayer {
  setInput(name: string, value: number | string): void;
  getState(): string;
  /** Forwards a host-sent event to the doc's machine (v0.1 "@EVENT" on-keys). */
  send(event: string): void;
  /**
   * Subscribes to node `emit` clicks (in addition to any machine transition
   * the click also causes). Returns an unsubscribe function.
   */
  on(cb: (e: GlamEmitEvent) => void): () => void;
  /** Starts/resumes the loops/wander run-loop. No-op if the doc has neither. */
  play(): void;
  /** Pauses the loops/wander run-loop. No-op if the doc has neither. */
  pause(): void;
  /**
   * Imperatively set one node's prop (the per-element half of "host drives the
   * canvas" — e.g. recolor a specific crab on a correct/wrong answer). Numeric
   * radius-family props are clamped to >= 0; an unknown node or prop is a no-op.
   */
  set(nodeId: string, prop: string, value: number | string): void;
  /**
   * Rung 2: subscribes to the raw pointer stream (down/move/up) in canvas
   * coordinates. Returns an unsubscribe function.
   */
  onPointer(cb: (e: GlamPointerEvent) => void): () => void;
  /**
   * Rung 2: subscribes to completed ink strokes (with a trace-match score when
   * doc.ink.match is set). Returns an unsubscribe function.
   */
  onStroke(cb: (e: GlamStrokeEvent) => void): () => void;
  /**
   * Guided ink: subscribes to drag-along-the-path progress ({index, progress,
   * done}) — the host uses it for presentation (reveal the next stroke, sparkle)
   * while the player owns the drag mechanics. Returns an unsubscribe function.
   */
  onGuided(cb: (e: GlamGuidedEvent) => void): () => void;
  destroy(): void;
}

export interface RenderGlamourOpts {
  /** Apply state `set` targets with zero-duration tweens (deterministic final frame). */
  instantTransitions?: boolean;
}

/** Node pointer event name -> the doc-facing event name (wired set only). */
const NODE_TO_DOC_EVENT: Record<string, string> = {
  click: 'click',
  mouseenter: 'hover',
  mouseleave: 'leave',
};

export function renderGlamour(
  doc: GlamDoc,
  mount: HTMLElement,
  opts: RenderGlamourOpts = {},
): GlamPlayer {
  const instant = opts.instantTransitions ?? false;
  const scene = buildScene(doc, mount);
  const inputs: Record<string, number | string> = { ...(doc.inputs ?? {}) };

  let actor: Actor<AnyStateMachine> | null = null;
  let eventForPointer: (nodeId: string, ev: string) => string | null = () => null;

  function applyStateEntry(stateName: string): void {
    const stateDef = doc.machine?.states[stateName];
    if (!stateDef?.set) return;
    const ms = instant ? 0 : (doc.machine?.transition?.ms ?? 0);
    const ease = doc.machine?.transition?.ease ?? 'linear';
    scene.applyStateSet(stateDef.set, ms, ease);
  }

  if (doc.machine) {
    const built = toXState(doc);
    eventForPointer = built.eventForPointer;
    actor = createActor(built.machine);
    actor.subscribe((snapshot) => {
      applyStateEntry(String(snapshot.value));
    });
    actor.start();
  }

  for (const [nodeId, node] of Object.entries(scene.byId)) {
    for (const [nodeEv, docEv] of Object.entries(NODE_TO_DOC_EVENT)) {
      node.on(nodeEv, () => {
        if (!actor) return;
        const type = eventForPointer(nodeId, docEv);
        if (type) actor.send({ type });
      });
    }
  }

  // v0.1: a node with `emit` fires host-registered `on` callbacks on click, in
  // addition to (not instead of) any machine transition the same click above
  // already causes.
  const emitListeners = new Set<(e: GlamEmitEvent) => void>();
  for (const node of doc.nodes) {
    if (!node.emit) continue;
    const target = scene.byId[node.id];
    if (!target) continue;
    const emitEvent = node.emit;
    target.on('click', () => {
      // Each listener is isolated: one throwing callback must not stop the
      // remaining listeners from firing, nor propagate into the scene's own
      // click dispatch (which would otherwise abort mid-handler).
      for (const cb of emitListeners) {
        try {
          cb({ event: emitEvent, node: node.id });
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('glam player: `on` listener threw', err);
        }
      }
    });
  }

  // v0.1: the live rAF run-loop for `doc.loops`/`doc.wander` — only built (and
  // auto-started) when the doc actually has continuous motion, so a v0 doc
  // (no loops/wander) behaves exactly as before (no ticker at all).
  const runLoop = hasMotion(doc) ? new RunLoop(doc, scene.byId, scene.layer) : null;
  runLoop?.play();

  // Rung 2: pointer stream + ink drawing. The canvas owns the live ink (drawing
  // into the `into` stroke node on drag — no per-point host round-trip); the
  // host owns the verdict (it gets the finished points + a trace score and
  // decides pass/fail). Coordinates are stage-space; ink points are stored in
  // the ink node's LOCAL space (subtracting its absolute position) so they paint
  // under the pointer regardless of where the node (or its group) is
  // TRANSLATED. A rotated/scaled ink node would need the full inverse transform
  // (getAbsoluteTransform().invert()); no such node ships today.
  const pointerListeners = new Set<(e: GlamPointerEvent) => void>();
  const strokeListeners = new Set<(e: GlamStrokeEvent) => void>();
  const ink = doc.ink;
  // Multi-stroke ("write like on paper"): an ordered list of pen-strokes, each
  // inking into its OWN node so finished strokes persist (accumulate) instead of
  // the next pen-down erasing them. Single-stroke (`into`) keeps its original
  // behaviour: every pen-down clears and redraws the same node.
  const inkStrokes = ink && ink.strokes && ink.strokes.length > 0 ? ink.strokes : null;
  const singleInkLine = ink && !inkStrokes && ink.into ? scene.byId[ink.into] : null;
  let strokeIdx = 0; // which pen-stroke is active (multi-stroke only)
  let drawing = false;

  // The node the current pen-stroke draws into: the indexed node in multi-stroke
  // mode (null once every stroke is done), else the single `into` node.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function activeInkLine(): any {
    if (inkStrokes) return strokeIdx < inkStrokes.length ? scene.byId[inkStrokes[strokeIdx].into] : null;
    return singleInkLine;
  }

  function fireIsolated<T>(listeners: Set<(e: T) => void>, e: T): void {
    for (const cb of listeners) {
      try {
        cb(e);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('glam player: pointer/stroke listener threw', err);
      }
    }
  }

  function appendInk(x: number, y: number): void {
    const line = activeInkLine();
    if (!line) return;
    const abs = line.getAbsolutePosition();
    const pts = line.points() as number[];
    line.points([...pts, x - abs.x, y - abs.y]);
    scene.layer.draw();
  }

  function finalizeStroke(): void {
    if (!ink) return;
    if (inkStrokes) {
      if (strokeIdx >= inkStrokes.length) return;
      const s = inkStrokes[strokeIdx];
      const line = scene.byId[s.into];
      if (!line) return;
      const points = [...(line.points() as number[])];
      const match = s.match ? traceMatch(s.match.target, points, s.match.tolerance) : undefined;
      fireIsolated<GlamStrokeEvent>(strokeListeners, {
        event: s.emit ?? ink.emit,
        points,
        index: strokeIdx,
        done: strokeIdx === inkStrokes.length - 1,
        ...(match ? { match } : {}),
      });
      strokeIdx += 1; // advance so the next pen-down starts the following stroke
      return;
    }
    if (!singleInkLine) return;
    const points = [...(singleInkLine.points() as number[])];
    const match = ink.match ? traceMatch(ink.match.target, points, ink.match.tolerance) : undefined;
    fireIsolated<GlamStrokeEvent>(strokeListeners, {
      event: ink.emit,
      points,
      ...(match ? { match } : {}),
    });
  }

  // ---- Guided ink (general): drag a handle along an authored path; the player
  // trims a single `into` stroke to how far the user pulled. No shape-specific
  // logic — the path is authored; the arrow follows the path's tangent. ----
  const guidedListeners = new Set<(e: GlamGuidedEvent) => void>();
  const guided = doc.guided;
  const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);
  const guidedInfos = guided
    ? guided.strokes.map((s) => {
        const P: Array<[number, number]> = [];
        for (let i = 0; i + 1 < s.path.length; i += 2) P.push([s.path[i], s.path[i + 1]]);
        const cum = [0];
        for (let i = 1; i < P.length; i++) cum[i] = cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
        return { s, P, cum, total: cum[cum.length - 1] || 1 };
      })
    : null;
  type GInfo = NonNullable<typeof guidedInfos>[number];
  const guidedGrab = guided?.grab ?? 44;
  let guidedIdx = 0;
  let guidedProgress = 0;
  let guidedDragging = false;

  function gAt(info: GInfo, t: number): [number, number] {
    const d = clamp01(t) * info.total;
    for (let i = 1; i < info.P.length; i++) {
      if (d <= info.cum[i] || i === info.P.length - 1) {
        const f = (d - info.cum[i - 1]) / (info.cum[i] - info.cum[i - 1] || 1);
        return [info.P[i - 1][0] + (info.P[i][0] - info.P[i - 1][0]) * f, info.P[i - 1][1] + (info.P[i][1] - info.P[i - 1][1]) * f];
      }
    }
    return info.P[0];
  }
  function gTangent(info: GInfo, t: number): number {
    const a = gAt(info, Math.max(0, t - 0.01));
    const b = gAt(info, Math.min(1, t + 0.02));
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    return dx || dy ? (Math.atan2(dy, dx) * 180) / Math.PI - 90 : 0;
  }
  function gProject(info: GInfo, px: number, py: number): number {
    const win = 52 / info.total; // short forward arc window — can't leap to a return pass
    const gate = 60; // finger must stay within this of the path to keep pulling (forgiving)
    let best = guidedProgress;
    let bd = Infinity;
    for (let k = 0; k <= 26; k++) {
      // Clamp rather than bail: on a path SHORTER than the 52px window, `win`
      // exceeds 1 and the raw samples step straight over the end — 0, 0.36,
      // 0.71, then break — so t=1 was never evaluated and progress saturated
      // below every completion gate. Any such stroke was unfinishable (the dot
      // on a lowercase `i` being the obvious one). Clamping guarantees the
      // endpoint is always in the sample set; for a long path this only means
      // the last sample lands exactly on 1 instead of just short of it.
      const t = Math.min(1, guidedProgress + (win * k) / 26);
      const p = gAt(info, t);
      const d = (p[0] - px) ** 2 + (p[1] - py) ** 2;
      if (d < bd) { bd = d; best = t; }
      if (t >= 1) break;
    }
    return bd <= gate * gate ? Math.max(guidedProgress, best) : guidedProgress;
  }
  function gPaint(info: GInfo, t: number): void {
    const line = scene.byId[info.s.into];
    if (line) {
      if (t <= 0) {
        line.points([]); // resting: no ink yet
      } else {
        const d = clamp01(t) * info.total;
        const out: number[] = [];
        for (let i = 0; i < info.P.length && info.cum[i] <= d; i++) out.push(info.P[i][0], info.P[i][1]);
        const tip = gAt(info, t);
        out.push(tip[0], tip[1]);
        line.points(out);
      }
    }
    const tip = gAt(info, t);
    if (info.s.handle) { const h = scene.byId[info.s.handle]; if (h) { h.x(tip[0]); h.y(tip[1]); } }
    if (info.s.arrow) { const a = scene.byId[info.s.arrow]; if (a) { a.x(tip[0]); a.y(tip[1]); a.rotation(gTangent(info, t)); } }
    scene.layer.draw();
  }
  function guidedComplete(): void {
    if (!guidedInfos || guidedIdx >= guidedInfos.length) return;
    const info = guidedInfos[guidedIdx];
    gPaint(info, 1);
    const wasLast = guidedIdx === guidedInfos.length - 1;
    fireIsolated<GlamGuidedEvent>(guidedListeners, { index: guidedIdx, progress: 1, done: true });
    if (guided?.emit) fireIsolated<GlamEmitEvent>(emitListeners, { event: guided.emit, node: info.s.into });
    guidedIdx += 1;
    guidedProgress = 0;
    guidedDragging = false;
    if (!wasLast) gPaint(guidedInfos[guidedIdx], 0); // seed next stroke's handle/arrow at its start
  }
  function guidedHandle(type: 'down' | 'move' | 'up', x: number, y: number): void {
    if (!guidedInfos || guidedIdx >= guidedInfos.length) return;
    const info = guidedInfos[guidedIdx];
    if (type === 'down') {
      const tip = gAt(info, guidedProgress);
      if ((x - tip[0]) ** 2 + (y - tip[1]) ** 2 <= guidedGrab * guidedGrab) guidedDragging = true;
    } else if (type === 'move') {
      if (!guidedDragging) return;
      guidedProgress = gProject(info, x, y);
      gPaint(info, guidedProgress);
      fireIsolated<GlamGuidedEvent>(guidedListeners, { index: guidedIdx, progress: guidedProgress, done: false });
      if (guidedProgress >= 0.985) guidedComplete(); // reached the end
    } else {
      if (!guidedDragging) return;
      guidedDragging = false;
      if (guidedProgress >= 0.9) guidedComplete(); // release near the end also completes
    }
  }

  function handlePointer(type: 'down' | 'move' | 'up', x: number, y: number): void {
    if (guided) {
      fireIsolated<GlamPointerEvent>(pointerListeners, { type, x, y });
      guidedHandle(type, x, y);
      return;
    }
    if (type === 'down') {
      drawing = true;
      const line = activeInkLine();
      if (line) line.points([]); // start a fresh stroke in the active node
      fireIsolated<GlamPointerEvent>(pointerListeners, { type, x, y });
      appendInk(x, y);
    } else if (type === 'move') {
      fireIsolated<GlamPointerEvent>(pointerListeners, { type, x, y });
      if (drawing) appendInk(x, y);
    } else {
      fireIsolated<GlamPointerEvent>(pointerListeners, { type, x, y });
      if (drawing) {
        finalizeStroke();
        drawing = false;
      }
    }
  }

  const pointerFromStage = (type: 'down' | 'move' | 'up') => (): void => {
    const p = scene.stage.getPointerPosition();
    if (p) handlePointer(type, p.x, p.y);
  };
  scene.stage.on('pointerdown', pointerFromStage('down'));
  scene.stage.on('pointermove', pointerFromStage('move'));
  scene.stage.on('pointerup', pointerFromStage('up'));

  function setInput(name: string, value: number | string): void {
    inputs[name] = value;
    scene.setInput(name, value);
    actor?.send({ type: 'INPUT', inputs: { ...inputs } });
  }

  function getState(): string {
    return actor ? String(actor.getSnapshot().value) : '';
  }

  function send(event: string): void {
    actor?.send({ type: event });
  }

  function on(cb: (e: GlamEmitEvent) => void): () => void {
    emitListeners.add(cb);
    return () => emitListeners.delete(cb);
  }

  function play(): void {
    runLoop?.play();
  }

  function pause(): void {
    runLoop?.pause();
  }

  function onPointer(cb: (e: GlamPointerEvent) => void): () => void {
    pointerListeners.add(cb);
    return () => pointerListeners.delete(cb);
  }

  function onStroke(cb: (e: GlamStrokeEvent) => void): () => void {
    strokeListeners.add(cb);
    return () => strokeListeners.delete(cb);
  }

  function onGuided(cb: (e: GlamGuidedEvent) => void): () => void {
    guidedListeners.add(cb);
    return () => guidedListeners.delete(cb);
  }

  function set(nodeId: string, prop: string, value: number | string): void {
    const target = scene.byId[nodeId];
    if (!target) return;
    const method = PROP_TO_METHOD[prop];
    // Accessors are generated on the handle, so reach them through a
    // string-keyed view rather than the declared interface.
    const acc = target as unknown as Record<string, (v: number | string) => void>;
    if (!method || typeof acc[method] !== 'function') return;
    const v = typeof value === 'number' ? clampPropValue(prop, value) : value;
    acc[method](v);
    scene.layer.draw();
  }

  function destroy(): void {
    runLoop?.destroy();
    actor?.stop();
    scene.destroy();
  }

  // Seed the guided resting frame: empty ink + handle/arrow at the first
  // stroke's start (so the doc reads right before the user touches it).
  if (guidedInfos && guidedInfos.length) gPaint(guidedInfos[0], 0);

  const player: GlamPlayer = {
    setInput,
    getState,
    send,
    on,
    play,
    pause,
    set,
    onPointer,
    onStroke,
    onGuided,
    destroy,
  };
  // Test-only hooks (not part of the public GlamPlayer contract):
  // - __byId: the built node handles, so tests can simulate pointer events
  //   deterministically (jsdom lacks real layout/hit-testing coordinates).
  // - __tick: the run-loop's frame callback, so tests can drive loop/wander
  //   advancement with injected timestamps instead of real rAF timing.
  Object.defineProperty(player, '__byId', { value: scene.byId, enumerable: false });
  Object.defineProperty(player, '__tick', {
    value: (time: number) => runLoop?.tick(time),
    enumerable: false,
  });
  // Rung 2 test hook: drive pointer handling with injected coords, since jsdom
  // has no real pointer positions for scene.stage.getPointerPosition().
  Object.defineProperty(player, '__pointer', {
    value: (type: 'down' | 'move' | 'up', x: number, y: number) => handlePointer(type, x, y),
    enumerable: false,
  });
  return player;
}
