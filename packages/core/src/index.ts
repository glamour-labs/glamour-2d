export type {
  NodeType,
  Ease,
  GlamGradient,
  GlamNode,
  GlamState,
  GlamMachine,
  GlamBind,
  GlamDoc,
  GlamLoop,
  GlamWander,
  GlamGroup,
  GlamInk,
} from './types.js';
export { getImage, peekImage, clearImageCache, fitBox } from './gl/image.js';
export type { ImageRecord, ImageState, ImageFit } from './gl/image.js';
export { traceMatch } from './trace.js';
export type { TraceResult } from './trace.js';
export { glamSchema, parseDoc } from './schema.js';
export type { ParseResult } from './schema.js';
export { validate } from './validate.js';
export type { ValidateResult } from './validate.js';
export { evalExpr, evalCondition, splitCondition } from './expr.js';
export type { ConditionOp, SplitCondition } from './expr.js';
export { classifyOnKey } from './onkey.js';
export type { OnKeyClassification } from './onkey.js';
export { applyOps } from './ops.js';
export type { Op } from './ops.js';
export { palette, listPrimitives } from './palette.js';
export { starterDoc } from './starterDoc.js';
export {
  buildScene,
  PROP_TO_METHOD,
  PROP_TO_KONVA_METHOD,
  methodFor,
  konvaMethodFor,
  clampPropValue,
  NON_NEGATIVE_PROPS,
  StageShim,
  LayerShim,
  applyEaseForTest,
} from './scene.js';
export type { SceneHandle, GlamNodeHandle, NodeHandle, BuildSceneOpts } from './scene.js';
// NOTE: `renderToPNG` is no longer exported from core. The WebGL backend has no
// in-process rasterizer, so headless render lives in `@glamour-labs/player/node`, which
// drives a real browser. See docs/V2-RENDERER.md.
export { loopValueAt, Wander } from './motion.js';
