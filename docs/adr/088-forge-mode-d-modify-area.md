# ADR-088: Forge Mode D — modify an existing practice area

Sprint 20-M7 (2026-05-21). Status: Accepted.

## Context

M0 (ADR-067) put `area_overrides` on `profile.json.practice_areas[i]`
as the durable surface for Forge-driven agent edits. M2–M6 wired the
read-paths (description, panel_sections, playbooks, enabled_skills).
Forge today can create areas (Mode B, ADR-039) and review uploaded
skills (Mode C, ADR-087) — both append-shaped. M7 closes the modify
side: a lawyer asks Forge to change something about an existing area
in plain English; Forge confirms and writes the override delta.

## Decision

Mode D is a fourth numbered section in the monolithic `SYSTEM_PROMPT`.
Two entry surfaces: sidebar Forge button (free-text opener; reads
profile.json + fuzzy-matches against `practice_areas[].id`, asks if
ambiguous) and per-area Edit link in `RightPaneShell` header (deep-link
`#/forge?modifyArea=<areaId>`; mirrors M6's `?reviewSkill=`).
`buildForgeRecipe(...)` gains optional fifth param `modifyAreaId`;
when set, prepends `[Begin in Mode D. Modify the practice area:
<areaId>]` to `SYSTEM_PROMPT`. `reviewSkillPath` precedes if both set.

Writes go via `oscar-fs__write_file` — same tool/allowed-dir as B/C.
Mode D preserves every untouched field verbatim (mutate-in-place vs.
Mode B's push-new). Procedure shows before/after diff for list fields
and before/after text for description_override.

## Alternatives rejected

- Renderer-side area picker before Mode D — splits responsibility;
  the agent already reads profile.json for Mode B/C.
- New MCP tool for area_overrides writes — contradicts M7 brief's
  "same write tool" rule.

## Caveats

Defence-in-depth write validation lives in ADR-089 (post-write
watcher; reverts bad area_overrides). Mode D's read-back step
surfaces a rejection conversationally — no toast UI. Resume-semantics
inherit Mode C: already-open matter sessions keep their recipe baked
at spawn; overrides apply on next fresh matter-open.

Cites: ADR-039, ADR-067, ADR-070, ADR-086, ADR-087, ADR-089.
