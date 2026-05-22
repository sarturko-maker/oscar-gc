# ADR-091: Archive don't delete

Sprint 20-M8 (2026-05-22). Status: Accepted.

## Context

ADR-090 establishes the marker → modal → IPC handoff for Forge Mode E.
What the confirm step does on disk is a separate decision. The brief's
spirit principle is "Reversible at the disk layer" — archive ≠ delete.
ADR-038 covers matter-level archive (`fs.rename` to
`<areaId>/matters/_archived/<slug>/`); M8 needs area-level. Lawyer's
matter content in `~/Documents/Oscar GC/` sits on a different volume
by ADR-047.

## Decision

On confirm: copy `~/.config/oscar/state/<areaId>/` to
`~/.config/oscar/state/_archive/<areaId>-<isoTimestamp>/` via Node's
built-in `fs.cp({ recursive: true })` (no new deps). Then `fs.rm` the
source. Then remove the `practice_areas[i]` entry from profile.json
via the existing atomic temp+rename `writeProfileFile` helper (the M7
post-write watcher refreshes `.bak` against the new shape).

`~/Documents/Oscar GC/<Area>/` is **untouched**. Lawyer's content; the
modal tells them. Restore-from-archive (post-master-brief) repoints
state back to the existing Documents tree if the area is restored.

Layout `state/_archive/<areaId>-<isoTimestamp>/`: one folder per
delete; `ls state/_archive/ | grep <areaId>` for lookup; ISO suffix
for chronological sort.

## Alternatives rejected

- `state/_archive/<isoDate>/<areaId>/` — needs a date guess to find by
  area.
- `state/_archive/<areaId>/<isoDate>/` — better for cycle delete-
  recreate-redelete; no concrete user need yet.
- Archive `~/Documents/Oscar GC/<Area>/` too — heavy; user content;
  restore can repoint without copying.
- Hard delete — irreversible; violates brief spirit.

## Caveats

Sessions in archived matters orphan in `ChatHistoryTree` (area gone
from profile.json; session files remain in goosed). If `fs.rm` of the
source fails after a successful `fs.cp`, log a warning — data is in
two places, not zero.

Cites: ADR-038, ADR-047, ADR-090.
