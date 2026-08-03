# runtime-qc · Glamour v1 non-UI surfaces (CLI / core API / MCP / skill examples) · rollup: PASS

Environment: Node v20.19.4 (`export PATH="$HOME/.nvm/versions/node/v20.19.4/bin:$PATH"`), `npm install` (up to date, 375 packages), `npm run build` at repo root — all workspaces built clean (core, cli, mcp, player, studio incl. `tsc --noEmit` + `vite build`).

## 1. CLI end-to-end self-verify loop — PASS

### `glam new` — PASS
- Tested: `node packages/cli/dist/cli.js new /tmp/qc.glam`
- Expected: writes starter `.glam`, prints path, exit 0
- Actual: printed `/tmp/qc.glam`, exit 0. File content matches the spec's example doc exactly (schema `glamour/v0`, orb/bar nodes, bind, idle/active machine).
- Evidence: command output above; file diffed by eye against spec §4 example (`docs/superpowers/specs/2026-07-22-glamour-design.md:69-85`) — identical.

### `glam validate` (valid doc) — PASS
- Tested: `node packages/cli/dist/cli.js validate /tmp/qc.glam`
- Expected: prints ok, exit 0
- Actual: `ok`, exit 0

### `glam validate` (broken doc — bind referencing missing node) — PASS
- Tested: took `/tmp/qc.glam`, appended `{"node":"does-not-exist","prop":"w","expr":"progress"}` to `bind` via a Python one-liner → `/tmp/qc-broken.glam`, then `node packages/cli/dist/cli.js validate /tmp/qc-broken.glam`
- Expected: exit 1, useful error mentioning the missing node id
- Actual: stdout `bind references missing node: "does-not-exist"`, exit 1

### `glam render` — PASS
- Tested: `node packages/cli/dist/cli.js render /tmp/qc.glam -o /tmp/qc.png`
- Expected: real PNG, signature `89 50 4E 47`, exit 0
- Actual: exit 0, printed `/tmp/qc.png`; `xxd` first bytes `8950 4e47 0d0a 1a0a` (matches PNG magic); file size 3214 bytes.
- Evidence: `xxd /tmp/qc.png | head -1` output above; `ls -la /tmp/qc.png` → 3214 bytes.

### `glam preview` — PASS
- Tested: `node packages/cli/dist/cli.js preview /tmp/qc.glam &` → printed `http://127.0.0.1:49799/` → `curl -sS -D - -o preview_body.html http://127.0.0.1:49799/`
- Expected: HTTP 200, self-contained HTML containing `window.Glam`
- Actual: `HTTP/1.1 200 OK`, `Content-Type: text/html; charset=utf-8`; body (677,289 bytes) contains the literal string `window.Glam`.
- Process cleanup: `kill <pid>` issued, confirmed via `ps -p <pid>` returning no matching process (server fully stopped).
- Evidence: curl header dump + grep hit above; body saved at `/private/tmp/claude-502/-Users-khavu-Project/461a359e-10b1-4a91-bf38-731b398e953f/scratchpad/preview_body.html` (scratchpad, not repo).

## 2. Core public API (`@glam/core`) — PASS

- Tested: scratch ESM script (`import { validate, applyOps, palette, renderToPNG } from '@glam/core'`) run from repo root so the workspace symlink (`node_modules/@glam -> packages/core`) resolves; script temp-copied into repo root as `.qc-core-check.mjs`, executed, then deleted (no residue).
- Expected (per plan Group A DoD): `validate` ok on spec's example doc; `applyOps` applies a palette primitive and re-validates ok; `applyOps` does not mutate its input; `renderToPNG` produces a real PNG.
- Actual output:
  ```
  validate(example doc): {"ok":true,"errors":[]}
  ops from palette.hoverGrow: [{"op":"defineState","name":"idle","state":{"on":{"orb.hover":"hover"}}},{"op":"defineState","name":"hover","state":{"set":{"orb.r":80},"on":{"orb.leave":"idle"}}},{"op":"setInitial","name":"idle"}]
  input doc mutated? unchanged (good)
  doc2 !== doc (new object)? true
  validate(after applyOps): {"ok":true,"errors":[]}
  renderToPNG type: Buffer length: 3214
  PNG signature: 89504e470d0a1a0a OK
  ```
- Confirms: `applyOps` is pure (input doc's `JSON.stringify` before/after call is byte-identical; returned doc is a different object reference); result re-validates ok; PNG signature correct.
- Evidence: full script at `/private/tmp/claude-502/-Users-khavu-Project/461a359e-10b1-4a91-bf38-731b398e953f/scratchpad/core-check.mjs`; raw stdout captured above.

## 3. MCP server (`@glam/mcp`) — PASS

- Tested: real subprocess over stdio (not in-process/in-memory) — `StdioClientTransport` spawning `node /Users/khavu/Project/glamour/packages/mcp/dist/index.js` (the `glam-mcp` bin target), full MCP SDK `Client.connect()` (does the `initialize` handshake), `listTools()`, then a scripted `callTool` session: `new_scene` → `add_node` → `apply_primitive` → `validate` → `render_preview`, plus an error-path check (`add_binding` to a missing node → `validate`).
- Expected: ≥11 tools listed; scripted session succeeds; `render_preview` returns a real PNG (base64, decodes to PNG signature); error path surfaces `isError`.
- Actual:
  ```
  TOOL_COUNT: 11
  TOOL_NAMES: new_scene,add_node,set_props,define_state,set_initial,add_binding,set_input,apply_primitive,validate,list_primitives,render_preview
  new_scene: {"content":[{"type":"text","text":"{\"created\":true}"}],"isError":false}
  add_node: {"content":[{"type":"text","text":"{\"added\":\"orb\"}"}],"isError":false}
  apply_primitive: {"content":[{"type":"text","text":"{\"applied\":\"hoverGrow\"}"}],"isError":false}
  validate: {"content":[{"type":"text","text":"{\"ok\":true,\"errors\":[]}"}],"isError":false}
  render_preview content type: text
  decoded PNG length: 2511 sig: 89504e470d0a1a0a
  add_binding(missing-node): {"content":[{"type":"text","text":"{\"bound\":{\"node\":\"missing-node\",\"prop\":\"w\",\"expr\":\"progress\"}}"}],"isError":false}
  validate(after bad bind): {"content":[{"type":"text","text":"{\"ok\":false,\"errors\":[\"bind references missing node: \\\"missing-node\\\"\"]}"}],"isError":true}
  ```
- Tool count matches spec's "expect 11" exactly; names match `TOOL_NAMES` in `packages/mcp/src/tools.ts`. `render_preview` payload is JSON `{"png": "<base64>"}` inside the tool's text content block; decoded bytes start with the PNG signature. Error path returns `isError: true` with a specific, useful message.
- Evidence: script at `/private/tmp/claude-502/-Users-khavu-Project/461a359e-10b1-4a91-bf38-731b398e953f/scratchpad/mcp-check.mjs` (temp-copied into repo root as `.qc-mcp-check.mjs` to resolve the `@modelcontextprotocol/sdk` + `@glam/mcp` workspace deps, executed, then deleted — no residue in repo); raw stdout captured above. Subprocess was spawned and torn down entirely within the script's own `client.close()` (transport terminates the child); no orphaned MCP process left running (not present in a follow-up `ps aux | grep glam`).

## 4. Skill examples (`skills/cast-glamour/examples/*.glam`) — PASS

- Tested: for each of the 3 example files, `glam validate <f>` then `glam render <f> -o /tmp/<name>.png`, followed by `file <name>.png` to confirm real PNG + dimensions match each doc's declared canvas.
- Expected: all validate ok / exit 0, all render to real PNGs.
- Actual:
  | file | validate | render | PNG check |
  |---|---|---|---|
  | click-toggle.glam | ok, exit 0 | exit 0 | `300 x 200, 8-bit/color RGBA` (`file` cmd), 2600 bytes, correct magic |
  | hover-grow-button.glam | ok, exit 0 | exit 0 | `300 x 200, 8-bit/color RGBA`, 2223 bytes, correct magic |
  | progress-bar.glam | ok, exit 0 | exit 0 | `300 x 120, 8-bit/color RGBA`, 295 bytes, correct magic + valid IEND trailer (`ae426082`) |
- Note: `progress-bar.png` is small (295 bytes) but is a legitimate, complete PNG (verified `file` reports valid dimensions/color type and the byte stream ends with the standard IEND chunk `0000000049454e44ae426082`) — flat-color rects on a dark bg compress very well; not a truncation.
- Evidence: raw `node ... validate/render` output + `file` output captured above; rendered PNGs at `/tmp/click-toggle.png`, `/tmp/hover-grow-button.png`, `/tmp/progress-bar.png`.

## Process/cleanup hygiene

- `glam preview` HTTP server (port 49799, started by this QC run): killed, confirmed dead via `ps`.
- MCP stdio subprocess(es): spawned and closed entirely within their own script run (`client.close()`); confirmed no `glam-mcp`/`packages/mcp/dist/index.js` process left in `ps aux`.
- A pre-existing `vite preview --port 5199` process (PID 36087, started 03:27:53, i.e. inside this session's window but **not started by this QC run** — this QC never invoked `vite preview`) was found running and was left untouched per the hard rule against stopping services not started by this check. Flagging for the requesting agent's awareness in case it needs cleanup — out of scope for this runtime-qc pass (Studio is the UI surface, excluded from this brief).
- No scratch files left in the repo tree (`.qc-core-check.mjs`, `.qc-mcp-check.mjs` created transiently and deleted immediately after use — required only because Node's ESM resolver needs cwd inside the workspace to resolve `@glam/core` / `@glam/mcp` symlinks). All other artifacts (scripts, HTML body dump) live under the session scratchpad, not the repo.
