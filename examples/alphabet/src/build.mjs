/**
 * The document builder — one glyph dataset × two aesthetics × two difficulties.
 *
 * ## The two modes are two different capabilities, not two difficulty numbers
 *
 * **EASY** emits a `guided` block. The *player* owns the drag: the child grabs
 * a handle and pulls it along the authored path, the runtime trims the ink to
 * how far they got, and the arrow rotates to the path's tangent so the
 * direction cue comes from the letter itself. You cannot draw a wrong shape —
 * only a shorter one. That is the point at this stage: motor path first.
 *
 * **HARD** emits an `ink` block with a `match` target per pen-stroke. The child
 * free-draws; the runtime inks the raw pointer path and scores it against the
 * target (coverage / stray / startOk / endOk). Nothing snaps. The host decides
 * the pass threshold — scoring stays out of the document.
 *
 * Both modes share every pixel of the letter, the rules, and the guides. The
 * difference is which block the document carries, and whether the moving
 * handle or a static numbered start-chip marks where to begin.
 *
 * ## Node id conventions (the host relies on these)
 *
 *   rule*        the four writing lines
 *   trackN       the ghost/channel letter, one per pen-stroke — always visible
 *   gN_*         every guide for pen-stroke N (1-based) — the host hides group
 *                N and reveals group N+1 as each stroke completes
 *   inkN         what the child draws — one node per pen-stroke, so finished
 *                strokes persist instead of the next pen-down erasing them
 *   spark*       celebration, hidden at rest
 */

import { flattenStroke, resample, pathLength, endTangent } from './geom.mjs';
import { glyphFor } from './glyphs.mjs';
import { THEMES, layout, CANVAS, bottomLayout } from './themes.mjs';

const r1 = (v) => Number(v.toFixed(1));

/**
 * Place a glyph on the card and return, per pen-stroke, both paths:
 * `draw` (the pen's motion, retraces included — what the finger follows) and
 * `shape` (the visible outline — what gets painted and what free-draw scores
 * against).
 */
export function placeGlyph(letter, upper, theme) {
  const glyph = glyphFor(letter, upper);
  const L = layout(theme);
  const scale = L.unit;
  const originX = CANVAS.w / 2 - (glyph.w / 2) * scale;
  const px = (pts) => {
    const flat = [];
    for (const [gx, gy] of pts) flat.push(r1(originX + gx * scale), r1(L.mapY(gy)));
    return flat;
  };
  // 0.03 band units ≈ 4.5px of curve sampling — fine enough that a circle has
  // no visible facets at this pen weight, coarse enough to keep files small.
  const step = 0.03;
  return glyph.strokes.map((segs) => {
    // The outline as CONTIGUOUS PIECES, split wherever a retrace was removed.
    //
    // Dropping the retrace segments is not enough on its own: the remaining
    // points are still one polyline, so it bridges the gap and walks the stem a
    // second time. Solid ink hides that, but a DASHED guide does not — the two
    // passes interleave and the stem renders as a solid blue line while the
    // rest of the letter is dashed (`p`, `b`, `h`, `m`, `n`, `r`).
    const pieces = [];
    const backs = [];
    let cur = [];
    let back = [];
    const flushBack = () => { if (back.length) { backs.push(back); back = []; } };
    for (const seg of segs) {
      if (seg.retrace) {
        if (cur.length) { pieces.push(cur); cur = []; }
        // Consecutive retraces are ONE doubled-back run, not several — `d` slides up
        // its bowl and on up the stem without stopping.
        const pts = flattenStroke([seg], step);
        if (back.length) {
          const [lx, ly] = back[back.length - 1];
          if (Math.hypot(pts[0][0] - lx, pts[0][1] - ly) < step * 0.5) pts.shift();
          back.push(...pts);
        } else back = pts;
        continue;
      }
      flushBack();
      const pts = flattenStroke([seg], step);
      if (cur.length) {
        const [lx, ly] = cur[cur.length - 1];
        if (Math.hypot(pts[0][0] - lx, pts[0][1] - ly) < step * 0.5) pts.shift();
        cur.push(...pts);
      } else {
        cur = pts;
      }
    }
    if (cur.length) pieces.push(cur);
    flushBack();
    return {
      draw: px(flattenStroke(segs, step)),
      shape: px(flattenStroke(segs.filter((s) => !s.retrace), step)),
      pieces: pieces.map(px),
      // The doubled-back runs, kept apart from `pieces` so the dashed guide can show
      // them as their own lines while the solid ghost stays one continuous shape.
      //
      // Every doubled-back run gets its own dashed line, drawn exactly where the pen
      // travels — including the stretches that lie right on top of the outbound line.
      //
      // That superposition is the POINT, not a defect. Two dash patterns over the same
      // stretch fall out of phase and fill each other's gaps, so the doubled stretch
      // reads bolder and denser than the single-pass dashes around it. That density IS
      // the cue: it says the pen comes back along here. Where the run then leaves the
      // stem — `b`'s bowl, `h`'s arch — the bold stretch resolves into a second line
      // curving away, which is exactly the motion the child has to make.
      //
      // Three earlier attempts fought this instead of using it: a parallel offset, a
      // bend, and an arrow marker. All three moved or decorated the guide to avoid an
      // overlap that was doing the work on its own.
      backs: backs.map(px),
    };
  });
}

/**
 * Walk back along a flat polyline from its end by `d`, and report the heading there.
 *
 * Falls back to the whole path when it is shorter than `d` — the `i`/`j` dot is a
 * deliberate 5.6px stroke, far shorter than an arrow, and must still get an angle
 * rather than a division by zero.
 */
function backFromEnd(flat, d) {
  const n = flat.length / 2;
  const px_ = (i) => flat[i * 2];
  const py_ = (i) => flat[i * 2 + 1];
  let walked = 0;
  for (let i = n - 1; i > 0; i--) {
    const seg = Math.hypot(px_(i) - px_(i - 1), py_(i) - py_(i - 1));
    if (walked + seg >= d) {
      const t = (d - walked) / (seg || 1);
      return {
        x: r1(px_(i) + (px_(i - 1) - px_(i)) * t),
        y: r1(py_(i) + (py_(i - 1) - py_(i)) * t),
        angle: endTangent(flat),
      };
    }
    walked += seg;
  }
  return { x: r1(px_(0)), y: r1(py_(0)), angle: endTangent(flat) };
}

/** A pointing triangle whose local geometry points DOWN at rotation 0 — the
 *  convention the player's `arrow` rotation (tangent − 90°) is written for. */
function arrowHead(id, x, y, rotation, size, fill, opacity) {
  const halfW = size * 0.42;
  return {
    id, type: 'stroke', x: r1(x), y: r1(y),
    points: [-halfW, -size * 0.34, halfW, -size * 0.34, 0, size * 0.5],
    closed: true, fill, rotation: r1(rotation), opacity,
  };
}

/** An 8-point star, used for the celebration burst. */
function star(id, x, y, r, fill) {
  const pts = [];
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.4;
    pts.push(r1(x + rad * Math.cos(a)), r1(y + rad * Math.sin(a)));
  }
  return { id, type: 'stroke', x: 0, y: 0, points: pts, closed: true, fill, tension: 0.1, opacity: 0 };
}

/**
 * Drop points that land on top of one that came before. A scoring target must
 * count each part of the letter once — where a path doubles back, the repeated
 * vertices weight that stretch twice and make a partial attempt look complete.
 *
 * Known consequence: collapsing a retrace leaves a straight gap between the
 * surviving neighbours (up to ~270px on `p`), so the target has corridors where
 * no vertex sits. Coverage is unaffected — it counts vertices, and all of them
 * are still on the letter — but the `stray` term is blind inside a corridor.
 * Measured across the corpus: no false negative, no new lazy-chord pass.
 */
function dedupe(flat, minGap) {
  const out = [];
  const g2 = minGap * minGap;
  for (let i = 0; i < flat.length; i += 2) {
    const x = flat[i];
    const y = flat[i + 1];
    let seen = false;
    for (let k = 0; k < out.length; k += 2) {
      const dx = out[k] - x;
      const dy = out[k + 1] - y;
      if (dx * dx + dy * dy < g2) { seen = true; break; }
    }
    if (!seen) out.push(x, y);
  }
  // Never collapse a target out of existence. The `i`/`j` dot is a deliberate
  // 5.6px stroke — shorter than the gap that catches a retrace — and reducing
  // it to a single point makes the document invalid.
  return out.length >= 4 ? out : flat;
}

export function buildDoc({ letter, upper, mode, theme: themeId }) {
  const theme = THEMES[themeId];
  if (!theme) throw new Error(`unknown theme: ${themeId}`);
  const easy = mode === 'easy';
  const L = layout(theme);
  const strokes = placeGlyph(letter, upper, theme);
  const nodes = [];

  const bottom = bottomLayout(theme);
  const H = bottom.height;

  // ---- the card ------------------------------------------------------------
  if (theme.panel) {
    const p = theme.panel;
    const ph = H - p.y - p.inset - p.edgeOffset;
    nodes.push({
      id: 'cardEdge', type: 'rect', x: p.x, y: p.y + p.edgeOffset,
      w: p.w, h: ph, cornerRadius: p.radius, fill: p.edge,
    });
    nodes.push({
      id: 'card', type: 'rect', x: p.x, y: p.y, w: p.w, h: ph,
      cornerRadius: p.radius, fill: p.fill, stroke: p.border, strokeWidth: p.borderWidth,
    });
  }

  // ---- writing rules -------------------------------------------------------
  const rule = (id, y, spec) => nodes.push({
    id, type: 'stroke', x: 0, y: 0,
    points: [spec.inset, y, CANVAS.w - spec.inset, y],
    stroke: spec.color, strokeWidth: spec.width,
    ...(spec.dash ? { dash: spec.dash } : {}),
  });
  // Exactly three, for every letter. A descender hangs below the baseline with
  // no line to catch it — drawing a fourth rule only for `g j p q y` made those
  // cards read as a different worksheet from the rest of the alphabet.
  rule('ruleTop', L.yTop, theme.rules.top);
  rule('ruleMid', L.yMid, theme.rules.mid);
  rule('ruleBase', L.yBase, theme.rules.base);

  // ---- the ghost / channel letter -----------------------------------------
  // Theme B's "hollow channel" is two stacked polylines: a wider outline colour
  // underneath, the fill on top. That reads as an outlined tube without the
  // format needing a stroked-stroke primitive.
  //
  // Every outline goes down BEFORE any fill. Interleaving them per stroke draws
  // stroke 2's outline across stroke 1's fill, so the `A` crossbar would look
  // like it had been laid on top of the diagonals instead of merging with them.
  // The ghost is drawn from the pen's FULL path, retraces included — so the grey
  // letter is exactly the shape the child's ink makes when they finish. Building it
  // from the retrace-split pieces (which the dashed guide below still must use) left
  // the ghost missing the doubled-back stretch that the ink does draw, so the letter
  // the child traced was not the letter they were shown.
  //
  // Solid ink can carry an overlap that a dash pattern cannot: one continuous
  // polyline painted twice over the same stretch is indistinguishable from painted
  // once, whereas interleaved dashes fill each other's gaps and read as a solid line.
  // That asymmetry is the whole reason these two layers are built differently.
  if (theme.trackOutline) {
    strokes.forEach((s, i) => nodes.push({
      id: `trackEdge${i + 1}`, type: 'stroke', x: 0, y: 0, points: s.draw,
      stroke: theme.trackOutline, strokeWidth: L.pen + theme.trackOutlineWidth * 2, tension: 0,
    }));
  }
  strokes.forEach((s, i) => nodes.push({
    id: `track${i + 1}`, type: 'stroke', x: 0, y: 0, points: s.draw,
    stroke: theme.track, strokeWidth: L.pen, tension: 0,
  }));

  // ---- per-stroke guides ---------------------------------------------------
  // Only stroke 1's guides are lit at rest; the host reveals each next group as
  // the previous stroke completes. Whole-letter guidance at once is noise.
  strokes.forEach((s, i) => {
    const n = i + 1;
    const on = i === 0 ? 1 : 0;
    const guideW = Math.max(2, Math.round(L.unit * theme.guideWidthRatio));

    s.pieces.forEach((piece, k) => nodes.push({
      id: `g${n}_dash${k ? `_${k}` : ''}`, type: 'stroke', x: 0, y: 0, points: piece,
      stroke: theme.guide, strokeWidth: guideW, dash: theme.guideDash, tension: 0, opacity: on,
    }));

    // The doubled-back run gets its OWN dashed line. This is the one layer where the
    // overlap is meant to show: the ghost and the finished ink are the same single
    // shape, and it is the guide that tells the child the pen comes back down this
    // way. Each stretch is still dashed exactly once — the pieces and the backs are
    // disjoint — so nothing interleaves into a solid line. Where the two lines run
    // close together near the baseline they read as converging, which is what the
    // motion actually does.
    s.backs.forEach((piece, k) => nodes.push({
      id: `g${n}_back${k ? `_${k}` : ''}`, type: 'stroke', x: 0, y: 0, points: piece,
      stroke: theme.guide, strokeWidth: guideW, dash: theme.guideDash, tension: 0, opacity: on,
    }));

    // ONE arrowhead per stroke, at the end of the dashed path and continuous
    // with it — so the guide reads as a single line with a point on it.
    //
    // There used to be extra heads part-way along, offset perpendicular so they
    // floated beside the letter. They looked like a detached arrowhead with no
    // line attached, and they said nothing the dashed path was not already
    // saying. Removed rather than restyled.
    // A glyph may ask for the head to STOP SHORT of the path's end, via `arrowBack`.
    // The head is positioned by its centre while its point reaches half a length
    // further on, so by default the point sits just past the last vertex — which is
    // right for a stroke that ends in open space, and wrong for one that ends where
    // the pen doubled back onto its own line. Only `b` closes on its own stem, so only
    // `b` sets it; every other letter keeps the placement it already had.
    const arrowSize = L.pen * theme.arrowRatio;
    const back = arrowSize * (glyphFor(letter, upper).arrowBack ?? 0);
    const at = back > 0
      ? backFromEnd(s.draw, back)
      : { x: s.draw[s.draw.length - 2], y: s.draw[s.draw.length - 1], angle: endTangent(s.draw) };
    nodes.push(arrowHead(`g${n}_end`, at.x, at.y, at.angle - 90, arrowSize, theme.arrow, on));

    nodes.push({
      id: `ink${n}`, type: 'stroke', x: 0, y: 0, points: [],
      stroke: theme.ink, strokeWidth: L.inkPen, tension: 0,
    });
  });

  // Ink must sit above the guides but below the start markers, so the markers
  // are pushed after every ink node exists.
  strokes.forEach((s, i) => {
    const n = i + 1;
    const on = i === 0 ? 1 : 0;
    const sx = s.draw[0];
    const sy = s.draw[1];
    // The bead marks a spot; the puck is a touch target. Different jobs, so
    // they are sized independently rather than one being a scale of the other.
    const beadR = Math.max(5, (L.pen * theme.startDotRatio) / 2);
    const puckR = Math.max(17, L.pen * 1.15);

    if (easy) {
      // The draggable puck: a filled blue disc with a white arrow inside,
      // pointing the way. It is the only thing on the card the child touches.
      nodes.push({
        id: `g${n}_curC`, type: 'circle', x: r1(sx), y: r1(sy), r: r1(puckR),
        fill: theme.handle, opacity: on,
      });
      nodes.push({
        id: `g${n}_curA`, type: 'stroke', x: r1(sx), y: r1(sy),
        points: [-puckR * 0.16, -puckR * 0.46, puckR * 0.16, -puckR * 0.46, puckR * 0.16, 0,
          puckR * 0.44, 0, 0, puckR * 0.56, -puckR * 0.44, 0, -puckR * 0.16, 0],
        closed: true, fill: theme.handleArrow, rotation: 0, opacity: on,
      });
    } else {
      // Free write: a small bead where the stroke begins, the same blue as the
      // path it starts. Deliberately no numeral — the guide only ever shows one
      // stroke at a time, so there is no sequence to disambiguate, and a digit
      // inside the bead just makes it a badge to read instead of a place to
      // put your finger.
      nodes.push({
        id: `g${n}_dot`, type: 'circle', x: r1(sx), y: r1(sy), r: r1(beadR),
        fill: theme.startDot, opacity: on,
      });
    }
  });

  // ---- celebration ---------------------------------------------------------
  // Deterministic placement (no RNG) so the same letter always renders the same
  // file — a byte-stable build is what makes the validate-and-diff loop useful.
  for (let i = 0; i < theme.sparkCount; i++) {
    const a = (i / theme.sparkCount) * Math.PI * 2 + 0.6;
    const rx = CANVAS.w * 0.40;
    const ry = (H - L.yTop) * 0.52;
    const cx = CANVAS.w / 2 + Math.cos(a) * rx;
    const cy = (L.yTop + L.yBase) / 2 + Math.sin(a) * ry;
    nodes.push(star(`spark${i}`, cx, cy, i % 2 === 0 ? 17 : 11, theme.spark[i % theme.spark.length]));
  }

  // ---- chrome --------------------------------------------------------------
  const glyphLabel = `${letter.toUpperCase()}${letter.toLowerCase()}`;
  nodes.push({
    id: 'label', type: 'text', x: theme.label.x, y: theme.label.y,
    text: glyphLabel, size: theme.label.size, fill: theme.label.color, fontStyle: 'bold',
  });
  const caseWord = upper ? 'Uppercase' : 'Lowercase';
  const strokeWord = strokes.length === 1 ? '1 stroke' : `${strokes.length} strokes`;
  nodes.push({
    id: 'caption', type: 'text', x: theme.caption.x, y: r1(bottom.captionTop),
    text: `${caseWord} ${upper ? letter.toUpperCase() : letter.toLowerCase()}  ·  ${strokeWord}  ·  ${easy ? 'Guided' : 'Free write'}`,
    size: theme.caption.size, fill: theme.caption.color,
  });

  const doc = {
    schema: 'glamour/v0.1',
    canvas: { w: CANVAS.w, h: H, bg: theme.bg },
    nodes,
  };

  if (easy) {
    doc.guided = {
      // ~6px spacing keeps the drag's feel even: the player projects the finger
      // onto a fixed 52px forward window, so uneven spacing would make the ink
      // run faster along some segments than others.
      strokes: strokes.map((s, i) => ({
        path: resample(s.draw, 6),
        into: `ink${i + 1}`,
        handle: `g${i + 1}_curC`,
        arrow: `g${i + 1}_curA`,
      })),
      grab: 46,
      emit: 'strokeDone',
    };
  } else {
    doc.ink = {
      strokes: strokes.map((s, i) => ({
        into: `ink${i + 1}`,
        match: {
          // Score against the visible outline, not the pen motion. Filtering the
          // retrace SEGMENTS is not enough on its own: the polyline still bridges
          // the gap they left, re-walking the stem, so `b`'s target counted its
          // stem twice and a child who drew only the stem scored 0.64 — a pass.
          // Collapsing coincident points makes each part of the letter count once.
          // Gap 6 against an 8px resample: catches a doubled-back pass without
          // touching legitimately-consecutive points.
          target: dedupe(resample(s.shape, 8), 6),
          // Tolerance is how far off the line a point may sit and still count.
          // At 1.15×pen (59px in the card theme, 14% of the canvas) a single
          // straight swipe from the start dot to the end dot passed 14 of the 68
          // curved strokes in the corpus — a child drawing a line instead of a
          // `u` was told they were right. 0.75×pen takes that to 1, and every
          // careful trace still scores 1.00.
          tolerance: Math.max(20, Math.round(L.pen * 0.75)),
        },
      })),
      emit: 'strokeDone',
    };
  }

  return doc;
}
