# oscar-onboarding-mcp

First-launch onboarding interview server for [Oscar GC](https://github.com/sarturko-maker/goose). Exposes a single MCP tool — `finalize_profile` — that writes the user's profile JSON to `~/.config/oscar/profile.json` atomically.

This server is the persistence backend for Sprint 6's agent-driven onboarding conversation. The desktop UI runs a recipe-scoped agent whose extension whitelist is exactly this server, locking the agent's tool surface to "write the profile and nothing else."

## Status

Sprint 6 minimum viable. Single tool, JSON persistence, no read-back via MCP (the desktop reads the file via Electron IPC, not through this server). See `docs/adr/` for the decisions and the foreseeable migration triggers.

## Tools

| Tool | Input | Behaviour |
|---|---|---|
| `finalize_profile` | `{ schema_version, completed_at, user, corporate, practice_areas, provider }` (see `src/schema.ts`) | Validate against the Zod schema, atomically write to `~/.config/oscar/profile.json`, return `{ ok: true, schema_version, practice_area_count, completed_at }`. Calling again overwrites the prior file. |

After Goose namespaces the extension, the LLM sees the tool as `oscar-onboarding__finalize_profile`.

## Persistence

Flat JSON file with atomic write (write-to-temp → fsync → rename). Default path: `~/.config/oscar/profile.json`. Override with `OSCAR_PROFILE_PATH=`. See [ADR-001](docs/adr/001-persistence-json.md).

## Bootstrap

```bash
git clone git@github.com:sarturko-maker/oscar-onboarding-mcp.git /srv/projects/oscar-onboarding-mcp
cd /srv/projects/oscar-onboarding-mcp
pnpm install
pnpm build
pnpm smoke
```

After build, `dist/index.js` is the entry point. It speaks MCP over stdin/stdout.

## Register with Goose

Add to `~/.config/goose/config.yaml` (sibling stanza to `oscar-memory`):

```yaml
extensions:
  oscar-onboarding:
    enabled: true
    type: stdio
    name: oscar-onboarding
    description: 'First-launch onboarding profile writer. One tool: finalize_profile.'
    cmd: node
    args:
      - /srv/projects/oscar-onboarding-mcp/dist/index.js
    timeout: 30
```

`enabled: true` is the gatekeeper — Goose silently skips the extension if it's missing or false. The `description` value contains no embedded `:`, so it does not need single-quoting (unlike Sprint 5's `oscar-memory` stanza which did).

In the desktop UI, the onboarding **recipe** whitelists exactly this extension and nothing else, so the onboarding agent's tool surface is locked even though the extension stays enabled globally.

## Cross-references

- [Oscar GC fork (`sarturko-maker/goose`)](https://github.com/sarturko-maker/goose) — the custom distribution this server feeds. See its `SPRINT_LOG.md` for Sprint 6.
- [Sibling repo `oscar-memory-mcp`](https://github.com/sarturko-maker/oscar-memory-mcp) — the notes store; same skeleton, different domain.
- [`docs/adr/`](docs/adr/) — three decisions of record: persistence, tool-argument classification, licence.
