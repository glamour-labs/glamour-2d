import { readFileSync } from 'node:fs';
import { validate } from '@glamour-labs/core';

export interface ValidateCommandResult {
  ok: boolean;
  errors: string[];
}

/** Reads a `.glam` file and runs core `validate` against its parsed JSON. */
export function validateCommand(filePath: string): ValidateCommandResult {
  const raw = readFileSync(filePath, 'utf8');
  const json: unknown = JSON.parse(raw);
  const result = validate(json);
  return { ok: result.ok, errors: result.errors };
}
