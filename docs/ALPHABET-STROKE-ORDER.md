> **How this doc is used.** It is the authority behind `examples/alphabet/src/glyphs.mjs`
> — the 52 glyph skeletons the tracing game is generated from. Research pass: 2026-08-05.
> Where the implementation deliberately departs from the tables below, it is listed in
> [What we implemented](#what-we-implemented) at the foot of this file. Change the tables
> and the glyph data together, or they drift.

# Pen-Stroke Order & Direction — 52 English Manuscript (Print) Letterforms

Authoritative reference for A–Z and a–z as taught in mainstream US/UK children's handwriting
curricula. Built for driving a tracing game: stroke segmentation, start/end anchors, and
direction conventions.

---

## 1. Sources

| # | Source | What it gave | Status |
|---|--------|--------------|--------|
| **S1** | **Zaner-Bloser Handwriting — Manuscript Stroke Descriptions** (official 5-page chart, all 52 glyphs with numbered arrows + verbatim stroke text) · [PDF](https://cdnsm5-ss7.sharpschool.com/userfiles/servers/server_92164/file/general%201/zaner-bloserhandwritingmanuscript.pdf) | Verbatim per-letter stroke text **and** numbered-arrow diagrams, visually verified page by page | **Primary spine** |
| **S2** | **Handwriting Without Tears / Learning Without Tears** (Jan Z. Olsen, 2008 parent guide: capital chart with numbered arrows + lowercase construction strips) · [PDF](http://bpsassets.weebly.com/uploads/9/9/3/2/9932784/handwriting_without_tears.pdf) | Per-letter stroke lists ("Big line / Little curve / Turn"), visually verified | Cross-check |
| **S2b** | **HWT "Letter of the Day" lowercase sheets** · [PDF](https://chaplinschool.org/wp-content/uploads/2018/10/lowercase-letter-practice-sheets.pdf) | Verbatim HWT phrase for all 26 lowercase | Cross-check |
| **S3** | **Fountas & Pinnell, "Verbal Path for the Formation of Letters"** (LLI, ©2009) · [PDF](https://www.montgomeryschoolsmd.org/siteassets/schools/elementary-schools/t-w/waysidees/uploadedfiles/specials/verbal_letters.pdf) | Independent verbal path for all 52 | Cross-check |
| **S4** | **D'Nealian — Donald N. Thurber**, *D'Nealian Manuscript: An Aid to Reading Development* (ERIC ED227474, 1983) · [PDF](https://files.eric.ed.gov/fulltext/ED227474.pdf) | The author's own continuous-stroke rule | Cross-check |
| **S5** | Line/zone terminology · [missjaimeot.com](https://missjaimeot.com/hw-terminology/) · ZB paper specs (Grade K `3/4 × 3/8 × 3/8`, Grade 2 `1/2 × 1/4 × 1/4`, PreK/K `1-1/8 × 9/16 × 9/16`) | Proportions | Proportions |
| **S6** | **UK set** — [Twinkl letter-formation families](https://www.twinkl.com/resource/t-l-8914-letter-formation-families-display-posters) + [Twinkl rhymes](https://www.winnershprimaryschool.co.uk/_site/data/files/users/curriculum/24CB06D4C4A3EB747CCC9FE132540DAE.pdf) · [Read Write Inc.](https://www.greenridgeacademy.co.uk/wp-content/uploads/2017/12/Letter-Formation-Chart.pdf) · [Little Wandle](https://www.pinewood.notts.sch.uk/_site/data/files/migrated/phonics/little-wandle-letter-formation-rhymes.pdf) · [Teach Handwriting](https://www.teachhandwriting.co.uk/print-letters-beginners.html) · [Letter-join manual](https://www.letterjoin.co.uk/manual.pdf) · [NHA](https://nha-handwriting.org.uk/handwriting/help-for-teachers/handwriting-teaching-in-a-nutshell/) · [Penpals policy](http://www.bacton.norfolk.sch.uk/wp-content/uploads/2020/11/Handwriting-How-to.pdf) | Letter families, per-letter rhymes, exit strokes, 2-line proportions | **UK — see §7** |

**Agreement is very high.** S1 and S3 agree on **all 26 lowercase** and on 21 of 26 capitals.
S2 (HWT) is the systematic outlier on **capitals only** — see §6.1.

> ### ⚠ Source defect worth knowing
> In the S1 PDF, the **text block for lowercase `f` is a copy-paste error** — it duplicates
> capital `F`'s description ("Pull down straight. Lift. Slide right. Lift. Slide right; stop
> short."). The **glyph diagram beside it is correct** and shows the true 2-stroke `f`
> (arrow 1 = curve over the top then straight down; arrow 2 = crossbar). The table below uses
> the correct form, corroborated by S3 ("pull back, down, and cross") and S4.

---

## 2. Coordinate system, line names, proportions

### 2.1 The four lines

| Line | ZB / US name | Kid-friendly names (S5) | Role |
|---|---|---|---|
| 1 | **Top line** / headline | "skyline", "sky line", "roof" | Top of capitals **and** ascenders |
| 2 | **Midline** (dashed) | "plane line", "dotted line", "belt" | Top of the x-height body |
| 3 | **Baseline** | "grass line", "ground" | Letters sit here |
| 4 | **Descender line** | "worm line", "water line", "dirt" | Bottom of `g j p q y` |

### 2.2 Proportions

Derived from Zaner-Bloser's own ruled-paper specs, which are the de-facto US standard. All
three grade rulings reduce to the **same ratio**:

| ZB product | top→base | base→mid | base→descender | Ratio |
|---|---|---|---|---|
| Pre-K / K | 1-1/8″ | 9/16″ | 9/16″ | 2 : 1 : 1 |
| Grade K | 3/4″ | 3/8″ | 3/8″ | 2 : 1 : 1 |
| Grade 2 | 1/2″ | 1/4″ | 1/4″ | 2 : 1 : 1 |

**The canonical proportion:**

```
  ─────────────────────  top line        y = 0.0     ┐
                                                      │  ascender zone = 1 unit
  - - - - - - - - - - -  midline         y = 1/3     ┤
                                                      │  x-height zone  = 1 unit
  ═════════════════════  baseline        y = 2/3     ┤
                                                      │  descender zone = 1 unit
  ─────────────────────  descender line  y = 1.0     ┘
```

- **The three zones are equal thirds** of the full glyph box. Easy to lay out.
- In x-height units: **x-height = 1, cap height = ascender height = 2, descender depth = 1**,
  total box = **3**.
- **Cap height == ascender height** in children's manuscript (unlike typographic fonts, where
  cap height is usually a little shorter). Both touch the top line. Do not model them separately.

### 2.3 Letter classes by vertical extent

| Class | Letters | Count | Extent |
|---|---|---|---|
| **x-height only** | `a c e i m n o r s u v w x z` | 14 | midline → baseline |
| **Ascenders** | `b d f h k l t` | 7 | top line → baseline |
| **Descenders** | `g j p q y` | 5 | midline → descender line |
| **All capitals** | `A`–`Z` | 26 | top line → baseline |

Notes:
- `i` is x-height; its **dot** floats between midline and top line. `j` is a descender; its dot
  sits at the same height as `i`'s.
- **`t` is a variant.** ZB/D'Nealian draw `t` as a **full ascender** (stem starts on the top
  line — verified in the S1 diagram). Many other schemes draw `t` at ~3/4 height, short of the
  top line. Either is defensible; pick one and stay consistent.
- **`f` has no descender** in manuscript print (unlike italic/cursive `f`).
- **`Q`** is the only capital that crosses the baseline (its tail).
- **`J`** does **not** descend in ZB manuscript — its hook bottoms out on the baseline.

---

## 3. Direction conventions

### 3.1 The two defaults

1. **Top → bottom.** Every vertical and diagonal begins at its highest point.
2. **Left → right.** Every horizontal bar is drawn leftward-to-rightward.

### 3.2 Every exception, exhaustively

**A. Upward strokes (bottom → top).** These are all *retraces* or *terminals* inside a
continuous stroke — never the opening move of a letter.

| Type | Glyphs | What happens |
|---|---|---|
| **Retrace up** (go back up a line you just drew, to launch a bowl/shoulder) | `a b d g h m n p q r` | ZB "push up" |
| **Terminal upstroke** (the stroke *ends* travelling upward) | `u v w` · `N U V W` | ZB "slant up" / "push up straight" |

`m` retraces twice; `w`/`W` rise twice.

**B. Right-to-left strokes.** Only one in the whole alphabet:

| Glyph | Stroke | Note |
|---|---|---|
| **`G`** | the crossbar | ZB: *"Circle back. **Slide left.**"* The bar is drawn **right→left** as a continuation of the C-curve. **HWT disagrees** and makes it a separate left→right "little line". |

(The "slide left" inside `B D P R` returns to the stem but is part of a clockwise bowl, not an
independent leftward stroke.)

**C. Curve handedness.**

| Handedness | ZB term | Glyphs |
|---|---|---|
| **Counter-clockwise** (anticlockwise) | "circle back" / "curve back" | `c a d e g o q`(bowl) `s`(upper) `f`(top hook) `g j`(tails) · `C G O Q S`(upper) `J`(hook) |
| **Clockwise** | "curve forward" | `b p`(bowls) `h m n r`(shoulders) `u`(base) `q`(tail) `s`(lower) · `B D P R`(bowls) `U S`(lower) |

The single most important rule for a child: **`c a d g o q e s` all open with the same
counter-clockwise "around" motion.** This is the "curly caterpillar" family (UK) / "Magic c"
family (HWT), and it is what stops `b`/`d` reversals.

### 3.3 Numbered arrows ≠ pen lifts — read this before implementing

Worksheets number **direction changes**; curricula count **pen lifts**. They are different, and
conflating them is the single biggest source of "which is right?" confusion.

- ZB's chart marks a real pen lift with the explicit word **"Lift"**. Stroke count = *(number of
  "Lift"s) + 1*. Its arrow numbers, by contrast, mark direction changes.
- Capital `M` in ZB is **2 pen strokes** but has **4 arrowed segments**.
- Lowercase `m` is **1 pen stroke** with **5 arrowed segments**.

**Recommendation for a tracing game:** model both. Use *pen-lift boundaries* to decide when the
child may lift the stylus, and *direction-change segments* to place arrows, waypoints, and
"keep going" hints.

---

## 4. UPPERCASE A–Z

Columns: **N** = pen strokes (ZB). Positions are `(line, horizontal)`.

| | N | Stroke-by-stroke |
|---|---|---|
| **A** | **3** | 1. top-center → diagonal down-left → baseline-left. 2. top-center → diagonal down-right → baseline-right. 3. crossbar at ~midline, left arm → right arm (L→R). |
| **B** | **2** | 1. top-left → straight down → baseline-left. 2. top-left → over right, curve **clockwise** down to midline, back left to stem; continue → over right, curve clockwise down to baseline, back left to stem. Both bowls, one stroke. |
| **C** | **1** | 1. just below top-right → up and over left, **counter-clockwise** around left side, down and around → finish just above baseline-right. |
| **D** | **2** | 1. top-left → straight down → baseline-left. 2. top-left → over right, curve **clockwise** down and around → back left to baseline-left. |
| **E** | **4** | 1. top-left → down → baseline-left. 2. top bar L→R. 3. mid bar L→R, *stop short* (shorter). 4. bottom bar L→R. |
| **F** | **3** | 1. top-left → down → baseline-left. 2. top bar L→R. 3. mid bar L→R, stop short. |
| **G** | **1** | 1. as `C` (counter-clockwise), continue up the right side to midline, then **slide LEFT** for the crossbar. *Only right-to-left stroke in the alphabet.* |
| **H** | **3** | 1. top-left → down → baseline-left. 2. top-right → down → baseline-right. 3. crossbar at midline, L→R. |
| **I** | **3** | 1. top-center → down → baseline-center. 2. top bar L→R. 3. bottom bar L→R. |
| **J** | **2** | 1. top-center-right → straight down → near baseline → **curve back** (counter-clockwise) left, ending just above baseline. 2. **top bar**, L→R. |
| **K** | **2** | 1. top-left → down → baseline-left. 2. top-right → slant down-left to stem at midline → *without lifting* slant down-right → baseline-right. |
| **L** | **1** | 1. top-left → down → baseline-left → **continue** sliding right along the baseline. No lift. |
| **M** | **2** | 1. top-left → down → baseline-left. 2. top-left → slant down-right to baseline-center → slant **up**-right to top-right → pull down → baseline-right. |
| **N** | **2** | 1. top-left → down → baseline-left. 2. top-left → slant down-right → baseline-right → **push up** to top-right. *Ends bottom→top.* |
| **O** | **1** | 1. just below top, right of center → **counter-clockwise** all the way around → close. |
| **P** | **2** | 1. top-left → down → baseline-left. 2. top-left → over right, curve **clockwise** down to midline, slide left to stem. |
| **Q** | **2** | 1. `O` (counter-clockwise, closed). 2. **tail**: from inside the lower-right of the bowl → slant down-right, crossing the baseline. |
| **R** | **2** | 1. top-left → down → baseline-left. 2. top-left → over right, clockwise down to midline, slide left to stem, → *without lifting* slant down-right → baseline-right. |
| **S** | **1** | 1. just below top-right → **curve back** (counter-clockwise) up-left, down through the middle → **curve forward** (clockwise) around the lower left → finish just above baseline-left. |
| **T** | **2** | 1. **top-center → down → baseline-center (STEM FIRST).** 2. top bar L→R. |
| **U** | **1** | 1. top-left → down → **curve forward** (clockwise) along the baseline → **push up** → top-right. *Ends bottom→top.* |
| **V** | **1** | 1. top-left → slant down-right → baseline-center → slant **up**-right → top-right. |
| **W** | **1** | 1. top-left → down-right to baseline → up-right to top → down-right to baseline → up-right to top-right. |
| **X** | **2** | 1. top-left → slant down-right → baseline-right (**the `\` first**). 2. top-right → slant down-left → baseline-left. Both top→bottom. |
| **Y** | **2** | 1. top-left → slant down-right → midline-center. 2. top-right → slant down-left → midline-center → **continue straight down** → baseline-center. *Right arm flows into the stem.* |
| **Z** | **1** | 1. top-left → slide right → slant down-left to baseline-left → slide right along baseline. |

---

## 5. lowercase a–z

| | N | Stroke-by-stroke |
|---|---|---|
| **a** | **1** | 1. start at midline just right of center → **counter-clockwise** around (left, down, along baseline, up the right side) closing the bowl → **continue straight down** the right side → baseline. |
| **b** | **1** | **LINE FIRST.** 1. top line → straight down → baseline → **retrace up** to midline → **curve forward** (clockwise) right, down, around the bottom, back left to the stem at the baseline. |
| **c** | **1** | 1. just below midline-right → up and over left, **counter-clockwise** around → finish just above baseline-right. |
| **d** | **1** | **CIRCLE FIRST.** 1. midline right of center → **counter-clockwise** circle all the way around → back to start → **push up** to the **top line** → pull down straight → baseline. |
| **e** | **1** | **BAR FIRST.** 1. start mid-x-height on the left → **slide right** (short horizontal) → curve up and back **counter-clockwise** over the top, around the left, down and around → finish just above baseline-right. |
| **f** | **2** | 1. just below top-right → **curve back** (counter-clockwise) up and over to the left → pull down straight → baseline. 2. crossbar at the midline, L→R. |
| **g** | **1** | 1. counter-clockwise circle (as `a`) → push up to midline-right → pull down straight **through the baseline** → descender line → **curve back** (counter-clockwise hook) to the left. |
| **h** | **1** | 1. top line → down → baseline → **retrace up** to midline → **curve forward** (clockwise) over right → pull down → baseline. |
| **i** | **2** | 1. midline → down → baseline. 2. **dot** above the stem, between midline and top line. *Dot is last.* |
| **j** | **2** | 1. midline → down through the baseline → descender line → **curve back** (counter-clockwise) to the left. 2. **dot** above. *Dot is last.* |
| **k** | **2** | 1. top line → down → baseline. 2. midline-right → slant down-left to the stem at mid-x-height → *without lifting* slant down-right → baseline-right. |
| **l** | **1** | 1. top line → down → baseline. |
| **m** | **1** | 1. midline → down → baseline → retrace up → curve forward over → down → baseline → retrace up → curve forward over → down → baseline. *Two humps, one stroke.* |
| **n** | **1** | 1. midline → down → baseline → retrace up → curve forward over → down → baseline. |
| **o** | **1** | 1. just below midline-right → **counter-clockwise** all the way around → close. |
| **p** | **1** | **LINE FIRST.** 1. midline → straight down **through the baseline** → descender line → **retrace up** to the midline → **curve forward** (clockwise) around → close at the stem on the baseline. |
| **q** | **1** | **CIRCLE FIRST.** 1. counter-clockwise circle → push up to midline-right → pull down straight through the baseline → descender line → **curve forward** (clockwise) hook to the **right**. |
| **r** | **1** | 1. midline → down → baseline → retrace up to midline → **curve forward** (clockwise) short shoulder to the right. |
| **s** | **1** | 1. just below midline-right → **curve back** (counter-clockwise) up-left, down through the middle → **curve forward** (clockwise) around the lower left → finish just above the baseline. |
| **t** | **2** | 1. **top line → down → baseline (STEM FIRST).** 2. crossbar at the midline, L→R. |
| **u** | **1** | 1. midline-left → down → **curve forward** (clockwise) along the baseline → **push up** to midline-right → pull down straight → baseline. |
| **v** | **1** | 1. midline-left → slant down-right → baseline → slant **up**-right → midline-right. |
| **w** | **1** | 1. midline → down-right → baseline → up-right → midline → down-right → baseline → up-right → midline-right. |
| **x** | **2** | 1. midline-left → slant down-right → baseline-right (**the `\` first**). 2. midline-right → slant down-left → baseline-left. Both top→bottom. |
| **y** | **2** | 1. midline-left → slant down-right → baseline-center. 2. midline-right → slant down-left → **continue through the baseline** → descender line. *Right arm becomes the tail.* |
| **z** | **1** | 1. midline-left → slide right → slant down-left to baseline-left → slide right along the baseline. |

---

## 6. Where the curricula disagree

### 6.1 The systematic split: HWT decomposes capitals

This is not a per-letter quirk, it is a design philosophy, and it explains most of the table below.

- **Zaner-Bloser / Fountas & Pinnell** allow a stroke to **turn a corner** without lifting. `M`
  is 2 strokes, `W` is 1, `Z` is 1, `L` is 1.
- **HWT** builds capitals from discrete **wood pieces** — Big Line, Little Line, Big Curve,
  Little Curve — so *every straight segment is its own stroke*. `M` is 4, `W` is 4, `Z` is 3,
  `L` is 2.
- **D'Nealian** goes the other way entirely (§6.2).

Capitals where S1/S3 and S2 differ (**ZB/F&P → HWT**): `B` 2→3 · `G` 1→2 · `K` 2→3 · `L` 1→2 ·
`M` 2→4 · `N` 2→3 · `R` 2→3 · `V` 1→2 · `W` 1→4 · `Z` 1→3.

**On lowercase the three agree on 25 of 26** (only `k` differs). Lowercase is settled; capitals are not.

### 6.2 D'Nealian's blanket rule

Thurber, the author, states it outright (S4, ED227474 abstract):

> All letters are made with a continuous stroke except to dot the "i" and "j" and cross the "f" and "t."

So D'Nealian lowercase is **1 stroke for everything** except `i j f t` = 2. (`x` is the
unstated exception — it cannot be drawn continuously.) D'Nealian also adds **exit tails**
("monkey tails") and a slight slant, which ZB does not have. If your game targets vertical
ball-and-stick print, D'Nealian is the wrong model — cite it for the continuity principle only.

### 6.3 Contested letters — full breakdown

US sources below; **UK positions are in §7.2** and are folded into each Resolution.

| Glyph | S1 Zaner-Bloser | S2 HWT | S3 Fountas & Pinnell | S4 D'Nealian | **Resolution** (incl. UK) |
|---|---|---|---|---|---|
| **`f`** 1 vs 2 | **2** (curve+stem, lift, cross) | **2** ("curve up, down" / "cross") | **2** ("pull back, down, and cross") | **2** (explicit: "cross the f") | **2 strokes. Unanimous.** The 1-stroke `f` belongs to UK continuous-cursive and italic hands, not to print. |
| **`k`** 2 vs 3 | **2** (stem; then in-and-out unlifted) | **3** ("down" / "kick!" / "slide away") | **2** ("pull down, pull in, pull out") | **1** (continuous) | **2 strokes — now high confidence.** UK is *unanimous* for 2 (RWI, Little Wandle, Twinkl; Penpals explicitly recommends "two pencil strokes rather than three"). HWT's 3 is the lone outlier. Stem, then arm-and-leg as one unlifted movement. |
| **`t`** cross first? | Stem, **then** cross | Stem, **then** cross | Stem, **then** cross | Stem, **then** cross | **Stem first, cross second. Unanimous.** HWT adds: right-handers cross **L→R**, left-handers **R→L**. |
| **`y`** arm→tail? | **Yes** — 2 strokes, arm continues | **Yes** — "slide down / slide down" | **Yes** — "slant in, slant and down" | Yes | **Yes. Unanimous.** Stroke 2 runs from midline-right diagonally down-left and *keeps going* through the baseline into the descender. Never 3 strokes. |
| **`b d p q`** | `b`,`p` **line first**; `d`,`q` **circle first** | identical | identical | identical | **Unanimous, and deliberate.** `d`/`q` start with the counter-clockwise `c` shape; `b`/`p` start with the descending stem. This asymmetry *is* the anti-reversal device — `d` "starts like `c`", `b` does not. **Do not "regularise" this.** |
| **`J`** top bar? | **Yes**, 2 strokes | **Yes** ("Big line / Turn / Little line") | **Yes** ("pull down, curve around, across") | No bar | **Genuinely contested — make it configurable.** All three US teaching charts say **yes, 2 strokes with a top bar**. UK splits: Twinkl yes, **Little Wandle deliberately no** ("unnecessary additions such as bars across the top"). Most digital fonts show a bare hook. **Default to the bar (US curriculum answer); expose a toggle.** Same toggle covers capital `I`'s serifs. |
| **`M`** | **2** | **4** | **2** ("pull down, slant down, slant up, pull down") | 1 | **2 pen strokes / 4 arrow segments.** |
| **`N`** | **2** | **3** | **2** ("pull down, slant down, pull up") | 1 | **2 pen strokes / 3 arrow segments.** Stroke 2 ends travelling **upward**. |
| **`W`** | **1** | **4** | **1** ("slant down up, down up") | 1 | **1 pen stroke / 4 arrow segments.** |
| **`Q`** tail | **2** — tail separate | **2** — "Little line" | **2** — "and cross" | 2 | **2 strokes, tail separate. Unanimous.** |
| **`G`** bar? | **Yes**, 1 stroke, bar drawn **R→L** | **Yes**, 2 strokes, bar drawn L→R | **Yes**, 1 stroke ("pull back, around, across") | Yes | **G always gets a bar.** Stroke count 1 (ZB/F&P) or 2 (HWT); bar direction is the real disagreement. **Use 1 stroke, bar R→L** to match the two agreeing sources. |
| **`i` `j`** dot | **Dot last** (stroke 2) | **Dot last** | **Dot last** | Dot last | **Dot is always the final stroke. Unanimous.** Never dot first. |
| **`x`** order | `\` first, then `/` | `\` first, then `/` | "slant down, slant down" | 2 strokes | **`\` (top-left→bottom-right) first, then `/` (top-right→bottom-left). Unanimous.** Both strokes go top→bottom — neither is drawn upward. |

### 6.4 Further disagreements found during research (not on the original list)

| Glyph | Issue |
|---|---|
| **`L`** | ZB/F&P = **1 stroke** (down, then turn the corner and slide right without lifting). HWT = **2**. |
| **`e`** | All four US sources start `e` with the **horizontal bar**, then loop counter-clockwise. Some UK schemes start `e` with the curve instead. The bar-first form is the US standard. |
| **`V` / `v`** | HWT is inconsistent across cases: lowercase `v` = 1 stroke but capital `V` = 2. ZB/F&P give **1 stroke for both** — use that. |
| **`Y`** (capital) | US is unanimous: **2 strokes**, right arm flows into the stem. **UK splits** — Twinkl agrees, but Little Wandle *and* Penpals prescribe **3 strokes with a separate central stalk**, arguing the finished `v` gives a clean start point for the downstroke. Central-stalk `Y` is the more-recommended *UK* form. Contested; US default = 2. |
| **`y`** (lowercase) shape | ⚠ **Not just stroke count — the shape differs.** US draws `y` as **two straight diagonals**. Many UK schemes draw a **curved, `u`-shaped body plus descender** (Teach Handwriting files `y` in the *tunnel* family with `n m h b p u`). If you support a UK mode, `y` needs a second outline, not just a second stroke order. |
| **`t`** height | ZB/D'Nealian: **full ascender** (stem starts on the top line — verified in the S1 diagram, crossbar exactly on the midline). Twinkl: *"T isn't small or tall, it's in between"* (~3/4 height). Both current; pick one. |
| **`f`** descender | US: `f` **never** descends. UK: Penpals treats `f` as a **descender**, and UK school policies often list `f` in *both* the ascender and descender groups. UK-mode `f` may need a below-baseline curve. |

---

## 7. UK practice

UK guidance agrees with the US on **stroke order** almost everywhere. It diverges on three
things: **letter families** (the organising principle), **exit strokes/flicks**, and **some
letterform shapes** — notably `y` and `k`.

### 7.1 Letter families

Statutory but unnamed: the National Curriculum requires Year 1 pupils to "understand which
letters belong to which handwriting 'families'" but never names them
([gov.uk](https://www.gov.uk/government/publications/national-curriculum-in-england-english-programmes-of-study/national-curriculum-in-england-english-programmes-of-study)).
The names are publisher convention, and there are **two competing taxonomies**:

**A. Character taxonomy — Twinkl, Letter-join, most school policies.** The one to use for
child-facing UI; by far the most recognised.

| Family | Letters |
|---|---|
| **Long ladder** | `l i t u j y` |
| **One-armed robot** | `r b n h m k p` |
| **Curly caterpillar** | `c a d e s g f q o` |
| **Zigzag monster** | `v w x z` |

**B. Movement taxonomy — Teach Handwriting** (print set; note `k` and `y` land in *different*
families than above):

`i l t` straight line · `c a d o g q e s` curves to start · `n m h b p u y` tunnel ·
`v w k x z` diagonal line · `f j r` hooks, loops and lines.

**UK capitals** (Teach Handwriting): `L T I F E H` straight · `V W X Y A N M K Z` straight+slant ·
`B P D R J G Q U` straight+curly · `C O S` curly.

### 7.2 UK verdicts on the contested letters

| Item | UK position |
|---|---|
| `f` | **2 strokes, cross last** — unanimous. But **f is the most variable UK letter**: Penpals treats it as a **descender** (`f` curves below the baseline); Little Wandle/RWI sit it **on the line**. Twinkl adds a leftward bottom swing. |
| `k` | **2 strokes** — unanimous (RWI, Little Wandle, Twinkl, Penpals). Penpals explicitly recommends "two pencil strokes rather than three". **Strongly corroborates the US ZB/F&P answer.** |
| `t` | **Cross second** — unanimous. Twinkl adds the height rule: *"T isn't small or tall, it's in between"* (the 3/4-height `t` variant, vs ZB's full ascender). |
| `y` | **⚠ Shape differs from the US.** Many UK schemes draw `y` as a **curved, `u`-shaped body plus descender** (Teach Handwriting files it in the *tunnel* family; LW: "down and round the yo-yo, then follow the string round"), **not** as two straight diagonals. Where the diagonal form is used, the right arm does continue into the tail. Tail swings **left**. |
| `b d p q` | **`d q` circle-first, `b p` line-first** — unanimous, same anti-reversal design as the US. Teach Handwriting encodes it structurally by putting `b`/`p` in a different family from `d`/`q`. |
| `e` | **Bar first** (Twinkl: "go across carefully, then curl like a snail"; RWI: "lift off the top and scoop out the egg"). Matches the US. The NHA argues UK children actually need **two** `e` forms for joining ("[The trouble with e](https://nha-handwriting.org.uk/handwriting/articles/the-trouble-with-e/)"). |
| `x` | **2 strokes, both top-down, left diagonal first** — matches the US. |
| `i j` | **Dot last** — unanimous. `j` tail curls left. |
| `o` | Explicitly **anticlockwise** — the governing direction for the whole `c a d g o q s e` group. |
| **`J`** | **⚠ Direct UK conflict.** Twinkl: **has a top bar** (2 strokes). Little Wandle: **no bar** — and says why: they adapted Sassoon "so that they don't have unnecessary additions such as bars across the top" ([LW FAQ](https://faqs.littlewandlelettersandsounds.org.uk/knowledge/the-capital-j-is-shown-without-the-line-at-the-top.-is-there-a-reason-for-this)). Same split applies to capital `I` (serifs or not). |
| **`G`** | **Has the bar** — UK consensus. Penpals: the barred form "is recommended as the correct handwriting form"; the barless one is "a font form". |
| **`Q`** | **Tail separate** — consensus, matches the US. |
| **`M` `N`** | **⚠ Conflict.** Twinkl: `M` = 3, `N` = 3. Little Wandle: **1 continuous stroke with a retrace** for both. Neither matches HWT's 4/3. ZB's 2/2 sits between them. |
| **`Y`** | **⚠ Conflict.** Twinkl: 2 strokes, right diagonal continues into the stem (= the US answer). Little Wandle **and Penpals**: **3 strokes with a separate central stalk** — Penpals argues the finished `v` "gives them a clear starting point for the downwards stroke". Central-stalk `Y` is the more-recommended UK form. |
| **`K`** | Penpals + Little Wandle: **2 strokes**. Twinkl: 3. |
| **`A`** | Twinkl 3; Little Wandle 2 (left diagonal retraced, then crossbar). |

General UK capital rule (Penpals): *"Capital letters should be formed from top to bottom and
left to right wherever possible."* And **UK capitals never join to lowercase.**

### 7.3 Exit strokes — the real UK/US divergence

US manuscript has **no** exit strokes. UK print often does — but it is contested and applies
only to baseline-finishing letters.

- **The DfE definition of print (since April 2021)** allows them and gives the roster:
  children "may be taught simple exit strokes for letters that end on the line
  (**a d h i k l m n t u**)". Lead-*in* strokes are banned in EYFS, and continuous cursive from
  the start is banned.
- **NHA agrees**: exit strokes on appropriate letters yes; "a lead-in stroke should not be taught".
- **Teach Handwriting dissents**: their print font has *no* entry or exit strokes at all;
  exits appear only in their cursive.
- **Letter-join agrees with DfE**: "Print Plus" is "a printed font with simple exit strokes in
  keeping with the DfE's phonics guidance".
- **Penpals** names it: *"Flick"* = exit stroke; note **`t` finishes with a curl, not a flick**.

**UK three-way font distinction:** *Print* (never joins) → *Cursive* (print start points **plus**
exit strokes; all letters finish on the line **except `o r v w`, which have a top exit**) →
*Continuous cursive* (adds a lead-in from the baseline). For a print tracing game, **exit
strokes should be an optional layer, off by default**.

### 7.4 UK lines and proportions — same 2:1, fewer lines

- **NHA recommends only TWO lines**: a baseline plus a line at the **top of the small letters**
  (x-height). Deliberately no ascender/descender rules — children "learn to estimate ascender
  and descender heights at **approximately twice the size of the small letters**."
  Rulings 4 mm / 5 mm / 6 mm.
- **This is the same 2 : 1 proportion as the US 4-line model** (§2.2) — ascender = 2 × x-height.
  UK just doesn't draw the guide lines.
- **Zone naming.** NHA: **attic / room / cellar**, or **sky / grass / underground**.
  Twinkl & SparkleBox: **Ground, Grass and Sky** (3-band coloured guide).
- **Teach Handwriting**: "lower-case letters being approximately **half the size** of capital
  letters."
- **Penpals vocabulary** (the words UK teachers use): *lower case letter*, ***capital letter***
  (preferred over "upper case"), *letter with an ascender*, *letter with a descender*,
  ***short letter*** (neither), ***flick*** (exit stroke), ***curve*** (the descender of
  `y j g f`), ***cross bar*** (the L→R line on `t` and `f`).
- UK ascender/descender membership matches the US **except `f`**, which UK policies often list
  in **both** groups (the Penpals descender form).

### 7.5 UK letterforms are *officially* configurable

Worth knowing before you hard-code anything: UK schools pick variants, and the vendors ship them.

- **Letter-join**: "your school's preferred letterforms for **f, k**, w, x and z will be used" —
  in the *printed* font, the alternates are **`f` and `k` only**.
- **Teach Handwriting**: "the letters **f and k** … can be written in different ways, impacting
  on which letter family they are taught in" — four combinations offered.
- Also school-selectable in practice: capital `J`/`I` (bar/serifs or not), capital `Y`
  (central stalk or not), curly vs straight `k`, and `f` with or without a descender.

**If you need one internally consistent UK model:** Little Wandle as the spine (current
DfE-validated, print, no lead-ins, complete A–Z + a–z phrase set), the DfE ten-letter list as an
optional flick layer, Twinkl's four family names for child-facing UI, and `f`, `k`, `J`, `Y`,
`M`/`N` left configurable.

### 7.6 Not verified

- No UK resource with readable **numbered** arrows was found; UK stroke order lives in
  animations and spoken rhymes, not numbered diagrams.
- gov.uk **Writing Framework (July 2025)** handwriting section — page 404'd.
- Little Wandle's family names/membership (subscriber-only); Little Wandle's `e` stroke order.
- Letter-join's "Oxford lines" geometry.

---

## 8. Implementation cheat-sheet

**Pen-stroke counts (Zaner-Bloser spine — recommended default):**

```
UPPERCASE  A3 B2 C1 D2 E4 F3 G1 H3 I3 J2 K2 L1 M2
           N2 O1 P2 Q2 R2 S1 T2 U1 V1 W1 X2 Y2 Z1     total 48
lowercase  a1 b1 c1 d1 e1 f2 g1 h1 i2 j2 k2 l1 m1
           n1 o1 p1 q1 r1 s1 t2 u1 v1 w1 x2 y2 z1     total 32
```

**Multi-stroke glyphs only** (everything else is one continuous stroke):

- 4 strokes: `E`
- 3 strokes: `A F H I`
- 2 strokes: `B D J K M N P Q R T X Y` · `f i j k t x y`
- 1 stroke: all remaining 32 glyphs

**Quick rules to encode:**

1. Start every stroke at its **topmost** point; draw **downward**.
2. Draw every horizontal **left→right** — except capital `G`'s bar.
3. `c a d g o q e s` + `C G O Q S` open **counter-clockwise**.
4. `b p` + `B D P R U` bowls run **clockwise**.
5. Dots (`i j`) are **always last**.
6. Crossbars on `f t` are **always last**; on `A H` last; on `E F I J T` after the stem.
7. `d q` begin with a circle; `b p` begin with a line.
8. Retrace-up is legal and expected in `a b d g h m n p q r`; it is not a pen lift.

**Make these configurable** — every one is a live disagreement between real curricula, and UK
vendors already ship them as school-selectable options:

| Toggle | Options | Default |
|---|---|---|
| `J` top bar | bar (2 strokes) / bare hook (1) | **bar** |
| `I` capital serifs | serifs (3 strokes) / bare stem (1) | **serifs** |
| `Y` capital | 2 strokes / 3 with central stalk | **2** |
| `k` lowercase | 2 strokes / 3 | **2** |
| `t` height | full ascender / ~3/4 | **full** |
| `f` | no descender / with descender (UK) | **no descender** |
| `y` lowercase | two diagonals (US) / curved tunnel body (UK) | **diagonals** |
| `G` bar direction | R→L continuous (1 stroke) / L→R separate (2) | **R→L, 1 stroke** |
| capital decomposition | continuous corners (ZB: `M`2 `W`1 `Z`1 `L`1) / discrete pieces (HWT: 4/4/3/2) | **continuous** |
| exit strokes ("flicks") | off / on for `a d h i k l m n t u` (DfE list) | **off** |


---

## What we implemented

`examples/alphabet/src/glyphs.mjs` follows the Zaner-Bloser column above, with three
deliberate departures. Each is a real decision, not an oversight.

| Glyph(s) | ZB says | We ship | Why |
|---|---|---|---|
| `a` `d` `g` `q` | **1** stroke — bowl, then *retrace up* the stem and pull back down | **2** strokes — bowl, then the stem/tail as its own pen-stroke | ZB's single stroke needs a full up-and-back retrace of the stem. It adds drag length without adding a motor lesson, and it makes the bowl and the stem impossible to score separately. HWT and every tracing app we surveyed split them the same way. The rendered shape is identical. |
| `J` | 2 strokes **with** a top bar | 2 strokes with a top bar | Followed — but note this is genuinely contested. US charts are unanimous for the bar; several UK schemes (Little Wandle) deliberately omit it, and most digital fonts have no bar. If a UK variant is ever needed, this is the first switch to add. |
| `t` | full-ascender or 3/4 height, split by curriculum | 3/4 height (top at y = 0.40) | The shorter `t` is what distinguishes it from `l` at a glance, which matters more in a tracing game than curriculum fidelity. |
| `t` | "top line → down → baseline" (a bare stem) | a small curved foot on the stem | Almost every modern worksheet and school font gives `t` a foot; a bare vertical reads as a cross, not a letter. The stroke order is unchanged — stem first, cross second. |

### Optical adjustments (shape, not stroke order)

Three glyphs stop just short of the line the tables name, because hitting it exactly reads worse
at monoline weight. None changes the stroke count, order or direction:

| Glyph | Table says | We ship | Why |
|---|---|---|---|
| `M` | the middle vertex reaches the baseline | y = 1.88 | A vertex landing exactly on the baseline makes the two halves look like they sag. |
| `N` | the diagonal reaches the baseline | y = 1.86 | Same; also keeps the diagonal's round cap from spilling below the rule. |
| `W` | the middle apex reaches the top line | y = 0.34 | At the fat pen weight a full-height apex closes up the two valleys. |

Everything else — including the contested set (`f` 2 strokes cross-last, `k` 2 strokes,
`t` stem-first, `y` right-arm-into-the-tail, `b`/`p` line-first vs `d`/`q` circle-first,
`i`/`j` dot last, `x` backslash first, `Q` tail separate, `G` barred in one stroke with
the bar right-to-left, `M`/`N`/`W` at 2/2/1 pen strokes) — matches the recommendation.

**Not implemented:** the UK letterform variants (§7). A UK mode needs different *geometry*
for `y` and `f`, not just a different stroke order, so it is a genuine feature rather than
a config flag. The glyph data is a plain table, so adding a second table is the shape that
change would take.
