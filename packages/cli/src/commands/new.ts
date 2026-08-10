import { writeFileSync } from 'node:fs';
import { starterDoc } from '@glamour-labs/core';

/**
 * The `glam new` starter doc — single-sourced from `@glamour-labs/core`'s
 * `starterDoc` (fix #12) rather than a hand-typed duplicate. Re-exported
 * here for backward compatibility (`@glamour-labs/cli`'s public API has always
 * exported `starterDoc`).
 */
export { starterDoc };

/** Writes the starter `.glam` doc to `targetPath` and returns the path. */
export function newCommand(targetPath: string): string {
  writeFileSync(targetPath, `${JSON.stringify(starterDoc, null, 2)}\n`, 'utf8');
  return targetPath;
}
