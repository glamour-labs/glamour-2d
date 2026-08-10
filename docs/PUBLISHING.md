# Publishing to npm

The five packages under `packages/` publish to the public npm registry as `@glamour-labs/*`.
`apps/studio`, `examples/*` and `skills/*` are `private: true` and never publish.

For *why* it's published at all, and the naming trap that preceded it, see
[DECISIONS.md](DECISIONS.md) §6.

## Prerequisites, once

1. **Be a member of the `glamour-labs` npm org.** The scope only works for org members —
   `@glamour-labs/*` is the org's namespace.
2. **`npm login`.**
3. **Create a granular access token with "bypass 2FA" enabled**, and use it instead of an
   interactive one-time code. This is not laziness — see the OTP race below.

## Release

```bash
pnpm release
```

That is `pnpm build && pnpm test && pnpm -r --filter "./packages/*" publish --access public`.
Publish order is topological, so `core` lands before the packages that depend on it.

## Three things that will bite

### 1. `pnpm publish` refuses to run off `main`

pnpm's git checks require the current branch to match `publish-branch` (`main`/`master`). On any
other branch it *prompts interactively and defaults to No* — so in CI or a non-interactive shell it
hangs or aborts, and the failure doesn't look like a branch problem.

Publish from `main`:

```bash
git checkout main && git merge --ff-only <your-branch>
```

Only bypass it deliberately, never as a habit:

```bash
pnpm -r --filter "./packages/*" publish --access public --no-git-checks
```

### 2. One OTP does not survive five sequential publishes

npm requires 2FA for publishing. An interactive OTP is a ~30-second window, and `pnpm release`
publishes **five packages one after another** — the code can expire partway through, leaving
`core` published and `react` not.

That state is annoying rather than fatal, but it isn't free: **a published version number can never
be reused**, even after `npm unpublish`. So a half-finished release means the next attempt needs a
version bump for the packages that already landed.

Use the bypass-2FA token from the prerequisites, and the race disappears.

### 3. `files: ["dist"]` is what makes the tarball non-empty

`dist/` is gitignored. With no `files` field, npm falls back to `.gitignore` when building the
tarball and would ship source with **no build output** — a publish that *reports success* and
produces a broken package.

Before any release, confirm the build output is actually in there:

```bash
cd packages/player && npm pack --dry-run
```

`dist/glam-player.umd.js` must appear. `renderToPNG` reads that file at runtime, so a tarball
without it breaks `glam render` for every consumer.

## Recovering a partial release

1. `npm view @glamour-labs/<pkg> versions` — see exactly what landed.
2. Bump the packages that already published (`pnpm -r exec npm version patch`, or edit by hand and
   keep the `^0.1.0` inter-package ranges consistent).
3. Re-run `pnpm release`.

Don't reach for `npm unpublish`. It's allowed only within 72 hours, it doesn't free the version
number for reuse, and it breaks anyone who already installed.

## Verifying a release from the outside

Install into a scratch directory rather than trusting the registry page:

```bash
mkdir /tmp/verify && cd /tmp/verify && npm init -y
npm i @glamour-labs/react react react-dom
head -c 14 node_modules/@glamour-labs/react/dist/index.js   # must print: 'use client';
```

That last line is the one regression that would silently break every Next.js App Router consumer.
