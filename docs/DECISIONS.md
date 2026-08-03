# Decisions

Durable decision records for Glamour. Read this first in a new session before changing the
toolchain or packaging — the *why* is here so choices don't get silently reverted.

---

## 1. Toolchain — pnpm (npm kept working as a fallback)

**Date:** 2026-07-22 · **Status:** active

**Decision.** pnpm is the package manager. npm still works too — we did *not* burn the npm bridge.

**Why pnpm.** Faster installs, content-addressable store (disk savings), stricter/correct
dependency resolution. Modest but real win for a small monorepo.

**Config that makes it work (don't remove these):**
- `pnpm-workspace.yaml` — lists the workspace packages **and** `onlyBuiltDependencies: [canvas, esbuild]`.
  - ⚠️ pnpm (v9+) **blocks native/postinstall build scripts by default.** Without this list, `canvas`
    (the headless renderer's native binary) and `esbuild` (tsup/vite) never build → `glam render`
    breaks with a cryptic canvas error. This is the #1 thing that bites a fresh pnpm clone.
- `.npmrc` — `link-workspace-packages=true`. The inter-package specs are `@glam/*: "*"` (not
  `workspace:*`). This flag makes `*` link to the local workspace copies under **both** pnpm and npm.
  We deliberately kept `*` (not `workspace:*`) so `npm install` still works as a fallback.
- `package.json` keeps the `workspaces` field (npm reads it; pnpm ignores it) and `build: pnpm -r build`.

**Node 20 is still mandatory** regardless of package manager — the native `canvas` binary is built
for the Node-20 ABI. `.nvmrc` pins `20.19.4`. Prefix commands with the Node-20 bin if the shell
defaults to something newer.

**Everyday commands:**
```bash
pnpm install                       # canvas + esbuild pre-approved to build
pnpm build                         # = pnpm -r build (topological)
pnpm test                          # 131 tests
pnpm --filter @glam/studio dev     # run the Studio (npm equiv: -w @glam/studio)
```

**Verified 2026-07-22** under pnpm 10.20 / Node 20.19.4: install (canvas built), build-all incl.
Studio, 131 tests green, a real `glam render` PNG (proves `konva→canvas` resolves under pnpm's
symlinked layout), Studio bundle build.

**To go pnpm-only** (drop the npm fallback), if ever wanted: remove the `workspaces` field from
`package.json`, remove `.npmrc`, and switch the inter-package `*` specs to `workspace:*`.

---

## 2. Packaging / publishing — local for now, publishable anytime

**Status:** NOT published to any registry. Local monorepo; every package is `private: true`.

**Using it in a real project today (no registry needed):**
- Copy the self-contained UMD `packages/player/dist/glam-player.umd.js` into the target project
  (e.g. its `public/`), or
- `npm pack` / `pnpm pack` a package into a tarball and install that.
- See `USING-GLAMOUR.md` for the three embed paths.

**Switching to pnpm did NOT close the npm-publish door.** pnpm is the *dev* package manager;
publishing is a separate act against the npm *registry* (npmjs.com). pnpm publishes there fine:
`pnpm publish` (per package) or `pnpm --filter @glam/core publish`. The tool you install with is
orthogonal to where you publish — pnpm actually has *better* monorepo publish ergonomics than npm.

**When we decide to publish, three flips (none blocked by pnpm):**
1. Remove `private: true` (or add a `publishConfig`) on the packages to publish.
2. Replace the `*` inter-package specs with pinned versions — or switch them to `workspace:*`, which
   pnpm auto-rewrites to the real published version at publish time.
3. Decide the `canvas` native-dep story: `@glam/core` pulls native `canvas` (heavy for consumers to
   build). The browser **UMD player has no canvas dependency**, so most web consumers want the
   player/UMD, not core. Consider publishing the player (browser-safe) first, or splitting the
   node-only headless-render bits behind an optional/peer dep.

**Recommendation:** publish only when there's a second consumer or you want to hand it to others.
Until then, local is strictly better — no registry maintenance, no name squatting, no version churn.
The `@glam` npm scope is also likely not ours to take; publishing would need our own npm org/scope.

---

## 3. AI authoring installed globally (`cast-glamour` skill + `glamour-smith` agent)

**Date:** 2026-07-22 · **Status:** installed on this machine

So glamours can be authored **by describing them** in any Claude Code session, three pieces are
installed outside the repo:
- `~/.local/bin/glam` — a wrapper script (`node@20 → glamour/packages/cli/dist/cli.js`). Makes the
  `glam` CLI available from any directory, pinned to Node 20 (canvas ABI). **Regenerate it** if the
  repo moves or the Node version changes (the path is hardcoded).
- `~/.claude/skills/cast-glamour/` — the skill (SKILL.md + reference/ + examples/), copied from
  `skills/cast-glamour/` in this repo. The repo is the source of truth; re-copy after editing it.
- `~/.claude/agents/glamour-smith.md` — the sub-agent, copied from `agents/glamour-smith.md`.

**Dependency chain (why all three):** the skill/agent shell out to `glam validate` / `glam render`
(the mandatory self-verify loop) → `glam` is the wrapper → the repo's built CLI → Node 20 + native
canvas. If any link is missing, authoring works but *verification* silently can't run. Build the repo
(`cd ~/Project/glamour && pnpm build`) if `glam` reports a missing build.

**How to trigger** (in a NEW session — skills are discovered at session start): just describe it —
"make me a glamour of a loading spinner" — and Claude picks up `cast-glamour`; or `/cast-glamour
<description>`; or dispatch the `glamour-smith` agent. The output is a validated `.glam` (+ a rendered
PNG) written wherever you're working.

**To keep the installed copies in sync** after editing the skill in-repo: re-run the copy
(`cp` SKILL.md + reference/ + examples/ into `~/.claude/skills/cast-glamour/`, and glamour-smith.md
into `~/.claude/agents/`).

---

## 4. v0.1 authoring gotchas: group z-order + `canvas.bg` painting

**Date:** 2026-07-22 · **Status:** documented (from the v0.1 verification pass)

**Group z-order trap.** `buildScene` (`packages/core/src/scene.ts`) adds every `doc.groups[]`
entry to the layer FIRST, then adds every `doc.nodes[]` entry (nesting into its group if
`node.group` matches, otherwise straight onto the layer). The upshot: **an ungrouped node
always paints above every group, regardless of where it sits in `doc.nodes` order** — Konva
paints in add-order, and groups are all added before any node. `validate` has no way to know
authoring *intent* here (there's no "z-index" concept in the schema), so this can't be caught
as an error — it's a doc-authoring trap, not a bug.

If a node needs to visually sit ON TOP of (or paint over) a group's children, an ungrouped
node can't win that fight no matter where it appears in `doc.nodes` — **wrap the covering
node in its own (possibly single-child) group** instead, so it competes in the group-vs-group
add order rather than losing outright as a bare node vs. a group.

**`canvas.bg` is now actually painted (v1 fix).** `buildScene` paints `doc.canvas.bg` as a
non-listening `Konva.Rect` at the bottom of the layer. Before this fix it was a dead field —
only the mount container's CSS background showed through, so a doc that set `canvas.bg` and
relied on that (rather than container CSS) rendered with a transparent/wrong background in
the headless PNG render. **If you have a v0 doc authored before this fix that sets
`canvas.bg` expecting it to be a no-op**, it will now render an opaque background — re-check
any such doc's headless render/screenshot.
