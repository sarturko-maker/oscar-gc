# ADR-090 — Sprint 26 verification-gate back-port + targeted constraint relax

Status: accepted
Date: 2026-05-22
Sprint: 26

## Context

[[ADR-082]]'s Sprint 25 ran 12 partner-cycles (Sarah Chen / Diana Park / Aisha Khan × 4 cycles × 20 instances = 240 partner runs) of subtractive iteration on the [[ADR-081]] Hybrid 2 verification gate. Two findings drive Sprint 26:

1. **Subtractive iteration works** for prompt-surface defects. Sarah's timeouts collapsed 45% → 10% monotonically. Aisha hit 95% delivery (highest single result of Sprint 25). Three cross-partner patterns emerged with rated transferability — P1 (-62 chars, fetch parenthetical, HIGH), P2 (-31 chars, doc-text precondition, HIGH), P3 (-425 chars, pre-scripted escalation reply, MEDIUM).
2. **Subtractive iteration cannot fix partner-training-bias.** Residual 5-30% NO_ANALYSIS rate held at iter-3 across all three partners. Partners hold a strong prior that "real" documents come via MCP and inline text is provisional. Removing every prompt-surface reference to MCP-fetch reduced but did not eliminate this rate.

Sprint 25's subtractive-only constraint forbids constructive additions to the gate. The negative finding above is unambiguous: closing the residual NO_ANALYSIS gap requires telling the model that inline document text is authoritative source material — a constructive addition. Sprint 26 must decide whether the constraint stands.

## Decision

**Back-port P1+P2+P3 subtractive cuts AND one targeted acknowledgement sentence** to production `ui/desktop/src/components/oscar/oscar-llp/verificationGateBlock.ts`. The constraint relaxation is **targeted at the partner-training-bias defect class only** — not a general license to add.

Concretely:
- **P1** (-62 chars): remove ` (fetched via \`oscar-document-reader\` or pasted by the user)` from the verification-pass invocation sentence.
- **P2** (-31 chars): remove `the relevant document text and ` from the same sentence.
- **P3** (-425 chars): remove the pre-scripted escalation reply template ("> I cannot ground...") and follow-up paragraph. Keep the abstract escalation directive ("after two revisions ... you MUST stop revising and escalate") so the model retains the behavioural trigger without the over-specified template that was being mimicked as an off-ramp.
- **Acknowledgement** (~+280 chars): insert one sentence after the H2 header stating that document text supplied directly in the user message — pasted inline or under a `## Document context` heading — is authoritative source material, equivalent to text returned by `oscar-document-reader`.

Net: ~-238 chars. All 10 partners pick up the change byte-for-byte via the [[ADR-081]] Hybrid 2 composition seam in `buildOscarLLPPartnerRecipe.ts:123-127`.

## Rationale

**Why P1+P2+P3 (subtractive)**: Sprint 25 produced specific empirical evidence per cut.
- P1: Sarah iter-0→iter-1 cut timeouts 45→30%; Diana iter-0→iter-1 cut 15→10%. Effect transfers to all 7 non-trio partners by structural inference (gate is byte-identical across all 10 partners per [[ADR-081]]).
- P2: Diana iter-2→iter-3 cut NO_ANALYSIS 40→10% (recovered the framework-cut regression); Aisha iter-1→iter-2 cut NO_ANALYSIS 25→10% (20pp converted to PARTIAL-with-caveat).
- P3: Aisha iter-2→iter-3 cut NO_ANALYSIS 10→5% AND delivered 65→90% (+25pp — biggest single-cycle improvement in Sprint 25).

**Why the acknowledgement sentence (constructive)**: subtraction can't tell the model what inline text *is*. The training-bias defect is a positive belief ("real documents come via MCP") that subtraction can only erode. Closing the residual 5-30% NO_ANALYSIS rate requires asserting the counter-belief. The acknowledgement does exactly that and nothing more — it is not a feature addition; it is a single sentence shaping the model's interpretation of authoritative source.

**Why "targeted" matters**: Sprint 25's Lavern-style subtractive methodology is the methodological asset. A general license to add would erode it. This ADR is explicit that the acknowledgement is an *exception* justified by ~240 partner-runs of evidence that subtraction provably fails on this specific defect class. Future constructive additions require the same standard of evidence.

## Alternatives rejected

- **Hold subtractive-only (P1+P2+P3, no acknowledgement)**: leaves the 5-30% residual NO_ANALYSIS rate unaddressed. Sprint 25's evidence is explicit that the gap is closeable with one targeted addition. Methodology preservation does not justify leaving evidence on the table.
- **Relax entirely**: drops the Lavern methodology specificity. Sprint 25's investment in subtractive discipline becomes "any addition is fine if we can argue for it" — a much weaker discipline.
- **Exclude P3**: gives up Sprint 25's largest single-cycle delivery improvement. P3 is MEDIUM-transferability (directly observed in only ~3 instances) but the risk (legitimate escalations losing template) is mitigated by removing the over-specified script while keeping the abstract escalation directive. Back-port commit is reversible if a non-trio partner regresses.
- **Land P1+P2 now, P3 later**: defers the decision. Sprint 26 has the validation budget for an empirical pre+post A/B on Marcus Webb that should detect any P3 transferability problem.

## Consequences

- `verificationGateBlock.ts` updated in one commit alongside this ADR. All 10 partners pick up the change byte-for-byte via the composition seam.
- Smoke test gate: `ui/desktop/scripts/test-oscar-llp-agents.js` 3/3 PASS both BEFORE and AFTER — confirms the composition seam still works.
- Empirical validation in Sprint 26 Phase 4 (Sarah iter-0 re-run vs Sprint 25 baseline on disk) and Phase 5 (Marcus Webb pre+post A/B) — outcomes reported at `evals/oscar-llp/reports/sprint-26-back-port-validation.md`.
- Reversal path: single commit revert of the back-port if any non-trio partner regresses on subsequent dogfood. ADR-090 stays as the architectural record of the attempt and the reasoning.
- Future ADR amends if Sprint 26 validation produces a negative finding (no improvement on Sarah, or a regression on Marcus).

## Supersedes

None. Companion to:
- [[ADR-081]] (Hybrid 2 — what gets edited; the byte-identical composition seam this back-port relies on).
- [[ADR-082]] (Sprint 25 interactive iteration shape — the evidence source for P1/P2/P3 + the training-bias negative finding).
- [[ADR-077]] (Sprint 23 eval baseline — the `SPRINT_22_DIRECTIVE` / `RALPH_DIRECTIVE` constants under `evals/lavern-jv/` remain frozen; Sprint 26's back-port to production `verificationGateBlock.ts` is independent of those reproducible-baseline constants).
