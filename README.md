# oscar-memory-mcp

In-house notes store exposed as a stdio-transport MCP server. Sibling of the [Oscar GC](https://github.com/sarturko-maker/goose) custom distribution of Goose.

This server owns the memory schema and policy that Oscar GC's agent reads from and writes to. Goose's built-in tag-based memory is **not** used for product memory.

## Status

Sprint 5 minimum viable. Single flat scope, JSON persistence, no semantic search, no per-user / team policy, no auth. See `docs/adr/` for the decisions and the foreseeable migration triggers.

## Tools

| Tool | Input | Behaviour |
|---|---|---|
| `store_note` | `{ scope_id: string, body: string }` | Append a note tagged with `scope_id`. Returns `{ ok: true, scope_id, created_at }`. |
| `list_notes` | `{ scope_id: string }` | Returns all notes for `scope_id`, sorted by `created_at` ascending. |

After Goose namespaces the extension, the LLM sees the tools as `oscar_memory__store_note` and `oscar_memory__list_notes`.

## Persistence

Flat JSON file with atomic write (write-to-temp → fsync → rename). Default path: `~/.local/share/oscar-memory/notes.json`. See [ADR-001](docs/adr/001-persistence-json.md).

## Bootstrap

```bash
git clone git@github.com:sarturko-maker/oscar-memory-mcp.git /srv/projects/oscar-memory-mcp
cd /srv/projects/oscar-memory-mcp
pnpm install
pnpm build
```

After build, `dist/index.js` is the entry point. It speaks MCP over stdin/stdout.

## Standalone smoke test

```bash
pnpm inspect
```

Spawns the official [MCP Inspector](https://www.npmjs.com/package/@modelcontextprotocol/inspector) (pinned to v0.21.2 in `package.json`). Use the UI to call both tools and confirm round-trip.

## Register with Goose

Add to `~/.config/goose/config.yaml`:

```yaml
extensions:
  oscar-memory:
    enabled: true
    type: stdio
    name: oscar-memory
    description: "In-house notes store, scoped by scope_id."
    cmd: node
    args:
      - /srv/projects/oscar-memory-mcp/dist/index.js
    timeout: 30
```

`enabled: true` is the gatekeeper — Goose silently skips the extension if it's missing or false. The `cmd: node` resolves via the parent shell's `PATH` (system `/usr/bin/node` on `lq-vps`).

## Cross-references

- [Oscar GC fork (`sarturko-maker/goose`)](https://github.com/sarturko-maker/goose) — the custom distribution this server feeds. See its `SPRINT_LOG.md` for the sprint that introduced this server.
- [`docs/adr/`](docs/adr/) — the three decisions of record: persistence, scope_id classification, licence.
