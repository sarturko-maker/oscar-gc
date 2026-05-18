# ADR-031 — Practice-area → upstream-plugin mapping

Status: accepted
Date: 2026-05-18
Sprint: 11

## Context

Anthropic's open-source `claude-for-legal` (Apache 2.0; https://github.com/anthropics/claude-for-legal) ships **9 in-house practice-area plugins**: `ai-governance-legal`, `commercial-legal`, `corporate-legal`, `employment-legal`, `ip-legal`, `litigation-legal`, `privacy-legal`, `product-legal`, `regulatory-legal`. Plus educational plugins (`law-student`, `legal-clinic`), infra (`legal-builder-hub`), an external paid integration (`external_plugins/cocounsel-legal`), and managed-agent cookbooks.

Oscar GC's practice-area sidebar (ADR-006, then ADR-014/015) lists **13 areas** at `ui/desktop/src/components/oscar/practiceAreas.ts:12-91` — substantive areas split from their disputes counterparts (`commercial` / `commercial-disputes`, `employment` / `employment-disputes`, `ip` / `ip-disputes`, `regulatory` / `regulatory-disputes`) plus `product`, `ai-governance`, and `cosec` (corporate secretary). Litigation is not its own area; it flows into the `*-disputes` slices.

Sprint 11 vendors `claude-for-legal` as a bundled skill library. The 9→13 fan-out needs a deterministic mapping so each Oscar area knows which upstream plugin(s) supply its skills.

## Decision

Vendor upstream's 9 in-house plugins verbatim under `skills/in-house-legal/<plugin>/`. Extend `PracticeArea` in `practiceAreas.ts` with `bundled_skill_sources: readonly string[]`:

| Oscar area | bundled_skill_sources |
|---|---|
| commercial | `commercial-legal` |
| commercial-disputes | `commercial-legal`, `litigation-legal` |
| corporate | `corporate-legal` |
| employment | `employment-legal` |
| employment-disputes | `employment-legal`, `litigation-legal` |
| privacy | `privacy-legal` |
| ip | `ip-legal` |
| ip-disputes | `ip-legal`, `litigation-legal` |
| regulatory | `regulatory-legal` |
| regulatory-disputes | `regulatory-legal`, `litigation-legal` |
| product | `product-legal` |
| ai-governance | `ai-governance-legal` |
| cosec | `corporate-legal` (weak fit; per-plugin MANIFEST flags) |

Drops: `law-student`, `legal-clinic` (educational; out of in-house scope), `legal-builder-hub` (community-installer infra), `external_plugins/cocounsel-legal` (paid Westlaw subscription). Out of scope this sprint: `managed-agent-cookbooks` (Sprint 12+).

## Rationale

- **Upstream shape preserved.** 9 plugin directories isomorphic to upstream → cheap re-vendoring on every future pull; no per-area re-cutting.
- **Fan-out in one config layer.** The 9→13 expansion lives in one field (`bundled_skill_sources`) on one file (`practiceAreas.ts`). No skill duplication across plugin directories.
- **Litigation distributed via disputes overlap.** All four `*-disputes` areas pull from both their substantive parent AND `litigation-legal`. Goose's skill discovery deduplicates by `name:`; if a litigation skill is loaded once, it's available across all four disputes practices.
- **CoSec weak fit, transparently.** Upstream has no `cosec-legal`. Corporate-legal covers board governance + statutory filings, which is the closest cousin; sourcing it with a MANIFEST flag is honest about the gap. Sprint 11 dogfood validates whether the cosec user actually benefits; a future sprint either authors bespoke cosec skills or waits for upstream.
- **Default-keep posture.** Borderline upstream content is kept; per-plugin agents and the orchestrator (per ADR-033) handle in-house gating + reference fixes.

## Consequences

- `bundled_skill_sources` is consumed by the onboarding system prompt (per ADR-032 P3.5 mini-interviews) and, in future sprints, by per-area UI scoping. Sprint 11 lands the data; UI scoping is not in scope.
- Goose's recursive skill walker (`crates/goose/src/skills/mod.rs:226-415`) treats all bundled skills as globally available — there is no per-area gating at discovery time. The mapping is editorial, not enforced.
- The 9 plugin directories retain their upstream layout (`.claude-plugin/`, `.mcp.json`, `CLAUDE.md`, `skills/`, `agents/`, `hooks/`). Non-skill artefacts (agents, hooks) are inert in Sprint 11 — kept for Sprint 12's Forge work.
- Future upstream additions (e.g., a `cosec-legal` plugin) integrate by adding a directory + updating one row of the mapping.

## Supersedes

None. First ADR on bundled skill content. Companion to ADR-006 (practice-area sidebar list).
