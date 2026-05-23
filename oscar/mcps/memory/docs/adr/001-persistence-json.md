# ADR-001 — Persistence: flat JSON file with atomic write

Status: accepted
Date: 2026-05-18
Sprint: 5 (`sarturko-maker/goose` SPRINT_LOG)

## Context

The server stores notes keyed by `scope_id`. Sprint 5 explicitly defers semantic search, multi-writer concurrency, and per-user / team policy. The persistence layer needs to support exactly: append a note, list notes for one `scope_id`, survive a process crash, be inspectable by hand for debugging.

Two candidates considered:
- **Flat JSON file** with atomic write (write-to-temp → fsync → rename).
- **SQLite via `better-sqlite3`** (synchronous, embedded).

## Decision

Flat JSON file at `~/.local/share/oscar-memory/notes.json`. Atomic write pattern: serialize the full file → write to `${target}.tmp` → `fsync` the temp file descriptor → `rename(tmp, target)`. Standard on Linux ext4 / xfs / btrfs.

Shape:

```json
{
  "notes": [
    { "scope_id": "acme-customer-001", "body": "first call with acme, discussed pricing", "created_at": "2026-05-18T12:34:56.789Z" }
  ]
}
```

`created_at` is UTC ISO 8601. `list_notes` returns entries sorted by `created_at` ascending.

## Rationale

- No native build step (no `node-gyp`, no prebuilds). Trivially portable across the dev VPS and any future Linux host. The dev surface stays small.
- The full-file rewrite cost is O(N) per `store_note`. At Sprint 5 scale (single user, expected note volume in the dozens-to-low-hundreds) the cost is invisible.
- A flat file is inspectable with `cat`, `jq`, and `grep` — direct ground-truth verification during development, which the Sprint 5 e2e test relies on.
- CLAUDE.md's "smallest defensible choice" rule favours the simpler dependency tree.

## Consequences

- **Migration trigger to SQLite or equivalent**: when any of the following lands, this ADR is superseded by a new persistence ADR:
  - Semantic search / embedding lookup (needs indexed text + vectors).
  - Multi-writer concurrency (more than one MCP server process writing to the same store).
  - Note volume crossing ~10 000 entries (full-file rewrite cost becomes user-visible).
  - Schema versioning needs (additive migrations across deployed clients).
- Until then, growth and write cost are tracked informally; no instrumentation is added in Sprint 5.

## Supersedes

None — first ADR in this repo.
