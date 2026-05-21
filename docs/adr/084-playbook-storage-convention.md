# ADR-084: Playbook storage convention

Status: accepted (2026-05-21).
Context: Sprint 20-M4 — Playbooks subsystem. Companion to ADR-085. Builds
on ADR-040 (oscar-fs), ADR-067 (`area_overrides`), ADR-070 (panel
registry), ADR-083 (pane reads agent state).

## Context

M4 adds a Playbooks pane section. Lawyers drag-drop reference files; the
agent reads them at conversation time (ADR-085 Layer 2) and/or has their
text injected into recipe instructions (Layer 1). This ADR settles where
playbook files live and how scope is encoded.

## Decision

Filesystem-only at `~/.config/oscar/playbooks/<scope>/<filename>`:
`<scope>` = `_global` (cross-area) or `<areaId>` (per-area; dirname equals
`OscarUserProfilePracticeArea.id`). The pane composes its list as
`[…global rows, …current-area rows]`, alphabetical within each.
`area_overrides[areaId].playbooks.always_on` stores **scoped relative
paths** like `["_global/foo.md", "commercial/bar.docx"]` — portable across
machines, no discriminator needed. The pane lists from disk via
`fs.readdir`; no shadow registry. A lawyer dropping a file via Finder
appears in the pane on the next 2 s poll.

## Rationale

- Mirrors `~/.agents/skills/<slug>/SKILL.md` (Sprint 11) — filesystem-as-
  source-of-truth, Finder/Drive-sync-compatible.
- Underscore prefix on `_global` avoids any future area-id named "global".
- oscar-fs allowed-dir widening is one line: the playbooks root in
  `buildPracticeAreaRecipe`'s args covers `_global` + every per-area
  subdir (prefix-based check).
- Per-matter scope tier rejected for M4 (AskUserQuestion option B picked:
  global + per-area). Deferred if M8 dogfood demands.

## Consequences

- 5-IPC main-process surface at `oscar:playbooks:*` (list, upload,
  toggle-always-on, delete, render-block); preload bridge as
  `window.electron.playbooks`.
- oscar-fs allowed-directories widens to include the playbooks root in
  every practice-area recipe. Forge's recipe does not get this widening.
- The toggle handler writes `profile.json` from main process via atomic
  temp+rename — same pattern Forge Mode B established (ADR-039).
