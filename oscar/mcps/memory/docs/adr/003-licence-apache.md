# ADR-003 — Licence: Apache 2.0

Status: accepted
Date: 2026-05-18
Sprint: 5 (`sarturko-maker/goose` SPRINT_LOG)

## Context

CLAUDE.md in the Goose fork constrains additions to Apache 2.0 or MIT (no AGPL, no GPL) so the custom distribution stays redistributable. Goose itself is Apache 2.0. The memory MCP server is a sibling, conceptually adjacent to a Goose sibling crate (Rust-side equivalents would live under `crates/`).

## Decision

Apache 2.0. Full text in `LICENSE`.

## Rationale

- Matches upstream Goose. Eases any future scenario where this server upstreams into Goose's MCP server set, or vendors alongside Goose crates in a single redistributable bundle.
- Includes an explicit patent grant. Marginal value for a small infrastructure project today, real value if the server ever ships to external operators.
- Sprint 1–4 ADRs in the Goose fork (`docs/adr/001`–`006`) make no licence choice for sibling projects; this ADR sets the precedent for any future Oscar GC-adjacent repos.

## Consequences

- Source files do not need per-file copyright headers (Apache 2.0 recommends but does not require them). The repo carries the LICENSE file at root; that is sufficient.
- Future contributors retain copyright on their contributions; the Apache 2.0 contribution clause covers inbound licensing.

## Supersedes

None.
