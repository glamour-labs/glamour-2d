import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';

export { createServer } from './server.js';
export { handlers, callTool, TOOL_NAMES } from './tools.js';
export type { ToolName, ToolResult } from './tools.js';

/**
 * `glam-mcp` bin entry: runs the server over stdio. Only executes when this
 * module is the process entry point, so importing `createServer` elsewhere
 * (tests, other adapters) never starts a transport as a side effect.
 */
async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
