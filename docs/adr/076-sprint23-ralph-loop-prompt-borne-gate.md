# ADR-076 — Sprint 23 Ralph Loop: prompt-borne gate-and-revise (Shape A)

Status: accepted
Date: 2026-05-20
Sprint: 23

## Context

Sprint 22 ([[ADR-074]], [[ADR-075]]) wired the `verification-pass` sub-recipe into all 10 Lavern partner recipes. The sub-recipe returns `## Verification Pass: <PASS|ISSUES>` plus per-category detail. As shipped the partner reads the result and can proceed to delivery anyway — verification is advisory. Sprint 23 turns it into a gate: on ISSUES the partner MUST revise (up to two revisions, then escalate to human review) before delivering substantive analysis. The architectural call was where the gate lives.

## Decision

**Shape A — prompt-borne.** The gate-and-revise discipline lives in each partner's prompt. Sprint 22's "Verification before delivery" paragraph is REPLACED (not appended) in all 10 partner prompt files by a single Ralph Loop paragraph that mandates revision on the literal marker `## Verification Pass: ISSUES`, caps at two revisions ("revision 1 of 2", "revision 2 of 2"), and gives an exact escalation phrase. The partner is required to quote the verification-pass header verbatim, making compliance transcript-auditable. `Recipe.settings.max_turns = 12` provides a substrate safety ceiling that aborts uncapped revision loops.

## Rationale

Shape B (substrate-borne gating — threading a `REVISE` signal through `delegate()`'s return shape into the parent's session loop) would touch `crates/goose/src/agents/platform_extensions/summon.rs`, `crates/goose/src/agents/subagent_handler.rs:48`, `crates/goose/src/agents/agent.rs`, and the Recipe schema — ~100-150 LOC of Rust core, violating CLAUDE.md "do not modify the Rust core unless absolutely necessary" and creating upstream-merge debt every Goose pull. The substrate today returns plain text only (`CallToolResult::success(vec![Content::text(text)])`) with no structured pass/fail field; `Recipe.retry: Option<RetryConfig>` is shell-command-failure semantics, not semantic revision. The LLM's natural session loop handles revision turns competently when the prompt enumerates revision counts as concrete sequence steps. REPLACE not APPEND avoids competing-instructions ambiguity between Sprint 22's softer paragraph and Sprint 23's stricter one — same conceptual hop, one paragraph, lower regression risk. The verbatim-quote requirement and exact-string ISSUES marker keep the discipline grep-detectable in transcripts.

## Alternatives rejected

- **Shape B with Rust-core schema extension**: violates CLAUDE.md fork hygiene; ~100-150 LOC of upstream-merge debt; no Sprint-23-specific evidence demanding it. Re-evaluable when Sprint 24 / 25 produces concrete demand.
- **Append a second paragraph rather than replace Sprint 22's**: creates competing instructions; under MiniMax-M2.5 the LLM tends to pick the earliest, softest match. Replacement subsumes Sprint 22's behaviour (invoke + cite) cleanly.
- **Sub-recipe parameter for revision count** (verification-pass takes a `revision_number` arg): double-counts (LLM still populates the count); complicates verification-pass.yaml for no detection-quality gain over inline prompt enumeration.

## Consequences

- 10 string-replace edits across `ui/desktop/src/components/oscar/lavern/prompts/*.ts`.
- Single-line `max_turns: 12` addition in `buildLavernPartnerRecipe.ts` `settings:` block and mirrored in `scripts/test-lavern-agents.js:buildPartnerRecipeYaml()`.
- Sprint 21 ADR-072's raw originals at `prompts/raw/<slug>.ts.original` are NOT modified (verification gate is Oscar-GC-specific augmentation, not part of the Lavern adaptation lineage).
- New dogfood test `scripts/test-lavern-revision.js` with a deliberately ungrounded prompt (Sarah Chen / "section 99.9") asserts gate-and-revise behaviour against the transcript.
- Sprint 22's existing `test-lavern-agents.js` regression suite still goes 3/3 — the new prompt is stricter than Sprint 22's but subsumes its observable behaviour.
- If the eval ([[ADR-077]]) shows Δ_grounded ≤ 0 with-Ralph vs without-Ralph on grounding-touched rubric items, that is the signal that Shape A wasn't enough and Sprint 24 reconsiders.

## Supersedes

None. Companion to [[ADR-074]] (Path A architectural call — sister Sprint 22 decision) and [[ADR-072]] (prompt-as-source-of-truth pattern). Sister Sprint 23 ADR: [[ADR-077]].
