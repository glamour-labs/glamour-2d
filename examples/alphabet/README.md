# Alphabet Tracing

A complete letter-tracing game built on Glamour: **26 letters × upper/lower × guided/free-write
× two worksheet aesthetics = 208 `.glam` documents**, plus a playable page that loads them.

```bash
pnpm playground          # from the repo root
# → http://localhost:4321/examples/alphabet/
```

## What this example is actually demonstrating

The engine owns motion and input; the host owns the verdict. Nothing about letters, scoring or
progress lives in the runtime — the documents describe *the shape and the drag*, and
`index.html` decides what "done" means.

The two difficulties are two different runtime capabilities, not a tuned number:

| | Document carries | Who owns the drag | What can go wrong |
|---|---|---|---|
| **Guided** (easy) | a `guided` block | the **player** — it trims the ink along the authored path | nothing; you can only draw *less* of the letter |
| **Free write** (hard) | an `ink` block with a per-stroke `match` target | the **host** — raw pointer ink, scored on pen-up | everything; coverage / stray / start are all reported |

## Layout

```
src/geom.mjs      the segment vocabulary (line · arc · cubic · retrace) + the flattener
src/glyphs.mjs    the 52 glyph skeletons — THE source of truth for letterform + stroke order
src/themes.mjs    the two aesthetics as data; identical glyphs, different pen
src/build.mjs     glyph + theme + mode -> one .glam document
build.mjs         writes all 208 documents into glam/ and validates each
tools/specimen.mjs  all 52 glyphs on one page, colour-coded per pen-stroke (the design loop)
tools/sheet.mjs     all 26 real cards for one theme/case/mode on one page (the review loop)
index.html        the game
glam/<theme>/<case>/<letter>-<mode>.glam
```

## Regenerating

The `.glam` files are committed (the page fetches them; there is no build step at runtime) and a
test asserts they match the generator, so the two can never drift silently.

```bash
node examples/alphabet/build.mjs            # rewrite all 208
node examples/alphabet/build.mjs --check    # verify without writing
npx vitest run --project node examples/alphabet
```

## The design loop

The letterforms were not eyeballed once and shipped. Both tools exist so a change can be *looked
at* rather than assumed:

```bash
node tools/specimen.mjs upper          # every capital, one pen-stroke per colour
node tools/specimen.mjs lower GKS      # a subset, 2.6× bigger, for judging one shape
node tools/sheet.mjs card lower easy   # all 26 finished cards for one combination
glam render out/specimen-upper.glam -o out/specimen-upper.png
```

The specimen sheet colours each pen-stroke separately and dots each stroke's start, so three
things are checkable at a glance: the shape reads as the right letter, the stroke decomposition
is what we intended, and each stroke starts where a child is taught to start.

## Coordinate system

Glyphs are authored in **band units**, never pixels — one unit is the height of one band on a
four-line writing rule:

```
y = 0   ceiling / ascender / cap height
y = 1   midline (x-height)
y = 2   baseline
y = 3   descender line
```

`x` starts at 0 on the glyph's own left edge, in the same unit, so each glyph carries its natural
width and nothing distorts when it is scaled onto a card. That is why one dataset serves two
aesthetics with different band proportions (1 : 1 : 1 on paper, 0.9 : 1 : 0.7 on the app card):
only the mapping changes.

## Where the letterforms come from

- **Stroke order and direction:** [`docs/ALPHABET-STROKE-ORDER.md`](../../docs/ALPHABET-STROKE-ORDER.md)
  — cross-checked against Zaner-Bloser, Handwriting Without Tears, D'Nealian, Fountas & Pinnell and
  UK schemes, including which letters the curricula genuinely disagree on and what we ship.
- **Visual design:** [`docs/ALPHABET-WORKSHEET-STYLES.md`](../../docs/ALPHABET-WORKSHEET-STYLES.md)
  — the two aesthetics, their sources, and the exact palettes.

## Two conventions worth knowing before you edit `glyphs.mjs`

1. **Retraces are one stroke, not two.** `b h m n p r` are written by pulling down, sliding back
   *up* the same line, then arching over. Mark the doubling-back segment with `retrace(...)`: it
   stays in the path the finger follows, and drops out of the outline that gets painted and scored.

2. **Dots are short strokes.** The renderer caps every polyline with a filled circle of half the
   stroke width, so a segment shorter than the pen is wide renders as a true round dot. That is
   how `i` and `j` work — and why the dot's height is tuned to clear the stem at *both* pen
   weights, since the app theme's pen is 2.4× the worksheet's.
