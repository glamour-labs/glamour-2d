/**
 * FRAME-SEQUENCE parity gate: compare v1 and v2 over TIME, not just at rest.
 *
 * The static gate (scripts/parity.mjs) diffs one resting frame per document. That
 * proves nothing about `loops`, `wander`, or the tween engine — and v2's tween
 * engine and rAF ticker are both hand-written replacements for Konva's, checked
 * until now only by unit tests I also wrote. A loop that drifts phase or an
 * easing that is subtly wrong passes every other gate in this repo.
 *
 * Two independent checks:
 *
 *   A. EASING MATH — samples every `Ease` name in both implementations at 101
 *      phases and compares numerically. Exact, fast, and it targets the actual
 *      risk (wrong curve) rather than its pixel shadow.
 *
 *   B. FRAME SEQUENCE — drives each animated document through identical VIRTUAL
 *      timestamps in both versions and diffs frame by frame.
 *
 * How B stays deterministic without any test hooks:
 *   - `requestAnimationFrame` and `performance.now` / `Date.now` are replaced in
 *     the page BEFORE the player bundle loads, so Konva's own Animation engine
 *     (v1) and v2's ticker both run on a clock this script steps by hand. Using
 *     the players' `__tick` seam instead would not work: `tick()` writes node
 *     props but does not redraw, and the redraw in each version is owned by the
 *     very rAF loop we need to control.
 *   - `Math.random` is replaced with a seeded LCG, so `wander` picks the same
 *     targets in both. v1 hardcodes `new Wander(w, Math.random)`, so seeding the
 *     global is the only way to make it comparable without editing v1.
 *
 * Deliberately OUT of scope: pixel parity for tween transitions. Those fire from
 * a node click, and the two versions dispatch clicks through different event
 * systems (Konva's hit graph vs v2's analytic hit-test), so a simulated click is
 * not a like-for-like input. Check A covers the interpolation math instead; the
 * click plumbing itself is covered by each version's own player tests.
 *
 * Usage:
 *   node scripts/frame-parity.mjs <v1-repo-path> [out-dir]
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { assertOracleBuildFresh } from './oracle-freshness.mjs';

const v1Repo = process.argv[2];
const outDir = process.argv[3] ?? 'frame-parity-out';
if (!v1Repo || !existsSync(v1Repo)) {
  console.error('usage: node scripts/frame-parity.mjs <v1-repo-path> [out-dir]');
  process.exit(1);
}
const V1_BUNDLE = path.join(v1Repo, 'packages/player/dist/glam-player.umd.js');
const V2_BUNDLE = path.join('packages/player/dist/glam-player.umd.js');
for (const b of [V1_BUNDLE, V2_BUNDLE]) {
  if (!existsSync(b)) {
    console.error(`missing UMD bundle: ${b}\nRun \`pnpm build\` in that repo first.`);
    process.exit(1);
  }
}
mkdirSync(outDir, { recursive: true });

// This gate renders v1 live from its build, so only the build itself can be stale
// (there are no pre-rendered references to go out of date).
try {
  assertOracleBuildFresh(v1Repo);
} catch (err) {
  console.error(`\n${err.message}\n`);
  process.exit(2);
}

/* ------------------------------- discovery -------------------------------- */

function findGlams(dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findGlams(full, acc);
    else if (entry.name.endsWith('.glam')) acc.push(full);
  }
  return acc;
}

/** Legacy docs, excluded from every gate (see scripts/parity.mjs). */
const LEGACY = new Set([
  'sketches/draw-letter-a/letter-a.glam',
  'sketches/trace-letter/letter-a.glam',
]);

/** Only documents with continuous motion have frames worth comparing. */
function hasContinuousMotion(doc) {
  return (doc.loops?.length ?? 0) > 0 || (doc.wander?.length ?? 0) > 0;
}

/* ------------------------------ page harness ------------------------------ */

// Installed before the player bundle so both versions' animation loops are
// captured. Kept as a plain string: it must run in page scope, ahead of any
// module the bundle pulls in.
const CLOCK_SHIM = `
(() => {
  let vnow = 0;
  let queue = [];
  const rafShim = (cb) => { queue.push(cb); return queue.length; };
  window.requestAnimationFrame = rafShim;
  window.cancelAnimationFrame = () => {};
  // performance.now lives on the prototype; an own property shadows it.
  Object.defineProperty(performance, 'now', { value: () => vnow, configurable: true, writable: true });
  Date.now = () => vnow;

  // Seeded LCG so wander draws identical targets in both versions.
  //
  // The stream must be RESET after the scene is constructed and before motion
  // starts. Konva assigns every shape a random hit-test colour key, so v1
  // consumes draws during construction that v2 does not; sharing one continuous
  // stream therefore handed the two versions DIFFERENT wander trajectories and
  // showed up as a ~1.7pp phantom diff on the one wander document.
  const SEED = 123456789;
  let seed = SEED;
  Math.random = () => {
    seed = (1103515245 * seed + 12345) % 2147483648;
    return seed / 2147483648;
  };
  window.__reseed = () => { seed = SEED; };

  // Advance the clock and flush whatever the players queued. Several passes per
  // step because a frame callback typically re-queues itself immediately.
  window.__advance = (dt) => {
    vnow += dt;
    for (let pass = 0; pass < 4; pass++) {
      const due = queue;
      queue = [];
      for (const cb of due) { try { cb(vnow); } catch (e) { /* surfaced by the caller */ } }
      if (queue.length === 0) break;
    }
  };
  window.__vnow = () => vnow;
})();
`;

/** Runs in the page: build the player, step the clock, capture each frame. */
const CAPTURE_SCRIPT = `(async () => {
  const { doc, stepMs, frames } = JSON.parse(document.getElementById('glam-args').textContent);
  const G = window.Glam;
  if (!G || typeof G.renderGlamour !== 'function') throw new Error('UMD bundle missing renderGlamour');
  const mount = document.getElementById('mount');
  const player = G.renderGlamour(doc, mount);
  // Construction is done; align the rng stream before any wander target is drawn.
  window.__reseed();
  if (typeof player.play === 'function') player.play();
  const canvas = mount.querySelector('canvas');
  if (!canvas) throw new Error('no canvas produced');
  const out = [];
  // Frame 0 is the resting frame, before any time passes.
  out.push(canvas.toDataURL('image/png'));
  for (let i = 1; i < frames; i++) {
    window.__advance(stepMs);
    out.push(canvas.toDataURL('image/png'));
  }
  return out;
})()`;

/** Pixel-diff two data URLs. Returns over-threshold percentage. */
const DIFF_SCRIPT = `(async () => {
  const pairs = JSON.parse(document.getElementById('glam-args').textContent);
  const load = (src) => new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error('decode failed'));
    img.src = src;
  });
  const px = (img) => {
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    return ctx.getImageData(0, 0, img.width, img.height).data;
  };
  const out = [];
  for (const [a, b] of pairs) {
    const [ia, ib] = await Promise.all([load(a), load(b)]);
    if (ia.width !== ib.width || ia.height !== ib.height) { out.push({ sizeMismatch: true }); continue; }
    const pa = px(ia), pb = px(ib);
    let over = 0, sum = 0, maxd = 0;
    const n = pa.length / 4;
    for (let i = 0; i < pa.length; i += 4) {
      let d = 0;
      for (let k = 0; k < 3; k++) {
        const j = i + k;
        const va = pa[j] * (pa[i+3]/255) + 255 * (1 - pa[i+3]/255);
        const vb = pb[j] * (pb[i+3]/255) + 255 * (1 - pb[i+3]/255);
        d = Math.max(d, Math.abs(va - vb));
      }
      sum += d;
      if (d > maxd) maxd = d;
      if (d > 24) over++;
    }
    out.push({ sizeMismatch: false, meanDiff: sum / n, maxDiff: maxd, pctOver: (over / n) * 100 });
  }
  return out;
})()`;

/**
 * Runs in the page with BOTH easing implementations available. v1 exposes
 * Konva.Easings as full interpolators (time, begin, change, duration), so they
 * are normalized to a phase->phase curve before comparing.
 */
const EASING_SCRIPT = `(() => {
  const K = window.Konva;
  if (!K || !K.Easings) return { error: 'Konva.Easings unavailable in the v1 bundle' };
  const MAP = {
    linear: 'Linear',
    easeIn: 'EaseIn',
    easeOut: 'EaseOut',
    easeInOut: 'EaseInOut',
    backInOut: 'BackEaseInOut',
    elasticOut: 'ElasticEaseOut',
  };
  const D = 1000;
  const out = {};
  for (const [name, konvaName] of Object.entries(MAP)) {
    const fn = K.Easings[konvaName];
    if (!fn) { out[name] = { error: 'missing Konva easing ' + konvaName }; continue; }
    const samples = [];
    for (let i = 0; i <= 100; i++) samples.push(fn((i / 100) * D, 0, 1, D));
    out[name] = { samples };
  }
  return out;
})()`;

/* --------------------------------- driver --------------------------------- */

async function pageFor(browser, bundlePath, viewport) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  return { page, bundle: readFileSync(bundlePath, 'utf8') };
}

async function capture(page, bundle, doc, stepMs, frames) {
  const args = JSON.stringify({ doc, stepMs, frames }).replace(/</g, '\\u003c');
  await page.setContent(
    '<!doctype html><meta charset="utf-8">'
    + '<style>html,body{margin:0;padding:0;background:transparent}</style>'
    + '<div id="mount"></div>'
    + `<script id="glam-args" type="application/json">${args}</script>`
    + `<script>${CLOCK_SHIM}</script>`
    + `<script>${bundle}</script>`,
    { waitUntil: 'load' },
  );
  return page.evaluate(CAPTURE_SCRIPT);
}

/**
 * Frame parity uses a TIGHTER threshold than the static gate's 2%.
 *
 * 2% was calibrated for text antialiasing noise, and no animated document
 * contains text. Measured clean baselines here are 0.10-0.42%; a deliberately
 * injected 40ms loop phase shift measured 1.04-1.66%. At 2% that real regression
 * reported MATCH. 0.8% sits above the noise and well below the smallest injected
 * fault, verified by mutation testing both ways.
 */
const FRAME_THRESHOLD_PCT = 0.8;

const STEP_MS = 100;
const FRAMES = Number(process.env.GLAM_FRAMES ?? 13);

const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const rows = [];

/* --- Check A: easing math ------------------------------------------------- */

console.log('=== A. easing curve parity (numeric) ===');
const easingPage = await browser.newPage({ viewport: { width: 32, height: 32 } });
await easingPage.setContent(
  `<div></div><script>${readFileSync(V1_BUNDLE, 'utf8')}</script>`,
  { waitUntil: 'load' },
);
const v1Easings = await easingPage.evaluate(EASING_SCRIPT);
await easingPage.close();

const easingRows = [];
if (v1Easings.error) {
  console.log(`  SKIPPED — ${v1Easings.error}`);
  easingRows.push({ name: '(all)', status: 'NOT-RUN', reason: v1Easings.error });
} else {
  const { applyEaseForTest } = await import('../packages/core/dist/index.js');
  if (typeof applyEaseForTest !== 'function') {
    console.log('  SKIPPED — @glamour-labs/core does not export applyEaseForTest');
    easingRows.push({ name: '(all)', status: 'NOT-RUN', reason: 'applyEaseForTest not exported' });
  } else {
    for (const [name, info] of Object.entries(v1Easings)) {
      if (info.error) {
        easingRows.push({ name, status: 'NOT-RUN', reason: info.error });
        console.log(`  ${name.padEnd(14)} NOT-RUN  ${info.error}`);
        continue;
      }
      let worst = 0;
      let worstAt = 0;
      for (let i = 0; i <= 100; i++) {
        const phase = i / 100;
        const mine = applyEaseForTest(name, phase);
        const d = Math.abs(mine - info.samples[i]);
        if (d > worst) { worst = d; worstAt = phase; }
      }
      // 1e-6 is a float-noise budget; anything real is orders of magnitude bigger.
      const status = worst <= 1e-6 ? 'MATCH' : 'DIFF';
      easingRows.push({ name, status, maxAbsDiff: worst, worstAtPhase: worstAt });
      console.log(
        `  ${name.padEnd(14)} ${status.padEnd(6)} max|Δ| ${worst.toExponential(2)} at phase ${worstAt.toFixed(2)}`,
      );
    }
  }
}

/* --- Check B: frame sequences --------------------------------------------- */

console.log(`\n=== B. frame-sequence parity (${FRAMES} frames, ${STEP_MS}ms apart) ===`);
const files = findGlams('.')
  .filter((f) => !LEGACY.has(path.relative('.', f)))
  .sort();

const diffPage = await browser.newPage({ viewport: { width: 32, height: 32 } });

for (const file of files) {
  const rel = path.relative('.', file);
  const doc = JSON.parse(readFileSync(file, 'utf8'));
  if (!hasContinuousMotion(doc)) continue;

  const viewport = { width: doc.canvas.w, height: doc.canvas.h };
  const row = { file: rel, loops: doc.loops?.length ?? 0, wander: doc.wander?.length ?? 0 };

  try {
    const a = await pageFor(browser, V1_BUNDLE, viewport);
    const v1Frames = await capture(a.page, a.bundle, doc, STEP_MS, FRAMES);
    await a.page.close();

    const b = await pageFor(browser, V2_BUNDLE, viewport);
    const v2Frames = await capture(b.page, b.bundle, doc, STEP_MS, FRAMES);
    await b.page.close();

    const pairs = v1Frames.map((f, i) => [f, v2Frames[i]]);
    const args = JSON.stringify(pairs).replace(/</g, '\\u003c');
    await diffPage.setContent(
      `<div></div><script id="glam-args" type="application/json">${args}</script>`,
      { waitUntil: 'load' },
    );
    const diffs = await diffPage.evaluate(DIFF_SCRIPT);

    // A static document would diff identically on every frame; motion parity is
    // only meaningful if the frames actually CHANGE. Guard against a silently
    // frozen animation reading as a pass.
    const movedV1 = new Set(v1Frames).size > 1;
    const movedV2 = new Set(v2Frames).size > 1;

    row.frames = diffs.map((d, i) => ({
      t: i * STEP_MS,
      pctOver: d.sizeMismatch ? null : +d.pctOver.toFixed(2),
      sizeMismatch: d.sizeMismatch || false,
    }));
    const worst = row.frames.reduce((m, f) => (f.pctOver !== null && f.pctOver > m.pctOver ? f : m), { pctOver: -1, t: 0 });
    row.worstPctOver = worst.pctOver;
    row.worstAtMs = worst.t;
    row.v1Animated = movedV1;
    row.v2Animated = movedV2;

    if (!movedV1 || !movedV2) row.status = 'FROZEN';
    else if (row.frames.some((f) => f.sizeMismatch)) row.status = 'SIZE-MISMATCH';
    else row.status = worst.pctOver > FRAME_THRESHOLD_PCT ? 'DIFF' : 'MATCH';

    // Keep the worst frame pair on disk so a failure is inspectable.
    if (row.status !== 'MATCH') {
      const idx = row.frames.findIndex((f) => f.t === worst.t);
      const base = rel.replace(/\//g, '__').replace(/\.glam$/, '');
      const strip = (u) => Buffer.from(u.replace(/^data:image\/png;base64,/, ''), 'base64');
      writeFileSync(path.join(outDir, `${base}.t${worst.t}.v1.png`), strip(v1Frames[idx]));
      writeFileSync(path.join(outDir, `${base}.t${worst.t}.v2.png`), strip(v2Frames[idx]));
    }
  } catch (err) {
    row.status = 'ERROR';
    row.error = String(err.message ?? err).split('\n')[0];
  }

  rows.push(row);
  const motion = `loops:${row.loops} wander:${row.wander}`;
  console.log(
    `  ${rel.padEnd(46)} ${String(row.status).padEnd(14)} ${motion.padEnd(20)} `
    + (row.status === 'ERROR'
      ? row.error
      : row.status === 'FROZEN'
        ? `v1 animated: ${row.v1Animated}, v2 animated: ${row.v2Animated}`
        : `worst ${row.worstPctOver}% @ ${row.worstAtMs}ms`),
  );
}

await diffPage.close();
await browser.close();

writeFileSync(
  path.join(outDir, 'frame-parity.json'),
  JSON.stringify({ easing: easingRows, docs: rows, stepMs: STEP_MS, frames: FRAMES }, null, 2),
);

const tally = rows.reduce((a, r) => ((a[r.status] = (a[r.status] ?? 0) + 1), a), {});
const eTally = easingRows.reduce((a, r) => ((a[r.status] = (a[r.status] ?? 0) + 1), a), {});
console.log('\n=== tally ===');
console.log('easing curves :', Object.entries(eTally).map(([k, v]) => `${k} ${v}`).join('  ') || 'none');
console.log('frame sequences:', Object.entries(tally).map(([k, v]) => `${k} ${v}`).join('  ') || 'none');
console.log(`threshold: worst frame must stay under ${FRAME_THRESHOLD_PCT}% over-threshold pixels`);
console.log(`\nreport: ${path.join(outDir, 'frame-parity.json')}`);

const failed = rows.some((r) => r.status !== 'MATCH') || easingRows.some((r) => r.status !== 'MATCH');
process.exitCode = failed ? 1 : 0;
