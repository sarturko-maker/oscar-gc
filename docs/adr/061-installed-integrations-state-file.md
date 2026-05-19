# ADR-061 — `installed_integrations.json` per-area state file

Status: accepted
Date: 2026-05-19
Sprint: 17

## Context

Sprint 17 adds a renderer-driven write path: the lawyer clicks "Add" on an Integrations card, and the choice must persist so the next session-spawn in that practice area loads the new MCP into the agent's recipe (ADR-041). The state needs a home.

Two locations considered:

- **`practice_areas[].installed_integrations[]` in `~/.config/oscar/profile.json`** — the existing per-area metadata block (ADR-051 schema v3). Already carries `area_profile` per area (ADR-032). Adding a field is structurally available.
- **A sibling state file** alongside the existing matters state (`~/.config/oscar/state/<area-id>/matters.json`).

The decisive constraint: **`profile.json` is single-writer today**. Only the onboarding MCP's `finalize_profile` tool writes it (via `oscar-onboarding-mcp::ProfileStore.writeAtomic`). The Electron main process only reads (`oscar:read-profile` at `main.ts:1745`). Adding renderer-driven writes to `profile.json` would introduce a second writer — concurrent read-modify-write with the onboarding MCP — and require either (a) re-routing writes through the MCP via Goose's session, or (b) accepting last-writer-wins drift between two processes mutating the same file.

The matters state file is already Electron-write-only via the `oscar:matters:*` IPC family (`main.ts:1960-2168`). Adding `installed_integrations.json` to the same dir mirrors a proven shape.

## Decision

Per-area installed integrations live at `~/.config/oscar/state/<area-id>/installed_integrations.json`. Schema v1:

```json
{
  "schema_version": 1,
  "installed_integrations": [
    {
      "id": "Ironclad",
      "added_at": "2026-05-22T10:34:11.000Z",
      "trust_acknowledged": true
    }
  ]
}
```

**Writer**: Electron main process via new IPC `oscar:integrations:install(areaId, entryId, trustAcknowledged)`. Read-modify-write atomically (same `O_WRONLY | O_CREAT | O_TRUNC, 0o600` + `rename` pattern as `matters.json`). Reuses existing `safeAreaId` validator and `areaStateDir` helper.

**Reader**: Renderer reads via `oscar:integrations:list(areaId)` IPC at session-spawn time (`MattersLanding.openMatter`) plus at UI mount (`IntegrationsPerArea`, `IntegrationsView`).

**Schema validation**: Zod schemas (`InstalledIntegrationEntrySchema`, `InstalledIntegrationsFileSchema`) live in `main.ts` near the matters schemas. `installed_integrations.default([])` handles the ENOENT case.

**Idempotency**: install is a noop if the entry's `id` already exists in the area's list. UI prevents double-Add via the `Installed` state (ADR-060); the disk-side idempotency is the safety net.

**Profile.json untouched**: `OscarUserProfile` (schema v3, ADR-051) gains no fields. Onboarding MCP doesn't know about installed integrations.

## Rationale

- **Preserves the single-writer invariant for `profile.json`.** Onboarding-mcp's `ProfileStore.writeAtomic` stays the sole writer. No concurrency to reason about; no two-process atomicity hazard.
- **Mirrors a working pattern.** `matters.json` is the established shape for per-area Electron-managed state. Code reuses helpers (`safeAreaId`, `areaStateDir`, atomic-rename). One mental model.
- **Per-area locality.** State lives in the same directory as the area's matters and conversation history — easy to inspect, easy to back up, easy to delete on uninstall (ADR-042 cleanup follow-up).
- **Schema isolation.** `installed_integrations.json` carries its own `schema_version`; future evolutions don't entangle with profile-schema migrations (ADR-051 v2→v3 stub pattern stays clean).
- **No backwards-compatibility shim.** First-read of a non-existent file returns the Zod default `installed_integrations: []`. No migration; no on-disk artefact until the first install.

## Consequences

- New IPC channels: `oscar:integrations:list(areaId)`, `oscar:integrations:install(areaId, entryId, trustAcknowledged)`, `oscar:integrations:list-available()`. Preload bridges in `preload.ts`.
- `MattersLanding.openMatter` gains a read call alongside the existing profile read; the install list threads into `buildPracticeAreaRecipe`'s `extraExtensions` (and `buildCommercialRecipe`'s new `installedConfigs` param).
- Removal / unmute / edit flows are out of scope for Sprint 17 — schema supports them (`installed_integrations` is an array of entries), but no IPC writes the remove path. Sprint 18+ adds `oscar:integrations:uninstall`.
- Backup / restore stories: anyone wanting to migrate installed integrations across machines copies `~/.config/oscar/state/<area-id>/installed_integrations.json` alongside matters. No new tooling needed.
- Idempotency cap: the schema doesn't enforce unique `id`s — duplicates are technically representable on disk if a user hand-edits the file. The IPC handler enforces "noop on duplicate id" on install; reading still emits the full list (the recipe builder dedupes by `id` at session-spawn as defence-in-depth).

## Supersedes

None. New per-area state file. Sibling to `matters.json` (Sprint 12 ADR-036) under the same `~/.config/oscar/state/<area-id>/` root.
