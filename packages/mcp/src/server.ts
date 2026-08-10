import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { GlamDoc } from '@glamour-labs/core';
import { callTool, type ToolName } from './tools.js';

// DEFER (v2): these zod shapes restate @glamour-labs/core's schema.ts by hand; core
// remains the source of truth for the GlamDoc shape — see FIX-LIST.md.
const glamNodeShape = {
  id: z.string(),
  type: z.enum(['circle', 'rect', 'text']),
  x: z.number(),
  y: z.number(),
  r: z.number().optional(),
  w: z.number().optional(),
  h: z.number().optional(),
  text: z.string().optional(),
  size: z.number().optional(),
  fill: z.string().optional(),
  stroke: z.string().optional(),
  strokeWidth: z.number().optional(),
  opacity: z.number().optional(),
  rotation: z.number().optional(),
} as const;

const glamStateShape = {
  set: z.record(z.union([z.number(), z.string()])).optional(),
  on: z.record(z.string()).optional(),
} as const;

const glamBindShape = {
  node: z.string(),
  prop: z.string(),
  expr: z.string(),
} as const;

/** Zod input shapes for every registered tool, keyed by tool name. */
const inputShapes = {
  new_scene: { w: z.number(), h: z.number(), bg: z.string().optional() },
  add_node: { node: z.object(glamNodeShape) },
  set_props: { id: z.string(), props: z.object(glamNodeShape).partial() },
  define_state: { name: z.string(), state: z.object(glamStateShape) },
  set_initial: { name: z.string() },
  add_binding: { bind: z.object(glamBindShape) },
  set_input: { name: z.string(), value: z.union([z.number(), z.string()]) },
  apply_primitive: {
    name: z.enum(['hoverGrow', 'clickToggle', 'progressBar', 'fadeIn']),
    args: z.array(z.unknown()).optional(),
  },
  validate: {},
  list_primitives: {},
  render_preview: { state: z.string().optional() },
} as const;

const descriptions: Record<ToolName, string> = {
  new_scene: 'Start a new glamour/v0 document with the given canvas size.',
  add_node: 'Add a node (circle/rect/text) to the current scene.',
  set_props: 'Patch properties on an existing node.',
  define_state: 'Define (or replace) a named machine state.',
  set_initial: 'Set the machine\'s initial state.',
  add_binding: 'Bind a node property to an expression over inputs.',
  set_input: 'Set an input value on the current document.',
  apply_primitive: 'Apply a named palette primitive (hoverGrow, clickToggle, progressBar, fadeIn) to a node.',
  validate: 'Validate the current document (schema + semantic checks).',
  list_primitives: 'List the available palette primitives and their signatures.',
  render_preview: 'Render the current document (optionally a named state) to a PNG and return it as base64.',
};

/**
 * Builds an `@glamour-labs/mcp` server. Session state (the in-progress `GlamDoc`) is
 * held in a closure so each tool call sees the result of the previous one —
 * mirroring a single authoring session.
 */
export function createServer(): McpServer {
  const server = new McpServer({ name: 'glam-mcp', version: '0.1.0' });
  let sessionDoc: GlamDoc | null = null;

  for (const name of Object.keys(inputShapes) as ToolName[]) {
    server.registerTool(
      name,
      { description: descriptions[name], inputSchema: inputShapes[name] },
      async (args: Record<string, unknown>): Promise<CallToolResult> => {
        try {
          const { doc, result } = await callTool(name, args, sessionDoc);
          sessionDoc = doc;

          const isErrorResult =
            typeof result === 'object' && result !== null && 'ok' in result && (result as { ok: boolean }).ok === false;

          const content: CallToolResult['content'] = [{ type: 'text', text: JSON.stringify(result) }];
          if (name === 'render_preview' && typeof result === 'object' && result !== null && 'png' in result) {
            content.push({ type: 'image', data: (result as { png: string }).png, mimeType: 'image/png' });
          }

          return { content, isError: isErrorResult };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return { content: [{ type: 'text', text: message }], isError: true };
        }
      },
    );
  }

  return server;
}
