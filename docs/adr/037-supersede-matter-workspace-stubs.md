# ADR-037 — Matters supersedes Sprint 11 matter-workspace stubs

Status: accepted
Date: 2026-05-19
Sprint: 12

## Context

Sprint 11 vendored Anthropic's `claude-for-legal` and kept 9 `matter-workspace` skill stubs (one per plugin) at `skills/in-house-legal/<plugin>/skills/matter-workspace/SKILL.md`. The stubs are "default off" for in-house users — Sprint 11 close-out noted them as supersede targets. 51 substantive skills in the bundled library reference `## Matter context` paragraphs whose paths point at `~/.config/oscar/state/<plugin-slug>/matters/<slug>/` (per the stubs' convention).

Sprint 12 introduces a first-class Matters UI (ADR-036). The slash-command-driven `/matter-workspace` flow is obsolete — lawyers select matters from the practice-area landing. ADR-036 also rekeys matter paths to practice-area id, not plugin slug.

## Decision

- **Retire the 9 stubs.** Delete `skills/in-house-legal/<plugin>/skills/matter-workspace/` ×9 from the vendored tree.
- **Rewrite path references in the 51 substantive skills** to consume an environment variable: `OSCAR_MATTER_DIR=<absolute matter folder>`. Skills check for matter state (the boilerplate they all share) and resolve paths from the env var instead of hard-coded plugin-slug-keyed paths.
- **Recipe builder injects `OSCAR_MATTER_DIR`** into the session's environment (see ADR-041). When no matter is open, the env is unset and the boilerplate's "no matter active" branch fires (already present in upstream skill bodies).
- **Apache modifications recorded.** Per ADR-035, edits to vendored SKILL.md are Oscar GC modifications. The per-file provenance comment Sprint 11 added stays; an "Oscar GC modifications: paths rewritten to $OSCAR_MATTER_DIR (Sprint 12)" line appends to any modified file.

Orchestrator pass over `skills/in-house-legal/**/SKILL.md` is mechanical (sed-class) — pattern-match-then-rewrite, verify zero dangling old-path references.

## Rationale

- **No skill-content drift.** Path rewriting is the minimum change consistent with retiring the stubs; substantive skill content is untouched.
- **`$OSCAR_MATTER_DIR` is the right level of indirection.** Skills don't need to know about practice-area ids or plugin slugs — they just need to know where the active matter's files live. The recipe builder (which DOES know both) provides the env var.
- **Stubs retired, not detached.** Deleting is cleaner than keeping inert stubs that signal "feature exists" to lawyers who shouldn't see it.
- The convention also lets a future re-vendoring (when upstream ships new `claude-for-legal` content) re-apply the same orchestrator pass — see ADR-031 baseline framing.

## Consequences

- The orchestrator script lives under `scripts/` (Sprint 12 Phase 6), reusable for future re-vendoring.
- A skill that depends on the literal old-path structure (e.g., listing `_archived/<slug>/` under a plugin slug) breaks — flag in Phase 6 verification.
- ADR-031's table remains intact; `bundled_skill_sources` still maps practice areas to plugin directories. Only matter-path references are rewritten.

## Supersedes

None. Companion to ADR-036.
