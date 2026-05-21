# ADR-087: Forge Mode C — review uploaded skill

Sprint 20-M6 (2026-05-21). Status: Accepted.

## Context

M5 (ADR-086) made skills visible per area but offered no path to add
one from an existing markdown file. M6 adds drop-affordance to the
Skills section: drop `<slug>.md` → `~/.agents/skills/<slug>/SKILL.md`
on disk → Forge opens with the path in `?reviewSkill=` and runs a
three-question review/enrich/bind interview.

## Decision

Mode C is a third numbered section in the existing monolithic
`SYSTEM_PROMPT`. Deep-link: `#/forge?reviewSkill=<absPath>`. When the
param is present, `buildForgeRecipe(...)` prepends a one-line
activation preamble (`[Begin in Mode C. Review the SKILL.md at: <path>]`)
to the prompt; when absent the prompt is unchanged and the agent picks
A or B from the lawyer's opener — Mode C does not fire in practice
without the drop affordance.

Mode C writes enriched SKILL.md via `oscar-fs__write_file` (Mode A's
allowed-dir). Area binding writes
`profile.json.practice_areas[i].area_overrides.enabled_skills` via
`oscar-fs__read_file` → mutate → `oscar-fs__write_file` — mirrors
Mode B. No new agent-facing IPC.

Stage IPC `oscar:skills:stage-for-review` validates slug regex +
frontmatter delimiters + `name:` field + no bundled-collision + no
overwrite, then writes atomically via `fs.writeFile { flag: 'wx' }` —
mirrors M4's `oscar:playbooks:upload`.

## Alternatives rejected

- Pre-session three-mode picker chrome — ForgeView is a transient
  bootstrap; adding UI is out of scope.
- Mode-stripped templated prompt — brittle; static prompt + runtime
  preamble is simpler.
- M5-IPC callback for binding writes — Forge agent runs in goosed,
  can't reach `window.electron`; defeats the reuse pivot.

## Caveats

Soft scoping inherits ADR-086 (out-of-scope still callable; walker-
fork queued). Frontmatter regex is permissive; Goose's `serde_yaml`
in `discover_skills` is the source of truth — malformed-but-passes-
regex files won't surface on next poll.

Cites: ADR-031, ADR-039, ADR-067, ADR-086.
