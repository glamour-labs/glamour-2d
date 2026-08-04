/**
 * Contact sheet — all 26 real cards for one theme/case/mode, composed into a
 * single document so the whole alphabet can be rendered once and *looked at*.
 *
 * This is not a mock-up of the cards: it transforms the actual generated
 * documents, so what appears on the sheet is exactly what the game will show.
 *
 *   node tools/sheet.mjs paper upper easy
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDoc } from '../src/build.mjs';
import { LETTERS } from '../src/glyphs.mjs';
import { CANVAS, maxCanvasHeight } from '../src/themes.mjs';
const CARD_H = maxCanvasHeight();

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

const [themeId = 'paper', caseKey = 'upper', mode = 'easy'] = process.argv.slice(2);
const upper = caseKey !== 'lower';

const COLS = 7;
const S = 0.46; // scale each card down to fit a grid

/** Scale + translate every geometric prop on a node. Absolute coords only, so
 *  this is a complete list — anything new in the format must be added here. */
function xform(node, k, dx, dy) {
  const n = { ...node };
  const sx = (v) => v * k + dx;
  const sy = (v) => v * k + dy;
  if (typeof n.x === 'number') n.x = Number(sx(n.x).toFixed(1));
  if (typeof n.y === 'number') n.y = Number(sy(n.y).toFixed(1));
  for (const p of ['r', 'rx', 'ry', 'w', 'h', 'size', 'strokeWidth', 'innerRadius', 'outerRadius', 'cornerRadius']) {
    if (typeof n[p] === 'number') n[p] = Number((n[p] * k).toFixed(2));
  }
  if (Array.isArray(n.dash)) n.dash = n.dash.map((d) => Number((d * k).toFixed(2)));
  if (Array.isArray(n.points)) {
    // Stroke points are LOCAL to the node, so they scale but must not be
    // translated — the node's own x/y already carries the offset.
    n.points = n.points.map((v, i) =>
      Number((v * k + (n.x === 0 && n.y === 0 ? (i % 2 ? dy : dx) : 0)).toFixed(1)),
    );
  }
  return n;
}

const nodes = [];
LETTERS.forEach((letter, i) => {
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  const dx = col * CANVAS.w * S;
  const dy = row * CARD_H * S;
  const doc = buildDoc({ letter, upper, mode, theme: themeId });
  for (const node of doc.nodes) {
    // Skip the resting-invisible celebration layer — it would only add noise.
    if (node.id.startsWith('spark')) continue;
    const t = xform(node, S, dx, dy);
    t.id = `${letter}_${node.id}`;
    nodes.push(t);
  }
  // Cell divider
  nodes.push({
    id: `${letter}_frame`, type: 'rect',
    x: dx + 1, y: dy + 1, w: CANVAS.w * S - 2, h: CARD_H * S - 2,
    stroke: '#dfe3e8', strokeWidth: 1, cornerRadius: 10,
  });
});

const rows = Math.ceil(LETTERS.length / COLS);
const doc = {
  schema: 'glamour/v0.1',
  canvas: { w: Math.round(COLS * CANVAS.w * S), h: Math.round(rows * CARD_H * S), bg: '#ffffff' },
  nodes,
};

mkdirSync(resolve(ROOT, 'out'), { recursive: true });
const out = resolve(ROOT, `out/sheet-${themeId}-${caseKey}-${mode}.glam`);
writeFileSync(out, JSON.stringify(doc));
console.log(out, `${nodes.length} nodes`);
