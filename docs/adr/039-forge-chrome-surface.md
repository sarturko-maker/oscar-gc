# ADR-039 — Forge as a distinct chrome surface, scoped MCP loadout

Status: accepted
Date: 2026-05-19
Sprint: 12

## Context

Sprint 12 introduces **Forge**, a meta-agent that (a) creates new skills (writes `SKILL.md` to the personal skills dir) and (b) creates new practice areas (extends `~/.config/oscar/profile.json` `practice_areas[]`). Forge is explicitly NOT an item in the practice-area list — the user-facing model is "practice areas hold matters; Forge sits above them and extends the system itself." The brief left chrome placement to plan-mode (sidebar / top bar / command bar all on the table).

Goose Desktop's sidebar today: `OscarSidebar.tsx` renders the practice-area list with Settings as the only system affordance in the footer. AppLayout (`ui/desktop/src/components/Layout/AppLayout.tsx:317`) has no top bar; no command palette.

## Decision

- **Chrome placement**: sidebar **header zone**, above the practice-area list, with a divider. Settings stays in the footer; the two system affordances inhabit distinct sidebar zones rather than co-mingled (footer = config; header = meta-agent extension surface). This expresses "Forge sits above practice areas" visually without introducing a new chrome region.
- **Recipe**: `ui/desktop/src/components/oscar/forge/forgeRecipe.ts` factory, title `Oscar GC — Forge` (bundled-trust prefix per ADR-029). Two-mode `instructions:` (create-skill OR create-area), mode picked by the LLM from the lawyer's natural-language opener.
- **Filesystem scope** via `oscar-fs` (ADR-040): `args: [~/.agents/skills/, ~/.config/oscar/]`. Forge has `available_tools: ['read_file', 'write_file', 'list_directory', 'create_directory']`. **No Developer extension, no memory MCP, no onboarding MCP, no redline MCP.**
- **Create-skill**: writes to `~/.agents/skills/<skill-name>/SKILL.md`, discovered by Goose's `all_skill_dirs()` walker (`crates/goose/src/skills/mod.rs:226-252`) on next session.
- **Create-practice-area**: writes to `profile.json` `practice_areas[]` with `source: 'user-added'` and explicitly offers **bundled-skill seeding** during the interview ("Would you like to seed this area with skills from Commercial, Privacy, IP, Litigation?..."). Selected plugin slug(s) populate `bundled_skill_sources` per ADR-031 mapping shape. Areas without seeding get `bundled_skill_sources: []` and Forge's closing message states explicitly: "Your new <name> area uses generic agent capabilities — filesystem access only. To wire domain-specific tools, edit the recipe builder (Sprint 13+ work)."

## Rationale

- **Sidebar header zone over footer-alongside-Settings** because Forge is a different kind of system affordance — Settings configures Oscar; Forge extends it. Two zones visually communicates that.
- **Bundled-skill seeding committed** rather than left to "Sprint 13+" because the data path is trivial (ADR-031 already wired `bundled_skill_sources`) and closes the surprise gap of "I made a new area; the agent has no skills."
- **Scope deliberately narrow** because Forge writes to system config — broader scope here would let Forge or a prompt-injection mutate matter data or document files.
- **No shell, no bash** keeps Forge inverted from upstream Goose's developer-tool defaults (CLAUDE.md "inverting upstream UX defaults").

## Consequences

- `OscarSidebar.tsx` grows a header zone above the area-list render block. Settings stays in the footer.
- New route `/forge` mounted in `App.tsx` to `ForgeView`. Trust dialog bypassed via title prefix (ADR-029).
- A new user-added practice area without seeded skills lands as a filesystem-only agent — documented in the closing message so lawyers know what they got.
- `profile.json` is now writable by two agents (Onboarding and Forge); both use schema-v2 (ADR-032). Idempotency: Forge refuses if `id` already exists.

## Supersedes

None.
