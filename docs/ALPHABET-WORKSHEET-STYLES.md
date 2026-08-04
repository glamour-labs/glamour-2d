> **How this doc is used.** These are the two aesthetics the alphabet tracing game ships,
> encoded as data in `examples/alphabet/src/themes.mjs` — aesthetic A is theme `paper`,
> aesthetic B is theme `card`. Both render the *same* glyph data
> (`examples/alphabet/src/glyphs.mjs`); only the pen changes. Research pass: 2026-08-05.
>
> Play them side by side: `pnpm playground` → <http://localhost:4321/examples/alphabet/>

# Alphabet Tracing — Two Visual Aesthetics

Derived from real printable worksheets and kid-facing tracing apps. All observations below are
about *conventions* (line colours, layout habits, stroke-order marking). No artwork is reproduced.
Hex values are a **buildable specification** consistent with those conventions — they are authored
here, not sampled from any copyrighted PDF. Where a source states a colour in words ("red baseline
and blue guidelines"), that wording is quoted and the hex is my rendering of it.

---

## Aesthetic A — "Classroom Ruled Paper"

### Sources

| Source | URL | Contributes |
|---|---|---|
| Learning Without Tears — "Why Double Lines Work" | https://www.lwtears.com/programs/our-lined-handwriting-paper-works | States the traditional four-line convention verbatim: "a blue line at the top, a dotted line in the middle, a red line on the bottom, and another blue line below". |
| Vertex42 Handwriting Paper | https://www.vertex42.com/templates/handwriting-paper.html | "Classic classroom-style handwriting paper featuring a red baseline and blue guidelines"; also the sky/grass/ground variant and the ¾″ → ½″ → wide-rule size progression. |
| PrintableHandwriting — Tracing Alphabet | https://printablehandwriting.com/tracing/tracing-alphabet-worksheets | Primary rule named as **baseline / midline / ceiling line**; three letter renderings offered (solid, outlined, dotted); start-dot indicator + numbered stroke-order indicators; one letter per A4 portrait page. |
| United Teaching — Free A–Z Letter Tracing Kit | https://unitedteaching.com/free-letter-tracing-worksheets/ | Page composition: large demonstration letter carrying stroke numbers and directional arrows, a beginning-sound picture, then two rows of uppercase and two rows of lowercase dashed tracing. |
| Wonjo Kids — Lowercase Letter Formation a–z | https://wonjo.kids/worksheets/kindergarten/tracing/lowercase-letter-formation-a-to-z/ | A **bold solid model letter at the left of each row**, followed by dotted repeats to trace. |

### Palette

| Role | Hex | Note |
|---|---|---|
| Page background | `#FBFAF5` | Warm paper white, not pure white — reads as print stock. |
| Sheet/card fill (if framed) | `#FFFFFF` | |
| Sheet hairline border | `#E6E2D6` | 1px, warm grey. |
| **Ceiling / top line** | `#7FA9D8` | The "blue line at the top". |
| **Midline (dashed)** | `#A8C4E2` | Lighter tint of the same blue — recessive by design. |
| **Baseline** | `#D24B4B` | The "red baseline" — schoolbook red, muted, never fire-engine. |
| **Descender line** | `#7FA9D8` | Same blue as ceiling. |
| Row separator dots (optional) | `#E3E0D6` | Vertex42's "subtle dotted pattern between writing rows". |
| Ghost / track letter (solid style) | `#C9CDD4` | 100% opacity flat grey; do **not** use opacity on the ink colour. |
| Ghost outline style — interior | `#FFFFFF` | Hollow outline with true white interior. |
| Ghost outline style — stroke | `#B0B6BF` | |
| Dotted-skeleton guide | `#AAB0B8` | |
| Child's ink | `#2B3A55` | Graphite-navy — reads as pencil, not marker. |
| Ink (correct, confirmed) | `#1F2E47` | Slight darkening on stroke commit. |
| Start dot | `#2E9E5B` | Green = "go". White numeral inside. |
| Arrowheads | `#E07B39` | Warm orange; alternate `#4A4A4A` for a black-and-white print look. |
| Off-path / error hint | `#D98A8A` | Soft, never alarming. |
| Success check | `#2E9E5B` | |
| Success star | `#F2B32E` | |
| Muted label text | `#8A8578` | |
| Heading text | `#3A3A3A` | |

Optional **sky/grass/ground** variant (Vertex42: "Blue *sky* for tall letters, Green *grass* for
short letters, Brown *ground* for letters with tails"):
sky band `#E3EFFA`, grass band `#E2F0DA`, ground band `#F0E4D4`, ground line `#8B5E3C`.

### Line system

Module = **x-height `H`**. Reference build: `H = 120px`.

```
ceiling   ──────────────────  y = 0      solid  2px  #7FA9D8
                                         ↕ H  (ascender band)
midline   ─ ─ ─ ─ ─ ─ ─ ─ ─   y = H      dashed 2px  #A8C4E2
                                         ↕ H  (x-height band)
baseline  ══════════════════  y = 2H     solid  3px  #D24B4B
                                         ↕ H  (descender band)
descender ──────────────────  y = 3H     solid  2px  #7FA9D8
```

- **Proportions 1 : 1 : 1.** Ascender band = x-height band = descender depth. This is the standard
  primary rule (a ¾″ sheet is 3/8″ + 3/8″, with a matching 3/8″ descender).
- Cap height = `2H` (baseline to ceiling). Lowercase x-height = `H`.
- Weights: baseline is the heaviest (3px) because it is the anchor; ceiling and descender 2px;
  midline 2px but dashed and tinted, so it reads lightest of all.
- **Dash pattern for the midline:** `8 on / 6 off` at `H=120` (i.e. `0.067H / 0.05H`), butt caps,
  phase-aligned so a dash starts at the left margin.
- Baseline extends 8px further left and right than the other three rules — a small print tell that
  makes the baseline feel like the "floor".

### The letter itself

Three renderings, matching the solid/outlined/dotted options real generators expose. Ship
**dotted skeleton** as the default trace target and **solid ghost** as the model letter.

- **Model letter** (large, left of row or top of page): solid `#C9CDD4`, stroke `0.14H` (≈17px at
  H=120), i.e. **14% of x-height** — a true monoline, no thick/thin modulation.
- **Trace target**: dotted skeleton, same `0.14H` weight, stroke `#AAB0B8`, dash `10 on / 14 off`
  with **round caps** so each dash reads as an elongated pill (this is what makes it look
  hand-drawn-dotted rather than machine-dashed).
- **Outline variant**: `#FFFFFF` interior, `#B0B6BF` outline at 2px, outer silhouette identical to
  the solid ghost.
- **Caps and joins**: round caps, round joins, but modest — the terminal is a semicircle of radius
  `0.07H`, no ball terminals, no flare.
- Optical rule: the ghost sits *behind* the child's ink; the ink stroke is drawn at the same
  `0.14H` width so a well-traced letter exactly covers the ghost. That coverage is the win
  condition and it should look like it.

### Stroke-order marks

- **Start dot**: filled circle, diameter `2.0 × stroke width` (≈34px at H=120), fill `#2E9E5B`,
  no border. Centred on the stroke's first point.
- **Numeral**: white, geometric sans, cap height `0.5 ×` the dot diameter, optically centred.
  Only strokes 1..n get numbered; a single-stroke letter still gets a "1".
- Secondary strokes use the same green — worksheets do not recolour per stroke; the *number* does
  the sequencing work.
- **Arrowheads**: solid filled triangles, `#E07B39`. Length `2.2 × stroke width`, base width
  `1.8 × stroke width`. Placed at **~40% along each stroke** (not at the end — the end is where
  the pencil stops, the middle is where direction needs confirming), plus one extra head after any
  direction change greater than 60°. The arrow sits *beside* the stroke, offset perpendicular by
  `1.1 × stroke width`, rotated to the local tangent — it never overlaps the letter.
- Long curved strokes (the bowl of `a`, `o`) get exactly one arrowhead at the curve apex.

### Card / page framing

- Page: A4/Letter portrait, aspect `1 : 1.414`. Outer margin `0.06 × page width` on all sides.
- No rounded card; the page *is* the surface. If you must frame for a screen, a 4px radius and a
  1px `#E6E2D6` border, nothing more.
- **Letter label "Aa"**: top-left of the page, above the first rule, in the same handwriting model
  as the trace target, `1.6H` cap height, colour `#3A3A3A`.
- **Picture cue**: top-right, opposite the label. A single line-art object (apple) at `2H` tall,
  outline `#8A8578` 2.5px, either uncoloured (worksheet-authentic) or flat-filled. The caption
  "A is for Apple" sits directly under the picture, `0.35H` cap height, `#8A8578`, letter-spaced
  +2%.
- **Row stack**: model row first (bold model letter + numbered/arrowed demonstration), then 2 rows
  of dotted trace repeats, then 1 blank ruled row for independent writing. Row gap = `0.5H`.
  This 1-model / 2-trace / 1-free stack is the near-universal worksheet rhythm.

### Celebration / feedback

Print worksheets are quiet, so keep this restrained:

- Per-stroke: the ghost dash segment turns to solid ink as it is covered; no bounce.
- Per-letter: a `#2E9E5B` check mark drawn on with a 220ms stroke-reveal in the right margin of
  the completed row — mimicking a teacher's pen.
- Per-page: a row of 3 stars fills left-to-right in `#F2B32E`, 300ms stagger, small 1.15 scale
  overshoot. Optionally a "smiley" stamp — the classic worksheet reward.
- No confetti, no particles, no sound stingers. The restraint *is* the aesthetic.

### Typographic model

**Zaner-Bloser manuscript.** Vertical (zero slant), "ball-and-stick" construction — straight lines
and circles, letters that "look like the letters you see in books".

What a parent notices vs the alternatives:
- vs **D'Nealian**: no slant (D'Nealian slants ~17°) and no exit tails/hooks on `a c d h i` etc.
  Zaner-Bloser print and cursive are two separate alphabets; D'Nealian's print is built to grow
  into cursive by joining the tails.
- vs **Handwriting Without Tears**: HWT is also vertical but simpler and wider, taught on a
  **two-line** page (baseline + midline, no ceiling line) because LWT argues four lines cause
  "line confusion". If you want the four-line paper, you want the Zaner-Bloser model with it.
- Lowercase `a c e i l m n o u` look near-identical across systems; `r s z f b` are where the
  difference shows — D'Nealian rounder and flowing, Zaner-Bloser sharper and more angular.

---

## Aesthetic B — "Modern Kid-App Card"

### Sources

| Source | URL | Contributes |
|---|---|---|
| LetterSchool | https://www.letterschool.com/ · https://apps.apple.com/us/app/letterschool-learn-to-write/id481067676 | The three-pass progression (tap the dots → trace the path → write it), "20+ exciting animations", "colors, stars and praise", unlockable "Golden Levels"; ships **Handwriting Without Tears, D'Nealian and Zaner-Bloser** as selectable letter models. |
| Writing Wizard (L'Escapadou) | https://play.google.com/store/apps/details?id=com.lescapadou.tracingfree | 18 school fonts and **50+ animated rewards** (stickers, stars) fired after each completed tracing — the reward-per-letter cadence. |
| Duolingo design system — Colour | https://design.duolingo.com/identity/color | The published, real kid-friendly palette hexes this aesthetic borrows: Feather Green `#58CC02`, Macaw `#1CB0F6`, Cardinal `#FF4B4B`, Bee `#FFC800`, Fox `#FF9600`, Beetle `#CE82FF`, Eel `#4B4B4B`, Swan `#E5E5E5`, Hare `#AFAFAF`, Snow `#FFFFFF`. |
| Khan Academy Kids | https://www.khanacademy.org/kids | Stylus-friendly tracing on flat, rounded, high-saturation illustration; no chrome, one activity per full-bleed screen. |

### Palette

| Role | Hex | Note |
|---|---|---|
| App background | `#FFF7E8` | Warm cream. Alt cool option: `#EEF6FF`. |
| Card fill | `#FFFFFF` | |
| Card border | `#E5E5E5` | Duolingo "Swan". 3px. |
| Card bottom-edge shadow | `#DFE3E8` | Flat 6px offset, no blur — the "chunky button" shadow. |
| **Baseline** | `#C9D4E2` | The only *emphatic* rule. |
| **Midline (dashed)** | `#DDE5EF` | |
| **Ceiling (dashed, optional)** | `#E8EDF3` | Present but barely — often omitted entirely. |
| **Descender line** | `#E8EDF3` | Only shown for `g j p q y`. |
| Track letter fill (untraced) | `#DDE7F2` | Chunky hollow "channel". |
| Track letter outline | `#B9C9DD` | |
| Track interior highlight | `#FFFFFF` | Gives the channel a printed-tube look. |
| Dotted guide path (inside track) | `#9FB3CB` | |
| Child's ink | `#1CB0F6` | Macaw. Bright, saturated, opaque. |
| Ink gradient (optional) | `#1CB0F6` → `#58CC02` | Fills green as the stroke completes. |
| Start dot chip | `#FF9600` | Fox orange, white numeral. |
| Arrowheads | `#FF4B4B` | Cardinal. |
| Success fill | `#58CC02` | Feather Green — the whole letter snaps to this on completion. |
| Success glow | `#89E219` | Mask Green, used as an outer ring. |
| Star / coin | `#FFC800` | Bee. |
| Confetti set | `#58CC02` `#1CB0F6` `#FF4B4B` `#FFC800` `#CE82FF` `#FF9600` | Six-way, equal weight. |
| Primary text | `#4B4B4B` | Eel. |
| Muted text | `#AFAFAF` | Hare. |
| Off-path nudge | `#FFC800` | Yellow, not red — never punish. |

### Line system

Deliberately **fewer lines than the worksheet** — the app teaches shape, the paper taught placement.
Module = x-height `H`. Reference build: `H = 160px` (letters are much bigger relative to screen).

```
ceiling   ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈  y = 0     dashed 2px  #E8EDF3   (often hidden)
                                       ↕ 0.9H
midline   ─ ─ ─ ─ ─ ─ ─ ─ ─  y = 0.9H  dashed 3px  #DDE5EF
                                       ↕ H
baseline  ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄  y = 1.9H  solid  6px  #C9D4E2   round caps
                                       ↕ 0.7H
descender ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈  y = 2.6H  dashed 2px  #E8EDF3
```

- **Proportions 0.9 : 1 : 0.7.** The ascender band is squeezed and the descender band shortened,
  which fattens the letter within the card — the app look is "letter fills the frame".
- The baseline is a **6px rounded-cap bar** with 24px inset from the card edge, so it reads as a
  drawn object (a shelf the letter sits on), not a ruled line.
- Midline dash: `10 on / 14 off`, **round caps**. Descender/ceiling dash: `4 on / 10 off`, round.
- Everything except the baseline is optional and can fade out at higher difficulty tiers.

### The letter itself

- **Hollow track with a white interior** — not a grey ghost. This is the defining difference from
  aesthetic A. The letter is a wide channel the child fills, so the fill animation has somewhere
  visible to go.
- Track stroke width = **0.34 × x-height** (≈54px at H=160). That is ~2.4× thicker relative to the
  x-height than the worksheet's 0.14H. Chunky is the whole point.
- Structure per stroke, back to front:
  1. Track fill `#DDE7F2`, width `0.34H`, round caps + round joins.
  2. Track outline `#B9C9DD`, 4px, following the outer contour.
  3. Dotted guide path down the centreline: `#9FB3CB`, 5px dots, `5 on / 22 off`, round caps.
  4. Child's ink `#1CB0F6`, width `0.30H` (slightly narrower than the channel so it never spills;
     the 2px of track showing on each side reads as a satisfying "inside the lines" margin).
- **Fully round caps and joins**, radius = half the stroke width. No corners anywhere, including
  at stroke junctions — the `A` apex is a rounded peak, not a point.
- On completion the ink width animates from `0.30H` to `0.34H` (fills the channel edge to edge)
  and recolours to `#58CC02` over 250ms.

### Stroke-order marks

- **Start dot = a chip, not a dot.** Circle of diameter `0.55 × track stroke width` (≈30px at
  H=160) — visually smaller relative to the stroke than in aesthetic A, because the stroke is so
  much fatter. Fill `#FF9600`, 3px `#FFFFFF` ring, plus a 4px `#00000014` drop shadow.
- **Numeral**: white, heavy rounded sans (700+), cap height `0.55 ×` chip diameter.
- The chip for the **active** stroke pulses: scale 1.0 → 1.12 → 1.0, 900ms, ease-in-out, infinite.
  Inactive stroke chips render at 45% opacity and do not pulse. This is the app-native way of
  saying "here next", and it replaces showing all numbers at equal weight.
- **Arrowheads**: rounded chevrons (two thick strokes meeting at a rounded vertex), **not** filled
  triangles. Stroke width 8px, arm length `0.30 × track stroke width`, colour `#FF4B4B`, drawn
  *inside* the channel, centred on the guide path at **~60% along the stroke**.
- Chevrons animate: a chevron travels along the guide path from start to end, 1.2s loop, fading in
  at 10% and out at 90%. One travelling chevron per stroke; the static arrowhead is the fallback
  when motion is reduced.

### Card / page framing

- One letter per **card**, card centred, `aspect 4:5` on mobile, `3:2` on tablet/desktop.
- Card radius **40px** (at ~720px card width — i.e. `0.055 × card width`). Fill `#FFFFFF`,
  3px `#E5E5E5` border, and a flat 6px `#DFE3E8` bottom-only offset (the Duolingo-style solid
  under-edge, not a blurred material shadow).
- Card inner padding `0.08 × card width`. The letter's ink box occupies ~62% of card height,
  centred, weighted 6% above optical centre.
- **Letter label "Aa"**: top-left inside the card, in a rounded pill `#F0F4F9` with 999px radius,
  height `0.09 × card height`, text `#4B4B4B`, 700 weight.
- **Picture/word cue**: bottom-centre, *below* the baseline bar. A flat vector object (no outline,
  2–3 flat colours from the confetti set) at `0.9H` tall, with "A is for **Apple**" beside it —
  "Apple" in `#4B4B4B` 700, the rest in `#AFAFAF` 500. Tapping it plays the phoneme.
- Progress: a 12px rounded track above the card, filled `#58CC02`, 999px radius, showing letters
  completed in the set.

### Celebration / feedback

Layered, because apps reward at three granularities (Writing Wizard's 50+ animated rewards fire
per-letter; LetterSchool's Golden Levels fire per-set):

- **Per-stroke**: the completed stroke snaps to full channel width, a 6-particle sparkle burst in
  `#FFC800` at the stroke end, 400ms, and a soft rising tone. The next start chip begins pulsing.
- **Per-letter**: whole letter recolours to `#58CC02` with a `#89E219` outer glow ring expanding
  from the letter silhouette (scale 1 → 1.25, opacity 1 → 0, 500ms); the card does a 1.0 → 1.04 →
  1.0 squash; **confetti burst** of ~40 pieces from the card's top edge using the six-colour
  confetti set, mixed rectangles and circles, 1.4s fall with rotation; a star flies to the progress
  bar. Optionally a collectible sticker awarded.
- **Per-set**: the "golden" state — the letter re-renders in `#FFC800` with a shimmer sweep, and
  the app replays the child's own stroke path as an animated trace (LetterSchool's Golden Level
  "displays exactly how the letter was drawn").
- **Off-path**: no red, no failure. The ink stops extending, the guide path flashes `#FFC800`
  once, and the travelling chevron restarts from the last valid point.

### Typographic model

**Handwriting Without Tears**, rendered as a **geometric rounded sans**. Vertical, wide, maximally
simple — capitals built from big/little lines and big/little curves — which is exactly what
survives being fattened to a 0.34H monoline channel. HWT also pairs naturally with this aesthetic's
reduced line system, since LWT's own paper drops the ceiling line for the same reason.

What a parent notices:
- vs **Zaner-Bloser**: same vertical axis, but wider, rounder, and with no ball-and-stick
  "constructed" feel — the shapes are single continuous simple forms.
- vs **D'Nealian**: no slant and no exit tails at all. A D'Nealian letter at this stroke weight
  would look smeared; the tails close up.
- The tell is uppercase — HWT capitals sit squarely between the two lines with a flat, blocky
  presence, and lowercase `a` is a simple circle-plus-line rather than a double-storey book `a`.

---

## Shared build notes

- Define **x-height `H`** as the single layout module in both aesthetics; every measurement above is
  expressed as a multiple of it, so one variable rescales the whole scene.
- Stroke width ratio is the fastest lever between the two looks: `0.14H` (worksheet) vs `0.34H`
  (app). Same letter geometry, different pen.
- Both aesthetics need the same underlying data per glyph: an ordered list of strokes, each with a
  centreline path, a start point, and one or more arrow anchor positions (parameter `t` along the
  path). The renderers differ, the data does not.
- Keep the ink stroke width tied to the track width in both — "did I cover the ghost" is the
  legible success signal in A, "did I stay in the channel" is the one in B.


---

## What we implemented

Both aesthetics ship in full — all 26 letters, both cases, both difficulties, so 208
documents in total under `examples/alphabet/glam/<theme>/<case>/<letter>-<mode>.glam`.

Faithfully carried over: the palettes, the four-line system and its 1:1:1 (paper) vs
0.9:1:0.7 (card) proportions, the `0.14H` vs `0.34H` pen ratio, the hollow-channel
construction, the numbered start chips, arrowhead placement at ~40% along a stroke plus
one after a sharp turn, the white card with a flat bottom-edge shadow, and the restrained
vs. exuberant celebration split.

Departures worth naming:

- **No picture/word cue ("A is for Apple").** It needs 26 pieces of illustration to be
  worth having, and one placeholder on every card would look worse than none.
- **No travelling chevron in theme B.** The EASY mode's draggable puck already moves
  along the path with its arrow rotating to the tangent, which is the same cue delivered
  by the child's own hand. A second animated chevron on top of it competes.
- **Static direction arrows appear in HARD mode only.** In EASY they duplicate the puck,
  and on a retraced stem (`h m n r b p`) they actively contradict it — showing "down" and
  "up" on the same line at the same time.
- **The paper worksheet layers, rather than substitutes.** The spec offers the dotted skeleton
  as an *alternative* rendering to the solid ghost; we draw a thin (0.045H) dotted centreline
  *on top of* the full-weight solid ghost. Stacking two 0.14H strokes just read as a dashed
  letter — the ghost disappeared into the dashes. Layering keeps "cover the ghost" as the win
  signal while still showing the path through the middle.
- **The card trims its own bottom.** A letter with no descender would otherwise carry an
  empty band under it. The trim moves only the bottom edge; `yTop` and the baseline stay
  fixed, so switching letters never shifts the writing lines.
