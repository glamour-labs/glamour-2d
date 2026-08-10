import { readFileSync, writeFileSync } from 'node:fs';
import { type GlamDoc } from '@glamour-labs/core';
// v2: headless render moved to the player (headless Chromium) — the WebGL
// backend has no in-process rasterizer.
import { renderToPNG } from '@glamour-labs/player/node';

export interface RenderCommandOpts {
  state?: string;
}

/**
 * Reads a `.glam` file, renders it to a PNG via the player's headless `renderToPNG`, writes
 * the PNG to `outPath`, and returns the buffer.
 */
export async function renderCommand(
  filePath: string,
  outPath: string,
  opts: RenderCommandOpts = {},
): Promise<Buffer> {
  const doc = JSON.parse(readFileSync(filePath, 'utf8')) as GlamDoc;
  const png = await renderToPNG(doc, { state: opts.state });
  writeFileSync(outPath, png);
  return png;
}
