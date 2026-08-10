# @glamour-labs/mcp

MCP server exposing [Glamour](https://github.com/glamour-labs/glamour-2d)'s core operations as
tools, so any MCP client can author `.glam` documents.

**Requires Node 20+.** Tested on 20 and 22.

```bash
npm install -g @glamour-labs/mcp
```

Register it with your MCP client as the command `glam-mcp`. For Claude Code:

```bash
claude mcp add glamour -- glam-mcp
```

Tools cover the authoring loop — create a starter document, apply palette operations, validate, and
render. Render needs a browser; `playwright` is an optional peer
(`npm install -g playwright && npx playwright install chromium`).

Full docs: **[glamour-labs/glamour-2d](https://github.com/glamour-labs/glamour-2d)** · MIT
