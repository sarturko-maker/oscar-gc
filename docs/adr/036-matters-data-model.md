# ADR-036 — Matters data model and per-practice-area storage layout

Status: accepted
Date: 2026-05-19
Sprint: 12

## Context

Sprint 12 introduces **Matters** as scoped containers — each matter holds agent sessions, files, and per-matter context. The practice-area landing currently resets chat on click (`PracticeAreaPlaceholder.tsx` for non-Commercial, `OscarCommercialView.tsx` creating a new session every mount for Commercial). Sprint 11 vendored 9 `matter-workspace` stub skills that assumed a path keyed by **plugin slug** (e.g., `~/.config/oscar/state/commercial-legal/matters/<slug>/`). The 9→13 fan-out (9 vendored plugins → 13 Oscar practice areas, with overlap) means plugin-slug keying would have `commercial` and `commercial-disputes` share matters — wrong for confidentiality.

## Decision

Matters are stored per-practice-area, keyed by **practice-area id** (the natural Oscar unit, not the plugin slug):

```
~/.config/oscar/state/<practice-area-id>/
├── matters.json                        # registry (index for UI)
└── matters/
    ├── <matter-slug>/
    │   ├── matter.md                   # frontmatter + intake body
    │   ├── history.md                  # append-only event log
    │   ├── notes.md                    # lawyer's free-form notes
    │   └── outputs/                    # matter-scoped redlines, NDA reviews, etc.
    └── _archived/<matter-slug>/        # closed matters; never deleted
```

`matters.json` is a Zod-validated registry: array of `MatterEntry { slug, name, client, counterparty, matter_type, opened_at, last_accessed_at, status: 'active'|'closed', privileged: boolean, session_id: string|null, schema_version: 1 }`. `matter.md` mirrors the registry in frontmatter plus key-facts and matter-specific overrides in the body. The registry is the index-for-UI; filesystem is the record-of-truth.

## Rationale

- **Practice-area-id keying matches the user's mental model.** Lawyers navigate by practice area, not by upstream plugin; matters belong to the area they were created in.
- **No cross-area matter leakage.** `commercial` and `commercial-disputes` are distinct practice areas with distinct matter folders. Confidentiality holds by storage shape.
- **Registry separate from records** so the UI doesn't scan every `matter.md` to render the matters list — a single read of `matters.json` suffices.
- **`_archived/` not deleted** preserves retention discipline for legal context; Sprint 13+ audit log can refer to archived matters.
- Path supersedes Sprint 11 stubs' plugin-slug convention — see ADR-037.

## Consequences

- The bundled skills' references to `~/.config/oscar/state/<plugin-slug>/matters/<slug>/` paths need rewriting — see ADR-037.
- IPC schema (`electronAPI.matters.{list, create, archive, get}`) validates `MatterEntry` at the boundary per CLAUDE.md "trust internal, validate at boundaries".
- The matter folder is the session's `working_dir` — see ADR-038. The filesystem MCP's `allowed_directories` narrows to it — see ADR-041.

## Supersedes

None. First ADR on Matters.
