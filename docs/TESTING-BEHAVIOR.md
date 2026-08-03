# Testing behavior — the drive-and-assert harness

**The point:** Glamour's runtime is drivable and inspectable out of the box, so an
agent (or CI) can exercise an interactive `.glam` *the way a real user would* —
including stopping **mid-interaction** — and assert the result. This is the thing
a binary format like Rive can't give an AI: not just "does it render," but
**drive it → (optionally freeze it) → check it**, with no human in the loop.

The boundary is honest: the harness tests everything **objective**. It does **not**
judge *feel* — "smooth / stuck / floaty / auto-completes too early." That still
needs a real device and a human (see `cast-glamour` §0). Everything else becomes
an automated regression guard.

## Two shapes of assertion

1. **Drive → assert outcome.** Run a full interaction, check what came out:
   the `onStroke` trace score, `done`/`index`, emitted events, final machine state.
2. **Freeze → assert invariant.** Stop *partway* (a "half go") and read live state:
   a node's position/opacity/points, the machine state, how much ink exists. This
   is where the subtle bugs live (a handle that jumps, ink that runs ahead, an
   arrow that flips early) — none of which show up if you only test the happy path.

## API (`@glam/player`)

```ts
import { createHarness } from '@glam/player';

const h = createHarness(doc);          // renders headless (jsdom/browser DOM)

// drive (chainable)
h.stroke([[10,10],[55,55],[100,100]]); // FULL go: down→moves→up; returns the stroke event
h.dragTo([[10,10],[55,55]]);           // HALF go: down→moves, NO up — inspect, then h.up()
h.down(x,y); h.move(x,y); h.up();      // manual pointer control
h.setInput('progress', 1);             // drive input-condition transitions + binds
h.send('RESET');                       // fire a machine @EVENT
h.tick(500);                           // advance loops/wander by 500ms of virtual time

// inspect (at any instant)
h.node('ink');    // { x, y, opacity, rotation, points? }
h.state();        // machine state name
h.strokes;        // completed onStroke events, in order  (h.lastStroke())
h.emits;          // node.emit clicks that bubbled up
h.pointers;       // raw down/move/up stream

h.destroy();
```

Point it at **any** `.glam` — it is not tied to one document. See
`packages/player/test/harness.test.ts` for worked examples (ink scoring,
accumulation, half-go, binds, machine, loops).

## The case matrix to reach for

Don't stop at the happy path. For an interactive glamour, trace at least:

| Class | What to assert |
|---|---|
| **Full path** | correct trace → completes; expected score / `done` |
| **Half go** | grab, drag partway, `up()` → *stays* where it stopped; **not** complete |
| **Resume** | continue from a partial state → completes exactly once (guards double-fire) |
| **Wrong-way / drift** | finger wanders mid-drag → does **not** jump / auto-complete |
| **Off-path** | scribble away from the target → low score (host would reject) |
| **Multi-stroke** | later strokes' guides hidden until earlier ones done; strokes accumulate; `index`/`done` correct |
| **Invariants (freeze)** | at many progress points: arrow direction, ink never past the handle, node visibility |
| **Reset** | after completion → back to the initial state |

## What's player-level (harness-testable) vs host-level

The harness reaches **player-level** behavior — and as of the native **`guided`**
block, that now includes guided drag-along-a-path (grab, snap, trim, per-stroke
advance): `player.onGuided` events + trimmed `into.points` are asserted headlessly
(`packages/player/test/guided.test.ts` — full go, half go, wrong-way, multi-stroke).
So the "half go" cases are now automated, not device-only.

What remains **host-level** is pure *presentation* reacting to those events —
revealing the next stroke's guide, the sparkle burst, the Reset button. That's
trivial glue, not delicate mechanics.

Deferred (its own gated step): migrating the 4 draw-letter EASY glams + playground
from their bespoke host guided-drag to the native `guided` block — the letters are
approved and delicate, so that swap gets its own verify + device check. And *feel*
(smooth / stuck / floaty) is always a device call, never the harness's.
