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
   * Plays a guided stroke drawing itself, then clears it for the user — the
   * "watch how, now you try" beat. Resolves when the stroke is ready to trace.
   * Defaults to the stroke the user is about to draw, so a multi-stroke letter
   * calls it once per stroke. No-ops (resolved) on a doc with no `guided` block.
   */
  demoGuided(opts?: {
    index?: number;
    durationMs?: number;
    holdMs?: number;
    /** Leave the finished stroke on the canvas, so a letter can be demonstrated
     *  stroke by stroke as one accumulating letter. Pair with `resetGuided`. */
    keepInk?: boolean;
  }): Promise<void>;
  /** Stops a demo in flight and hands control back to the pointer. */
  cancelGuidedDemo(): void;
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
  className?: string;
  style?: CSSProperties;
}

export const Glamour = forwardRef<GlamourHandle, GlamourProps>(function Glamour(
  { doc, onEmit, onStroke, onPointer, onGuided, className, style },
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

    const player = renderGlamour(doc, mount);
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
  }, [doc]);

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
      // Resolves rather than rejects when there is no player yet (the canvas is
      // client-only, so a host may call this before mount): an awaiting caller
      // should proceed to "now you try", not hang or throw.
      demoGuided: (opts) => playerRef.current?.demoGuided(opts) ?? Promise.resolve(),
      cancelGuidedDemo: () => playerRef.current?.cancelGuidedDemo(),
      resetGuided: () => playerRef.current?.resetGuided(),
    }),
    [],
  );

  return <div ref={mountRef} className={className} style={style} />;
});
