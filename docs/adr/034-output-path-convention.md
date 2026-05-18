# ADR-034 — Output-path convention for skill-generated work product

Status: accepted
Date: 2026-05-18
Sprint: 11

## Context

ADR-019 (Sprint 9) set the egress convention for the Commercial redline flow: adeu writes to `~/Documents/Oscar Redlines/{stem}_redlined_{YYYYMMDD-HHmmss}.docx`; the agent surfaces the path. Sprint 11 vendors `claude-for-legal` (per ADR-031), which contains skills producing many output types beyond redlines — DPAs, FTO opinions, diligence memos, privacy notices, board minutes, position papers. ADR-019's flat `~/Documents/Oscar Redlines/` directory was sized for one output type; it doesn't scale.

`claude-for-legal`'s upstream convention writes to per-plugin config dirs (`~/.claude/plugins/config/<plugin>/`); not appropriate for Oscar GC's user-facing work product (lawyers expect deliverables in `~/Documents/`).

## Decision

Generalise to `~/Documents/Oscar/<Practice Area Name>/<Output Type>/<file>`. Examples:

- `~/Documents/Oscar/Commercial/Redlines/nda-acme_redlined_20260518-143022.docx`
- `~/Documents/Oscar/Privacy/DPAs/vendor-x-dpa_drafted_20260518-150301.docx`
- `~/Documents/Oscar/IP/FTO Opinions/feature-y_fto_20260518-160044.md`
- `~/Documents/Oscar/CoSec/Board Minutes/2026-Q2-board_minutes_20260518-170522.docx`

Rules:

- **Practice Area Name** = Title Case from `PRACTICE_AREAS[i].name` (`Commercial`, `Commercial Disputes`, `AI Governance`, `CoSec`). Matches sidebar label exactly; spaces preserved.
- **Output Type** = Title Case plural enumerated by the orchestrator agent across all 9 plugins; canonical list lives at `skills/in-house-legal/OUTPUT_TYPES.md`. One canonical name per artefact kind.
- **Convention encoded in recipe system prompts**, not in adeu (or other backend MCPs). Per ADR-019, the recipe owns `output_path`; backends write where instructed.

Sprint 11 updates:

- `ui/desktop/src/components/oscar/commercial/systemPrompt.ts:39` — `~/Documents/Oscar Redlines/` → `~/Documents/Oscar/Commercial/Redlines/`.
- Each vendored SKILL.md's output-path templates rewritten to this convention by the per-plugin agents (ADR-033 invocation-reference fixes).
- `RUNBOOK.md` gains a one-line note for any Sprint-10 dogfood files the user references.

**No file migration.** Existing files at `~/Documents/Oscar Redlines/` stay where they are. New writes go to the new path.

## Rationale

- **Title Case matches sidebar.** Lawyers see "Commercial" in the UI; they get a "Commercial" folder. Kebab-case ids leak schema into a user-visible filesystem.
- **Two-segment `<area>/<type>` is shallow.** One level of nesting is browseable. Per-matter / per-counterparty sub-segments are deferred to Sprint 12 (Matters/Projects).
- **Recipe-owned, backend-agnostic.** Same pattern as ADR-019. Adeu's Python source is untouched; the recipe system prompt instructs the agent to set `output_path`.
- **No migration honours the user's existing artefacts.** Sprint 9–10 redlines remain where they are. The new structure starts now.
- **Canonical Output Type list prevents drift.** Each plugin author would otherwise invent their own ("Redline" vs "Redlines" vs "Marked-up Versions"); orchestrator enumerates once and the rest of the bundle inherits.

## Consequences

- `~/Documents/Oscar/` becomes the user-facing artefact root. `~/Documents/Oscar Redlines/` (legacy from ADR-019) coexists with pre-Sprint-11 files; new redlines go to the new path.
- **Migration follow-up**: a future sprint (when matter scoping arrives) can offer a one-time mover. Sprint 11 does not.
- Each kept SKILL.md and the Commercial recipe system prompt carry the new path templates. Orchestrator catches inconsistent capitalisation during the cross-plugin pass.
- Adeu's egress logic in `/srv/projects/oscar-runtime/python/adeu-venv/` is unchanged.
- ADR-019's narrower convention is superseded by this one; ADR-019 stays in place as historical record.

## Supersedes

ADR-019 (file egress disk-write convention) — generalises the Sprint 9 narrow case (Commercial redlines only) to the cross-skill case. ADR-019's "recipe owns `output_path`" finding stays valid and load-bearing.
