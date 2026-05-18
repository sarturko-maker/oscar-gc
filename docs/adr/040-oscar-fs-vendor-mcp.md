# ADR-040 — Filesystem MCP: vendor `@modelcontextprotocol/server-filesystem`

Status: accepted
Date: 2026-05-19
Sprint: 12

## Context

Sprint 12 Workstream 3 (access model) requires every practice-area agent to operate under a **scoped filesystem MCP** whose `allowed_directories` is limited to the practice area's folder (or, when a matter is open, the matter folder per ADR-041). Goose upstream does not bundle a filesystem MCP — bundled MCPs in Oscar GC today are `oscar-onboarding` and `oscar-memory` only (`ui/desktop/scripts/prepare-oscar-bundle.js`).

Two implementation paths considered:

1. **Vendor `@modelcontextprotocol/server-filesystem`** — npm-published; accepts allowed-directories as CLI args; exposes `read_file`, `write_file`, `list_directory`, `create_directory`, `move_file`, `search_files`, `get_file_info`. Apache 2.0 / MIT licensed (fits our license policy per CLAUDE.md "no AGPL, no GPL").
2. **Build a sibling `oscar-filesystem-mcp` repo** — full control; matches our `oscar-memory` / `oscar-onboarding` development pattern.

## Decision

Option (1): vendor `@modelcontextprotocol/server-filesystem` at a pinned version (Phase 2 captures the exact version).

- Bundle via `ui/desktop/scripts/prepare-oscar-bundle.js` — esbuild single-file output to `resources/mcps/oscar-fs/server.js`. Pattern mirrors Sprint 10's MCP bundling (ADR-023).
- Register at capability name `oscar-fs` per ADR-017 discipline. The agent sees `oscar-fs__read_file`, `oscar-fs__write_file`, etc. The string "@modelcontextprotocol/server-filesystem" appears only in `package.json` and ADRs; the agent never sees it.
- Allowed-directories set per recipe via the standard `args:` (the package's documented config surface). Practice-area recipe: `args: [<matter folder>]` when matter open; `args: [<practice-area folder>]` when no matter. Forge: `args: [~/.agents/skills/, ~/.config/oscar/]` (ADR-039).

## Rationale

- **Reuse over rebuild** (CLAUDE.md doctrine). Anthropic's package is battle-tested, audited, and already exposes the surface we need.
- **License-compatible.** Apache 2.0 / MIT keeps the distribution redistributable.
- **No new sibling repo** to maintain. The MCP server bundle pipeline is already paved (Sprint 10 ADR-023); this is one more bundle.
- **Capability-name discipline (ADR-017)** keeps the tool namespace stable even if we swap implementations later — e.g., if upstream Anthropic adds new tools we want to suppress, a router-MCP at capability name `oscar-fs` becomes the natural seam, not a code rewrite.
- **No outbound network surface area.** Filesystem-only by definition — satisfies ADR-042's audited-convention floor.

## Consequences

- New devDependency in `ui/desktop/package.json` (pinned exact version per CLAUDE.md TypeScript discipline).
- `prepare-oscar-bundle.js` adds an esbuild step for the package, copying the bundle to `resources/mcps/oscar-fs/server.js`. `forge.config.ts` `extraResource` includes it.
- `main.ts`'s resource resolution adds a path-resolver for `oscar-fs/server.js` analogous to the existing onboarding/memory resolvers.
- The recipe-level `available_tools` whitelist (ADR-017) narrows the agent's surface where helpful (Forge uses 4 of 7 tools — see ADR-039). For practice-area agents, the full surface is exposed because read/write/list/create/move/search are all legitimate operations within a matter folder.
- An ADR-time future inversion is possible: if `@modelcontextprotocol/server-filesystem` adds telemetry or other defaults conflicting with Oscar GC's lockdown posture, we route via a thin sibling MCP at the same capability name. Not in scope today.

## Supersedes

None. First filesystem-MCP ADR.
