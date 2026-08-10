import { loopValueAt, Wander, konvaMethodFor, clampPropValue, type GlamDoc } from '@glamour-labs/core';

// Node handles are structurally typed — the scene generates its accessors, so a
// concrete interface here would just duplicate @glamour-labs/core's.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NodeLike = any;
/** Only `draw()` is needed; @glamour-labs/core's LayerShim satisfies it. */
interface Drawable {
  draw(): void;
}

/**
 * Drives `doc.loops`/`doc.wander` every animation frame, writing eased values
 * straight onto the node handles in `byId`, then redrawing the layer.
 *
 * v2 owns its own rAF ticker (v1 delegated to `Konva.Animation`). `tick(time)`
 * stays a real method so tests can drive it with injected timestamps instead of
 * depending on real rAF timing, and `play()` gates it on an internal `playing`
 * flag so a manual tick while paused is a no-op — same contract as before.
 */
export class RunLoop {
  private readonly doc: GlamDoc;
  private readonly byId: Record<string, NodeLike>;
  private readonly wanderControllers: { target: string; controller: Wander }[];
  private readonly layer: Drawable;
  private raf: number | null = null;
  private startTime: number | null = null;
  private playing = false;
  private destroyed = false;

  constructor(doc: GlamDoc, byId: Record<string, NodeLike>, layer: Drawable) {
    this.doc = doc;
    this.byId = byId;
    this.layer = layer;
    this.wanderControllers = (doc.wander ?? []).map((w) => ({
      target: w.target,
      controller: new Wander(w, Math.random),
    }));
  }

  private frame = (time: number): void => {
    this.raf = null;
    if (this.destroyed || !this.playing) return;
    this.tick(time);
    this.layer.draw();
    this.schedule();
  };

  private schedule(): void {
    if (this.raf !== null || this.destroyed || !this.playing) return;
    if (typeof requestAnimationFrame !== 'function') return;
    this.raf = requestAnimationFrame(this.frame);
  }

  private cancel(): void {
    if (this.raf !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.raf);
    }
    this.raf = null;
  }

  /** The frame callback. Exposed as a real method so tests can drive it directly. */
  tick(time: number): void {
    if (this.destroyed || !this.playing) return;
    if (this.startTime === null) this.startTime = time;
    const elapsed = time - this.startTime;

    for (const loop of this.doc.loops ?? []) {
      const target = this.byId[loop.node];
      if (!target) continue;
      const method = konvaMethodFor(loop.prop);
      // Clamp radius-family props: overshoot easings can undershoot below 0,
      // and a negative canvas radius throws.
      (target[method] as (v: number) => void)(clampPropValue(loop.prop, loopValueAt(loop, elapsed)));
    }

    for (const { target: targetId, controller } of this.wanderControllers) {
      const target = this.byId[targetId];
      if (!target) continue;
      const p = controller.valueAt(elapsed);
      target.x(p.x);
      target.y(p.y);
    }
  }

  play(): void {
    // No-op once destroyed — otherwise this would restart the ticker against a
    // scene that has already been torn down.
    if (this.destroyed) return;
    this.playing = true;
    this.schedule();
  }

  pause(): void {
    this.playing = false;
    this.cancel();
  }

  destroy(): void {
    this.destroyed = true;
    this.playing = false;
    this.cancel();
  }
}

/** True when the doc has any continuous motion (loops or wander) to animate. */
export function hasMotion(doc: GlamDoc): boolean {
  return (doc.loops?.length ?? 0) > 0 || (doc.wander?.length ?? 0) > 0;
}
