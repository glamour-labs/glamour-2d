import { starterDoc } from '@glam/core';

/**
 * Studio's starting point — sourced from the single canonical starter doc
 * in `@glam/core` (fix #12), not a hand-typed JSON string that could drift
 * out of sync with the CLI's `glam new` starter.
 */
export const STARTER_DOC_JSON = `${JSON.stringify(starterDoc, null, 2)}\n`;
