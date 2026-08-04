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
 * Card width is fixed (sized so the widest glyph, `W`, clears the pen at both
 * weights). Height is NOT: a letter with no descender would otherwise carry a
 * whole empty band of dead space under it, which makes the glyph read small and
 * the card bottom-heavy.
 *
 * The trim only ever moves the card's bottom edge — `yTop`, and therefore the
 * baseline, stay put — so flipping between letters in one stage never shifts
 * the writing lines under the child's hand.
 */
export const CANVAS = { w: 420 };

export function canvasHeight(theme, usesDescender) {
  const L = layout(theme);
  return Math.round((usesDescender ? L.yDesc : L.yBase) + theme.bandDesc * 0.52) + 26;
}

/** The tallest card any theme produces — a descender letter. Layout helpers
 *  that need a uniform row height (the contact-sheet tool) size against this,
 *  so it must be derived, not typed in: hard-coding it went stale the moment a
 *  band height changed, and descender cards silently overflowed their cell. */
export function maxCanvasHeight() {
  return Math.max(...Object.values(THEMES).map((t) => canvasHeight(t, true)));
}

export const THEMES = {
  /**
   * A — "Classroom ruled paper". Zaner-Bloser manuscript on the traditional
   * four-line rule: blue ceiling, dashed blue midline, red baseline, blue
   * descender. Equal 1:1:1 bands. Quiet, print-like, restrained celebration.
   */
  paper: {
    id: 'paper',
    label: 'Classroom paper',
    blurb: 'Four-line school rule — blue ceiling, dashed midline, red baseline. Pencil-weight ghost letter.',
    bg: '#FBFAF5',

    // Vertical rule placement (px). Equal bands.
    yTop: 108,
    bandAsc: 140,
    bandX: 140,
    bandDesc: 140,

    rules: {
      top: { color: '#7FA9D8', width: 2, dash: null, inset: 34 },
      mid: { color: '#A8C4E2', width: 2, dash: [8, 6], inset: 34 },
      base: { color: '#D24B4B', width: 3, dash: null, inset: 26 },
      desc: { color: '#7FA9D8', width: 2, dash: null, inset: 34 },
    },

    penRatio: 0.14,      // track/ink stroke width, as a fraction of the x-height
    inkRatio: 0.14,      // ink exactly covers the ghost — that coverage is the win
    track: '#C9CDD4',
    trackDashed: false,
    guide: '#AAB0B8',
    guideWidthRatio: 0.045,
    guideDash: [9, 13],
    ink: '#2B3A55',

    startDot: '#2E9E5B',
    startDotRatio: 2.0,  // diameter, in pen widths
    numeral: '#FFFFFF',
    arrow: '#E07B39',
    arrowRatio: 1.45,    // arrowhead length, in pen widths

    handle: '#2E9E5B',   // the EASY-mode draggable puck
    handleRing: '#FFFFFF',
    handleArrow: '#FFFFFF',

    spark: ['#F2B32E', '#2E9E5B'],
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
    caption: { color: '#AFAFAF', size: 18, x: 34, fromBottom: 38 },
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
