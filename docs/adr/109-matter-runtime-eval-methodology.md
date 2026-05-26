# ADR-109: Matter-runtime eval methodology

Sprint 32 (2026-05-26). Status: Accepted. Cites [[ADR-077]], [[ADR-082]], [[ADR-101]], [[ADR-104]], [[ADR-106]], [[ADR-107]], [[ADR-108]]. Mirrors [[ADR-077]] for the matter-runtime substrate.

## Context

Sprint 30 ([[ADR-101]]) measured wiring uptake on MiniMax-M2.5 manually (N=1). Sprint 31 ([[ADR-104]]) landed discovery doctrine; Sprint 31A ([[ADR-107]]) found uptake is **model-family-specific** at N=1; Sprint 31B ([[ADR-108]]) refined doctrine, 2/3 fixes took at N=1. Manual N=1 cannot answer "does this work reliably at scale across fixture variations." Sprint 31A's MiniMax `load_skill` non-determinism on identical fixtures already showed N=1 lies.

## Decision

`evals/matter-runtime/` is the substrate every future matter system prompt doctrine change runs through before merging.

- **Scope** — tool-call observation, not legal-substance accuracy. Judge scores affordance uptake (`load_skill`, on-demand playbook reads, `delegate`, redline) against per-scenario expectations.
- **Multi-model standard** — every doctrine A/B runs against MiniMax (primary, N=20) + at least one OpenRouter family at directional N. Sprint 32 uses MiniMax-M2.5 + claude-haiku-4-5; GPT-5.4-mini is the deferred cell. Single-model evaluation is the failure mode Sprint 31A documented.
- **Judging** — Claude Code via Max per [[ADR-082]]. No programmatic judge layer. Doctrine **masked from the judge** — scoring is observable tool-call appropriateness, not adherence to known doctrine. The same CC that authors doctrine has priors; mask keeps verdicts honest.
- **Rubric principle** — observable-only. Distinguishes **invoked** from **invoked correctly** (Sprint 31A lesson: GPT-5.4-mini called `load_skill(name="commercial/rfq-review-playbook.md")` — fired with wrong arg shape). Fields: `skill_arg_correct`, `delegate_strategy` (one_per_item/partition), `redline_succeeded_when_invoked`.
- **N standard** — MiniMax N=20 (quota-bound, not $-bound). OpenRouter N=10 ($-bound). Pre-flight N=5 variance gate mandatory before main spawn — if verdicts disagree on >1 affordance across 5 cycles, the cell's non-determinism is too high for N=20 to discriminate.
- **Provider switch** — [[ADR-106]] env-overridable provider; substrate sets `GOOSE_PROVIDER` / `GOOSE_MODEL` per cell.
- **Spawn primitive** — bundled binary via `ui/desktop/scripts/dogfood-driver.mjs` (matches Sprint 31A/31B substrate). Headless `goose run --recipe` is wrong: matter recipes are renderer-built; the dogfood IPC bridge to `oscar:matters:create` is the right primitive.
- **Cost discipline** — primary on MiniMax (effectively free at sprint scale); secondary within OpenRouter dollar cap. Cost log records dollar-equivalent across both providers for observability.

## Where future doctrine changes plug in

Every matter system prompt doctrine change after Sprint 32 runs as a new variant cell against this substrate. Sprint 33's "act, don't describe" relocation (brief flags moving from doctrine to tool description) is the next candidate.

## Carry-forwards

GPT-5.4-mini cell → Sprint 32b (OpenRouter cost). `single-nda` + `saas-msa-stack` stretch scenarios require new fixture creation → Sprint 33+. Fixture-refresh discipline (avoid house-style pattern recognition by the judge) → Sprint 33+.

Cites: [[ADR-077]], [[ADR-082]], [[ADR-101]], [[ADR-104]], [[ADR-106]], [[ADR-107]], [[ADR-108]].
