# @glamour-labs/cli

The `glam` command — author and verify [Glamour](https://github.com/glamour-labs/glamour-2d)
documents.

```bash
npm install -g @glamour-labs/cli
glam doctor
```

| Command | What it does | Needs a browser? |
|---|---|---|
| `glam new <file.glam>` | write a starter document | no |
| `glam validate <file.glam>` | schema + every semantic rule; names the offending node/state/bind | no |
| `glam render <file.glam> -o <out.png>` | headless-render the resting frame, ~1–2s | **yes** |
| `glam preview <file.glam>` | serve a live interactive page | no |
| `glam doctor` | report each render prerequisite and its exact fix | — |

**`render` needs a real browser.** The renderer is WebGL2 and Node has no in-process rasterizer for
it, so headless render drives Chromium — which means the PNG comes from the *same* renderer that
ships to users. `playwright` is an optional peer, installed only if you want render:

```bash
npm install -g playwright && npx playwright install chromium
```

**Exit codes:** `0` ok · `1` the document is wrong · `3` the environment can't render. An exit 3 is
never evidence about your `.glam` — run `glam doctor` instead of editing it.

Full docs: **[glamour-labs/glamour-2d](https://github.com/glamour-labs/glamour-2d)** · MIT
