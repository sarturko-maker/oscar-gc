# ADR-077 — Sprint 23 Lavern eval baseline + judge + A/B methodology

Status: accepted
Date: 2026-05-20
Sprint: 23

## Context

[[ADR-075]] flagged that Lavern's `evals/jv/` is NOT empty (corrected the ADR-073:71 claim): 28-item RUBRIC (12 + 10 + 7 across three CUAD JV contracts; ADR-075's "12-item" referenced Doc 1 alone — actual total across the three docs is 29), plus three plain-text contracts (borrowmoney, sibannac, veoneer), plus seven versioned EVAL_REPORTs human-scored on gemma2:2b local. Sprint 23 lifts these as Oscar GC's eval baseline. Inspection at lift time: the rubric is structured around Lavern's PIPELINE (Watchman → Reader → precedent-board → Curator on gemma2:2b), not partner-style consultation. The per-doc risk substance transfers; the pipeline metrics do not. Lavern's human scores on gemma2:2b are not directly comparable to MiniMax-M2.5 partner consultation — different model, different role.

## Decision

Copy (not symlink) docs + rubric into `evals/lavern-jv/` per [[ADR-021]] distribution shape. Preserve `RUBRIC.md` verbatim as `RUBRIC.lavern-original.md`. Build `RUBRIC.adapted.md` that keeps the 29 per-doc risk items + Recall/Precision/Hallucination definitions (rescoped to partner findings), drops Watchman / pipeline-specific watching-for items, adds four Oscar-GC global axes scored per `partner × doc × config`: `grounded_citations` (0-1), `verification_pass_cited` (boolean), `revision_behaviour` (boolean | null), `partner_tone_fit` (0-2). Doc 3 also gets `overproduction_flag` (boolean). Lavern human baseline is informational, not a quality gate. Run **3 partners × 3 docs × 2 configs = 18 partner runs + 18 batched judge calls** on real MiniMax-M2.5 (CLAUDE.md "Pipeline tests must NOT mock LLM calls"). Single MiniMax-as-judge prompt at `prompts/judge-system.md`; Zod-validated JSON output; one parse-failure retry. Sprint 22 verification directive frozen as `SPRINT_22_DIRECTIVE` constant in `lib-recipe.js` (Sprint 22 SHA `08a5381a7`) for the without-Ralph leg — decouples eval from live production prompts so the A/B baseline stays reproducible across future sprints.

## Rationale

Copy preserves the eval as a self-contained artifact (ADR-021 distribution shape). Adapting the rubric isolates substance that transfers (risk lists) from substrate that doesn't (pipeline metrics). Lavern human-baseline numbers are informational because (a) model mismatch (gemma2:2b vs MiniMax-M2.5), (b) role mismatch (pipeline vs partner consultation), (c) score-divergence threshold > 0.5 in the brief already pre-aligns with flag-don't-fail. Batched-per-document judge calls (one judge call returns 12 / 10 / 7 verdicts) keep cost low and judge context consistent across the same partner response — per-item calls would 12x the call count for no quality gain. Required `evidence` field per judge verdict grounds calls in partner text, mitigating the COVERED-without-grounding hallucination. Frozen Sprint-22-directive constant keeps the A/B baseline reproducible — production prompts evolve sprint-to-sprint, but the eval's without-Ralph reference stays fixed.

## Alternatives rejected

- **Symlink fixtures from `/srv/projects/lavern/`**: breaks the moment a reviewer clones Oscar GC without Lavern alongside. Violates ADR-021 self-contained-distribution.
- **Per-rubric-item judge calls** (1 call per item per doc per partner = 87+ calls per sweep): 5-12x cost; judge context inconsistent across items for the same response; no quality gain.
- **Build a partner-consultation rubric from scratch instead of adapting Lavern's**: violates ADR-075's lift-not-build commitment; loses Lavern's pre-registered grading discipline; longer Sprint 23.
- **Run only with-Ralph (skip A/B)**: cheaper but loses the substantive Sprint 23 measurement (does gate-and-revise improve grounding?). User selected Full A/B in plan-mode AskUserQuestion.

## Consequences

- New `evals/lavern-jv/` directory tree (docs/, rubric/, prompts/, scripts/, runs/, reports/). `runs/` gitignored; `reports/sprint-23-baseline.md` checked in at sprint close.
- Top-level `NOTICE` gains a "Lavern eval baseline" paragraph (Apache 2.0 attribution + Lavern SHA `7c2efe61524b14c632bee8f14d9bbcbdd85d0cfd`).
- Runner cost envelope ~$1.20 + ~16 min wall-clock against $10/PCM dev-key budget.
- Substantive Sprint 23 test (Δ_grounded with-Ralph vs without-Ralph on grounding-touched items) is gated by this harness. If Δ ≤ 0, that's the signal that [[ADR-076]] Shape A wasn't enough; Sprint 24 reconsiders.
- Two known coverage gaps to flag in the closing report: `oscar-document-reader` not exercised (per ADR-075:32 it ships with placeholder corpus; partners read CUAD docs via user-message paste); doc text passed to `verification-pass` via `delegate()` args is wasteful (per ADR-074 sub-recipes don't inherit parent extensions — Sprint 24 evidence candidate).

## Supersedes

None. Diverges from [[ADR-054]] (Sprint 15 onboarding eval shape — 5 questions × 3 judges × 10 personas) per the "honest scope: pair, not five-by-three-by-ten" framing; Sprint 23 is 3 partners × 3 docs × 2 configs × 1 judge against lifted real-contract fixtures. Companion to [[ADR-075]] (lift policy; carried the 12-item count corrected here to 29) and [[ADR-076]] (Sprint 23 sister piece — the gate the eval measures).
