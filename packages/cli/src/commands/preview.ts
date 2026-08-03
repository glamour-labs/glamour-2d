import { readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { validate, type GlamDoc } from '@glam/core';
import { exportInlineHTML } from '@glam/player/node';

export interface PreviewHandle {
  url: string;
  close: () => Promise<void>;
}

/**
 * Reads a `.glam` file, starts a local HTTP server on an ephemeral port
 * serving `exportInlineHTML(doc)` at `/`, and resolves to a handle with the
 * URL and a `.close()` to shut the server down.
 */
export async function previewCommand(filePath: string): Promise<PreviewHandle> {
  const json: unknown = JSON.parse(readFileSync(filePath, 'utf8'));

  const result = validate(json);
  if (!result.ok) {
    throw new Error(`previewCommand: invalid doc: ${result.errors.join('; ')}`);
  }
  const doc = json as GlamDoc;

  const html = exportInlineHTML(doc);

  const server: Server = createServer((req, res) => {
    if (req.url === '/' || req.url === undefined) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as AddressInfo;
      const url = `http://127.0.0.1:${address.port}/`;
      resolve({
        url,
        close: () =>
          new Promise((res, rej) => {
            server.close((err) => (err ? rej(err) : res()));
          }),
      });
    });
  });
}
