import { z } from 'zod';
import type { GlamDoc } from './types.js';

const nodeTypeSchema = z.enum(['circle', 'rect', 'text', 'ellipse', 'arc', 'stroke', 'image']);

const gradientSchema = z.object({
  type: z.enum(['linear', 'radial']),
  stops: z
    .array(z.object({ offset: z.number(), color: z.string() }))
    .min(2),
  from: z.object({ x: z.number(), y: z.number() }).optional(),
  to: z.object({ x: z.number(), y: z.number() }).optional(),
  center: z.object({ x: z.number(), y: z.number() }).optional(),
  startRadius: z.number().optional(),
  endRadius: z.number().optional(),
});

const nodeSchema = z.object({
  id: z.string().min(1),
  type: nodeTypeSchema,
  x: z.number(),
  y: z.number(),
  r: z.number().optional(),
  w: z.number().optional(),
  h: z.number().optional(),
  rx: z.number().optional(),
  ry: z.number().optional(),
  innerRadius: z.number().optional(),
  outerRadius: z.number().optional(),
  angle: z.number().optional(),
  cornerRadius: z.number().optional(),
  points: z.array(z.number()).optional(),
  tension: z.number().optional(),
  closed: z.boolean().optional(),
  dash: z.array(z.number()).optional(),
  text: z.string().optional(),
  /**
   * Image source (`image` nodes). A URL or a data: URI — it is handed to an
   * `Image`, so anything the browser can decode works, and it is loaded
   * asynchronously: a node whose source has not arrived draws nothing yet.
   */
  src: z.string().optional(),
  /**
   * How the picture fills the node's own geometry. `cover` crops the overflow
   * against the node's shape, `contain` fits the whole picture inside it, and
   * `fill` stretches. Defaults to `cover`.
   */
  fit: z.enum(['cover', 'contain', 'fill']).optional(),
  /**
   * End shape of an `arc` band. `butt` (the default, and what every existing
   * document gets) leaves the square ends the band has always had; `round`
   * caps each end with a disc so the band tapers, which is what a highlight or
   * a progress sweep usually wants.
   */
  cap: z.enum(['butt', 'round']).optional(),
  size: z.number().optional(),
  fontStyle: z.string().optional(),
  fill: z.string().optional(),
  fillGradient: gradientSchema.optional(),
  stroke: z.string().optional(),
  strokeWidth: z.number().optional(),
  opacity: z.number().optional(),
  rotation: z.number().optional(),
  shadowColor: z.string().optional(),
  shadowBlur: z.number().optional(),
  shadowOpacity: z.number().optional(),
  shadowOffsetX: z.number().optional(),
  shadowOffsetY: z.number().optional(),
  group: z.string().optional(),
  emit: z.string().optional(),
});

const easeSchema = z.enum([
  'linear',
  'easeIn',
  'easeOut',
  'easeInOut',
  'backInOut',
  'elasticOut',
]);

const loopSchema = z.object({
  node: z.string(),
  prop: z.string(),
  from: z.number(),
  to: z.number(),
  ms: z.number(),
  mode: z.enum(['loop', 'alternate']).optional(),
  ease: easeSchema.optional(),
});

const wanderSchema = z.object({
  target: z.string(),
  cx: z.number(),
  cy: z.number(),
  rx: z.number(),
  ry: z.number(),
  stepMs: z.number(),
  ease: easeSchema.optional(),
});

const groupSchema = z.object({
  id: z.string().min(1),
  x: z.number(),
  y: z.number(),
});

const stateSchema = z.object({
  set: z.record(z.union([z.number(), z.string()])).optional(),
  on: z.record(z.string()).optional(),
});

const machineSchema = z.object({
  initial: z.string(),
  states: z.record(stateSchema),
  transition: z
    .object({
      ms: z.number(),
      ease: easeSchema.optional(),
    })
    .optional(),
});

const bindSchema = z.object({
  node: z.string(),
  prop: z.string(),
  expr: z.string(),
});

const inkMatchSchema = z.object({
  target: z.array(z.number()),
  tolerance: z.number(),
});
const inkStrokeSchema = z.object({
  into: z.string(),
  emit: z.string().optional(),
  match: inkMatchSchema.optional(),
});
const inkSchema = z.object({
  into: z.string().optional(),
  strokes: z.array(inkStrokeSchema).optional(),
  emit: z.string().optional(),
  match: inkMatchSchema.optional(),
});
const guidedStrokeSchema = z.object({
  path: z.array(z.number()),
  into: z.string(),
  handle: z.string().optional(),
  arrow: z.string().optional(),
});
const guidedSchema = z.object({
  strokes: z.array(guidedStrokeSchema),
  grab: z.number().optional(),
  emit: z.string().optional(),
});

export const glamSchema: z.ZodType<GlamDoc> = z.object({
  schema: z.union([z.literal('glamour/v0'), z.literal('glamour/v0.1')]),
  canvas: z.object({
    w: z.number(),
    h: z.number(),
    bg: z.string().optional(),
  }),
  inputs: z.record(z.union([z.number(), z.string()])).optional(),
  nodes: z.array(nodeSchema),
  bind: z.array(bindSchema).optional(),
  machine: machineSchema.optional(),
  groups: z.array(groupSchema).optional(),
  loops: z.array(loopSchema).optional(),
  wander: z.array(wanderSchema).optional(),
  ink: inkSchema.optional(),
  guided: guidedSchema.optional(),
}) satisfies z.ZodType<GlamDoc>;

export type ParseResult =
  | { ok: true; doc: GlamDoc }
  | { ok: false; errors: string[] };

export function parseDoc(json: unknown): ParseResult {
  const result = glamSchema.safeParse(json);
  if (result.success) {
    return { ok: true, doc: result.data };
  }
  const errors = result.error.issues.map((issue) => {
    const path = issue.path.join('.');
    return path ? `${path}: ${issue.message}` : issue.message;
  });
  return { ok: false, errors };
}
