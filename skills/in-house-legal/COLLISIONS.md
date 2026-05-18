# Skill-name collisions — orchestrator resolution

Sprint 11 (2026-05-18). Per ADR-031 detect-and-prefix strategy.

Goose's skill discovery (`crates/goose/src/skills/mod.rs:364`) uses a `seen`
HashSet keyed on the SKILL.md frontmatter `name:` field. The first occurrence
wins; subsequent ones are silently dropped. The orchestrator scans every kept
SKILL.md across all 9 vendored plugins; collisions get plugin-prefixed names
(`<plugin>__<skill>`); singletons keep their upstream names.

## Resolved collisions

| Skill name | Plugins | Renamed to |
|---|---|---|
| `policy-monitor` | ai-governance-legal, privacy-legal | `ai-governance-legal__policy-monitor`, `privacy-legal__policy-monitor` |
| `reg-gap-analysis` | ai-governance-legal, privacy-legal | `ai-governance-legal__reg-gap-analysis`, `privacy-legal__reg-gap-analysis` |
| `use-case-triage` | ai-governance-legal, privacy-legal | `ai-governance-legal__use-case-triage`, `privacy-legal__use-case-triage` |

Per-skill verification:

- Each renamed SKILL.md has its frontmatter `name:` updated to match the
  directory name.
- Cross-references in skill bodies — `/<plugin>:<skill>` — were rewritten
  during the ADR-033 invocation-reference pass to the prefixed name
  (e.g. references to `/ai-governance-legal:policy-monitor` became
  `ai-governance-legal__policy-monitor`).

## Pre-empted collisions (the dropped-skills set)

Three skill names appeared in **all 9 plugins** and would have collided
identically. These were dropped or stub'd by the Sprint 11 orchestrator
policy:

| Skill name | Resolution |
|---|---|
| `matter-workspace` | Kept as 9 stubs (self-disable for in-house default; superseded by Sprint 12 Matters layer). Skills file the gating logic that recognises Oscar's in-house tenant model, so the duplicates remain inert. |
| `cold-start-interview` | Dropped × 9. Content extracted to per-plugin `onboarding-questions.json` (ADR-032); unified Oscar onboarding supersedes. |
| `customize` | Dropped × 9. Replaced by Oscar Settings / profile editor (ADR-030 surface). |

Sprint 11 keeps the `matter-workspace` stubs because their bodies handle the
disabled state cleanly and the cross-skill `## Matter context` paragraphs
in 51 kept skills reference them. Sprint 12 (Matters/Projects scoped
containers) will retire the stubs.

## Why detect-and-prefix (vs. always-prefix)

Per ADR-031 (the user choice during planning): preserve upstream skill names
verbatim where unique. Prefix only the 3 colliders. This minimises mechanical
deviation from upstream and keeps `load_skill(name: "...")` calls readable
in the agent's reasoning.

Tradeoff: future vendor pulls that add new colliders trigger re-prefix work.
The orchestrator's collision-detection step (this file) is reproducible at
re-vendor time; no human judgment required to extend.

## Verification at runtime

Sprint 11 dogfood verifies that `load_skill(name: "<renamed>")` resolves
correctly for at least one renamed skill (`policy-monitor` per area).
