# Oscar LLP partner-prompt iteration eval (Sprint 25, executes 24-C substrate)

Cross-partner iteration eval harness applying Lavern's subtractive-edit methodology to the Oscar LLP partner roster. The methodology gap Sprint 23 missed — single A/B cycle is not the inheritance from Lavern; **4 iteration cycles of measurable subtractive edits per partner** is — closes here.

Sprint 23's eval (`evals/lavern-jv/`) measured the Sprint 22 Ralph Loop on three CUAD JV contracts. Δ_grounded came in at **-3.8pp** (with-Ralph WORSE than without on grounding-touched items). Sprint 24-C built the harness substrate; Sprint 25 trims the SDK side per [[ADR-082]] (Claude Code interactive rather than `@anthropic-ai/sdk`) and runs the iteration end-to-end.

## Trio

| Partner | Specialism | Benchmark | Source |
|---|---|---|---|
| Sarah Chen | M&A | MAUD (50 instances, N=20 sampled per cycle) | Atticus Project, CC-BY-4.0 |
| Diana Park | Privacy | CUAD privacy clause subset | Atticus Project, CC-BY-4.0 |
| Aisha Khan | Tech Tx | CUAD SaaS clause subset | Atticus Project, CC-BY-4.0 |

**Helena Voss is intentionally NOT in the trio.** Sprint 22's test substrate inline-cast her as Privacy (a bug — production prompt has her as Tax per `ui/desktop/src/components/oscar/oscar-llp/partners.ts:73`). Sprint 24-C swapped to Diana Park (production Privacy partner). See ADR-081 / sprint brief for the call.

**Supplementals deferred** (drop-order positions #1 in original 24-C brief): `legalbench-privacy.json`, `github-saas-tnc.json`. Reactivate only if first-cycle results show benchmark-source overfitting.

## Methodology (Sprint 25 interactive shape, per ADR-082)

Per partner, per iteration cycle (4 cycles per partner: iter-0 baseline + iter-1..3 subtractive edits):

1. **Phase A — partner runs (Node, unattended-in-turn)**: `run-partner-cycle.js` loads the prompt snapshot from `iterations/<partner>/iter-<k>/prompt.txt` (or composes production + verification gate for iter-0), samples N=20 benchmark instances, spawns `goose run --recipe <yaml> --no-session` serially per instance via MiniMax-M2.5, writes transcripts + manifest, emits a `READY-FOR-JUDGE` marker.
2. **Phase B — judging + proposing (Claude Code, in-conversation)**: at the start of every Phase B turn, re-read `prompts/judge-rubric.md` + `prompts/subtractive-system.md` (anti-drift discipline). Read the 20 transcripts + sampled gold labels, judge `COVERED / PARTIAL / MISSED / WRONG` with verbatim evidence quotes, write `iter-<k>/scores.json` (per-instance verdicts + distribution + weakest-slice diagnosis), propose ONE subtractive edit referencing specific transcript IDs, write `iter-<k>/proposal.json` per the schema in `subtractive-system.md`.
3. **Phase C — apply + snapshot (Node)**: `apply-proposal.js` validates `proposal.json` via `lib-subtractive` (Layer B: end > start, no overlaps, net length negative, strict char-subset), applies removals, writes `iter-<k+1>/prompt.txt`, emits unified diff to `iter-<k+1>/diff-from-prior.patch`.

After all 12 cycles complete (3 partners × 4 cycles), **Phase 4 cross-partner pattern extraction** runs in conversation: read all 12 iteration histories, identify failure-mode → fix patterns appearing in ≥2 partners, write `iterations/_cross-partner/pattern-extraction.json` per `prompts/cross-partner-extractor.md` schema. Patterns rated `transferability: high` are candidates for back-port into the shared `verificationGateBlock.ts` (Hybrid 2 architecture per ADR-081).

## Subtractive constraint, three layers

Per the Lavern methodology (Apache 2.0, `AnttiHero/lavern@7c2efe61524b`):

- **Layer A (system prompt)**: `prompts/subtractive-system.md` — "only REMOVALS, never additions/rewrites/replacements". Re-read by me at the start of every proposing turn.
- **Layer B (structural validation)**: `lib-subtractive.js` validates all `end > start`, `sum(end-start) > 0`, resulting prompt is strict char-subset. Invoked by `apply-proposal.js`; non-zero exit on violation.
- **Layer C (diff visualisation)**: each `proposal.json` apply emits `iter-<k+1>/diff-from-prior.patch`. Arturs eyeballs at sprint close. Catches "rewrite disguised as removal" cases.

Rationale: partner prompts (post-Hybrid-2) are 90-130 lines. Lavern's hypothesis — long-context degradation, prompt-soup syndrome, attention-drift on accreted framework sections — predicts cutting noise outperforms adding rules. Sprint 23's Δ_grounded = -3.8pp result (adding the Ralph Loop ~45 lines dropped grounding) is exactly this pattern.

## Pre-execution gates

Run these before any iteration:

1. **MiniMax dev key**: `/root/.minimax-dev-key` (Sprint 22-24 carries the $10/PCM dev key per RUNBOOK).
2. **Hybrid 2 refactor + smoke**: `node ui/desktop/scripts/test-oscar-llp-agents.js` 3/3 PASS post-refactor (confirms composition seam).
3. **Benchmark files populated**: `maud.json` + `cuad-privacy.json` + `cuad-saas.json` each `instances.length ≥ 20`. Phase 1 loaders under `loaders/` produce these.
4. **Sprint 23 sanity check**: `node scripts/sanity-check.js` — re-runs Sprint 23's N=6 Sarah Chen baseline (~$0.30, ~15 min); asserts |new Δ_grounded - (-3.8pp)| ≤ 2pp tolerance. PASS → proceed; FAIL → halt and review (MiniMax drift or substrate change).

**Removed gate (Sprint 25, per ADR-082)**: Anthropic API key. Judging happens in-conversation under the Max subscription; no SDK call needed.

## Cost budget

| Component | Estimate |
|---|---:|
| MiniMax partner runs (3 partners × 4 cycles × 20 instances × ~$0.05) | ~$12 |
| Sprint 23 sanity check | ~$0.30 |
| Phase B judging + proposing | $0 (Claude Code, in-conversation) |
| Phase 4 cross-partner extraction | $0 (Claude Code, in-conversation) |
| **Total live spend** | **~$12.30** |

Against the $10/PCM MiniMax dev-key cap. Cap risk: cumulative spend tracks toward the cap mid-execution; fallback per drop-order is to throttle cycles 4 → 3 per partner before exhausting headroom.

## Drop-order (mid-execution scope cuts)

Per brief: **protect methodology investment over partner coverage**:

1. LegalBench-Privacy + GitHub-SaaS-T&C loaders (already deferred at brief level)
2. Reduce iteration cycles 4 → 3 per partner (iter-0 + iter-1 + iter-2 only)
3. Drop Phase 4 cross-partner extractor (iteration trajectories alone are publishable; extraction becomes Sprint 26)
4. Trio → single partner (Sarah Chen on MAUD only)

## Run instructions

```bash
# 1. (Once per sprint) — Phase 1: populate benchmarks
node evals/oscar-llp/loaders/maud-loader.js
node evals/oscar-llp/loaders/cuad-loader.js --clause-types data-privacy
node evals/oscar-llp/loaders/cuad-loader.js --clause-types saas

# 2. (Once per sprint) — Phase 2: sanity check (gates iteration)
node evals/oscar-llp/scripts/sanity-check.js

# 3. (Per partner per cycle) — Phase 3A: partner runs
node evals/oscar-llp/scripts/run-partner-cycle.js --partner sarah-chen --cycle 0

# 4. (Per partner per cycle) — Phase 3B: Claude Code reads transcripts,
#    writes iterations/<partner>/iter-<k>/scores.json + proposal.json
#    directly via Read/Write/Edit. No script invocation here.

# 5. (Per partner per cycle) — Phase 3C: apply the proposal
node evals/oscar-llp/scripts/apply-proposal.js --partner sarah-chen --cycle 0

# Repeat 3A → 3B → 3C for each cycle k in (0..3) per partner.

# 6. (Sprint close) — Phase 4 cross-partner extraction is done in conversation,
#    writing iterations/_cross-partner/pattern-extraction.json directly.

# Output: evals/oscar-llp/iterations/<partner>/iter-<n>/
#         evals/oscar-llp/iterations/_cross-partner/pattern-extraction.json
#         evals/oscar-llp/reports/sprint-25-iteration-results.md (sprint close)
```

## Critical files

- [`scripts/run-partner-cycle.js`](scripts/run-partner-cycle.js) — Phase A spawner (Node)
- [`scripts/apply-proposal.js`](scripts/apply-proposal.js) — Phase C subtractive applier (Node)
- [`scripts/sanity-check.js`](scripts/sanity-check.js) — Sprint 23 baseline re-run gate
- [`scripts/lib-recipe24.js`](scripts/lib-recipe24.js) — partner-recipe builder reading per-iteration snapshot
- [`scripts/lib-benchmarks.js`](scripts/lib-benchmarks.js) — MAUD / CUAD format adapters
- [`scripts/lib-subtractive.js`](scripts/lib-subtractive.js) — removals validator + unified-diff emitter
- [`scripts/lib-report24.js`](scripts/lib-report24.js) — trajectory + closing report
- [`scripts/lib-cost-log.js`](scripts/lib-cost-log.js) — MiniMax dollar accumulator
- [`prompts/subtractive-system.md`](prompts/subtractive-system.md) — Layer A subtractive constraint (re-read each Phase B turn)
- [`prompts/judge-rubric.md`](prompts/judge-rubric.md) — per-partner judge instructions (re-read each Phase B turn)
- [`prompts/cross-partner-extractor.md`](prompts/cross-partner-extractor.md) — Phase 4 schema + framing (re-read at sprint close)
- `loaders/maud-loader.js`, `loaders/cuad-loader.js` — Phase 1 benchmark population (Sprint 25 deliverables)

## References

- ADR-082 (Sprint 25 interactive iteration shape)
- ADR-079, ADR-080, ADR-081 (Sprint 24-B/C decisions)
- ADR-076, ADR-077 (Sprint 23 Ralph Loop + eval baseline)
- ADR-074 (Sprint 22 Path A sub-recipe inheritance)
- Lavern repo @ `7c2efe61524b14c632bee8f14d9bbcbdd85d0cfd` (Apache 2.0)
- MAUD: https://www.atticusprojectai.org/maud
- CUAD: https://www.atticusprojectai.org/cuad
- MEMORY: `feedback_max_subscription_means_interactive` — why Sprint 24-C's SDK shape was wrong
