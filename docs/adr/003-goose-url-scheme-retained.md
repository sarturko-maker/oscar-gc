# ADR-003 — `goose://` URL scheme retained through Sprint 2

Status: accepted
Date: 2026-05-18
Sprint: 2

## Context

A complete Goose → Oscar GC rebrand would change the deep-link URL scheme from `goose://` to `oscar-gc://`. The scheme is declared in two places:

- `ui/desktop/forge.config.ts` L21: `schemes: ['goose']`
- `ui/desktop/forge.deb.desktop` / `forge.rpm.desktop` L8: `MimeType=x-scheme-handler/goose;`

Changing the declaration is one-line-each. The problem is the **consumer side**: a grep of `ui/desktop/src/` for `goose://` shows 14+ call sites across at least eight files — `sessionLinks.ts`, `App.tsx`, `main.ts`, `ExtensionInstallModal.test.tsx`, `SessionListView.tsx`, `SessionHistoryView.tsx`, `ScheduleModal.tsx`, `ImportRecipeForm.tsx`, `settings/extensions/utils.test.ts` — covering sessions, extensions, recipes, scheduling, and tests. All hardcode the literal `goose://`.

Renaming `schemes: ['goose']` to `['oscar-gc']` without simultaneously rewriting those call sites breaks deep linking at runtime: the OS-registered scheme would no longer match what the app looks for. Rewriting the `src/` call sites is out of Sprint 2 scope per ADR-001 (rebrand stops at the desktop build boundary).

## Decision

Leave `schemes: ['goose']` in `forge.config.ts` and `MimeType=x-scheme-handler/goose;` in both `.desktop` templates. The protocol display name (`GooseProtocol` → `OscarGCProtocol`) is safe to rename because no `src/` code references that string — it is electron-only metadata.

The scheme rename is bundled into the future `src/` rewrite sprint (Sprint 3+), where both the declaration and the consumers can be changed in the same commit.

## Consequences

- Sprint 2 ships a build whose deep-link URLs are still `goose://sessions/…`, `goose://recipe?…`, etc. — the most visible single gap in the rebrand surface.
- Documentation, support material, and any user-facing screenshots produced during Sprint 2 should note this limitation explicitly.
- The src/-rewrite sprint must change both ends atomically: the declaration in `forge.config.ts` + `.desktop` templates AND every `src/` literal. A grep-and-replace across `ui/desktop/src/` for `goose://` will catch the consumers; the declaration sites are listed above.
- If Sprint 3+ chooses a different scheme name (e.g. `osc://` instead of `oscar-gc://`), the change set is the same — declaration + consumer literals, atomic.

## Supersedes

None. Likely **superseded by** the future src/-rewrite ADR.
