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
  play(): void;
  pause(): void;
  getState(): string;
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
  className?: string;
  style?: CSSProperties;
}

export const Glamour = forwardRef<GlamourHandle, GlamourProps>(function Glamour(
  { doc, onEmit, onStroke, onPointer, className, style },
  ref,
) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<GlamPlayer | null>(null);

  // Keep the latest callbacks in a ref so a parent re-render that passes new
  // callback identities does NOT tear down and re-mount the canvas (which would
  // reset all animation/state). The subscriptions read through this ref.
  const cbs = useRef({ onEmit, onStroke, onPointer });
  cbs.current = { onEmit, onStroke, onPointer };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const player = renderGlamour(doc, mount);
    playerRef.current = player;

    const unsubs = [
      player.on((e) => cbs.current.onEmit?.(e)),
      player.onStroke((e) => cbs.current.onStroke?.(e)),
      player.onPointer((e) => cbs.current.onPointer?.(e)),
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
      play: () => playerRef.current?.play(),
      pause: () => playerRef.current?.pause(),
      getState: () => playerRef.current?.getState() ?? '',
    }),
    [],
  );

  return <div ref={mountRef} className={className} style={style} />;
});
