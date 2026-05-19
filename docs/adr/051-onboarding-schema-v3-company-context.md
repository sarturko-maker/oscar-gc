# ADR-051 — Onboarding schema v3 (company_context block)

Status: accepted
Date: 2026-05-19
Sprint: 15

## Context

ADR-050 introduces P2.5 — Company context block — capturing industry depth, geography, regulatory baseline (with provenance), recurring matters, stakeholders, risk appetite, and open notes. The Sprint 11 schema v2 carries only `corporate.{name, industry, size_band}` at company level (Sprint 6 v1 fields) + `practice_areas[].area_profile` per-area. The new fields don't have a home.

## Decision

Schema bump v2→v3 in `/srv/projects/oscar-onboarding-mcp/src/schema.ts`. Add a top-level `company_context` block on `Profile`:

```ts
company_context: {
  industry: { sector, sub_sector, business_model },               // 3 × string|null
  geography: { hq_jurisdiction, operating_jurisdictions[], customer_jurisdictions[]|null, employee_jurisdictions[]|null },
  regulatory_baseline: {
    frameworks: { id, label, confidence: "user-confirmed" | "tavily+user-confirmed" | "llm-hypothesis-only" }[],
    captured_via: "hypothesis-confirm" | "user-enumerated" | "tavily-failed-llm-fallback" | "needs-re-intake",
  },
  recurring_matters: { top_shapes: string[] },                    // top 3–5 verbatim
  stakeholders: { reports_to, key_business_partners[], escalation_threshold_label },
  risk_appetite: "conservative" | "balanced" | "growth-oriented" | null,
  open_notes: string | null,
}
```

`SCHEMA_VERSION = 3`. `ProfileSchemaV2` preserved for read-time migration. `migrate_v2_to_v3` writes a stub `company_context` (all nulls + `captured_via = "needs-re-intake"`); `migrate_v1_to_v2` chains into it. Disk not rewritten until next `finalize_profile`. `OscarOnboardingGuard.tsx` routes to a **gated re-intake** when `captured_via === "needs-re-intake"` — only P2.5 + P4 run; P1/P2/P3/P3.5 fields are read-only display.

## Rationale

- **Distinct block, not flattened into `corporate`.** The `corporate.{name, industry, size_band}` fields drive the sidebar display and Hub banner (ADR-015). `company_context` drives the *agent layer* — passed via recipe injection (ADR-053). Different consumers, different shapes.
- **Provenance on `regulatory_baseline.frameworks` is load-bearing.** A `tavily+user-confirmed` framework carries different trust than `llm-hypothesis-only` — downstream agents may surface confidence differently in privileged advice contexts.
- **`captured_via` enum carries the migration sentinel** `needs-re-intake` directly — no separate `_migration_pending` flag. The schema itself encodes whether the profile needs an intake top-up.
- **Pre-pilot doctrine** (CLAUDE.md: *"we are pre-pilot, no backwards-compatibility shims"*) → force re-intake on existing v2 profiles. Cost ~3 minutes per existing dogfood user; the new intake is the upside.

## Consequences

- `Profile` type changes; existing consumers (`useOscarProfile`, sidebar, `OscarHubBanner`) read `company_context` through optional chaining initially; full typing rolls out in P4.
- `migrate_v2_to_v3` is read-only at read time; disk not rewritten until next `finalize_profile` → no mass-rewrite on launch.
- `practice_areas[].area_profile` (v2 P3.5 captures) carries forward unchanged. The skip-when-covered logic (ADR-050 rule 6) cross-references `company_context` at runtime; no field migration needed.
- Sibling-repo `oscar-onboarding-mcp` minor version bump.

## Supersedes

None. Extends ADR-011 (schema v1) and ADR-032 (schema v2 + P3.5).
