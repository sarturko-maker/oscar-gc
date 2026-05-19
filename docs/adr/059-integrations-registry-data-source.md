# ADR-059 — Integrations registry: `.mcp.json` + hand-curated overlay

Status: accepted
Date: 2026-05-19
Sprint: 17

## Context

Sprint 17 ships **Integrations** — a transparent, in-house-shaped surface where lawyers see and add MCPs to their per-area agent loadout. The surface needs a registry: a list of available MCP entries with honest metadata (license, subscription, security tier, hostname, env_keys).

Two pre-existing data shapes are relevant:

- **Vendor data**: `skills/in-house-legal/<plugin>/.mcp.json` (9 files, vendored from Anthropic's claude-for-legal at ADR-031 commit `4d55f539`). Each file contains `{mcpServers: {name: {type, url, title, description}}, recommendedCategories: [...]}`. Hand-curated by Anthropic; covers 17+ wrappers (Ironclad, DocuSign, CourtListener, Slack, Google Drive, etc.). All `http` transport.
- **Per-area mapping**: `ui/desktop/src/components/oscar/practiceAreas.ts` maps 13 practice areas to `bundled_skill_sources` plugin slugs (ADR-031).

Three options considered:

- **(a) Hand-author a single registry file**: re-creates information already in `.mcp.json`; two sources of truth that drift.
- **(b) Derive everything from `.mcp.json`**: requires teaching license/subscription/tier fields into the vendored Anthropic tree → polluting the vendor surface (ADR-035 hygiene) → re-application on every claude-for-legal re-vendor.
- **(c) `.mcp.json` for vendor truth + Oscar overlay for editorial metadata**: same pattern as Sprint 11's collision renames (`<plugin>__<skill>` per ADR-031 — local manifest over vendored content).

## Decision

**Option (c).** The registry has two parts joined at load time:

- **Vendor truth (read-only)**: `skills/in-house-legal/<plugin>/.mcp.json`. Owns `id, transport, url, title, description`.
- **Oscar overlay (new, hand-curated)**: `ui/desktop/src/components/oscar/integrations/registry.ts` exports `INTEGRATIONS_OVERLAY: Record<string, IntegrationOverlay>`. Owns `license, subscription_type, security_tier, env_keys, service_endpoint_host, maintenance_signal, facts_note`.
- **Loader**: `loadRegistry.ts` reads `.mcp.json` files via IPC `oscar:integrations:list-available`, joins with overlay by entry id, computes `relevant_areas` by inverting `bundled_skill_sources` (plugin membership → area_ids).
- **Override path**: overlay entries without a vendor row (e.g., the bundled `oscar-fs`) carry `url + title + description` themselves; the loader emits them anyway.

**Per-area scoping mechanism**: `relevant_areas` is derived from `.mcp.json` membership × `bundled_skill_sources` inversion. No new taxonomy; no per-entry hand-curation of areas. Slack/Google Drive (in every `.mcp.json`) → all 13 areas; Ironclad/DocuSign (only `commercial-legal/.mcp.json`) → `['commercial']`; CourtListener (`litigation-legal` + `ip-legal`) → IP + 4 disputes areas via the `litigation-legal` → disputes inversion.

## Rationale

- **Reuse over rebuild** (CLAUDE.md). `.mcp.json` is already authored, vendored, attributed (ADR-035). Recreating it would mean diverging from claude-for-legal updates.
- **Honest separation of authority.** Anthropic owns what the wrapper is (URL, description); Oscar GC owns the in-house editorial judgement (license stamp, security tier, subscription posture).
- **No vendor-tree edits.** ADR-035 hygiene preserved. Future claude-for-legal re-vendor (Sprint 18+) overwrites `.mcp.json` files cleanly; only the overlay survives.
- **Per-area scoping is derived, not authored.** The brief explicitly said "no full taxonomy in Sprint 17". `bundled_skill_sources` inversion gives correct per-area filtering for free.

## Consequences

- `INTEGRATIONS_OVERLAY` ships with 6 seed entries for Sprint 17 (oscar-fs, CourtListener, Slack, Google Drive, Ironclad, DocuSign). Adding/updating an entry is a one-line edit in the overlay file.
- Overlay coverage is a registry contract: if `.mcp.json` carries an entry without an overlay row, the loader emits a warning and excludes the entry from the rendered list (fail-closed, no silent inclusion of un-tiered MCPs).
- The loader can be reused at session-spawn (`buildExtensionFromIntegration`) and at UI mount (`IntegrationsView` / `IntegrationsPerArea`). One source of truth across the desktop process.
- ADR-031's `bundled_skill_sources` table becomes a load-bearing primitive for two systems (skill discovery + integrations scoping). A rename of any plugin slug now requires touching both consumers.

## Supersedes

None. New Sprint 17 surface. Builds on ADR-031 (practice-area → plugin mapping) and ADR-035 (Apache 2.0 NOTICE / vendor hygiene).
