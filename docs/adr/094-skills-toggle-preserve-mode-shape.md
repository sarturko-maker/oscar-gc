# ADR-094: Skills toggle preserves the existing mode shape on write

Sprint 29 M1 (2026-05-25). Status: Accepted. Extends ADR-093.

## Context

Sprint 28's ADR-093 decided that every Skills toggle write normalises to
the deny-shape `{ mode: 'deny', slugs: [...disabled] }`. The Sprint 28
visual harness only covered the `mode: 'all' → first toggle` path; the
`'allow'` migration was untested. Crostini dogfood (2026-05-25) surfaced
the consequence: clicking one Off skill On flipped every other Off
skill to On.

Root cause at `main.ts:3144-3151`: the handler treats `current.slugs` as
"currently disabled" regardless of mode. In `'allow'` mode
`current.slugs` is the **enabled** set, so writing
`{ mode: 'deny', slugs: current.slugs }` says "every other skill is on"
— silently inverting the meaning of every other slug.

## Decision

The toggle handler preserves the existing mode shape on write:

- `mode: 'all'` + enable a slug → no-op (`{ mode: 'all', slugs: [] }`).
- `mode: 'all'` + disable a slug → `{ mode: 'deny', slugs: [slug] }`.
- `mode: 'allow'` → keep `'allow'`, mutate slug list with enabled-set
  semantics (add on enable, remove on disable).
- `mode: 'deny'` → keep `'deny'`, mutate slug list with disabled-set
  semantics (remove on enable, add on disable).

ADR-093's read-path migration in `joinSkills` is untouched — it already
handles all three modes correctly. The only change is to stop coercing
to deny-shape at write time when the source shape is `'allow'`.

## Alternatives rejected

- **Correct migration to deny-shape on every write.** Honours ADR-093's
  "every write is deny" intent but the toggle handler needs the full
  skill universe (bundled inventory + user inventory ∩ slash-commands).
  Duplicates the work `oscar:skills:list` already does and pulls a
  goosed client into the toggle path. ~40 LOC against this fix's ~15.
- **Migrate-on-read in `oscar:skills:list`.** Read mutates profile.json
  — a side-effect that surprises anyone tailing the file or diffing
  state across sessions. Rejected on principle.

## Caveats

- Profiles whose `mode: 'allow'` was written by Forge Mode D survive in
  their original shape. The recipe-render path (ADR-086) and the
  Skills section row computation both honour all three modes, so this
  is invisible to lawyers. Convergence to a single shape, if ever
  wanted, is a future migration not a per-toggle one.
- Sprint 29 M1 visual verification covers the `mode: 'allow'` starting
  state explicitly — the gap that let this bug ship in Sprint 28.

Cites: ADR-086, ADR-093.
