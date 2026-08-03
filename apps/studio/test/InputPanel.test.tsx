import { afterEach, expect, test } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { GlamPlayer } from '@glam/player';
import { InputPanel } from '../src/components/InputPanel.js';

afterEach(() => {
  cleanup();
});

test('a fractional input starting at 0 (e.g. "progress") gets a usable 0..1 range, not a degenerate max', () => {
  render(<InputPanel inputs={{ progress: 0 }} player={null} />);
  const slider = screen.getByLabelText('progress') as HTMLInputElement;
  expect(Number(slider.min)).toBe(0);
  expect(Number(slider.max)).toBe(1);
});

test('a larger initial value gets a sensible non-degenerate range', () => {
  render(<InputPanel inputs={{ count: 50 }} player={null} />);
  const slider = screen.getByLabelText('count') as HTMLInputElement;
  expect(Number(slider.min)).toBe(0);
  expect(Number(slider.max)).toBeGreaterThan(50);
});

test('the slider is controlled and resyncs its displayed value when the doc reloads with a new initial value (fix #11)', () => {
  const player: GlamPlayer = {
    setInput: () => {},
    getState: () => 'idle',
    destroy: () => {},
    send: () => {},
    on: () => () => {},
    play: () => {},
    pause: () => {},
    set: () => {},
    onPointer: () => () => {},
    onStroke: () => () => {},
    onGuided: () => () => {},
  };

  const { rerender } = render(<InputPanel inputs={{ progress: 0 }} player={player} />);
  let slider = screen.getByLabelText('progress') as HTMLInputElement;
  expect(slider.value).toBe('0');

  // Simulate loading a different .glam doc whose "progress" input starts
  // at a different value — with an uncontrolled `defaultValue`, the slider
  // would keep showing the stale value from first mount.
  rerender(<InputPanel inputs={{ progress: 0.75 }} player={player} />);
  slider = screen.getByLabelText('progress') as HTMLInputElement;
  expect(slider.value).toBe('0.75');
});
