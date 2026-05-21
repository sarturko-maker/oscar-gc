# ADR-086: Skill scoping via prompt enumeration

Status: accepted (2026-05-21).
Context: Sprint 20-M5 — Skills visibility + per-area scoping. Companion
to ADR-085 (resume), ADR-067/068 (`area_overrides`), ADR-031 (Sprint 11
`~/.agents/skills/<slug>/SKILL.md`). Plan-mode reached for a fresh
`skillStore.ts` walker + YAML parser; probe found Goose's Rust core
already exports `discover_skills()` via `GET /config/slash_commands`
(CommandType === 'Skill'). CLAUDE.md "Reuse over rebuild" wins — same
pivot M4 took with `computercontroller`.

## Decision

Per-area skill scoping is **prompt-level**, not walker-level. Main-process
IPC `oscar:skills:render-block(areaId)` composes a `## Skills available
in this area` markdown block appended to recipe instructions, followed by
an `Ignore any other skills you may discover.` sentence. Three modes
stored in `area_overrides.enabled_skills.{mode, slugs}`:

- `all`   — every on-disk slug intersecting
            `area.bundled_skill_sources × ~/.agents/skills/`.
- `allow` — exactly `slugs` (intersected with on-disk presence).
- `deny`  — `all` MINUS `slugs`.

Skill name + description come from goosed's `getSlashCommands` HTTP
response (server-side `serde_yaml` parse). Bundled-vs-user discrimination
is a `fs.readdir` of `<resourcesRoot>/skills/in-house-legal/<plugin>/
skills/` per area. No new YAML parser, no new walker, no new npm dep.

## Caveat (soft constraint)

Well-behaved agents obey. Misbehaving agents may still invoke skills
outside the listed set — goosed auto-discovers everything under
`~/.agents/skills/` at session-spawn. Hard scoping via walker-fork is
queued post-master-brief.

## Resume semantics (mirrors ADR-085)

Mode + slug changes apply on the next fresh matter-open. Already-bound
sessions keep the recipe baked at spawn (ADR-038 + Sprint 19b). Pane
reflects the toggle immediately via the 2 s poll. SkillsSection chip +
mode pill carry `title="Applies on next matter open"`.

## Consequences

- profile.json single-writer (M4 `mutateAlwaysOn` template); mode flips
  do NOT clear `slugs` (invert-on-flip ergonomic).
- Bundled rows read-only ([bundled] tag, no delete X); user-added delete
  cross-scrubs the slug from every area's `enabled_skills.slugs`.
- Cross-agent "All Skills" view defers post-M8. No new npm deps; no Rust.
