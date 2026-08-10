import { afterEach, expect, test } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { starterDoc } from '@glamour-labs/core';
import { App } from '../src/App.js';
import { STARTER_DOC_JSON } from '../src/starterDoc.js';

afterEach(() => {
  cleanup();
});

test('renders the starter doc and mounts a live preview', () => {
  render(<App />);
  expect(screen.getByTestId('preview-mount')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('editing the JSON to an invalid doc shows a validation error', () => {
  render(<App />);
  const editor = screen.getByLabelText('glam document JSON') as HTMLTextAreaElement;

  fireEvent.change(editor, { target: { value: '{"schema":"nope","canvas":{"w":1,"h":1},"nodes":[]}' } });

  expect(screen.getByRole('alert')).toBeInTheDocument();
});

test('a subsequent valid edit clears the validation error', () => {
  render(<App />);
  const editor = screen.getByLabelText('glam document JSON') as HTMLTextAreaElement;

  fireEvent.change(editor, { target: { value: '{"schema":"nope","canvas":{"w":1,"h":1},"nodes":[]}' } });
  expect(screen.getByRole('alert')).toBeInTheDocument();

  const validDoc = JSON.stringify({
    schema: 'glamour/v0',
    canvas: { w: 100, h: 100 },
    nodes: [{ id: 'orb', type: 'circle', x: 10, y: 10, r: 5, fill: '#fff' }],
  });
  fireEvent.change(editor, { target: { value: validDoc } });

  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('selecting a palette primitive on a node updates the doc and keeps it valid', async () => {
  render(<App />);

  const nodeSelect = screen.getByLabelText('Target node') as HTMLSelectElement;
  fireEvent.change(nodeSelect, { target: { value: 'orb' } });

  const primitiveSelect = screen.getByLabelText('Primitive') as HTMLSelectElement;
  fireEvent.change(primitiveSelect, { target: { value: 'hoverGrow' } });

  fireEvent.click(screen.getByRole('button', { name: 'Apply primitive' }));

  await waitFor(() => {
    const editor = screen.getByLabelText('glam document JSON') as HTMLTextAreaElement;
    expect(editor.value).toMatch(/"hover"/);
  });
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('Studio starter doc is single-sourced from @glamour-labs/core, not a hand-typed duplicate (fix #12)', () => {
  expect(JSON.parse(STARTER_DOC_JSON)).toEqual(starterDoc);
});
