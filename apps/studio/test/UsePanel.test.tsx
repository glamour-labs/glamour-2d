import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { GlamDoc } from '@glamour-labs/core';
import { UsePanel } from '../src/components/UsePanel.js';

const doc: GlamDoc = {
  schema: 'glamour/v0',
  canvas: { w: 520, h: 300, bg: '#12151b' },
  inputs: { progress: 0 },
  nodes: [{ id: 'orb', type: 'circle', x: 150, y: 150, r: 52, fill: '#4c7dff' }],
};

beforeEach(() => {
  // A real browser exposes `navigator.clipboard` as a getter-only property, so
  // Object.assign throws (jsdom allowed plain assignment). Define it instead.
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  cleanup();
});

test('web component tab is shown by default', () => {
  render(<UsePanel doc={doc} />);
  expect(screen.getByText('<glam-canvas src="/my.glam"></glam-canvas>', { exact: false })).toBeInTheDocument();
});

test('JavaScript tab shows renderGlamour snippet with the doc canvas width inlined', () => {
  render(<UsePanel doc={doc} />);
  fireEvent.click(screen.getByRole('tab', { name: 'JavaScript' }));

  const codeBlock = screen.getByText(/Glam\.renderGlamour/);
  expect(codeBlock.textContent).toContain('Glam.renderGlamour');
  expect(codeBlock.textContent).toContain('"w": 520');
});

test('switching to the web component tab after JavaScript shows the web-component snippet', () => {
  render(<UsePanel doc={doc} />);
  fireEvent.click(screen.getByRole('tab', { name: 'JavaScript' }));
  fireEvent.click(screen.getByRole('tab', { name: 'Web component' }));

  expect(screen.getByText(/glam-player\.umd\.js/)).toBeInTheDocument();
  expect(screen.queryByText(/Glam\.renderGlamour/)).not.toBeInTheDocument();
});

test('an invalid/null doc shows a fix-the-json placeholder instead of stale snippets', () => {
  render(<UsePanel doc={null} />);
  expect(screen.getByText('Fix the JSON to generate code.')).toBeInTheDocument();
  expect(screen.queryByText(/Glam\.renderGlamour/)).not.toBeInTheDocument();
});

test('copy button copies the current tab snippet via the Clipboard API', async () => {
  render(<UsePanel doc={doc} />);
  fireEvent.click(screen.getByRole('button', { name: 'Copy web component snippet' }));

  expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('glam-canvas'));
});
