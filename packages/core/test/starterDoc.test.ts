import { expect, test } from 'vitest';
import { starterDoc } from '../src/starterDoc.js';
import { validate } from '../src/validate.js';

test('the canonical starter doc validates ok (single source for cli + studio, fix #12)', () => {
  const r = validate(starterDoc);
  expect(r.ok).toBe(true);
  expect(r.errors).toEqual([]);
});
