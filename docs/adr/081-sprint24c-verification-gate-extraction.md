# ADR-081 — Sprint 24-C verification-gate extraction (Hybrid 2)

Status: accepted
Date: 2026-05-21
Sprint: 24-C

## Context

[[ADR-076]]'s exit criterion reopens the architectural call if Sprint 23's Δ_grounded ≤ 0. [[ADR-077]]'s eval delivered **Δ_grounded = -3.8pp** — with-Ralph 33.3% vs without-Ralph 37.1% on grounding-touched rubric items; mean `grounded_citations` -0.25 (0.71 vs 0.96); 4/9 with-Ralph runs hit the 300s `max_turns: 12` ceiling. The broken language is the 21-line "## Verification gate (required before delivery)" paragraph [[ADR-076]] appended to every partner prompt — **byte-identical sha256 across all 10 partners** (verified). Sprint 24-C must iterate on this block. The architectural call: iterate in-place across 10 files (Shape B), refactor everything (Shape A), or extract only the byte-identical block then iterate (Hybrid 2).

## Decision

**Hybrid 2** — extract the verbatim-shared verification block into a new `verificationGateBlock.ts` exporting `VERIFICATION_GATE_BLOCK: string`; remove the 21-line block from each of the 10 partner prompts; `buildOscarLLPPartnerRecipe.ts` composes it as the 4th entry in the existing identity/company/partner instructions stack (lines 123-127). Do NOT extract Memory or Key Principles — those are structure-shared, content-partner-specific and refactoring them violates CLAUDE.md "three similar lines is better than a premature abstraction".

## Rationale

Empirical: the genuinely-shared portion is 210 lines (21 × 10) concentrated in ONE block; the remaining "shared" appearance is structural-similarity (Memory protocol, Key Principles numbering) not duplication. Memory contents are partner-specific (M&A observations vs Privacy observations); Principles 1-6 are partner-specific. Sprint 23 evidence concentrates entirely in the extracted block — forcing verbatim-quote of the verification-pass header burned turns (4/9 timeouts) and degraded `grounded_citations` (-0.25). Iterating the broken language across 10 files is 10x edit cost for zero specificity gain — and risks drift between partners. Pattern precedent: `userIdentityBlock.ts` (Sprint 21, [[ADR-071]]) and `companyContextBlock.ts` (Sprint 15, [[ADR-053]]) already establish "shared block composed into instructions" in `buildOscarLLPPartnerRecipe.ts:123-127`. Hybrid 2 adds a 4th entry to that existing array — no new mechanism. Iteration mechanics: cross-partner edits land in `verificationGateBlock.ts`; partner-specific edits land in the partner file. File boundaries enforce tier separation without per-edit human vigilance. Sprint 25+ scaling: adding partners 4-10 to iteration scope is identical to today — each new partner imports via the existing builder.

## Alternatives rejected

- **Shape A (full base + per-partner overlay)** — refactoring 72% partner-specific frameworks (Sarah's Deal phases, Diana's GDPR phases — share no structural skeleton beyond "five phases") into "specialism overlays" is the premature-abstraction CLAUDE.md warns against. Forces a templating system for Memory + Principles for cosmetic uniformity.
- **Shape B (iterate monolithic prompts in place)** — 10x edit fan-out for a provably-identical block; Sprint 23's evidence is unambiguously in the shared layer; in-place iteration risks drift between the 10 partners with no specificity gain.
- **Hybrid 1 (iterate-then-extract at end-of-sprint)** — defers a refactor we have evidence to do now; "patterns shared-shaped at end of sprint" is already known from Sprint 23.
- **Hybrid 3 (leave monolithic; tag edits cross-partner-vs-partner-specific)** — human-discipline-driven; the file-boundary version (Hybrid 2) is the same discipline enforced by the type system.
- **Also extract Memory + Key Principles** — structure-shared, content-different; would force `renderMemoryBlock(partnerSpecificObservations)` templating, heavier than three similar lines.

## Consequences

- New file: `ui/desktop/src/components/oscar/oscar-llp/verificationGateBlock.ts` (~25 lines).
- Modified: `buildOscarLLPPartnerRecipe.ts` — add 4th array entry in `instructions` composition. +2 lines, -1 modified. Under 300 cap.
- Modified: 10 partner prompt files in `prompts/` — each loses 21 lines (verification-gate tail). All under 130 lines after.
- Untouched: `prompts/raw/*.ts.original` (Apache 2.0 verbatim per [[ADR-072]] + [[ADR-078]]); verification gate is Oscar-GC augmentation, never in raws.
- Untouched: `evals/lavern-jv/scripts/lib-recipe.js` `SPRINT_22_DIRECTIVE` + `RALPH_DIRECTIVE` constants frozen per [[ADR-077]]; Sprint 24-C eval continues A/B against those baselines.
- Sprint 24-C iteration edits the constant in `verificationGateBlock.ts` for cross-partner patterns; partner-specific defects (Sarah × Doc 1 from `sprint-23-baseline.md`) land in the partner file.
- Smoke test gate: `test-oscar-llp-agents.js` (Sprint 22's 3-partner regression) must remain 3/3 PASS after refactor — confirms composition seam works.
- A future sprint introduces templating substrate for Memory / Principles IF AND ONLY IF iteration reveals genuinely cross-partner Memory / Principles edits. Sprint 24-C does not have this evidence yet.

## Supersedes

None. Companion to [[ADR-076]] (Sprint 23 Shape A — the iteration target this ADR refactors) and [[ADR-072]] (prompt adaptation lineage). Pattern-mirror of [[ADR-053]] (`companyContextBlock.ts`) and Sprint 21 [[ADR-071]] precedent for `userIdentityBlock.ts`.
