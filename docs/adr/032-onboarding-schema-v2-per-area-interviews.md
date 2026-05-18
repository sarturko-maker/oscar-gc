# ADR-032 — Onboarding schema v2 + per-area mini-interviews

Status: accepted
Date: 2026-05-18
Sprint: 11

## Context

Sprint 6 landed the unified onboarding (`oscar-onboarding-mcp` + `Oscar GC Onboarding` recipe), departing from `claude-for-legal`'s per-plugin cold-start-interview pattern: one conversation instead of nine. Profile shape v1 at `/srv/projects/oscar-onboarding-mcp/src/schema.ts` carries identity, corporate context, a list of selected practice areas, and provider — but each `PracticeArea` is `{id, name, body, source}` with `body` a free-text default-description string. No per-area Q&A.

Sprint 11 vendors `claude-for-legal`. Upstream's per-plugin cold-start interviews contain area-specific questions (e.g. "What's your renewal window for vendor contracts?", "Which clauses do you treat as deal-breakers?") that materially shape how each plugin's skills perform. Sprint 11 drops the per-plugin onboarding scaffolding and folds the content into the unified onboarding's new **P3.5 — Per-area mini-interview** phase.

Two Sprint 10 dogfood carry-forwards live here: markdown not rendering during the interview (`OscarChatMessage.tsx:21-24` renders raw text), and "jumps to practice areas too soon" pacing complaint.

## Decision

**Schema bump v1→v2** in `oscar-onboarding-mcp/src/schema.ts`. `PracticeAreaSchema` gains `area_profile: Record<string, string> | null` — free-text answers keyed by question id. v1 profiles read fine (read-time `migrate_v1_to_v2` in `store.ts` synthesises `area_profile: null` on legacy entries; disk is not rewritten until next `finalize_profile`).

**Question templates colocate with the plugin they came from.** Each kept plugin gets `/srv/projects/goose/skills/in-house-legal/<plugin>/onboarding-questions.json` — array of `{id, prompt, priority}`. Onboarding MCP exposes a new tool `list_area_questions(plugin_id)`; main spawns the MCP with `OSCAR_RESOURCES_ROOT=${process.resourcesPath}` so the tool resolves the JSON path. The onboarding MCP knows about skill-bundle paths via a single env var; it does not depend on the bundle's internal structure beyond that root.

**System-prompt change** in `ui/desktop/src/components/oscar/onboarding/systemPrompt.ts`:

- Insert **P3.5 — Per-area mini-interview** between current lines 56 and 58. For each selected practice area, the agent reads `bundled_skill_sources` from the embedded `seedAreasJson` (extended in this ADR to include the field per ADR-031), calls `list_area_questions(plugin_id)` once per unique source plugin, and asks at most **2 questions per area** (the JSON marks `priority: 1` candidates; agent picks top 2). Answers map into the area's `area_profile`. Worst case 13 areas × 2 = 26 turns; realistic median 18–22.
- **Pacing reshape.** P3.5 closes with explicit completion ("That's everything I needed."). P4 (provider confirmation) and the closing message are delivered as a tail wrap, not as further question-and-answer beats.

**Markdown render fix** in `OscarChatMessage.tsx:21-24`: wrap `body` in the existing `<MarkdownContent>` component (`ui/desktop/src/components/MarkdownContent.tsx`) for the `agent` variant only. User-typed turns stay plain text.

## Rationale

- **`body: string` cannot honestly carry structured Q&A.** Flat strings work for default body copy but not for per-area answer maps. Schema v2 is the right shape; the migration cost is one read-time function.
- **Colocate questions with skills, decouple paths from MCP.** Questions live next to the plugin that authored them (the natural source of authority); the onboarding MCP discovers them via one env var. No hard-coding of bundle paths in the MCP source.
- **2-question cap respects the original "five minutes at most" promise.** 4-per-area was considered (richer profile) but lands at 30+ turns — too long. Per-plugin agents rank priority during the manifest pass; if fewer than 2 questions feel load-bearing, fewer ship.
- **Pacing reshape is system-prompt-only.** The "jumps to practice areas" complaint is LLM-driven, not code-driven; the fix is to require explicit completion of P3.5 before P4.
- **Markdown rendering reuses `MarkdownContent`.** Component already in the app, ships syntax highlighting + GFM. Pure addition.

## Consequences

- `oscar-onboarding-mcp` minor version bump (v0.x → v0.x+1); sibling-repo ADR-004 cross-references this one.
- `finalize_profile` input schema gains `practice_areas[].area_profile`. Existing renderer code that reads the profile (`useOscarProfile`, sidebar) ignores the new field until a future sprint surfaces it.
- Per-plugin agents (per ADR-033) produce `onboarding-questions.json` as part of their manifest pass — extracted from each upstream cold-start-interview skill before the skill itself is dropped.
- Worst-case onboarding length grows from ~10 turns (Sprint 6) to ~25 turns (Sprint 11). Dogfood will reveal whether a "skip per-area for this area" affordance is needed in a future sprint.
- Existing v1 `profile.json` files on disk continue to load. No forced re-onboarding for existing dogfood profiles.

## Supersedes

None. Companion to ADR-011 (profile schema v1) and ADR-013 (onboarding chat surface).
