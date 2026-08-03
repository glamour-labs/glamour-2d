/**
 * Headless render for the WebGL2 backend.
 *
 * v1 rendered in-process: Konva + the native `canvas` package rasterized a stage
 * straight to a PNG buffer. WebGL2 has no equivalent — `headless-gl` is
 * effectively unmaintained and would trade one native-ABI liability for a worse
 * one — so v2 drives a real headless Chromium instead.
 *
 * Two things that buys beyond just working:
 *   - it rasterizes with the SAME renderer that ships to users, so a headless
 *     PNG is evidence about production rather than about a second code path;
 *   - it removes the Node 20.19.4 pin the native `canvas` ABI forced on every
 *     session.
 *
 * The cost is honest: ~1-2s per render instead of instant, and Chromium must be
 * installed (`npx playwright install chromium`). The mandatory self-verify loop
 * in the cast-glamour skill is unaffected — `glam render` still emits a PNG.
 *
 * The page-side script mirrors v1's `renderToPNG` step for step: buildScene,
 * optionally `applyStateSet(state.set, 0, 'linear')`, then capture.
 */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate, type GlamDoc } from '@glam/core';

export interface RenderOpts {
  /** Apply a named machine state's `set` before capturing. */
  state?: string;
  /** Backing-store scale. 1 keeps output deterministic across machines. */
  dpr?: number;
}

interface ChromiumLike {
  launch(opts?: { args?: string[] }): Promise<BrowserLike>;
}
interface BrowserLike {
  newPage(opts?: {
    viewport: { width: number; height: number };
    deviceScaleFactor?: number;
  }): Promise<PageLike>;
  close(): Promise<void>;
}
interface PageLike {
  setContent(html: string, opts?: { waitUntil?: 'load' | 'domcontentloaded' }): Promise<void>;
  evaluate<T>(pageFunction: string): Promise<T>;
  close(): Promise<void>;
}

/**
 * Resolve the built UMD player bundle the page will load.
 *
 * Resolved relative to this module rather than via `require.resolve` on the
 * package name: the package's `exports` map deliberately does not expose
 * `./package.json`, so a name-based lookup throws ERR_PACKAGE_PATH_NOT_EXPORTED.
 * Two candidates because this file runs both bundled (`dist/node.js`, bundle is
 * a sibling) and straight from source under vitest (`src/`, bundle is `../dist`).
 */
function umdBundlePath(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(here, 'glam-player.umd.js'),
    path.join(here, '..', 'dist', 'glam-player.umd.js'),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(
    `renderToPNG: UMD bundle not found. Looked in:\n  ${candidates.join('\n  ')}\n`
    + 'Run `pnpm build` in the player package first.',
  );
}

async function loadChromium(): Promise<ChromiumLike> {
  try {
    const mod = (await import('playwright')) as unknown as { chromium: ChromiumLike };
    return mod.chromium;
  } catch {
    throw new Error(
      'renderToPNG: playwright is required for headless render in v2. '
      + 'Install it with `pnpm add -D playwright` then `npx playwright install chromium`.',
    );
  }
}

// Runs inside the page as a self-invoking expression.
//
// Arguments arrive via a JSON <script> tag rather than as an `evaluate` arg:
// Playwright only passes args to a real function, and a string pageFunction is
// evaluated as a bare expression (which silently returned undefined when this
// was first written). Reading a JSON tag is robust and, unlike interpolating the
// document into the script source, cannot break out of its context.
const PAGE_SCRIPT = `(async () => {
  const args = JSON.parse(document.getElementById('glam-args').textContent);
  const { doc, stateSet } = args;
  const G = window.Glam;
  if (!G || typeof G.buildScene !== 'function') throw new Error('UMD bundle missing buildScene');
  const mount = document.getElementById('mount');
  const scene = G.buildScene(doc, mount, { dpr: 1 });
  try {
    if (stateSet) scene.applyStateSet(stateSet, 0, 'linear');
    // Two frames so the scene's own draw has certainly flushed to the canvas.
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const canvas = mount.querySelector('canvas');
    if (!canvas) throw new Error('no canvas produced');
    return canvas.toDataURL('image/png');
  } finally {
    scene.destroy();
  }
})()`;

/**
 * Headless render → PNG buffer. Validates first, so an invalid doc fails with
 * the same message prefix v1 used rather than producing a blank image.
 */
export async function renderToPNG(doc: GlamDoc, opts: RenderOpts = {}): Promise<Buffer> {
  const result = validate(doc);
  if (!result.ok) {
    throw new Error(`renderToPNG: invalid doc: ${result.errors.join('; ')}`);
  }

  let stateSet: Record<string, number | string> | null = null;
  if (opts.state) {
    const state = doc.machine?.states[opts.state];
    if (!state) throw new Error(`renderToPNG: unknown state "${opts.state}"`);
    stateSet = state.set ?? null;
  }

  const chromium = await loadChromium();
  const bundle = await readFile(umdBundlePath(), 'utf8');

  const browser = await chromium.launch({
    // SwiftShader keeps WebGL2 available on machines with no usable GPU (CI).
    args: ['--enable-unsafe-swiftshader', '--hide-scrollbars'],
  });
  try {
    const page = await browser.newPage({
      viewport: { width: doc.canvas.w, height: doc.canvas.h },
      deviceScaleFactor: opts.dpr ?? 1,
    });
    // `<` escaped so no document string can close the script tag early.
    const argsJson = JSON.stringify({ doc, stateSet }).replace(/</g, '\\u003c');
    await page.setContent(
      '<!doctype html><meta charset="utf-8">'
      + '<style>html,body{margin:0;padding:0;background:transparent}</style>'
      + '<div id="mount"></div>'
      + `<script id="glam-args" type="application/json">${argsJson}</script>`
      + `<script>${bundle}</script>`,
      { waitUntil: 'load' },
    );

    let dataUrl: string;
    try {
      dataUrl = await page.evaluate<string>(PAGE_SCRIPT);
    } catch (err) {
      throw new Error(`renderToPNG: page evaluation failed: ${String(err)}`);
    }
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/png')) {
      throw new Error(`renderToPNG: page returned no PNG (got ${typeof dataUrl})`);
    }

    await page.close();
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
    return Buffer.from(base64, 'base64');
  } finally {
    await browser.close();
  }
}
