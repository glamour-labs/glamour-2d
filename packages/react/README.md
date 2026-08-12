# @glamour-labs/react

React binding for [Glamour](https://github.com/glamour-labs/glamour-2d) — interactive, animated
vector canvases as a component.

```bash
pnpm add @glamour-labs/react
```

```tsx
import { Glamour, type GlamourHandle } from '@glamour-labs/react';

const ref = useRef<GlamourHandle>(null);

<Glamour
  ref={ref}
  doc={doc}
  onEmit={(e) => console.log('clicked', e.node)}
  onStroke={(e) => console.log('score', e.match?.score)}
  onGuided={(e) => console.log('stroke', e.index, e.progress, e.done)}
/>;

ref.current?.setInput('progress', 0.5);
ref.current?.send('RESET');
```

The handle exposes `send` / `setInput` / `play` / `pause`. **The host keeps the logic** — scoring,
timers, correctness — while Glamour owns motion and input.

### Which listener a tracing host wants

`onStroke` and `onGuided` are not two views of the same thing — they belong to the two different
ink modes, and picking the wrong one gets you silence:

| | Fires | Use it for |
|---|---|---|
| `onStroke` | once, at pen-up, on a doc with an `ink` block | free-write: the host scores raw ink against a `match` target |
| `onGuided` | continuously during the drag, on a doc with a `guided` block | guided tracing: per-stroke `progress` 0..1 and `done`, for milestone feedback and advancing to the next stroke |

A guided doc draws no free ink, so `onStroke` never fires for it. A tracing UI that wants live
progress — a sound every 10%, a sparkle at completion — needs `onGuided`.

**Next.js App Router:** this package ships a `'use client'` directive, so importing it from a server
component works as-is. It has to — the component owns a live WebGL2 context. Give the wrapper
explicit dimensions matching `canvas.w`/`canvas.h`, since the canvas only appears after hydration.

React 18 and 19 are both supported (`peerDependencies: react >=18`).

Full docs: **[glamour-labs/glamour-2d](https://github.com/glamour-labs/glamour-2d)** · MIT
