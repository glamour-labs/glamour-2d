import { afterEach, beforeAll, expect, test, vi } from 'vitest';
import type { GlamDoc } from '@glam/core';
import { defineGlamCanvas, GlamCanvasElement } from '../src/webcomponent.js';

const doc: GlamDoc = {
  schema: 'glamour/v0',
  canvas: { w: 100, h: 100 },
  nodes: [{ id: 'orb', type: 'circle', x: 50, y: 50, r: 20, fill: '#4c7dff' }],
};

let el: GlamCanvasElement | undefined;

beforeAll(() => {
  defineGlamCanvas();
});

afterEach(() => {
  el?.remove();
  el = undefined;
});

test('registers as <glam-canvas> and mounts a canvas when .doc is set', () => {
  el = document.createElement('glam-canvas') as GlamCanvasElement;
  document.body.appendChild(el);
  el.doc = doc;
  expect(el.querySelector('canvas')).not.toBeNull();
});

test('defineGlamCanvas is idempotent (safe to call more than once)', () => {
  expect(() => defineGlamCanvas()).not.toThrow();
});

test('src load surfaces an HTTP error instead of swallowing it (fix #10)', async () => {
  const fetchSpy = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response('not found', { status: 404 }));

  el = document.createElement('glam-canvas') as GlamCanvasElement;
  document.body.appendChild(el);
  el.setAttribute('src', 'https://example.test/missing.glam');

  // Let the microtask queue drain the async _loadFromSrc.
  // A single macrotask sufficed under jsdom's synchronous-ish fetch mock; in a
  // real browser the fetch + validate chain needs a moment, so poll instead.
  await vi.waitFor(() => expect(el.error).toBeInstanceOf(Error), { timeout: 5000 });

  expect(el.error).toBeInstanceOf(Error);
  expect(el.error?.message).toMatch(/404|failed to load/i);
  expect(el.doc).toBeNull();

  fetchSpy.mockRestore();
});

test('src load surfaces a validate() failure on the fetched doc instead of mounting it (fix #10)', async () => {
  const invalidDoc = { schema: 'nope', canvas: { w: 1, h: 1 }, nodes: [] };
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify(invalidDoc), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );

  el = document.createElement('glam-canvas') as GlamCanvasElement;
  document.body.appendChild(el);
  el.setAttribute('src', 'https://example.test/invalid.glam');

  // A single macrotask sufficed under jsdom's synchronous-ish fetch mock; in a
  // real browser the fetch + validate chain needs a moment, so poll instead.
  await vi.waitFor(() => expect(el.error).toBeInstanceOf(Error), { timeout: 5000 });

  expect(el.error).toBeInstanceOf(Error);
  expect(el.doc).toBeNull();
  expect(el.querySelector('canvas')).toBeNull();

  fetchSpy.mockRestore();
});

test('a glam-error event fires with the error in its detail', async () => {
  const fetchSpy = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response('nope', { status: 500 }));

  el = document.createElement('glam-canvas') as GlamCanvasElement;
  document.body.appendChild(el);

  const caught = new Promise<CustomEvent>((resolve) => {
    el?.addEventListener('glam-error', (ev) => resolve(ev as CustomEvent), { once: true });
  });
  el.setAttribute('src', 'https://example.test/missing.glam');

  const event = await caught;
  expect(event.detail.error).toBeInstanceOf(Error);

  fetchSpy.mockRestore();
});
