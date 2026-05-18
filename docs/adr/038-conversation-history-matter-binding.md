# ADR-038 — Conversation-history-to-matter binding

Status: accepted
Date: 2026-05-19
Sprint: 12

## Context

Sprint 10 dogfood surfaced "where does conversation history go?" — opening a practice area in Oscar GC creates a new session every mount (`OscarCommercialView.tsx`), discarding history. Goose stores sessions in SQLite at `~/.config/Block/goose/data/sessions/sessions.db` (`crates/goose/src/session/session_manager.rs:56-80`); each session carries `id`, `working_dir`, `recipe`, `extension_data`. The desktop's resume flow is `ui/desktop/src/sessions.ts:19-35` (`resumeSession()` dispatches `ADD_ACTIVE_SESSION` + navigates to `/pair?resumeSessionId=...`).

Goose has a "Projects" concept (`~/.local/share/goose/projects.json`; CLI-only; Desktop "planned for future releases" per goose-docs.ai). Validates the direction but doesn't model in-house-legal metadata (client, counterparty, privileged) — we don't integrate at the projects.json layer.

## Decision

**One matter ↔ at most one Goose session.** The binding is recorded in `matters.json[slug].session_id`:

- **New matter, first chat**: `MattersLanding.tsx`'s "open matter" handler calls `createSession()` with `working_dir = <matter folder>`. The returned `session.id` is written back to `matters.json[slug].session_id` via IPC.
- **Existing matter**: handler calls `resumeSession(matters.json[slug].session_id)` using the existing dispatch.
- **No retroactive migration of pre-Sprint-12 sessions.** Existing orphan sessions (Sprint 10–11 dogfood) remain accessible through Goose's built-in Sessions panel; they are not bound to matters. Sprint 12 dogfood begins with an empty matters layer.

The session's `working_dir` IS the matter folder. This means (a) MCP Roots advertisement points at the matter folder, (b) the filesystem MCP's `allowed_directories` arg narrows to the same folder (ADR-041), (c) Top of Mind matter context (ADR-044) is in scope.

## Rationale

- **`session_id` in `matters.json` is the binding surface** because Goose's session SQLite is the authoritative store; the registry is the index, not a parallel record. One indirection, easy to validate.
- **No retroactive migration** because pre-Sprint-12 sessions were never bound to matters — synthesising a binding would be guessing. Lawyers who dogfooded Sprint 10–11 can find their sessions via the Sessions panel; new work happens in matters.
- **No Projects-integration** because Goose Desktop doesn't surface Projects yet, and our matters carry metadata Projects doesn't model. If upstream ships Desktop Projects later, an Oscar matter may map cleanly onto an extended Project — ADR at that time.
- **`working_dir = matter folder`** lets every downstream primitive (MCP Roots, filesystem-MCP allowed-dirs, output paths) inherit the scope without extra wiring.

## Consequences

- A matter without a session yet (just created, no first chat) has `session_id: null` — UI renders the row but the first click triggers `createSession()` rather than resume.
- If a session is deleted from Goose's panel (out-of-band), `matters.json[slug].session_id` becomes a dangling reference. Phase 3 verification handles this gracefully: if `resumeSession()` returns 404, fall through to `createSession()` and update the registry.
- The matter folder must exist before `createSession()` (matter creation writes the directory tree first).

## Supersedes

None.
