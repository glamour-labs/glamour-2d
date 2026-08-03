# Embed a glamour in a plain web page

A minimal third-party page (not part of the library) that embeds `demo.glam` two ways:
- **Path A** — `<glam-canvas src="demo.glam">` (zero JS; the UMD auto-registers the element)
- **Path B** — `Glam.renderGlamour(doc, mount)` + buttons/slider driving a host input

## Run it
```bash
# 1. build the player, then copy the UMD bundle next to this page:
pnpm --filter @glam/player build     # (from repo root, Node 20)
cp ../../packages/player/dist/glam-player.umd.js .
# 2. serve (fetch needs http, not file://):
python3 -m http.server 8123
# open http://localhost:8123
```
Click the orb (state machine), drag the slider (host input → bound bar width). That's it.
See ../../docs/USING-GLAMOUR.md for the full guide.
