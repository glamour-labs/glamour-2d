# @glamour-labs/player

Browser runtime for [Glamour](https://github.com/glamour-labs/glamour-2d) documents — a hand-written
WebGL2 renderer plus an XState statechart, driven by named inputs.

```bash
pnpm add @glamour-labs/player
```

```ts
import { renderGlamour } from '@glamour-labs/player';

const player = renderGlamour(doc, document.getElementById('stage'));
player.setInput('progress', 0.8);
player.on((e) => console.log('emitted', e));
player.destroy();
```

Also exports `defineGlamCanvas()` (a `<glam-canvas>` web component) and `createHarness(doc)` for
headless drive-and-assert testing — drive a full drag, stop mid-interaction, and inspect state.

**Node-only helpers** live at `@glamour-labs/player/node`: `renderToPNG` (headless render) and
`exportInlineHTML` (a self-contained single-file player). `renderToPNG` needs `playwright`, declared
as an **optional peer** — browser hosts never pay for it.

React host? Use [`@glamour-labs/react`](https://www.npmjs.com/package/@glamour-labs/react).

Full docs: **[glamour-labs/glamour-2d](https://github.com/glamour-labs/glamour-2d)** · MIT
