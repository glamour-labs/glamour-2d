/**
 * Specimen sheet — every glyph on one page, so the letterforms can be *looked
 * at* rather than assumed.
 *
 * Each cell draws one glyph on a miniature four-line rule, with every pen-stroke
 * in its own colour and a dot at each stroke's start point. That makes three
 * things checkable at a glance: the shape reads as the right letter, the stroke
 * decomposition is what we intended, and each stroke starts where a child is
 * taught to start.
 *
 *   node tools/specimen.mjs upper   # -> out/specimen-upper.glam
 *   node tools/specimen.mjs lower
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { flattenStroke } from '../src/geom.mjs';
import { UPPER, LOWER, LETTERS } from '../src/glyphs.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

// A subset renders at 3x so individual letterforms can be judged properly;
// the full sheet is for scanning, the subset is for deciding.
const SUBSET = process.argv[3] ? process.argv[3].split('') : null;
const ZOOM = SUBSET ? 2.6 : 1;

const COLS = SUBSET ? Math.min(SUBSET.length, 4) : 7;
const CELL_W = 200 * ZOOM;
const CELL_H = 240 * ZOOM;
const BAND = 56 * ZOOM;
const CELL_TOP = 36 * ZOOM;
const PEN = 8 * ZOOM;

// One colour per pen-stroke index — the eye can then count strokes without
// reading anything.
const STROKE_COLORS = ['#1f2a44', '#1c9ff2', '#e07b39', '#2e9e5b', '#a855f7'];

function buildSheet(which) {
  const set = which === 'upper' ? UPPER : LOWER;
  const rows = Math.ceil((SUBSET ?? LETTERS).length / COLS);
  const nodes = [];

  const list = SUBSET ?? LETTERS;
  list.forEach((L, i) => {
    const key = which === 'upper' ? L.toUpperCase() : L.toLowerCase();
    const glyph = set[key];
    if (!glyph) throw new Error(`missing glyph: ${key}`);

    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const ox = col * CELL_W;
    const oy = row * CELL_H + CELL_TOP;

    const yTop = oy;
    const yMid = oy + BAND;
    const yBase = oy + BAND * 2;
    const yDesc = oy + BAND * 3;
    const mapY = (y) => oy + y * BAND;
    const originX = ox + CELL_W / 2 - (glyph.w / 2) * BAND;

    // Rules
    const rule = (id, y, color, width, dash) =>
      nodes.push({
        id, type: 'stroke', x: 0, y: 0,
        points: [ox + 14, y, ox + CELL_W - 14, y],
        stroke: color, strokeWidth: width, ...(dash ? { dash } : {}),
      });
    rule(`${key}_rt`, yTop, '#c8d8ec', 1.5);
    rule(`${key}_rm`, yMid, '#dde7f4', 1.5, [6, 6]);
    rule(`${key}_rb`, yBase, '#e8a0a0', 2);
    rule(`${key}_rd`, yDesc, '#dde7f4', 1.5, [6, 6]);

    // Cell caption
    nodes.push({
      id: `${key}_cap`, type: 'text', x: ox + 12, y: oy - 26,
      text: key, size: 20, fill: '#9aa4b4', fontStyle: 'bold',
    });

    glyph.strokes.forEach((seg, si) => {
      const pts = flattenStroke(seg, 0.035);
      const flat = [];
      for (const [gx, gy] of pts) flat.push(originX + gx * BAND, mapY(gy));
      nodes.push({
        id: `${key}_s${si}`, type: 'stroke', x: 0, y: 0,
        points: flat, stroke: STROKE_COLORS[si % STROKE_COLORS.length],
        strokeWidth: PEN, tension: 0,
      });
      // Start marker
      nodes.push({
        id: `${key}_d${si}`, type: 'circle',
        x: flat[0], y: flat[1], r: 5.5, fill: '#ffffff',
        stroke: STROKE_COLORS[si % STROKE_COLORS.length], strokeWidth: 2.5,
      });
      nodes.push({
        id: `${key}_n${si}`, type: 'text',
        x: flat[0] - 3.5, y: flat[1] - 24,
        text: String(si + 1), size: 15,
        fill: STROKE_COLORS[si % STROKE_COLORS.length], fontStyle: 'bold',
      });
    });
  });

  return {
    schema: 'glamour/v0.1',
    canvas: { w: COLS * CELL_W, h: rows * CELL_H + 20, bg: '#ffffff' },
    nodes,
  };
}

const which = process.argv[2] === 'lower' ? 'lower' : 'upper';
const doc = buildSheet(which);
mkdirSync(resolve(ROOT, 'out'), { recursive: true });
const outPath = resolve(ROOT, SUBSET ? `out/zoom-${which}.glam` : `out/specimen-${which}.glam`);
writeFileSync(outPath, JSON.stringify(doc));
console.log(outPath, `${doc.nodes.length} nodes`);
