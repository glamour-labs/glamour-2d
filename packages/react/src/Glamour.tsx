import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type CSSProperties,
} from 'react';
import type { GlamDoc } from '@glamour-labs/core';
import {
  renderGlamour,
  type GlamPlayer,
  type GlamEmitEvent,
  type GlamGuidedEvent,
  type GlamPointerEvent,
  type GlamStrokeEvent,
} from '@glamour-labs/player';

/**
 * Imperative handle exposed via `ref` — the host drives the canvas through this
 * (send events, set inputs, play/pause the motion, read machine state). This is
 * the "host drives the canvas" half of the mission contract; the `on*` props are
 * the "host listens to the canvas" half. Game/scoring logic stays in the host.
 */
export interface GlamourHandle {
  send(event: string): void;
  setInput(name: string, value: number | string): void;
  /** Imperatively set one node's prop (e.g. recolor a specific element). */
  set(nodeId: string, prop: string, value: number | string): void;
  /** Apply many props across many nodes, repainting once. Use this instead of a
   *  run of `set` calls: each `set` repaints, and a burst of them can jank hard
   *  enough to swallow the pointer events an interaction depends on. */
  setMany(updates: Array<[string, string, number | string]>): void;
  play(): void;
  pause(): void;
  getState(): string;
  /**
   * Puts guided stroke `index` at progress `t` (0..1) — the painting half of the
   * drag, with the host supplying `t`. Drive it from a clock and the stroke writes
   * itself; the pacing, the hold and whether earlier strokes stay are the host's.
   * No-op mid-drag, out of range, or on a doc with no `guided` block.
   */
  setGuidedProgress(index: number, t: number): void;
  /** Accept or ignore pointer input on the guided path — turn it off while
   *  driving progress yourself, on again to hand over. */
  setGuidedInputEnabled(enabled: boolean): void;
  /** Clears every stroke's ink and returns to the first stroke, at rest. */
  resetGuided(): void;
}

export interface GlamourProps {
  /** The glamour document to render. Changing its identity re-mounts the canvas. */
  doc: GlamDoc;
  /** Fired when a node with `emit` is clicked. */
  onEmit?: (e: GlamEmitEvent) => void;
  /** Fired when a pointer-drawn ink stroke completes (Rung 2). */
  onStroke?: (e: GlamStrokeEvent) => void;
  /** Raw pointer stream in canvas coordinates (Rung 2). */
  onPointer?: (e: GlamPointerEvent) => void;
  /**
   * Guided ink: fires continuously as the user drags along an authored path
   * (`{index, progress, done}`). The player owns the drag mechanics; the host
   * uses this for presentation and for its own notion of "stroke finished" —
   * which is why a tracing host needs it and `onStroke` alone will not do
   * (`onStroke` reports raw ink at pen-up, and a guided doc has none).
   */
  onGuided?: (e: GlamGuidedEvent) => void;
  /**
   * Multisample the drawing buffer. Unset lets the renderer decide from the
   * buffer's own size — see `MSAA_PIXEL_BUDGET` in core.
   */
  antialias?: boolean;
  /**
   * Device pixels per document unit for the backing store. Defaults to the
   * window's own `devicePixelRatio`, which is right only when the canvas is
   * displayed at its document size. A host that CSS-scales the canvas down to
   * fit a box must multiply that scale in, or it pays for pixels the screen
   * cannot show — the player clamps the result to [1, 3].
   */
  dpr?: number;
  className?: string;
  style?: CSSProperties;
}

export const Glamour = forwardRef<GlamourHandle, GlamourProps>(function Glamour(
  { doc, onEmit, onStroke, onPointer, onGuided, antialias, dpr, className, style },
  ref,
) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<GlamPlayer | null>(null);

  // Keep the latest callbacks in a ref so a parent re-render that passes new
  // callback identities does NOT tear down and re-mount the canvas (which would
  // reset all animation/state). The subscriptions read through this ref.
  const cbs = useRef({ onEmit, onStroke, onPointer, onGuided });
  cbs.current = { onEmit, onStroke, onPointer, onGuided };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const player = renderGlamour(doc, mount, { antialias, dpr });
    playerRef.current = player;

    const unsubs = [
      player.on((e) => cbs.current.onEmit?.(e)),
      player.onStroke((e) => cbs.current.onStroke?.(e)),
      player.onPointer((e) => cbs.current.onPointer?.(e)),
      player.onGuided((e) => cbs.current.onGuided?.(e)),
    ];

    return () => {
      for (const u of unsubs) u();
      player.destroy();
      playerRef.current = null;
    };
    // `antialias` and `dpr` sit beside `doc` on purpose: both are settled when
    // the context is created, so changing either means building a new one.
  }, [doc, antialias, dpr]);

  useImperativeHandle(
    ref,
    () => ({
      send: (event) => playerRef.current?.send(event),
      setInput: (name, value) => playerRef.current?.setInput(name, value),
      set: (nodeId, prop, value) => playerRef.current?.set(nodeId, prop, value),
      setMany: (updates) => playerRef.current?.setMany(updates),
      play: () => playerRef.current?.play(),
      pause: () => playerRef.current?.pause(),
      getState: () => playerRef.current?.getState() ?? '',
      setGuidedProgress: (index, t) => playerRef.current?.setGuidedProgress(index, t),
      setGuidedInputEnabled: (on) => playerRef.current?.setGuidedInputEnabled(on),
      resetGuided: () => playerRef.current?.resetGuided(),
    }),
    [],
  );

  return <div ref={mountRef} className={className} style={style} />;
});
