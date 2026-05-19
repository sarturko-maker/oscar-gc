# ADR-056 — Regulatory-fit eval axis + per-persona answer-keys

Status: accepted
Date: 2026-05-19
Sprint: 16

## Context

Sprint 15's coverage rubric (`scripts/dogfood/sprint-15/judge-prompts/coverage.md`, ADR-054) scored framework *presence* across 7 dimensions, not industry-*fit*. Daniel Okafor iter-1 missed REACH/WEEE/RoHS/UKCA/Modern Slavery/Late Payment in `regulatory_baseline`, yet scored 5/5 coverage because the rubric only checked that `frameworks[]` was populated. The rubric let the bug hide. Iter-2 surfaced the same dynamic: coverage stayed 4.50 while regulatory hypothesis quality regressed in places.

Arturs's brief: *"Sprint 15's coverage axis rewarded 'framework count' and gave Arturs's persona 5/5 even though the hypothesis missed REACH entirely. New rubric should reward industry-specificity, not framework count."*

The system that produced the failure (MiniMax) is also what judges the eval — same-Eurocentric-bias risk. Arturs's direction: *"There are no judges — one LLM for now."* The defense against single-model bias must be structural — human-authored ground truth, not a multi-model judge layer.

## Decision

**Add a fourth eval axis: `regulatory-fit`.** Coverage stays a presence axis; regulatory-fit measures whether the captured frameworks fit the persona's industry × geography × practice areas, against a human-authored per-persona answer-key.

**New judge prompt** at `scripts/dogfood/sprint-15/judge-prompts/regulatory-fit.md` — reads `persona.regulatory_answer_key`, compares against captured `regulatory_baseline.frameworks[]`, scores 0–5.

**Per-persona answer-key schema** — new field `regulatory_answer_key` on each persona JSON (sibling to existing `regulatory_seed`):
```json
"regulatory_answer_key": [
  {"id": "uk-reach", "label": "UK REACH (chemicals / restricted substances)", "tier": "load-bearing"},
  {"id": "incoterms-2020", "label": "Incoterms 2020", "tier": "nice-to-have"}
]
```
The `regulatory_seed` = what the persona *says* if asked. The `regulatory_answer_key` = what the agent *should capture* given industry × geography × practice areas (a stricter superset). Quiet-Lawyer's answer-key is `[]` with sentinel `"_decline_expected": true` — full marks for a null-faithful capture.

**Coverage deconfliction** — edits to `coverage.md`:
- Dimension 3 reword: *"Regulatory baseline — that `frameworks[]` is populated, `captured_via` set, provenance/confidence recorded per framework. Industry-fit is judged separately on the regulatory-fit axis — do NOT double-penalise here."*
- Add: *"Coverage is a presence axis. Industry-mismatched but populated regulatory_baseline is a regulatory-fit failure, not a coverage failure."*

**Pass criterion update** (encoded in `aggregate-scores.mjs`):
- Mean coverage ≥ 4.0
- Mean efficiency ≥ 4.0
- Mean downstream-briefing ≥ 4.0
- **Mean regulatory-fit ≥ 4.0** *(new)*
- No individual cell < 3.0 (any axis)
- **No persona regulatory-fit < 3.0** *(new — per-persona floor on the bug-detection axis)*

**7th persona** — `personas/arturs-industrial-eu.json` added: UK+IE+DE+FR industrial-cable distribution mirroring Arturs's dogfood scenario; load-bearing answer-key entries include UK REACH + EU REACH, RoHS, WEEE, UKCA + CE marking, Modern Slavery Act, Late Payment (UK + DE BGB §271a), German LkSG / EU CSDDD. This persona closes E2 in the synthetic eval.

## Rationale

- **Same-LLM-judge bias defended structurally.** A MiniMax judge that doesn't know REACH still can't score regulatory-fit 5/5 because the answer-key forces the comparison. Human ground truth, not model knowledge, is the rubric.
- **Coverage stays orthogonal.** Two axes for two different failure modes — *capture* (coverage) vs *fit* (regulatory-fit) — let iter-N self-assessment surface which kind of failure is happening.
- **Per-persona floor is load-bearing.** Mean ≥4.0 can mask one persona scoring 1.0 — exactly the Daniel-Okafor-iter-1 shape. The floor catches structural misses that the mean averages out.
- **Tier system over binary.** `load-bearing` vs `nice-to-have` lets the rubric penalise structural misses harder than incidental gaps. A persona missing UK REACH (load-bearing) hurts more than missing Incoterms 2020 (nice-to-have).
- **One LLM for now** (per Arturs). Multi-model judge layer is a Sprint 17+ question. Sprint 16 defends via the answer-keys.

## Consequences

- All 6 existing personas need `regulatory_answer_key` authored. One-day task at Phase 1 implementation.
- `aggregate-scores.mjs` adds the new axis + new pass criterion + per-persona floor check.
- `run-intake-eval.mjs` runs four judges per persona (was three).
- `arturs-industrial-eu.json` is the synthetic stand-in for Arturs's manual dogfood persona; useful regardless of whether Stage 2 dogfood signs off, because it captures the exit-criterion E2 scenario in CI.
- Iter-3 eval (Phase 4 in Sprint 16) is the first run under the new rubric.

## Supersedes

Amends ADR-054 (eval harness pass criteria + persona JSON schema). ADR-054 text unchanged per ADR rules; this ADR is the new decision-of-record for the pass criterion and persona format.
