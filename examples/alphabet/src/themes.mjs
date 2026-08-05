/**
 * The two worksheet aesthetics, as data.
 *
 * Both are derived from real printable tracing worksheets and kid-facing
 * tracing apps (see `docs/ALPHABET-WORKSHEET-STYLES.md` for the sources). The
 * glyph data is identical between them — only the pen changes. The single
 * biggest lever is `penRatio`: 0.14 of the x-height reads as a pencil on ruled
 * paper, 0.34 reads as a chunky app channel.
 */

/**
 * Every card is the SAME size, for every letter.
 *
 * An earlier version trimmed the bottom off letters with no descender, to avoid
 * an empty band. That was wrong once the stage started scaling cards to fit: a
 * taller `y` card was scaled down more than an `a` card, so the writing lines
 * themselves changed size and position on screen as the child moved between
 * letters. The rules are the one thing that must never move — they are what the
 * child reads height against. Reserve the descender space always, and let the
 * letters that do not use it simply not use it, exactly as a worksheet does.
 */
export const CANVAS = { w: 420 };

/**
 * Everything below the baseline, derived rather than guessed.
 *
 * Three constraints stack up and a single magic constant kept satisfying two of
 * them: the deepest ink (`p` and `q` reach y=3, plus half a pen for the round
 * cap), the caption sitting clear of that ink, and — in the card theme — the
 * caption also sitting inside the panel, whose bottom edge is itself derived
 * from the height. Solve it in one place instead.
 */
export function bottomLayout(theme) {
  const L = layout(theme);
  const inkBottom = L.yBase + theme.bandDesc + L.pen / 2;
  const captionTop = inkBottom + 14;
  const captionH = theme.caption.size * 1.35;
  // The card theme's caption lives inside the panel, which stops short of the
  // canvas edge by its own inset plus its offset bottom edge.
  const below = theme.panel ? theme.panel.inset + theme.panel.edgeOffset + 12 : 18;
  return { inkBottom, captionTop, height: Math.round(captionTop + captionH + below) };
}

export function canvasHeight(theme) {
  return bottomLayout(theme).height;
}

/** The tallest card any theme produces — a descender letter. Layout helpers
 *  that need a uniform row height (the contact-sheet tool) size against this,
 *  so it must be derived, not typed in: hard-coding it went stale the moment a
 *  band height changed, and descender cards silently overflowed their cell. */
export function maxCanvasHeight() {
  return Math.max(...Object.values(THEMES).map((t) => canvasHeight(t)));
}

export const THEMES = {
  /**
   * A — "Classroom ruled paper". Zaner-Bloser manuscript letterforms on a quiet
   * three-line rule, styled the way a modern tracing app draws it: everything
   * structural in near-invisible grey, and one saturated blue reserved entirely
   * for "here is what to do next" — the start point, the path, the arrow.
   *
   * THREE rules, not four, and the same three for every letter. Descenders hang
   * below the baseline with no extra line to catch them; adding a fourth rule
   * only for `g j p q y` made those cards read as a different worksheet.
   */
  paper: {
    id: 'paper',
    label: 'Classroom paper',
    blurb: 'Quiet three-line rule, pencil-weight ghost letter, and one blue for the path to follow.',
    bg: '#FFFFFF',

    // Vertical rule placement (px). Equal bands.
    yTop: 108,
    bandAsc: 140,
    bandX: 140,
    bandDesc: 140,

    rules: {
      top: { color: '#E8E8E8', width: 2, dash: null, inset: 26 },
      mid: { color: '#E0E0E0', width: 2, dash: [11, 11], inset: 26 },
      base: { color: '#E8E8E8', width: 2, dash: null, inset: 26 },
    },

    penRatio: 0.145,     // track/ink stroke width, as a fraction of the x-height
    inkRatio: 0.145,     // ink exactly covers the ghost — that coverage is the win
    track: '#E4E4E4',
    trackDashed: false,
    guide: '#45A6E8',        // the blue is the instruction, and nothing else is blue
    guideWidthRatio: 0.042,
    guideDash: [8, 9],
    ink: '#4A4A4A',          // graphite, not navy: it must read as pencil on paper

    startDot: '#45A6E8',
    startDotRatio: 0.7,  // diameter, in pen widths — a small bead, not a badge
    numeral: '#FFFFFF',
    arrow: '#45A6E8',
    arrowRatio: 1.25,    // arrowhead length, in pen widths

    handle: '#45A6E8',   // the EASY-mode draggable puck
    handleRing: '#FFFFFF',
    handleArrow: '#FFFFFF',

    spark: ['#F2B32E', '#45A6E8'],
    sparkCount: 8,

    label: { color: '#3A3A3A', size: 40, x: 34, y: 28 },
    caption: { color: '#8A8578', size: 17, x: 34, fromBottom: 36 },
    numeralOutside: '#3A3A3A',
  },

  /**
   * B — "Modern kid-app card". Handwriting Without Tears shapes as a rounded
   * sans, rendered as a chunky hollow channel the child fills. Squeezed
   * ascender / short descender (0.9 : 1 : 0.7) so the letter fills the frame.
   * Fewer rules: the baseline is a drawn shelf, everything else recedes.
   */
  card: {
    id: 'card',
    label: 'Kid-app card',
    blurb: 'Chunky hollow channel on a soft card — one bold baseline shelf, the letter fills the frame.',
    bg: '#FFF7E8',

    yTop: 124,
    bandAsc: 135,   // 0.9 H
    bandX: 150,     // H
    bandDesc: 105,  // 0.7 H

    rules: {
      top: { color: '#E8EDF3', width: 2, dash: [4, 10], inset: 64 },
      mid: { color: '#DDE5EF', width: 3, dash: [10, 14], inset: 64 },
      base: { color: '#C9D4E2', width: 6, dash: null, inset: 50 },
      desc: { color: '#E8EDF3', width: 2, dash: [4, 10], inset: 64 },
    },

    penRatio: 0.34,
    inkRatio: 0.30,      // narrower than the channel — the margin reads as "inside the lines"
    track: '#DDE7F2',
    trackOutline: '#B9C9DD',
    trackOutlineWidth: 4,
    trackDashed: false,
    guide: '#9FB3CB',
    guideWidthRatio: 0.035,
    guideDash: [5, 22],
    ink: '#1CB0F6',

    startDot: '#FF9600',
    startDotRatio: 0.55,
    numeral: '#FFFFFF',
    arrow: '#FF4B4B',
    arrowRatio: 0.42,

    handle: '#FF9600',
    handleRing: '#FFFFFF',
    handleArrow: '#FFFFFF',

    spark: ['#FFC800', '#58CC02', '#1CB0F6', '#CE82FF', '#FF4B4B', '#FF9600'],
    sparkCount: 12,

    success: '#58CC02',

    // The white card the letter sits on — a drawn object, with the flat
    // bottom-only offset edge the app aesthetic uses instead of a blurred
    // material shadow. Aesthetic A deliberately has none: there, the page IS
    // the surface.
    panel: {
      x: 18, y: 16, w: 384, inset: 16, radius: 32,
      fill: '#FFFFFF', border: '#E5E5E5', borderWidth: 3,
      edge: '#DFE3E8', edgeOffset: 7,
    },

    label: { color: '#4B4B4B', size: 42, x: 40, y: 32 },
    // Clear of the panel: its bottom edge sits at H-23, and x must miss the
    // 32px corner radius that starts at x=18.
    caption: { color: '#AFAFAF', size: 18, x: 58, fromBottom: 54 },
    numeralOutside: '#4B4B4B',
  },
};

/** Resolve a theme's rule y-positions and the band→pixel mapping. */
export function layout(theme) {
  const yTop = theme.yTop;
  const yMid = yTop + theme.bandAsc;
  const yBase = yMid + theme.bandX;
  const yDesc = yBase + theme.bandDesc;
  const unit = theme.bandX; // the x-height band is the module for x and for pen width
  return {
    yTop, yMid, yBase, yDesc, unit,
    pen: Math.round(unit * theme.penRatio),
    inkPen: Math.round(unit * theme.inkRatio),
    /** Band-unit y (0 top · 1 mid · 2 base · 3 desc) → pixels, piecewise. */
    mapY(y) {
      if (y <= 1) return yTop + y * theme.bandAsc;
      if (y <= 2) return yMid + (y - 1) * theme.bandX;
      return yBase + (y - 2) * theme.bandDesc;
    },
  };
}

export const THEME_IDS = Object.keys(THEMES);
