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
import { THEMES, layout, CANVAS, canvasHeight } from './themes.mjs';

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
  return glyph.strokes.map((segs) => ({
    draw: px(flattenStroke(segs, step)),
    shape: px(flattenStroke(segs.filter((s) => !s.retrace), step)),
  }));
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

/** Point and tangent at fraction `t` along a flat polyline. */
function atFraction(flat, t) {
  const total = pathLength(flat);
  const want = total * t;
  let d = 0;
  for (let i = 2; i < flat.length; i += 2) {
    const seg = Math.hypot(flat[i] - flat[i - 2], flat[i + 1] - flat[i - 1]);
    if (d + seg >= want || i === flat.length - 2) {
      const f = seg === 0 ? 0 : (want - d) / seg;
      return {
        x: flat[i - 2] + (flat[i] - flat[i - 2]) * f,
        y: flat[i - 1] + (flat[i + 1] - flat[i - 1]) * f,
        deg: (Math.atan2(flat[i + 1] - flat[i - 1], flat[i] - flat[i - 2]) * 180) / Math.PI,
      };
    }
    d += seg;
  }
  return { x: flat[0], y: flat[1], deg: 0 };
}

/**
 * Where direction arrows go along one stroke: always ~40% in (worksheets put
 * the head where direction needs confirming, not where the pencil stops), plus
 * one shortly after any turn sharper than 60°, which is what makes `Z`, `W`
 * and the `h` arch readable rather than ambiguous. Two is the ceiling.
 */
function arrowAnchors(flat) {
  const anchors = [0.4];
  const total = pathLength(flat);
  let d = 0;
  let prevDeg = null;
  for (let i = 2; i < flat.length; i += 2) {
    const dx = flat[i] - flat[i - 2];
    const dy = flat[i + 1] - flat[i - 1];
    const seg = Math.hypot(dx, dy);
    if (seg > 0.5) {
      const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
      if (prevDeg !== null) {
        let turn = Math.abs(((deg - prevDeg + 540) % 360) - 180);
        if (turn > 60) {
          const t = (d + seg) / total + 0.10;
          // Past 0.8 the corner head crowds the end arrowhead — `L` and `Z`
          // ended up with two triangles a few pixels apart on the final bar.
          if (t <= 0.8 && anchors.every((a) => Math.abs(a - t) > 0.18)) anchors.push(t);
        }
      }
      prevDeg = deg;
    }
    d += seg;
  }
  // Two heads is the ceiling. `W` generates four corner candidates and a page
  // of arrowheads stops reading as direction and starts reading as decoration.
  return anchors.slice(0, 2).sort((a, b) => a - b);
}

/**
 * Approximate top-left placement for a numeral so it lands optically centred
 * on (cx, cy). Text nodes anchor at the top-left of their raster box, and the
 * format exposes no measure hook, so this is a calibrated estimate for digits
 * in the default sans: ~0.56em wide, cap centre ~0.66em below the box top.
 */
const centreDigit = (cx, cy, size) => ({ x: r1(cx - size * 0.28), y: r1(cy - size * 0.66) });

export function buildDoc({ letter, upper, mode, theme: themeId }) {
  const theme = THEMES[themeId];
  if (!theme) throw new Error(`unknown theme: ${themeId}`);
  const easy = mode === 'easy';
  const L = layout(theme);
  const strokes = placeGlyph(letter, upper, theme);
  const nodes = [];

  // The descender rule is noise unless the glyph genuinely lives in that band.
  // `Q`'s tail only nicks it, and drawing a full fourth rule for that reads as
  // a mistake; `g j p q y` drop far enough to need the floor. The same test
  // sizes the card, so a letter with no tail carries no empty band either.
  const descendThreshold = L.yBase + theme.bandDesc * 0.4;
  const usesDescender = strokes.some((s) => {
    for (let i = 1; i < s.shape.length; i += 2) if (s.shape[i] > descendThreshold) return true;
    return false;
  });
  const H = canvasHeight(theme, usesDescender);

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
  rule('ruleTop', L.yTop, theme.rules.top);
  rule('ruleMid', L.yMid, theme.rules.mid);
  rule('ruleBase', L.yBase, theme.rules.base);
  if (usesDescender) rule('ruleDesc', L.yDesc, theme.rules.desc);

  // ---- the ghost / channel letter -----------------------------------------
  // Theme B's "hollow channel" is two stacked polylines: a wider outline colour
  // underneath, the fill on top. That reads as an outlined tube without the
  // format needing a stroked-stroke primitive.
  //
  // Every outline goes down BEFORE any fill. Interleaving them per stroke draws
  // stroke 2's outline across stroke 1's fill, so the `A` crossbar would look
  // like it had been laid on top of the diagonals instead of merging with them.
  if (theme.trackOutline) {
    strokes.forEach((s, i) => nodes.push({
      id: `trackEdge${i + 1}`, type: 'stroke', x: 0, y: 0, points: s.shape,
      stroke: theme.trackOutline, strokeWidth: L.pen + theme.trackOutlineWidth * 2, tension: 0,
    }));
  }
  strokes.forEach((s, i) => nodes.push({
    id: `track${i + 1}`, type: 'stroke', x: 0, y: 0, points: s.shape,
    stroke: theme.track, strokeWidth: L.pen, tension: 0,
  }));

  // ---- per-stroke guides ---------------------------------------------------
  // Only stroke 1's guides are lit at rest; the host reveals each next group as
  // the previous stroke completes. Whole-letter guidance at once is noise.
  strokes.forEach((s, i) => {
    const n = i + 1;
    const on = i === 0 ? 1 : 0;
    const guideW = Math.max(2, Math.round(L.unit * theme.guideWidthRatio));

    nodes.push({
      id: `g${n}_dash`, type: 'stroke', x: 0, y: 0, points: s.shape,
      stroke: theme.guide, strokeWidth: guideW, dash: theme.guideDash, tension: 0, opacity: on,
    });

    const arrowSize = L.pen * theme.arrowRatio;
    // Static direction arrows are HARD-mode furniture only. In EASY the puck
    // travels the path with the arrow already rotating to the tangent, so a
    // second set of frozen arrows is redundant clutter — and on a retraced
    // stem it actively contradicts the puck ("down" and "up" at once).
    if (!easy) {
      arrowAnchors(s.draw).forEach((t, k) => {
        const p = atFraction(s.draw, t);
        // On paper the head sits beside the pencil line; in the fat app channel
        // it belongs inside the channel, where there is room for it.
        const off = theme.trackOutline ? 0 : L.pen * 1.25;
        const nx = Math.cos(((p.deg + 90) * Math.PI) / 180) * off;
        const ny = Math.sin(((p.deg + 90) * Math.PI) / 180) * off;
        nodes.push(arrowHead(`g${n}_arr${k}`, p.x + nx, p.y + ny, p.deg - 90, arrowSize, theme.arrow, on));
      });
    }

    const tip = { x: s.draw[s.draw.length - 2], y: s.draw[s.draw.length - 1] };
    nodes.push(arrowHead(`g${n}_end`, tip.x, tip.y, endTangent(s.draw) - 90, arrowSize * 1.05, theme.arrow, on));

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
    const dotR = Math.max(11, (L.pen * theme.startDotRatio) / 2);
    const numSize = Math.round(dotR * 1.25);

    if (easy) {
      // The draggable puck. The player moves it to the ink tip and rotates the
      // arrow to the path tangent, so both must exist as separate nodes.
      nodes.push({
        id: `g${n}_curC`, type: 'circle', x: r1(sx), y: r1(sy), r: r1(dotR * 1.05),
        fill: theme.handle, stroke: theme.handleRing, strokeWidth: 3, opacity: on,
      });
      nodes.push({
        id: `g${n}_curA`, type: 'stroke', x: r1(sx), y: r1(sy),
        points: [-2.6, -dotR * 0.5, 2.6, -dotR * 0.5, 2.6, 0, dotR * 0.46, 0, 0, dotR * 0.62,
          -dotR * 0.46, 0, -2.6, 0],
        closed: true, fill: theme.handleArrow, rotation: 0, opacity: on,
      });
      // A static numeral beside the start, so multi-stroke order stays legible
      // once the puck has moved away. Single-stroke letters don't get one — the
      // puck already says "start here", and a lone "1" is just clutter.
      //
      // Offset HORIZONTALLY, away from the glyph's centre. Stacking it above the
      // puck put it straight through the "Aa" label on every letter whose first
      // stroke starts at the top-left (H, M, N, V, W, …).
      if (strokes.length > 1) {
        const side = sx < CANVAS.w / 2 ? -1 : 1;
        const c = centreDigit(sx + side * dotR * 2.3, sy, numSize);
        nodes.push({
          id: `g${n}_num`, type: 'text', x: c.x, y: c.y, text: String(n),
          size: numSize, fill: theme.numeralOutside, fontStyle: 'bold', opacity: on,
        });
      }
    } else {
      nodes.push({
        id: `g${n}_dot`, type: 'circle', x: r1(sx), y: r1(sy), r: r1(dotR),
        fill: theme.startDot, stroke: theme.handleRing, strokeWidth: theme.trackOutline ? 3 : 0,
        opacity: on,
      });
      const c = centreDigit(sx, sy, numSize);
      nodes.push({
        id: `g${n}_num`, type: 'text', x: c.x, y: c.y, text: String(n),
        size: numSize, fill: theme.numeral, fontStyle: 'bold', opacity: on,
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
    id: 'caption', type: 'text', x: theme.caption.x, y: H - theme.caption.fromBottom,
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
          // `u` was told they were right. 0.75×pen takes that to 2, and every
          // careful trace still scores 1.00.
          tolerance: Math.max(20, Math.round(L.pen * 0.75)),
        },
      })),
      emit: 'strokeDone',
    };
  }

  return doc;
}
