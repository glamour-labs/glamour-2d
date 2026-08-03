import {
  applyOps,
  validate as coreValidate,
  palette,
  listPrimitives as coreListPrimitives,
  type GlamDoc,
  type GlamNode,
  type GlamState,
  type GlamBind,
  type Op,
  type ValidateResult,
} from '@glam/core';
// v2: headless render lives in the player (headless Chromium), not core.
import { renderToPNG } from '@glam/player/node';

/** Names of every MCP tool exposed over core, in registration order. */
export const TOOL_NAMES = [
  'new_scene',
  'add_node',
  'set_props',
  'define_state',
  'set_initial',
  'add_binding',
  'set_input',
  'apply_primitive',
  'validate',
  'list_primitives',
  'render_preview',
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

export interface ToolResult<T = unknown> {
  doc: GlamDoc | null;
  result: T;
}

export interface NewSceneArgs {
  w: number;
  h: number;
  bg?: string;
}

export interface AddNodeArgs {
  node: GlamNode;
}

export interface SetPropsArgs {
  id: string;
  props: Partial<GlamNode>;
}

export interface DefineStateArgs {
  name: string;
  state: GlamState;
}

export interface SetInitialArgs {
  name: string;
}

export interface AddBindingArgs {
  bind: GlamBind;
}

export interface SetInputArgs {
  name: string;
  value: number | string;
}

export type PrimitiveName = keyof typeof palette;

export interface ApplyPrimitiveArgs {
  name: PrimitiveName;
  args?: unknown[];
}

export type ValidateArgs = Record<string, never>;
export type ListPrimitivesArgs = Record<string, never>;

export interface RenderPreviewArgs {
  state?: string;
}

/** Maps each tool name to its JSON args shape. */
export interface ToolArgsMap {
  new_scene: NewSceneArgs;
  add_node: AddNodeArgs;
  set_props: SetPropsArgs;
  define_state: DefineStateArgs;
  set_initial: SetInitialArgs;
  add_binding: AddBindingArgs;
  set_input: SetInputArgs;
  apply_primitive: ApplyPrimitiveArgs;
  validate: ValidateArgs;
  list_primitives: ListPrimitivesArgs;
  render_preview: RenderPreviewArgs;
}

/** Maps each tool name to its result payload shape. */
export interface ToolResultMap {
  new_scene: { created: true };
  add_node: { added: string };
  set_props: { updated: string };
  define_state: { defined: string };
  set_initial: { initial: string };
  add_binding: { bound: GlamBind };
  set_input: { input: string; value: number | string };
  apply_primitive: { applied: string };
  validate: ValidateResult;
  list_primitives: ReturnType<typeof coreListPrimitives>;
  render_preview: { png: string };
}

export type ToolHandler<K extends ToolName> = (
  args: ToolArgsMap[K],
  doc: GlamDoc | null,
) => ToolResult<ToolResultMap[K]> | Promise<ToolResult<ToolResultMap[K]>>;

function requireDoc(doc: GlamDoc | null, tool: string): GlamDoc {
  if (!doc) {
    throw new Error(`${tool}: no active scene — call new_scene first`);
  }
  return doc;
}

export const handlers: { [K in ToolName]: ToolHandler<K> } = {
  new_scene(args) {
    const canvas = args.bg !== undefined ? { w: args.w, h: args.h, bg: args.bg } : { w: args.w, h: args.h };
    const doc: GlamDoc = { schema: 'glamour/v0', canvas, nodes: [] };
    return { doc, result: { created: true } };
  },

  add_node(args, doc) {
    const d = requireDoc(doc, 'add_node');
    const next = applyOps(d, [{ op: 'addNode', node: args.node }]);
    return { doc: next, result: { added: args.node.id } };
  },

  set_props(args, doc) {
    const d = requireDoc(doc, 'set_props');
    const next = applyOps(d, [{ op: 'setProps', id: args.id, props: args.props }]);
    return { doc: next, result: { updated: args.id } };
  },

  define_state(args, doc) {
    const d = requireDoc(doc, 'define_state');
    const next = applyOps(d, [{ op: 'defineState', name: args.name, state: args.state }]);
    return { doc: next, result: { defined: args.name } };
  },

  set_initial(args, doc) {
    const d = requireDoc(doc, 'set_initial');
    const next = applyOps(d, [{ op: 'setInitial', name: args.name }]);
    return { doc: next, result: { initial: args.name } };
  },

  add_binding(args, doc) {
    const d = requireDoc(doc, 'add_binding');
    const next = applyOps(d, [{ op: 'addBinding', bind: args.bind }]);
    return { doc: next, result: { bound: args.bind } };
  },

  set_input(args, doc) {
    const d = requireDoc(doc, 'set_input');
    const next = applyOps(d, [{ op: 'setInput', name: args.name, value: args.value }]);
    return { doc: next, result: { input: args.name, value: args.value } };
  },

  apply_primitive(args, doc) {
    const d = requireDoc(doc, 'apply_primitive');
    const fn = palette[args.name] as (...fnArgs: unknown[]) => Op[];
    if (typeof fn !== 'function') {
      throw new Error(`apply_primitive: unknown primitive "${String(args.name)}"`);
    }
    const ops = fn(...(args.args ?? []));
    const next = applyOps(d, ops);
    return { doc: next, result: { applied: args.name } };
  },

  validate(_args, doc) {
    const d = requireDoc(doc, 'validate');
    return { doc: d, result: coreValidate(d) };
  },

  list_primitives(_args, doc) {
    return { doc, result: coreListPrimitives() };
  },

  async render_preview(args, doc) {
    const d = requireDoc(doc, 'render_preview');
    const png = await renderToPNG(d, args.state ? { state: args.state } : {});
    return { doc: d, result: { png: png.toString('base64') } };
  },
};

/** Type-erased dispatch used by the server layer, which only has JSON args. */
export async function callTool(
  name: ToolName,
  args: unknown,
  doc: GlamDoc | null,
): Promise<ToolResult> {
  const handler = handlers[name] as (a: unknown, d: GlamDoc | null) => ToolResult | Promise<ToolResult>;
  return handler(args ?? {}, doc);
}
