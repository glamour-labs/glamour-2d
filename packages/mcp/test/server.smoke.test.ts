import { describe, expect, test } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../src/server.js';
import { TOOL_NAMES } from '../src/tools.js';

async function connectedClient() {
  const server = createServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '0.0.1' });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return { client, server };
}

describe('glam-mcp server (in-memory transport)', () => {
  test('lists all registered tools', async () => {
    const { client } = await connectedClient();
    const { tools } = await client.listTools();
    expect(tools.length).toBeGreaterThanOrEqual(11);
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual([...TOOL_NAMES].sort());
  });

  test('calling validate on a known-bad doc returns an error result', async () => {
    const { client } = await connectedClient();

    await client.callTool({ name: 'new_scene', arguments: { w: 100, h: 100 } });
    await client.callTool({
      name: 'add_node',
      arguments: { node: { id: 'a', type: 'circle', x: 0, y: 0, r: 1 } },
    });
    // Dangling bind: references a node that doesn't exist -> validate should fail.
    await client.callTool({
      name: 'add_binding',
      arguments: { bind: { node: 'ghost', prop: 'r', expr: '1' } },
    });

    const result = await client.callTool({ name: 'validate', arguments: {} });
    expect(result.isError).toBe(true);
  });

  test('the happy-path validate call is not an error', async () => {
    const { client } = await connectedClient();
    await client.callTool({ name: 'new_scene', arguments: { w: 100, h: 100 } });
    const result = await client.callTool({ name: 'validate', arguments: {} });
    expect(result.isError).toBeFalsy();
  });
});
