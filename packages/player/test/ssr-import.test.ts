import { expect, test } from 'vitest';

/**
 * Runs in the `node` project (see vitest.workspace.ts) — no DOM, deliberately.
 *
 * The entry point re-exports the `<glam-canvas>` element, and `class X extends
 * HTMLElement` resolves its superclass when the module loads. That made a bare
 * `import '@glamour-labs/player'` throw `ReferenceError: HTMLElement is not
 * defined` in any DOM-less runtime, which in practice meant every server render:
 * a Next.js page importing @glamour-labs/react died during SSR with an error
 * naming the bundler chunk rather than this file.
 *
 * A browser test cannot catch this — the whole failure is the absence of a DOM.
 * Keep this file in the `node` project.
 */
test('the package entry point imports with no DOM present', async () => {
  expect(typeof globalThis.HTMLElement).toBe('undefined'); // guard the guard

  const mod = await import('../src/index.js');

  expect(typeof mod.renderGlamour).toBe('function');
  expect(typeof mod.defineGlamCanvas).toBe('function');
  expect(typeof mod.GlamCanvasElement).toBe('function');
});

test('defineGlamCanvas is a silent no-op with no custom-element registry', async () => {
  expect(typeof globalThis.customElements).toBe('undefined');
  const { defineGlamCanvas } = await import('../src/index.js');
  expect(() => defineGlamCanvas()).not.toThrow();
});
