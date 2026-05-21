# Oscar LLP partner-prompt iteration eval (Sprint 24-C)

Cross-partner iteration eval harness applying Lavern's subtractive-edit methodology to the Oscar LLP partner roster. The methodology gap Sprint 23 missed — single A/B cycle is not the inheritance from Lavern; **4-6 iteration cycles of measurable subtractive edits** is — closes here.

Sprint 23's eval (`evals/lavern-jv/`) measured the Sprint 22 Ralph Loop on three CUAD JV contracts. Δ_grounded came in at **-3.8pp** (with-Ralph WORSE than without on grounding-touched items). The Sprint 23 closing report ([`../lavern-jv/reports/sprint-23-baseline.md`](../lavern-jv/reports/sprint-23-baseline.md)) called for Sprint 24 to reconsider shape. Sprint 24-C does this via iteration, not A/B.

## Trio

| Partner | Specialism | Benchmark | Source |
|---|---|---|---|
| Sarah Chen | M&A | MAUD (50 instances, N=20 sampled per cycle) | Atticus Project, CC-BY-4.0 |
| Diana Park | Privacy | CUAD privacy clause subset (+ optional LegalBench-Privacy supplement) | Atticus Project, CC-BY-4.0 + Stanford LegalBench, MIT |
| Aisha Khan | Tech Tx | CUAD SaaS clause subset (+ optional public GitHub T&C supplement) | Atticus Project, CC-BY-4.0 |

**Helena Voss is intentionally NOT in the trio.** Sprint 22's test substrate inline-cast her as Privacy (a bug — production prompt has her as Tax per `ui/desktop/src/components/oscar/oscar-llp/partners.ts:73`). Sprint 24-C swaps to Diana Park (production Privacy partner). See ADR-081 / sprint brief for the call.

## Methodology

Per partner, per iteration cycle (4 cycles per partner: iter-0 baseline + iter-1..3 subtractive edits):

1. Load partner prompt snapshot from `iterations/<partner>/iter-<k-1>/prompt.ts` (or production for iter-0).
2. Sample N=20 benchmark instances; build per-instance partner recipe.
3. Invoke real MiniMax-M2.5 via `goose run --recipe <yaml> --no-session` for each instance.
4. Single batched Claude (Opus 4.7) call: read all 20 transcripts + gold labels; emit per-instance verdicts (COVERED/PARTIAL/MISSED/WRONG); identify lowest-performing slice; propose a **subtractive** edit (removals only — character-range deletions; NEVER additions/rewrites/replacements).
5. Validate the proposal (`lib-subtractive.js`): net diff length strictly negative; resulting prompt is a strict character subset of the source.
6. Apply removals, persist new snapshot to `iterations/<partner>/iter-<k>/prompt.ts`.

After all 12 cycles complete (3 partners × 4 cycles), Phase 2 cross-partner pattern extraction: one Claude call concatenating all iteration histories identifies patterns appearing in ≥2 partners. Patterns rated `transferability: high` are candidates for back-port into the shared `verificationGateBlock.ts` (Hybrid 2 architecture per ADR-081).

## Subtractive constraint, three layers

Per the Lavern methodology (Apache 2.0, `AnttiHero/lavern@7c2efe61524b`):

- **Layer A (system prompt)**: subtractive-system.md is verbatim "only REMOVALS, never additions/rewrites/replacements".
- **Layer B (structural validation)**: `lib-subtractive.js` validates: all `end > start`, `sum(end-start) > 0` deleted, resulting prompt is strict char-subset. One retry on validation fail; then human-review halt.
- **Layer C (diff visualisation)**: each `proposal.json` carries a unified diff (`diff -u`). Arturs eyeballs at sprint close. Catches "rewrite disguised as removal" cases.

Rationale: partner prompts (post-Hybrid-2) are 90-130 lines. Lavern's hypothesis — long-context degradation, prompt-soup syndrome, attention-drift on accreted framework sections — predicts cutting noise outperforms adding rules. Sprint 23's Δ_grounded = -3.8pp result (adding the Ralph Loop ~45 lines dropped grounding) is exactly this pattern.

## Pre-execution gates

Run these before any iteration:

1. **Anthropic API key**: `/root/.anthropic-dev-key` (chmod 600), env-var override `ANTHROPIC_API_KEY`. Max subscriptions don't issue API keys — confirm pay-as-you-go API key available.
2. **MiniMax dev key**: `/root/.minimax-dev-key` (Sprint 22-24 carries the $10/PCM dev key per RUNBOOK).
3. **Hybrid 2 refactor + smoke**: `test-oscar-llp-agents.js` 3/3 PASS post-refactor (confirms composition seam).
4. **Sprint 23 sanity check**: `node evals/oscar-llp/scripts/sanity-check.js` — re-runs Sprint 23's N=6 Sarah Chen baseline (~$0.30, ~15 min); asserts |new Δ_grounded - (-3.8pp)| ≤ 2pp tolerance. PASS → proceed; FAIL → halt and Arturs reviews (MiniMax drift or substrate change).

## Cost budget

| Component | Estimate |
|---|---:|
| Anthropic (3 partners × 4 cycles × 1 batched Claude call with caching) | ~$14.50 |
| MiniMax partner runs (60/cycle × 4 cycles × 3 partners = 720 runs @ ~$0.05) | ~$36 |
| Sprint 23 sanity check | ~$0.50 |
| Phase 2 cross-partner extraction | ~$0.75 |
| **Total** | **~$52** |

Sprint envelope: $60-100 (per brief). Fallback if budget tightens: Sonnet 4.6 for in-cycle proposals; Opus 4.7 reserved for iter-0 baseline + Phase 2.

## Drop-order (mid-execution scope cuts)

Per brief: **protect (C) eval over (B) pipeline**. Within (C):

1. Drop GitHub SaaS T&C corpus (Aisha supplemental).
2. Drop LegalBench Privacy (Diana supplemental).
3. Reduce iteration cycles 3 → 2 per partner.
4. Drop Phase 2 cross-partner extractor (iteration trajectories alone are publishable).
5. Trio → single partner (Sarah Chen on MAUD only).

## Run instructions

```bash
# 1. Install dev deps (one-time)
cd evals/oscar-llp
npm install                              # picks up @anthropic-ai/sdk

# 2. Sanity check (gates iteration)
node scripts/sanity-check.js

# 3. Single partner smoke (iter-0 baseline only)
node scripts/run-iteration.js --partner sarah-chen --cycles 0

# 4. Full sprint
node scripts/run-iteration.js --all

# Output: evals/oscar-llp/iterations/<partner>/iter-<n>/
#         evals/oscar-llp/reports/sprint-24-c-iteration-baseline.md (sprint close)
```

## Critical files

- [`scripts/run-iteration.js`](scripts/run-iteration.js) — orchestrator
- [`scripts/sanity-check.js`](scripts/sanity-check.js) — Sprint 23 baseline re-run gate
- [`scripts/lib-claude.js`](scripts/lib-claude.js) — Anthropic SDK wrapper with prompt caching
- [`scripts/lib-recipe24.js`](scripts/lib-recipe24.js) — partner-recipe builder reading per-iteration snapshot
- [`scripts/lib-benchmarks.js`](scripts/lib-benchmarks.js) — MAUD/CUAD/LegalBench format adapters
- [`scripts/lib-subtractive.js`](scripts/lib-subtractive.js) — removals validator + unified-diff emitter
- [`scripts/lib-report24.js`](scripts/lib-report24.js) — trajectory report + Phase 2 extractor
- [`scripts/lib-cost-log.js`](scripts/lib-cost-log.js) — token + dollar accumulator
- [`prompts/subtractive-system.md`](prompts/subtractive-system.md) — Layer A subtractive constraint
- [`prompts/judge-rubric.md`](prompts/judge-rubric.md) — per-partner judge instructions
- [`prompts/cross-partner-extractor.md`](prompts/cross-partner-extractor.md) — Phase 2 prompt

## References

- ADR-079, ADR-080, ADR-081 (Sprint 24-B/C decisions at decision time)
- ADR-076, ADR-077 (Sprint 23 Ralph Loop + eval baseline)
- ADR-074 (Sprint 22 Path A sub-recipe inheritance)
- Lavern repo @ `7c2efe61524b14c632bee8f14d9bbcbdd85d0cfd` (Apache 2.0)
- MAUD: https://www.atticusprojectai.org/maud
- CUAD: https://www.atticusprojectai.org/cuad
- LegalBench: https://hazyresearch.stanford.edu/legalbench/
