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
/>;

ref.current?.setInput('progress', 0.5);
ref.current?.send('RESET');
```

The handle exposes `send` / `setInput` / `play` / `pause`. **The host keeps the logic** — scoring,
timers, correctness — while Glamour owns motion and input.

**Next.js App Router:** this package ships a `'use client'` directive, so importing it from a server
component works as-is. It has to — the component owns a live WebGL2 context. Give the wrapper
explicit dimensions matching `canvas.w`/`canvas.h`, since the canvas only appears after hydration.

React 18 and 19 are both supported (`peerDependencies: react >=18`).

Full docs: **[glamour-labs/glamour-2d](https://github.com/glamour-labs/glamour-2d)** · MIT
