# ADR-090: Destructive ops via renderer confirm, not LLM stream

Sprint 20-M8 (2026-05-22). Status: Accepted.

## Context

Mode D (ADR-088) mutates `area_overrides` in-place via
`oscar-fs__write_file`; ADR-089's post-write watcher reverts malformed
JSON. M8 closes the loop with delete. Delete is materially different:
a misfiring LLM with the same write tool could wipe a year of matters
on a confirm-step misread. The brief's load-bearing rule is that
destructive ops must traverse a renderer-side click in a real modal —
something an LLM cannot synthesise into its own write stream.

## Decision

Mode E uses a one-way handoff. Forge writes
`~/.config/oscar/_forge_request_delete_<areaId>.json` via
`oscar-fs__write_file`. A main-process `fs.watch` on `~/.config/oscar/`
(mirrors `profileWriteWatcher`) debounces 100ms, JSON-parses, Zod-
validates against `ForgeDeleteRequestSchema` (areaId, ISO timestamp,
impact), drops anything older than 5s (stale-marker mitigation across
restart), and `webContents.send`s `oscar:forge:delete-prepare` to all
BrowserWindows. A renderer modal subscribes via the existing
`window.electron.on` bridge and renders the impact with Cancel /
Archive buttons. Only the Archive click invokes
`oscar:forge:confirm-delete-area` (archive + profile edit + marker
unlink); Cancel invokes `oscar:forge:cancel-delete-area` (marker
unlink only). The watcher is read-only — IPC handlers own deletion.
Forge's Mode E procedure reads the marker on its next turn to
disambiguate confirmed / cancelled / pending.

## Alternatives rejected

- goosed → main → renderer IPC through session bus: new infra; fails
  if renderer unfocused; loses marker-on-disk auditability.
- Hybrid (marker + IPC nudge): over-engineered for single-window.
- LLM-driven delete via the same write tool as Mode D: violates the
  brief's renderer-confirm rule.

## Caveats

Lossy if the renderer dies between marker write and modal fire —
acceptable because Forge IS the renderer surface. Stale markers from
crashes are filtered by the 5s timestamp rule.

Cites: ADR-039, ADR-088, ADR-089.
