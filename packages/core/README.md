# @glamour-labs/core

Headless engine for the **glamour/v0** format — an AI-native document for interactive, animated
vector canvases. This package is the format itself: schema, validation, the op vocabulary, and the
environment-agnostic scene + state-machine builder.

```bash
pnpm add @glamour-labs/core
```

```ts
import { validate, applyOps, palette } from '@glamour-labs/core';

const result = validate(doc);
if (!result.ok) console.error(result.errors);   // names the offending node/state/bind
```

Most apps don't import this directly — they use [`@glamour-labs/player`](https://www.npmjs.com/package/@glamour-labs/player)
or [`@glamour-labs/react`](https://www.npmjs.com/package/@glamour-labs/react), which depend on it.

Full docs: **[glamour-labs/glamour-2d](https://github.com/glamour-labs/glamour-2d)** · MIT
