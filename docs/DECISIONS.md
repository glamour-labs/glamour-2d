# Decisions

Durable decision records for Glamour. Read this first in a new session before changing the
toolchain or packaging — the *why* is here so choices don't get silently reverted.

> **This is an append-only log, not a snapshot.** §1–§4 describe the Konva-era engine and are
> preserved verbatim because they were true when made. **§5 supersedes them on the toolchain
> points** — in particular there is no longer a Node 20 / native-`canvas` requirement, `renderToPNG`
> has moved out of `@glam/core`, and the test count is 265 rather than 131. Read §5 before acting on
> anything toolchain-related in §1 or §3.
>
> **§6 supersedes §2 entirely** — the packages ARE published now, and the scope is `@glamour-labs/*`,
> not `@glam/*`. Package names written as `@glam/…` anywhere in §1–§5 are historical; the live
> names all read `@glamour-labs/…`. Read §6 before touching anything about packaging or release.

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

## 5. The renderer — Konva replaced by hand-written WebGL2 (v2)

**Decided 2026-08-03.** Entries §1–§4 above describe the Konva-era engine and are
left as written — they were true when made, and this is a log, not a snapshot.

`glamour-v2` is a fork of this repo with exactly one thing replaced: the
rasterizer. Konva and the native `canvas` package are gone; the scene is drawn by
`packages/core/src/gl/`. The `.glam` format, schema ids, state machine, bindings,
ink, guided strokes, host API and React binding are unchanged, and **every v1
document loads unedited**.

Why a fork rather than an in-place swap: v1 stays runnable as the **pixel oracle**,
so "does it still look right" is a measured number instead of a judgement call. It
is not a dependency; it is the spec.

Consequences that ripple outward:

- **No Node version pin.** The Node-20.19.4 constraint existed only for the native
  `canvas` ABI. Headless render now drives a real headless Chromium, which also
  means it rasterizes with the *same* renderer that ships to users — a headless
  PNG is evidence about production. Cost: ~1–2s per render, and Chromium must be
  installed.
- **`renderToPNG` moved** from `@glam/core` to `@glam/player/node`. WebGL has no
  in-process rasterizer, so it cannot live in core.
- **Tests split in two.** jsdom has no WebGL context at all; v1 could run
  everything there only because Konva needed a 2D context, which `canvas`
  supplied. Scene tests now run in real Chromium.
- **`buildScene(doc, mount, opts?)`** — no injected Konva. Node handles keep
  Konva's chainable accessor shape on purpose, which is why the player, run-loop
  and harness needed almost no changes.
- **Context loss is now a real failure mode** and is handled explicitly. Canvas2D
  had no equivalent.

The full engineering account, including the four bugs the gates caught and the
residual text-rasterizer difference, is in `docs/V2-RENDERER.md`.

**Cutover completed 2026-08-03.** `~/.local/bin/glam`, `~/.claude/skills/cast-glamour/`
and `~/.claude/agents/glamour-smith.md` all point at v2; v1's README carries a
RETIRED banner. v1 stays on disk and stays built — it is the pixel oracle for both
parity gates, and a stale `dist/` there has already produced one wrong result. See
ROADMAP §"CUTOVER DONE" for the verification and the re-copy caveat on the skill.

---

## 6. Published to npm as `@glamour-labs/*`, from `glamour-labs/glamour-2d`

**Date:** 2026-08-10 · **Status:** active · **Supersedes §2 entirely**

**Decision.** The five library packages are published to the public npm registry under the
`@glamour-labs` scope, from a public GitHub repo at `glamour-labs/glamour-2d`, MIT licensed.

**Why now.** §2 said to publish "only when there's a second consumer." There is one:
`react-web-monorepo` (Next 16 / React 19) embeds glamours in a real product. Copying a UMD file
into `public/` — §2's stopgap — has no version, no changelog, and no way to tell which build a
given app is running.

**Names — and the check that cannot be skipped.** Plain `glamour` was unavailable in both
namespaces, and finding that out cost two rounds of rework:

- **GitHub:** `github.com/glamour` is an existing *user* account. GitHub shares one namespace
  between users and organizations, so no org by that name can exist.
- **npm:** `@glamour` is held too — with **zero published packages under it**. This is the trap.
  We reasoned from `registry.npmjs.org/@glamour%2Fcore` returning 404 that the scope was free. It
  isn't: a 404 means *that package* doesn't exist, and says nothing about who owns the scope. npm
  answers anonymous namespace lookups with 401/403, so **scope availability is unknowable without
  logging in.** Only the create-org form gives a real answer.

The rule that falls out: **verify a name in the registry's own UI before renaming anything to it.**
The available-name check is not a `curl`.

So the scope is `@glamour-labs`, matching the org. `glamour-labs` is deliberately family-level
rather than dimensional — it is an umbrella for `glamour-2d`, `glamour-video` and later
`glamour-3d`, and one scope shared across all three is worth more than a per-repo `@glamour-2d`.
Scope and org don't have to match; here they happen to, which is strictly easier to explain.

What did NOT get renamed, on purpose: the `glam` CLI binary, the `.glam` extension, the
`window.Glam` UMD global, and `glam-player.umd.js`. Those are format and UX surface. Only package
identity changed.

**The five flips (what §2 predicted, plus one it missed):**
1. `private: true` removed from the five packages. `apps/studio` and the examples stay private.
2. **`files: ["dist"]` added — this was the trap.** `dist/` is gitignored, and with no `files`
   field npm falls back to `.gitignore` when building the tarball. Publishing as-is would have
   *succeeded* and shipped source with no build output. A silent broken publish, not a loud one.
3. Inter-package specs went `"*"` → `"^0.1.0"`. `"*"` would have published as a dependency on
   *whatever core is latest, forever*. `^0.1.0` publishes correctly **and** still links locally
   under pnpm's `link-workspace-packages`, so §1's npm fallback survives — which `workspace:*`
   would have broken, since npm doesn't implement that protocol.
4. `LICENSE` (MIT) added at the root plus `license`/`repository`/`homepage`/`bugs` on each package.
   A public repo with no license is legally all-rights-reserved and nobody can use it.
5. `publishConfig.access: public` (scoped packages default to restricted) and a `prepublishOnly`
   build per package.

**The `canvas` native-dep worry from §2 is moot.** v2 deleted native `canvas` with Konva. The only
heavy dependency left is playwright, and it is an *optional peer* — see §7.

**Release:** `pnpm release` at the root = build, test, then `pnpm -r --filter "./packages/*"
publish --access public`. Publish order is topological, so `core` lands before its dependents.

---

## 7. Playwright is an optional peer, and the failure had to be made recoverable

**Date:** 2026-08-10 · **Status:** active

**Decision.** `playwright` is an optional `peerDependency` of `@glamour-labs/cli`, `@glamour-labs/player`
and `@glamour-labs/mcp` — never a hard dependency.

**Why optional.** Exactly one command needs it: `glam render`. `new`, `validate` and `preview` do
not. Making it required would put a ~300MB Chromium download in front of every consumer —
including a React app that only ever *plays* a glamour and will never rasterize one.

**Why not something lighter.** Considered and rejected: `headless-gl` is WebGL **1** only and would
mean downgrading the renderer to suit the test tool; `@napi-rs/canvas`/`skia-canvas` are Canvas2D
only and would mean writing a second renderer — exactly what v2 deleted, and it would resurrect the
parity problem the pixel oracle exists to solve; `puppeteer` is the same weight for no gain. Driving
a real browser is not a workaround here, it is the point: the headless PNG comes from the *same*
renderer that ships to users (§5).

**The part that mattered more than the dependency choice.** Optional only works if the failure is
*solvable by whoever hits it* — and for this project that is very often an AI agent running the
cast-glamour self-verify loop, with no signal but the error text. As written, it was not solvable:

- The message always said `pnpm add -D playwright`. For the global CLI install most authors have,
  that adds the package to the wrong module graph — the fix "works," the retry fails identically,
  and the loop burns.
- Two distinct faults shared one message, and the second (package present, browser never
  downloaded) didn't even reach that handler — `launch()` threw playwright's raw error downstream.
- Nothing distinguished "your environment is broken" from "your document is broken", so the
  rational response to an environment failure was to start editing a perfectly valid `.glam`.

So the fix is four things, in `packages/player/src/diagnose.ts`: install-context-aware hints that
print both forms rather than guessing wrong silently; the two faults split with their own correct
commands; a `glam doctor` command; and **exit code 3** for "environment", distinct from 1 for
"bad document". `docs/DECISIONS.md` §3 had already recorded the underlying hazard — *"authoring
works but verification silently can't run"* — this closes it.

**`glam doctor` launches a real browser rather than stat'ing `executablePath()`.** They are
different binaries: `executablePath()` names the headed Chromium while a default `launch()` uses
the headless shell, so a path check can report "ok" on an install that cannot render. A diagnostic
nobody can trust is worse than none. The real launch costs ~1s, and doctor now uses the same launch
arguments as `renderToPNG`, so the two cannot drift.
