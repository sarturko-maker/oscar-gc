# ADR-070 — Panel sections declarative + per-area defaults

Status: accepted
Date: 2026-05-20
Sprint: 20 / M2 (right-panel master brief, sub-sprint 2)

## Context

[[ADR-069]] landed the right-pane primitive with an inert body. M2 turns that body into a vertical stack of section stubs whose composition is per-area: Commercial shows MatterFacts/Skills/Playbooks/Redlining; Privacy shows ProgrammeFacts/Skills/Playbooks/Deadlines; etc. [[ADR-067]]'s `area_overrides.panel_sections` is typed `string[]` permissively in M0 (string-slugs to keep M0 scope-bounded). The Forge area-modify path (M7) needs a durable override surface that drives this composition without hard-coding per-area logic in the pane component.

## Decision

Section IDs are a closed 8-member literal union: `PanelSectionId = 'MatterFacts' | 'ProgrammeFacts' | 'Skills' | 'Playbooks' | 'Redlining' | 'Forum' | 'Deadlines' | 'History'`. Exported alongside a `PANEL_SECTION_IDS` const array (for runtime iteration) and an `isPanelSectionId` guard. `PracticeAreaShape` gains required `defaultPanelSections: PanelSectionId[]`; all 13 bundled areas declare it. `area_overrides.panel_sections` narrows from M0's `string[]` to `PanelSectionId[]`. Resolution: `area_overrides.panel_sections ?? PRACTICE_AREA_SHAPES[areaId].defaultPanelSections ?? Forge-fall-through`, where the Forge fall-through (user-added areas with no shape) reads `practice_areas[i].entry_noun.singular === 'Programme' ? [ProgrammeFacts, Skills, Playbooks] : [MatterFacts, Skills, Playbooks]`. A `sectionRegistry: Record<PanelSectionId, ComponentType>` indirection maps every ID to `PanelSectionStub` in M2; M3+ swap individual entries (eager or `React.lazy()`) without `RightPaneShell` change.

## Rationale

- **Single source of truth + ADR-047 pattern reuse.** Same declarative-per-area shape as `NewMatterDialog` (Sprint 14). No 13-way switch in the pane component.
- **Closed enum prevents LLM-controlled section list.** Section composition is product/UI policy; an LLM should not be able to introduce arbitrary section IDs at runtime (CLAUDE.md MCP tool-schema rule, type-safety rule).
- **Registry decouples wiring from content.** M2 ships all stubs; M3 fills MatterFacts + History by swapping registry entries; M4 fills Playbooks; M5 fills Skills. RightPaneShell never imports section bodies directly.
- **Last-writer-wins.** Forge-set `area_overrides.panel_sections` supersedes the registry default — same merge layer pattern ADR-067 established.

## Alternatives rejected

- **Open string IDs** (any string flows through). Rejected — opens an LLM-controllable runtime surface, breaks the closed-set rule, and silently mounts nothing for unknown IDs.
- **One renderer per area** (Commercial.tsx, Privacy.tsx, …). Rejected by ADR-047's precedent — leads to 13-way switches in code; per-area variation is data.
- **Composition stored on user-added-area's shape entry.** Rejected — `profile.json` is the durable surface per ADR-067; shape data is bundled and not user-writeable.

## Consequences

- `OscarAreaOverrides.panel_sections` narrows `string[] → PanelSectionId[]`. M0's permissive comment ("later sprints narrow to enums/literal unions as they land") is now retired.
- `PracticeAreaShape.defaultPanelSections` becomes a required field — TS fails loudly for any new area entry missing the declaration, which is the desired type-safety outcome.
- `OscarUserProfilePracticeArea` gains optional `entry_noun: { singular, plural } | null` (Sprint 19 P4 already writes it; M2 adds the read-side type) so the Forge fall-through can resolve.
- M3 fills MatterFacts + History bodies by swapping their registry entries. M7 writes to `area_overrides.panel_sections` via existing `oscar-fs__write_file` path; Zod validation at the IPC boundary is the [[ADR-077]] candidate.

## Supersedes

None. Companion to [[ADR-067]] (`area_overrides` persistence surface), [[ADR-069]] (right-pane primitive), [[ADR-047]] (declarative per-area config pattern).
