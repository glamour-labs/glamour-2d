/**
 * Parity gate: render every .glam with the v2 WebGL backend and pixel-diff it
 * against the v1 (Konva) reference PNGs.
 *
 * v1 is the oracle. It stays installed in its own repo and its renders are the
 * spec — "looks right" becomes a measurable number instead of a judgement call.
 *
 * Usage:
 *   node scripts/parity.mjs <oracle-dir> [out-dir]
 *
 * Refuses to run against a stale oracle. Set GLAM_V1_REPO to point at the v1 repo
 * if it is not at ~/Project/glamour-v1-oracle.
 *
 * The diff itself runs inside Chromium (decoding PNGs needs a real image
 * decoder, and the browser is already a dependency of the render path).
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { renderToPNG } from '../packages/player/dist/node.js';
import {
  assertOracleBuildFresh,
  assertOracleRendersFresh,
  DEFAULT_V1_REPO,
} from './oracle-freshness.mjs';

const oracleDir = process.argv[2];
const outDir = process.argv[3] ?? 'parity-out';
if (!oracleDir || !existsSync(oracleDir)) {
  console.error('usage: node scripts/parity.mjs <oracle-dir> [out-dir]');
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

// A stale oracle makes this gate report confident nonsense — see
// scripts/oracle-freshness.mjs for the incident that motivated this.
const v1Repo = process.env.GLAM_V1_REPO ?? DEFAULT_V1_REPO;
try {
  assertOracleBuildFresh(v1Repo);
  assertOracleRendersFresh(v1Repo, oracleDir);
} catch (err) {
  console.error(`\n${err.message}\n`);
  process.exit(2);
}

/** Every .glam in the repo, excluding build/vendor dirs. */
function findGlams(dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findGlams(full, acc);
    else if (entry.name.endsWith('.glam')) acc.push(full);
  }
  return acc;
}

const oracleName = (file) =>
  `${path.relative('.', file).replace(/\//g, '__').replace(/\.glam$/, '')}.png`;

const DIFF_SCRIPT = `(async () => {
  const { a, b } = JSON.parse(document.getElementById('glam-args').textContent);
  const load = (src) => new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error('decode failed'));
    img.src = src;
  });
  const [ia, ib] = await Promise.all([load(a), load(b)]);
  if (ia.width !== ib.width || ia.height !== ib.height) {
    return { sizeMismatch: true, aw: ia.width, ah: ia.height, bw: ib.width, bh: ib.height };
  }
  const px = (img) => {
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    return ctx.getImageData(0, 0, img.width, img.height).data;
  };
  const pa = px(ia), pb = px(ib);
  let sum = 0, over = 0, maxd = 0;
  const n = pa.length / 4;
  for (let i = 0; i < pa.length; i += 4) {
    // Compare over white, so differing alpha does not read as a false match.
    const d = ['0','1','2'].reduce((acc, k) => {
      const j = i + Number(k);
      const va = pa[j] * (pa[i+3]/255) + 255 * (1 - pa[i+3]/255);
      const vb = pb[j] * (pb[i+3]/255) + 255 * (1 - pb[i+3]/255);
      return Math.max(acc, Math.abs(va - vb));
    }, 0);
    sum += d;
    if (d > maxd) maxd = d;
    if (d > 24) over++;
  }
  return { sizeMismatch: false, meanDiff: sum / n, maxDiff: maxd, pctOver: (over / n) * 100, w: ia.width, h: ia.height };
})()`;

/**
 * Legacy docs excluded from the gate (King, 2026-08-03: "ignore that letter a,
 * it old and might not use"). Both are dominated by one huge glyph, and text
 * metrics differ between node-canvas (FreeType) and Chromium (Skia), so they
 * measure the two rasterizers' fonts rather than this renderer.
 */
const LEGACY = new Set([
  'sketches/draw-letter-a/letter-a.glam',
  'sketches/trace-letter/letter-a.glam',
]);

const files = findGlams('.').filter((f) => !LEGACY.has(path.relative('.', f))).sort();
if (LEGACY.size) console.log(`skipping ${LEGACY.size} legacy doc(s): ${[...LEGACY].join(', ')}\n`);
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 64, height: 64 } });

const rows = [];
for (const file of files) {
  const rel = path.relative('.', file);
  const oraclePath = path.join(oracleDir, oracleName(file));
  const row = { file: rel, status: 'ok' };

  let v2;
  try {
    const doc = JSON.parse(readFileSync(file, 'utf8'));
    v2 = await renderToPNG(doc);
    writeFileSync(path.join(outDir, oracleName(file)), v2);
  } catch (err) {
    row.status = 'V2-RENDER-FAILED';
    row.error = String(err.message ?? err).split('\n')[0];
    rows.push(row);
    console.log(`${rel.padEnd(48)} ${row.status}  ${row.error}`);
    continue;
  }

  if (!existsSync(oraclePath)) {
    row.status = 'NO-ORACLE';
    rows.push(row);
    console.log(`${rel.padEnd(48)} ${row.status} (v1 could not render it either)`);
    continue;
  }

  const args = JSON.stringify({
    a: `data:image/png;base64,${readFileSync(oraclePath).toString('base64')}`,
    b: `data:image/png;base64,${v2.toString('base64')}`,
  }).replace(/</g, '\\u003c');
  await page.setContent(
    `<div></div><script id="glam-args" type="application/json">${args}</script>`,
    { waitUntil: 'load' },
  );
  const d = await page.evaluate(DIFF_SCRIPT);
  Object.assign(row, d);
  if (d.sizeMismatch) row.status = 'SIZE-MISMATCH';
  else if (d.pctOver > 2) row.status = 'DIFF';
  else row.status = 'MATCH';
  rows.push(row);
  console.log(
    `${rel.padEnd(48)} ${row.status.padEnd(14)} `
    + (d.sizeMismatch
      ? `${d.aw}x${d.ah} vs ${d.bw}x${d.bh}`
      : `mean ${d.meanDiff.toFixed(2)}  max ${d.maxDiff}  over-thresh ${d.pctOver.toFixed(2)}%`),
  );
}

await browser.close();
writeFileSync(path.join(outDir, 'parity.json'), JSON.stringify(rows, null, 2));

const tally = rows.reduce((acc, r) => ((acc[r.status] = (acc[r.status] ?? 0) + 1), acc), {});
console.log('\n=== tally ===');
for (const [k, v] of Object.entries(tally)) console.log(`${k.padEnd(20)} ${v}`);
console.log(`\nreport: ${path.join(outDir, 'parity.json')}`);
