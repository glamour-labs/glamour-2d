export type NodeType = 'circle' | 'rect' | 'text' | 'ellipse' | 'arc' | 'stroke' | 'image';

// v1.1: `backInOut` (spring overshoot) + `elasticOut` (settle-with-wobble) join
// the base four. Both intentionally overshoot the 0..1 range mid-curve — that
// overshoot IS the effect for loops/tweens, not a bug.
export type Ease = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'backInOut' | 'elasticOut';

/**
 * v1.1 paint: a declarative gradient fill. When present it takes precedence
 * over the flat `fill` (the scene sets Konva's fillPriority accordingly).
 * Points are in the node's LOCAL coordinate space — for a circle/ellipse/arc
 * the origin is the node's center; for a rect it is the top-left corner.
 */
export interface GlamGradient {
  type: 'linear' | 'radial';
  /** >= 2 stops; each offset in [0,1], ascending by convention. */
  stops: { offset: number; color: string }[];
  from?: { x: number; y: number }; // linear start (default {0,0})
  to?: { x: number; y: number }; // linear end (required for linear)
  center?: { x: number; y: number }; // radial center (default {0,0})
  startRadius?: number; // radial inner radius (default 0)
  endRadius?: number; // radial outer radius (required for radial)
}

export interface GlamNode {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  r?: number; // circle
  w?: number; // rect
  h?: number; // rect
  rx?: number; // ellipse: horizontal radius
  ry?: number; // ellipse: vertical radius
  innerRadius?: number; // arc: inner radius (0 = pie/wedge)
  outerRadius?: number; // arc: outer radius
  angle?: number; // arc: sweep angle in degrees
  cornerRadius?: number; // rect: rounded-corner radius
  points?: number[]; // stroke: flat [x0,y0,x1,y1,...] polyline (Rung 2 ink)
  tension?: number; // stroke: line smoothing (0 = straight segments)
  closed?: boolean; // stroke: connect last point back to first
  dash?: number[]; // stroke: dash pattern [dashLen, gapLen, ...] (omit = solid)
  text?: string; // text
  src?: string; // image: URL or data: URI, loaded asynchronously
  fit?: 'cover' | 'contain' | 'fill'; // image: how it fills the node's shape
  cap?: 'butt' | 'round'; // arc: end shape of the band
  size?: number; // text
  fontStyle?: string; // text: 'normal' | 'bold' | 'italic' | 'italic bold'
  fontFamily?: string; // text: family name; falls back to sans-serif
  align?: 'left' | 'center' | 'right'; // text: which part of the line sits on x
  valign?: 'top' | 'middle' | 'bottom'; // text: which part of the line sits on y
  fill?: string;
  fillGradient?: GlamGradient; // v1.1: gradient fill (overrides flat fill)
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  rotation?: number;
  // v1.1 glow/shadow (only painted when shadowColor is set):
  shadowColor?: string;
  shadowBlur?: number;
  shadowOpacity?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  group?: string; // v0.1: id of a declared GlamGroup this node belongs to
  emit?: string; // v0.1: host event name fired on click
}

/** v0.1: continuous auto-playing motion on a single numeric node prop. */
export interface GlamLoop {
  node: string;
  prop: string;
  from: number;
  to: number;
  ms: number; // full round-trip period
  mode?: 'loop' | 'alternate'; // default 'loop'
  ease?: Ease; // default 'linear'
}

/** v0.1: free drift to random points within an ellipse. */
export interface GlamWander {
  target: string; // node OR group id
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  stepMs: number;
  ease?: Ease; // default 'easeInOut'
}

/** v0.1: a Konva.Group; children opt in via node.group. */
export interface GlamGroup {
  id: string;
  x: number;
  y: number;
}

export interface GlamState {
  set?: Record<string, number | string>;
  on?: Record<string, string>;
}

export interface GlamMachine {
  initial: string;
  states: Record<string, GlamState>;
  transition?: { ms: number; ease?: Ease };
}

export interface GlamBind {
  node: string;
  prop: string;
  expr: string;
}

/**
 * Rung 2: makes the canvas drawable. The player captures pointer drags and
 * inks them into the `into` stroke node (live, on the canvas). On stroke end it
 * fires `emit` to host `onStroke` listeners with the drawn points — and, when
 * `match` is set, a trace-match score the host uses to judge the attempt. Game
 * logic (pass/fail, scoring) stays in the host; the canvas only draws + scores.
 */
/** Rung 2: a `match` target — the flat [x,y,...] path the user should trace, in
 * the ink node's LOCAL coordinate space (drawn points are stored there too, so
 * they line up), plus the px radius a drawn point may deviate and still count. */
export interface GlamInkMatch {
  target: number[];
  tolerance: number;
}

/** Rung 2 (multi-stroke): one pen-stroke of a letter written with pen lifts.
 * Each stroke inks into its OWN `stroke` node, so finished strokes persist on
 * the canvas (they accumulate) instead of the next pen-down erasing them. */
export interface GlamInkStroke {
  into: string; // id of the `stroke` node THIS pen-stroke draws into
  emit?: string; // host event fired when this stroke ends (falls back to ink.emit)
  match?: GlamInkMatch; // optional per-stroke trace target
}

export interface GlamInk {
  // Single-stroke (the next pen-down clears and redraws the same node):
  into?: string; // id of the `stroke` node the drag draws into
  // Multi-stroke, "write like on paper" — an ordered list of pen-strokes, each
  // committed to its own node so they accumulate; the player advances one step
  // per pen-up and flags `done` on the last. Exactly one of `into`/`strokes`.
  strokes?: GlamInkStroke[];
  emit?: string; // host event name fired on stroke end
  match?: GlamInkMatch; // single-stroke trace target (used with `into`)
}

/**
 * Guided ink (general, not letter-specific): the user grabs a handle and drags
 * it ALONG an authored `path`; the player trims a single `into` stroke to how
 * far they've pulled (perfect, snapped ink) and reports progress. The drag
 * mechanics live in the player; presentation (revealing the next stroke's guide,
 * celebration) stays in the host, via `onGuided`/`emit` — same motion-vs-logic
 * split as `ink`. Works for any shape: a letter, a number, a check, a signature.
 */
export interface GlamGuidedStroke {
  path: number[]; // flat [x,y,...] the drag follows (arc-projected); >= 2 points
  into: string; // a `stroke` node the player TRIMS to progress (the drawn ink)
  handle?: string; // node moved to the live ink tip (the draggable puck)
  arrow?: string; // node rotated to the path's tangent at the tip
}
export interface GlamGuided {
  strokes: GlamGuidedStroke[]; // >= 1; drawn in order
  grab?: number; // px radius to grab the handle (default 44)
  emit?: string; // host event fired when a stroke completes
}

export interface GlamDoc {
  schema: 'glamour/v0' | 'glamour/v0.1';
  canvas: { w: number; h: number; bg?: string };
  /**
   * Default text family for every text node that does not name its own. The
   * page must provide the face (self-hosted or system); the document only names
   * it. Omitted falls back to the renderer's last-resort family.
   */
  fontFamily?: string;
  inputs?: Record<string, number | string>;
  nodes: GlamNode[];
  bind?: GlamBind[];
  machine?: GlamMachine;
  groups?: GlamGroup[]; // v0.1
  loops?: GlamLoop[]; // v0.1
  wander?: GlamWander[]; // v0.1
  ink?: GlamInk; // Rung 2: pointer-drawn ink + optional trace-matching
  guided?: GlamGuided; // guided ink: drag a handle along an authored path
}
