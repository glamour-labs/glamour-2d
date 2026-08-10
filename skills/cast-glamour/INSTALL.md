# Installing the `cast-glamour` skill

This skill teaches Claude Code to author `.glam` documents — the schema, the primitive palette, and
the mandatory self-verify loop. It is **not** an npm package: Claude Code discovers skills as
directories on disk, so installing it means copying it into your Claude configuration.

## 1. The CLI it depends on

The skill shells out to `glam validate` and `glam render`. Without the CLI it can still author, but
it cannot *verify*, which is the part that makes AI authoring trustworthy. Install it first:

```bash
npm install -g @glamour-labs/cli
npm install -g playwright && npx playwright install chromium   # for `glam render`
glam doctor                                                    # confirm both landed
```

`glam doctor` must report that render is ready. If it doesn't, it names the exact fix.

## 2. The skill itself

```bash
git clone https://github.com/glamour-labs/glamour-2d.git /tmp/glamour-2d
mkdir -p ~/.claude/skills
cp -R /tmp/glamour-2d/skills/cast-glamour ~/.claude/skills/cast-glamour
```

Optionally also install the sub-agent, which wraps the same knowledge in a dispatchable form:

```bash
mkdir -p ~/.claude/agents
cp /tmp/glamour-2d/agents/glamour-smith.md ~/.claude/agents/glamour-smith.md
```

Skills are discovered at session start, so **start a new Claude Code session** afterwards.

## 3. Check it works

In a new session, ask for something in plain language — "make me a glamour of a loading spinner".
Claude should pick up `cast-glamour`, write a `.glam`, and then run validate + render before
handing it back. If it hands you a document without a rendered PNG, the CLI half is missing: run
`glam doctor`.

## Keeping it current

This repo is the source of truth. After pulling changes, re-copy — the installed copy does not
update itself:

```bash
cp -R <checkout>/skills/cast-glamour ~/.claude/skills/
```

If you work on the skill *in* a checkout, symlinking instead of copying stops the two drifting:

```bash
ln -sfn <checkout>/skills/cast-glamour ~/.claude/skills/cast-glamour
```
