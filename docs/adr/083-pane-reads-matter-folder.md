# ADR-083: Right pane reads matter folder + session log directly

Status: accepted (2026-05-21).
Context: Sprint 20-M3 — Matter Facts + History real bodies. Builds on
ADR-044 (tom-active-matter file), ADR-047 (matter.md), ADR-069 (right-pane
primitive), ADR-070 (section registry).

## Context

M3 fills MatterFacts / ProgrammeFacts and History with real bodies. Matter
state lives at `~/Documents/Oscar GC/<Area>/<Matter>/matter.md` and at
`~/.config/oscar/tom-active-matter.md`. Session events live in goose-server's
SQLite session DB, served by the existing `GET /sessions/{session_id}` route
which already returns the full `Conversation`.

## Decision

The right pane is a *view* of agent state, not a parallel source of truth.

- MatterFacts reads `matter.md` + the Top of Mind file via a thin Electron IPC
  (`oscar:right-pane:read-matter-facts`) over existing main-process helpers
  (`renderMatterMd` ↔ new `parseMatterMd`, colocated in `matterMdSerde.ts`).
- History calls the existing `getSession` API client from the renderer; no new
  Rust route. Reduces `conversation` → `{ ts, role, summary }[]` in-renderer,
  capped at ~10 events, with consecutive same-tool-name turns collapsed.
- Reads are polled (2 s) via `usePanelReader`, not watched; polling halts on
  unmount.

## Rationale

One round-trip per section per tick, no watcher fan-out. External edits
(Finder / Drive sync) reflect on the next poll. No goose-server change
preserves fork hygiene.

## Alternatives rejected

- **File watchers** — fan out under multi-matter use.
- **Separate per-pane state file** — split-brain vs the agent's view.
- **New Rust readonly session route** — `getSession` already returns full
  conversation; redundant.
- **Reading SQLite directly from main** — needs a driver in the bundle.
- **Reusing `oscar:matters:get`** — returns full `MatterEntry` + raw markdown;
  the M3 IPC returns parsed, label-ready facts.

## Consequences

`matterMdSerde.ts` is the single round-trip module for matter.md. Poll
interval (2 s) is the explicit perf budget. History tolerates unknown
`MessageContent` types so upstream schema additions don't break the pane.
