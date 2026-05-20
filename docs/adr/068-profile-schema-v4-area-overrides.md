# ADR-068 — Profile schema v3 → v4: additive `area_overrides`, absent reads as undefined

Status: accepted
Date: 2026-05-20
Sprint: 20 (M0)

## Context

[[ADR-067]] adds `area_overrides` to `profile.json.practice_areas[i]`. The sibling `oscar-onboarding-mcp`'s `ProfileSchema` (V3, per ADR-051) needs to know about the new field. Zod's default object behaviour strips unknown keys on parse, so leaving schema at V3 would silently strip any Forge-written `area_overrides` if the MCP ever round-trips the profile (e.g. via `finalize_profile` re-run). Prior migrations (V1→V2 added `area_profile`; V2→V3 added `company_context`) were all read-time additions, non-destructive.

## Decision

Bump `SCHEMA_VERSION` to 4. New `PracticeAreaSchemaV4` extends `PracticeAreaSchemaV2` with `area_overrides: AreaOverridesSchema.optional()`. New `ProfileSchemaV4` mirrors the V3 shape but with `schema_version: z.literal(4)` and `practice_areas: z.array(PracticeAreaSchemaV4)`. `ProfileSchema` becomes the V4 alias. New `migrateV3ToV4(v3)` returns `{ ...v3, schema_version: 4 }` — practice_areas keep their V2 fields (`area_overrides` stays undefined and parses fine on round-trip). `store.read()` chain extends: V4? → V3 → migrateV3ToV4 → V4; same fall-through for V2/V1.

Renderer-side `OscarUserProfile.schema_version` becomes `1 | 2 | 3 | 4` (already a permissive union — the renderer reads raw JSON and doesn't enforce). `OscarUserProfilePracticeArea` gains the optional `area_overrides` field of type `OscarAreaOverrides`.

## Rationale

- **Non-destructive.** Absent `area_overrides` parses fine (Zod `.optional()`); migration leaves it undefined; recipe builders read `areaOverrides ?? null`. No data loss; no required user action.
- **Bump prevents silent stripping.** Staying at V3 would require Zod `.passthrough()` on every nested object — a pervasive change for one new field, and one that defeats validation elsewhere.
- **Mirrors prior bumps.** Each prior schema bump introduced one new field with a sensible default; this matches the pattern.

## Alternatives rejected

- **Stay at V3 with `.passthrough()`.** Loses defence-in-depth schema validation everywhere for the sake of one new field.
- **Inline `area_overrides` in `practiceAreas.ts` registry.** Would couple lawyer-set state to a code-defined registry; the registry is bundled and not user-writeable.

## Consequences

- Two repos commit together: `goose/ui/desktop/src/components/oscar/hooks/useOscarProfile.ts` and `oscar-onboarding-mcp/src/schema.ts`. Cross-repo discipline per PROJECT.md — both SHAs in SPRINT_LOG.
- Existing V3 profiles read cleanly on next launch (chain migrates and re-writes on next `finalize_profile`; until then, V3 still parses via fall-through).
- Future Forge writes via `oscar-fs__write_file` MUST emit a complete V4-shaped object. Addressed by [[ADR-077]] (M7 area_overrides write validation at IPC boundary).
- No user-facing migration prompt — the chain is transparent at MCP boundary; renderer reads raw JSON either way.

## Supersedes

None. Extends [[ADR-051]] (schema v3 company_context), [[ADR-011]] (initial schema).
