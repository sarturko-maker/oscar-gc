# ADR-044 — Matter-context injection via Top of Mind (`tom` platform extension)

Status: accepted
Date: 2026-05-19
Sprint: 12

## Context

Sprint 12 binds matters to conversation history (ADR-038) and passes matter folder via `$OSCAR_MATTER_DIR` to skill bodies (ADR-037). But the agent also needs to **always know what matter it's in** — parties, counterparty, matter type, key facts, privileged status — without re-reading `matter.md` every turn (wasteful tokens, lossy across context compaction).

Discovered during plan-mode review: Goose ships a platform extension named `tom` (Top Of Mind) at `crates/goose/src/agents/platform_extensions/tom.rs:13`. Its `get_moim()` (`tom.rs:63-86`) reads two env vars **on every turn** with tilde expansion and a 64KB cap:

- `GOOSE_MOIM_MESSAGE_TEXT` — inline text.
- `GOOSE_MOIM_MESSAGE_FILE` — path to a file whose content is loaded fresh per call (`tom.rs:72-78` via `read_bounded`).

This matches goose-docs.ai's "Persistent Instructions" feature description ("inject critical reminders into goose's working memory every turn"). Plan reviewer flagged its absence as a high-priority gap.

## Decision

- **At goosed-spawn time**, `main.ts` sets `GOOSE_MOIM_MESSAGE_FILE=~/.config/oscar/tom-active-matter.md` (stable path; tilde-expanded by `tom.rs:73`).
- **On matter open**, the matters IPC writes a derived "agent reminder" view to that file — slug, name, client, counterparty, matter type, confidentiality level, privileged flag, key facts, matter-specific overrides. Sourced from `matter.md` frontmatter plus a small set of body fields.
- **On matter close / detach / Forge view active / MattersLanding active** (no matter open), the IPC truncates the file to empty. The Rust core re-reads each turn (`tom.rs:74-78` re-opens the file every call), so the file is the load-bearing surface; no goosed restart needed for matter switching.
- **Forge gets its own Top of Mind value**: a short reminder that it is a meta-agent, not bound to any matter, with skill-writing and area-creation scope. Forge's ForgeView writes this on mount; switching away truncates.
- **Complementary to `$OSCAR_MATTER_DIR`** (ADR-037): Top of Mind = facts the agent always knows; env var = the filesystem location for matter outputs/history/notes that skill bodies need to write to. Different jobs.

## Rationale

- **No goosed restart, no recipe change.** `tom` is a built-in platform extension; the env var is read at goosed-spawn and the file is re-read every turn. Sprint 12 wiring is one env var + one IPC write/truncate flow.
- **Closes the failure mode** the plan reviewer named: without Top of Mind, the agent re-reads `matter.md` (or `$OSCAR_MATTER_DIR/matter.md`) every turn, burning tokens and risking loss across compaction. Top of Mind survives compaction by design.
- **File over inline-text** because content needs to change per matter without process restart; only the file mechanism does that.
- **Stable path over per-session paths** because we have one goosed daemon and one active matter at a time (single-window today).

## Consequences

- `main.ts` sets `GOOSE_MOIM_MESSAGE_FILE` before goosed spawn (Phase 2). Empty file means `tom.get_moim()` returns `None` (`tom.rs:81-86`) — no injection.
- IPC handlers for matters write/truncate the file as part of open / close / detach (Phase 3).
- 64KB cap is plenty for matter context (typical content < 5KB).
- **Multi-window deferral**: `tom-active-matter.md` is single-active-state. If Oscar GC ever supports multi-window with different matters per window, the env-var-points-at-stable-file model needs revisiting (per-session-id file paths). Out of scope; tracked in TODO.md.

## Supersedes

None. First ADR on Top of Mind / Persistent Instructions integration.
