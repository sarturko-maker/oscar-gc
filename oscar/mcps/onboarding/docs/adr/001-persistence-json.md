# ADR-001 — Persistence: flat JSON file with atomic write

Status: accepted
Date: 2026-05-18
Sprint: 6 (`sarturko-maker/goose` SPRINT_LOG)

## Context

The server's single job is to receive the user's onboarding profile from the LLM, validate it, and write it once. The desktop UI reads the file separately via Electron IPC — not through this server. There is exactly one writer (this MCP server, invoked by Goose); exactly one consumer (the desktop UI, reading the file directly).

Two candidates considered:
- **Flat JSON file** with atomic write (write-to-temp → fsync → rename), same pattern as `oscar-memory-mcp`.
- **SQLite via `better-sqlite3`** (synchronous, embedded).

## Decision

Flat JSON file at `~/.config/oscar/profile.json`. Atomic write pattern: validate via Zod → serialize → write to `${target}.tmp` → `fsync` the temp file descriptor → `rename(tmp, target)`. Path is overridable via `OSCAR_PROFILE_PATH=` for tests.

Shape: see `src/schema.ts`. Top-level fields are `schema_version`, `completed_at`, `user`, `corporate`, `practice_areas`, `provider`. Reserved-for-future fields (`tenant_id`, `admin_pushed`, `entry_route`) are intentionally absent in v1 — Zod's default behaviour silently drops unknown keys on parse, so a future agent emitting them won't crash older readers.

## Rationale

- The profile is small (under 4 KB even with two-dozen practice areas) and updated rarely — usually once per device install, occasionally once per re-onboarding. Full-file rewrite has zero practical cost.
- Hand-editable. Until the in-app settings page lands (later sprint), the lawyer's only escape valve for "I picked the wrong size band" is editing the JSON directly. Plain JSON wins over SQLite for that.
- Identical pattern to `oscar-memory-mcp`'s `notes.json` — same atomic-write helper shape, same review surface, same operational instincts.
- No native build step. Same portability win as the sibling repo.

## Consequences

- **Migration trigger to SQLite or equivalent**: when any of the following lands, this ADR is superseded by a new persistence ADR:
  - Multi-user / multi-tenant profiles in a single store.
  - Profile history / audit trail (we'd want indexable writes).
  - Admin push of profiles requiring conflict resolution between local edits and pushed config.
- Until then, the file is single-writer and small.
- XDG-config convention: `~/.config/oscar/` (small hand-editable user config) is distinct from `~/.local/share/oscar-memory/` (notes data). Profile is config, not data.

## Supersedes

None — first ADR in this repo.
