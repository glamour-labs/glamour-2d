import { afterEach, expect, test } from 'vitest';
import { createRef } from 'react';
import { cleanup, render } from '@testing-library/react';
import type { GlamDoc } from '@glam/core';
import { Glamour, type GlamourHandle } from '../src/index.js';

afterEach(cleanup);

const toggleDoc: GlamDoc = {
  schema: 'glamour/v0',
  canvas: { w: 120, h: 120 },
  nodes: [{ id: 'orb', type: 'circle', x: 60, y: 60, r: 24, fill: '#4c7dff', emit: 'picked' }],
  machine: {
    initial: 'idle',
    states: {
      // `@toggle` is a host event (driven via the handle's `send`), unlike an
      // `orb.click` pointer on-key which only fires on a real canvas click.
      idle: { set: { 'orb.r': 24 }, on: { '@toggle': 'active' } },
      active: { set: { 'orb.r': 40 }, on: { '@toggle': 'idle' } },
    },
    transition: { ms: 0 },
  },
};

test('mounts a Konva canvas inside its container', () => {
  const { container } = render(<Glamour doc={toggleDoc} />);
  // renderGlamour ran within the React lifecycle -> a <canvas> exists
  expect(container.querySelector('canvas')).toBeTruthy();
});

test('exposes an imperative handle that reflects and drives the player', () => {
  const ref = createRef<GlamourHandle>();
  render(<Glamour ref={ref} doc={toggleDoc} />);
  expect(ref.current).toBeTruthy();
  // reads machine state
  expect(ref.current?.getState()).toBe('idle');
  // host drives the canvas: send a host event -> transitions
  ref.current?.send('toggle');
  expect(ref.current?.getState()).toBe('active');
  // setInput / play / pause are callable without throwing
  expect(() => {
    ref.current?.setInput('progress', 1);
    ref.current?.play();
    ref.current?.pause();
  }).not.toThrow();
});

test('a new callback identity does NOT remount the canvas (stable across re-render)', () => {
  const { container, rerender } = render(<Glamour doc={toggleDoc} onEmit={() => {}} />);
  const first = container.querySelector('canvas');
  // re-render with a brand-new onEmit function identity
  rerender(<Glamour doc={toggleDoc} onEmit={() => {}} />);
  const second = container.querySelector('canvas');
  expect(second).toBe(first); // same canvas node -> no teardown/remount
});

test('passes className/style through to the mount element', () => {
  const { container } = render(
    <Glamour doc={toggleDoc} className="glam-host" style={{ width: 120 }} />,
  );
  const host = container.querySelector('.glam-host') as HTMLElement;
  expect(host).toBeTruthy();
  expect(host.style.width).toBe('120px');
});

test('unmount destroys the player without throwing', () => {
  const { unmount } = render(<Glamour doc={toggleDoc} />);
  expect(() => unmount()).not.toThrow();
});
