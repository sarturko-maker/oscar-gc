# ADR-067 — `area_overrides` as the persistence surface for Forge-driven agent edits

Status: accepted
Date: 2026-05-20
Sprint: 20 (M0 — right-panel master brief, sub-sprint 0)

## Context

The right-panel master brief expands Forge to modify and delete practice-area agents (description, tools, skills, MCPs). The brief assumes "agent = recipe; modify agent = modify recipe", but Oscar GC builds recipes at runtime via `buildPracticeAreaRecipe` / `buildCommercialRecipe` / `buildForgeRecipe` — there is no on-disk recipe YAML to edit. The runtime build reads: `practiceAreas.ts` registry → `bundled_skill_sources` → `profile.json.practice_areas[i]` → `installed_integrations.json`. None of these exposes a per-area override mechanism.

## Decision

A new `area_overrides` block on each `profile.json.practice_areas[i]` entry is the durable surface for Forge-driven agent edits. Shape:

```ts
area_overrides?: {
  description_override?: string;
  panel_sections?: PanelSectionId[];
  enabled_skills?: { mode: 'all' | 'allow' | 'deny'; slugs: string[] };
  enabled_mcps?: { mode: 'all' | 'allow' | 'deny'; ids: string[] };
  playbooks?: { always_on: string[]; on_demand: string[] };
};
```

All fields optional. Recipe builders read `area_overrides` as the FINAL merge layer (registry default → user-added entry → override). M0 wires `description_override` only; M2 wires `panel_sections`; M4 wires `playbooks`; M5 wires `enabled_skills`; M7 wires `enabled_mcps`.

## Rationale

- **Single durable surface.** All agent-modification state lives in one place — easy to reason about, easy to inspect.
- **Preserves runtime-built recipes.** No on-disk recipe YAML; no fork of upstream Goose's recipe model. The per-matter freshness pattern Sprints 12-18 rely on is unchanged.
- **profile.json is already Forge-writeable.** Forge Mode B edits profile.json via `oscar-fs__write_file` (ADR-039); Modes C/D/E (M6/M7/M8) reuse that path.
- **Last-writer-wins merge.** Lawyer's override always supersedes registry defaults.

## Alternatives rejected

- **Per-area recipe YAML on disk** (e.g., `~/.config/oscar/recipes/<area>.yaml`). Forks Oscar GC away from runtime-built recipes; breaks per-matter freshness; doubles source of truth.
- **A separate `overrides.json` sibling file.** Splits profile state across two writers. ADR-061 set the single-writer precedent (installed_integrations.json is the deliberate exception, scoped to a single concern).

## Consequences

- `profile.json` schema bumps v3 → v4 (covered by [[ADR-068]]). Absent `area_overrides` reads as undefined per Zod `.optional()`.
- Recipe builders gain an `areaOverrides` field on their options shape. M0 wires the type-only thread-through plus `description_override` rendering.
- Forge's write surface for area edits is the existing `oscar-fs__write_file` targeting `~/.config/oscar/profile.json`. M7 will add Zod validation at the IPC boundary as defence in depth ([[ADR-077]]).
- Cross-repo: sibling `oscar-onboarding-mcp` `ProfileSchema` gains the V4 shape (mirror change). The MCP only writes profile.json on `finalize_profile`; Forge bypasses the MCP. The schema bump keeps the MCP and renderer types in sync.

## Supersedes

None. Companion to [[ADR-039]] (Forge filesystem scope), [[ADR-061]] (installed_integrations single-writer), [[ADR-068]] (schema migration policy).
