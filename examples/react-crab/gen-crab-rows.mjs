// Generates the letter-hunt crab doc + a manifest the host game reads.
// 3 rows of crabs conveyor-belting horizontally (seamless one-tile wrap, mixed
// directions). Each crab wears a letter. One TARGET letter is placed on K crabs
// (K in 3..5). The doc only shows + emits + moves; the HOST (React) owns the
// game: which letter is the target, correct/wrong, sparkle, win/lose.
//
// Base crab color is neutral ORANGE so the host's green(correct)/red(wrong)
// recolor via player.set reads as a clear change. The manifest gives the host
// each crab's body + claw node ids (all recolored together) and its letter.
//
// Regenerate:  node examples/react-crab/gen-crab-rows.mjs \
//                examples/react-crab/src/crab.json examples/react-crab/src/crab-letters.json
import { writeFileSync } from 'node:fs';

const W = 400, H = 300;
const TILE = 100;
const CRABS_PER_ROW = 6;
const ROWS = [
  { y: 105, dir: 'LR', ms: 3000 },
  { y: 185, dir: 'RL', ms: 2600 }, // the odd-direction row
  { y: 255, dir: 'LR', ms: 3400 },
];

const ORANGE = '#f2913f', CLAW = '#e07d2e', WHITE = '#ffffff', PUPIL = '#22303a', GLYPH = '#1e2c36';

const groups = [{ id: 'bg', x: 0, y: 0 }];
const nodes = [];

nodes.push({ id: 'sky', type: 'rect', x: 0, y: 0, w: W, h: 150, fill: '#bfe8fb', group: 'bg' });
nodes.push({ id: 'sea', type: 'rect', x: 0, y: 138, w: W, h: 22, fill: '#6cc5e0', group: 'bg' });
nodes.push({ id: 'sand', type: 'rect', x: 0, y: 150, w: W, h: H - 150, fill: '#f2d9a0', group: 'bg' });
nodes.push({ id: 'sun', type: 'circle', x: 355, y: 40, r: 24, fill: '#ffd76b', group: 'bg' });

// --- pick the puzzle ---
const ALPHABET = 'ABCDEFGHJKLMNPRSTUVWY'.split(''); // drop easily-confused I/O/Q/X/Z
const rand = (n) => Math.floor(Math.random() * n);
const TOTAL = ROWS.length * CRABS_PER_ROW; // 18
const target = ALPHABET[rand(ALPHABET.length)];
const K = 3 + rand(3); // 3..5 correct crabs
const correctIdx = new Set();
while (correctIdx.size < K) correctIdx.add(rand(TOTAL));
const others = ALPHABET.filter((c) => c !== target);

const loops = [];
const manifest = [];
let idx = 0;

ROWS.forEach((row, r) => {
  const gid = `row${r}`;
  groups.push({ id: gid, x: 0, y: row.y });
  for (let c = 0; c < CRABS_PER_ROW; c++) {
    const cx = c * TILE;
    const p = `r${r}c${c}`;
    const isCorrect = correctIdx.has(idx);
    const letter = isCorrect ? target : others[rand(others.length)];
    const bodyId = `${p}_body`, clawL = `${p}_clawL`, clawR = `${p}_clawR`;
    nodes.push({ id: bodyId, type: 'circle', x: cx, y: 0, r: 17, fill: ORANGE, group: gid, emit: bodyId });
    nodes.push({ id: clawL, type: 'circle', x: cx - 21, y: 5, r: 8, fill: CLAW, group: gid });
    nodes.push({ id: clawR, type: 'circle', x: cx + 21, y: 5, r: 8, fill: CLAW, group: gid });
    nodes.push({ id: `${p}_eyeL`, type: 'circle', x: cx - 6, y: -16, r: 4.5, fill: WHITE, group: gid });
    nodes.push({ id: `${p}_eyeR`, type: 'circle', x: cx + 6, y: -16, r: 4.5, fill: WHITE, group: gid });
    nodes.push({ id: `${p}_pupL`, type: 'circle', x: cx - 6, y: -16, r: 2, fill: PUPIL, group: gid });
    nodes.push({ id: `${p}_pupR`, type: 'circle', x: cx + 6, y: -16, r: 2, fill: PUPIL, group: gid });
    nodes.push({ id: `${p}_ltr`, type: 'text', x: cx - 6, y: -8, text: letter, size: 17, fontStyle: 'bold', fill: GLYPH, group: gid });
    manifest.push({ body: bodyId, clawL, clawR, letter });
    idx++;
  }
  const [from, to] = row.dir === 'LR' ? [-TILE, 0] : [0, -TILE];
  loops.push({ node: gid, prop: 'x', from, to, ms: row.ms, mode: 'loop' });
});

const doc = { schema: 'glamour/v0.1', canvas: { w: W, h: H, bg: '#bfe8fb' }, groups, nodes, loops };

const [docOut, manOut] = [process.argv[2], process.argv[3]];
writeFileSync(docOut, JSON.stringify(doc, null, 2) + '\n');
writeFileSync(manOut, JSON.stringify({ target, total: K, crabs: manifest }, null, 2) + '\n');
console.log(`wrote ${docOut}: ${nodes.length} nodes; target "${target}" x${K}; manifest ${manOut}`);
