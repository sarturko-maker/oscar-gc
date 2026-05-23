# ADR-003 — Licence: Apache 2.0

Status: accepted
Date: 2026-05-18
Sprint: 6 (`sarturko-maker/goose` SPRINT_LOG)

## Context

CLAUDE.md in the Goose fork constrains additions to Apache 2.0 or MIT (no AGPL, no GPL) so the custom distribution stays redistributable. Goose itself is Apache 2.0. `oscar-memory-mcp` (Sprint 5 sibling) is Apache 2.0 per its own ADR-003.

## Decision

Apache 2.0. Full text in `LICENSE`. Matches the Sprint 5 sibling precedent and upstream Goose.

## Rationale

- Consistency with `oscar-memory-mcp` and upstream Goose. A user inspecting Oscar GC's sibling repos finds the same licence everywhere.
- Patent grant is marginal value today, real value if the server ever ships to external operators.

## Consequences

- Source files do not carry per-file copyright headers (Apache 2.0 recommends but does not require them). The repo carries the LICENSE file at root.
- Future contributors retain copyright on their contributions; Apache 2.0's contribution clause covers inbound licensing.

## Supersedes

None.
