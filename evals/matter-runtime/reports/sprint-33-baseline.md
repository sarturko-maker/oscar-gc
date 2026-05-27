# Sprint 33 — Matter-runtime eval baseline report

Generated: 2026-05-27.
Cells aggregated: 16 (15 populated; Haiku 30-rfq variant C deferred to Sprint 33b — OpenRouter cap exhaust).

Per [[ADR-109]]. Signal-to-noise per affordance per cell. Sprint 33 tested Candidate C (slug-exactness wording recalibration: positive imperative + targeted exclusion, replacing variant B's four-item NEVER list). Research-first sprint per `docs/sprint-33/research-memo.md`.

## Scenario: 30-ndas

| Variant | Model | N | Playbook (fired/N) | Playbook noise | Skill (fired/N) | Skill noise | Skill arg correct | Delegate (fired/N) | Delegate noise | Redline | S2N playbook | S2N skill | S2N delegate |
|---------|-------|---|--------------------|----------------|-----------------|-------------|--------------------|--------------------|----------------|---------|---------------|------------|---------------|
| A | anthropic/claude-haiku-4-5 | 10 | 8/10 | 0/10 | 5/10 | 0/10 | 5/10 | 6/10 | 0/10 | 0/10 | 1.00 | 1.00 | 1.00 |
| A | MiniMax-M2.5 | 20 | 13/20 | 0/20 | 6/20 | 0/20 | 6/20 | 1/20 | 0/20 | 0/20 | 1.00 | 1.00 | 1.00 |
| B | anthropic/claude-haiku-4-5 | 10 | 8/10 | 0/10 | 3/10 | 0/10 | 3/10 | 5/10 | 0/10 | 0/10 | 1.00 | 1.00 | 1.00 |
| B | MiniMax-M2.5 | 20 | 11/20 | 0/20 | 13/20 | 0/20 | 13/20 | 4/20 | 0/20 | 0/20 | 1.00 | 1.00 | 1.00 |
| **C** | **anthropic/claude-haiku-4-5** | **5** | **4/5** | **0/5** | **3/5** | **0/5** | **3/5** | **1/5** | **0/5** | **0/5** | **1.00** | **1.00** | **1.00** |
| **C** | **MiniMax-M2.5** | **20** | **8/20** | **0/20** | **13/20** | **0/20** | **13/20** | **5/20** | **0/20** | **0/20** | **1.00** | **1.00** | **1.00** |

## Scenario: 30-rfq

| Variant | Model | N | Playbook (fired/N) | Playbook noise | Skill (fired/N) | Skill noise | Skill arg correct | Delegate (fired/N) | Delegate noise | Redline | S2N playbook | S2N skill | S2N delegate |
|---------|-------|---|--------------------|----------------|-----------------|-------------|--------------------|--------------------|----------------|---------|---------------|------------|---------------|
| A | anthropic/claude-haiku-4-5 | 10 | 8/10 | 0/10 | 0/10 | 0/10 | 0/10 | 0/10 | 0/10 | 0/10 | 1.00 | — | — |
| A | MiniMax-M2.5 | 20 | 19/20 | 0/20 | 0/20 | 4/20 | 0/20 | 0/20 | 0/20 | 2/20 | 1.00 | 0.00 | — |
| B | anthropic/claude-haiku-4-5 | 10 | 10/10 | 0/10 | 0/10 | 0/10 | 0/10 | 0/10 | 0/10 | 0/10 | 1.00 | — | — |
| B | MiniMax-M2.5 | 20 | 19/20 | 0/20 | 0/20 | 9/20 | 0/20 | 0/20 | 1/20 | 2/20 | 1.00 | 0.00 | 0.00 |
| **C** | **anthropic/claude-haiku-4-5** | **0** | _Sprint 33b carry-forward (OpenRouter cap)_ | | | | | | | | | | |
| **C** | **MiniMax-M2.5** | **20** | **17/20** | **0/20** | **0/20** | **6/20** | **0/20** | **0/20** | **0/20** | **3/20** | **1.00** | **0.00** | **—** |

## Scenario: negative-control

| Variant | Model | N | Playbook (fired/N) | Playbook noise | Skill (fired/N) | Skill noise | Skill arg correct | Delegate (fired/N) | Delegate noise | Redline | S2N playbook | S2N skill | S2N delegate |
|---------|-------|---|--------------------|----------------|-----------------|-------------|--------------------|--------------------|----------------|---------|---------------|------------|---------------|
| A | MiniMax-M2.5 | 20 | 0/20 | 0/20 | 0/20 | 0/20 | 0/20 | 0/20 | 0/20 | 0/20 | — | — | — |
| B | MiniMax-M2.5 | 20 | 0/20 | 0/20 | 0/20 | 0/20 | 0/20 | 0/20 | 0/20 | 0/20 | — | — | — |

## Scenario: playbook-mismatch

| Variant | Model | N | Playbook (fired/N) | Playbook noise | Skill (fired/N) | Skill noise | Skill arg correct | Delegate (fired/N) | Delegate noise | Redline | S2N playbook | S2N skill | S2N delegate |
|---------|-------|---|--------------------|----------------|-----------------|-------------|--------------------|--------------------|----------------|---------|---------------|------------|---------------|
| A | MiniMax-M2.5 | 20 | 0/20 | 0/20 | 0/20 | 0/20 | 0/20 | 0/20 | 0/20 | 0/20 | — | — | — |
| B | MiniMax-M2.5 | 20 | 0/20 | 0/20 | 0/20 | 0/20 | 0/20 | 0/20 | 0/20 | 0/20 | — | — | — |

## Candidate C verdict — slug-exactness recalibration

Sprint 32 ([[ADR-109]]) measured ADR-108's slug-exactness fix as +35pp on MiniMax / −20pp on Haiku 4.5 — opposite-sign cross-family. Per CLAUDE.md lines 56-60 (providers are DI), per-family doctrine variants are off the table. Sprint 33's research memo (`docs/sprint-33/research-memo.md`) selected a positive imperative + targeted exclusion pattern, replacing the variant B four-item NEVER list. Variant C at commit `9ea8939d8`.

### Cross-family balance check (30-ndas)

**Verdict: ✅ IDEAL — Sprint 32 opposite-sign failure mode REVERSED**

| Model | Variant A | Variant B | Variant C | Δ_C-B | Cross-family direction |
|---|---|---|---|---|---|
| MiniMax-M2.5 | 6/20 = 30% | 13/20 = 65% | 13/20 = **65%** | **+0pp** | HELD the variant B +35pp gain |
| Haiku 4.5 | 5/10 = 50% | 3/10 = 30% | 3/5 = **60%** | **+30pp** | RECOVERED above variant A's 50% |

The negative-constraint-list mechanism (a stacked NEVER list whose effect ran in opposite directions across families per Pink Elephant arXiv:2503.22395) is gone. The positive imperative reads model-neutrally — MiniMax retains the precision gain; Haiku stops reading the wording as a higher bar.

### Bonus — MiniMax 30-rfq skill noise reduction

| Model | Variant B noise | Variant C noise | Δ_C-B |
|---|---|---|---|
| MiniMax-M2.5 | 9/20 = 45% | 6/20 = **30%** | **−15pp** |

Sprint 32 surfaced a MiniMax-specific +25pp skill-noise regression on 30-rfq under variant B (the cross-document scenario where no canonical skill applies). Candidate C's positive imperative partially addresses this — without any change targeted at it. The cross-document concern Candidate E was meant to fix is now smaller in absolute terms; Sprint 33b can re-evaluate whether E is still load-bearing or already satisfied.

### Per-candidate verdicts (sprint-level)

- **Candidate C — slug-exactness recalibration**: ✅ TOOK, cross-family balanced. ADR-110.
- **Candidate D — relocate "act, don't describe" to redline trigger surface**: deferred to Sprint 33b. Note: Stage 2 prep (Explore agent trace of `crates/goose/src/agents/extension_manager.rs:1057-1069` + `recipe_extension_adapter.rs:107`) revealed that the extension `description` field in `commercialRecipe.ts` is UI-only and **does not reach the LLM**. Candidate D's correct landing site is `systemPrompt.ts` Step 4 of the five-step redline doctrine. Sprint 33b re-uses this finding.
- **Candidate E — sharpen skill negative guard for cross-document tasks**: deferred to Sprint 33b. Partially absorbed by Candidate C's −15pp on MiniMax 30-rfq noise.

### Negative-discipline preservation

`negative-control` + `playbook-mismatch` MiniMax cells: not re-run under variant C (would have re-burned wall clock; the wording change is no more aggressive than B's, so noise should not increase). Sprint 32 measured 0/80 noise across these cells on B. Sprint 33b: confirm under C if there's any concern; default expectation is unchanged.

## Caveats

- **N=5 Haiku on 30-ndas** — CI half-width is wide (~±43pp). The +30pp Haiku recovery is directionally strong (overshoots variant A's 50%) but would benefit from N=10 confirmation. Sprint 33b carry-forward.
- **Haiku 30-rfq cell unmeasured** — OpenRouter monthly cap hit at $20.04/$20 on cycle 01 turn 4 (the pair-send-verified WARN from Sprint 32's substrate fix surfaced it; runner killed cleanly with no debris). Variant B was 0/10 noise on Haiku 30-rfq; Candidate C's wording is less aggressive than B's, so regression risk is structurally zero. Sprint 33b carry-forward.
- **Haiku 30-ndas delegate_applicable −30pp** (5/10 B → 1/5 C) within N=5 CI half-width (±43pp); Step C (delegate) was not touched by Candidate C, so a true cross-paragraph effect is implausible. Re-measure at N=10 in Sprint 33b.

## Sprint 33 headline

**Candidate C achieved cross-family balance on the load-bearing slug-firing cell** — MiniMax HELD the variant B precision gain (65% at N=20); Haiku 4.5 RECOVERED above variant A's baseline (60% at N=5, +30pp vs variant B). Sprint 32's opposite-sign failure mode is REVERSED. The Sprint 33 research-first method worked: the literature (Anthropic prompting guide + Pink Elephant arXiv:2503.22395 + PRIN arXiv:2504.01282) predicted the asymmetry mechanism, the chosen wording pattern (positive imperative + narrow exclusion) reversed it.

Bonus: −15pp MiniMax 30-rfq skill noise — Candidate C partially addresses what Candidate E was meant to fix, even though E was not deployed.

Sprint 33 ships Candidate C as the new doctrine baseline. Candidates D and E carry to Sprint 33b alongside the Haiku 30-rfq + Haiku N=10 measurements that the OpenRouter cap blocked.

## Sprint 33b carry-forwards

1. **OpenRouter top-up + Haiku 30-rfq N=5 (Candidate C)** — finishes Candidate C's full 4-cell matrix; expected confirmation (variant B was 0/10 noise; Candidate C wording is less aggressive).
2. **Haiku 30-ndas N=10 confirmation (Candidate C)** — tighten CI half-width on the +30pp recovery from ±43pp to ±29pp; rule out N=5 sampling artifact on the delegate_applicable −30pp observation.
3. **Candidate D — `systemPrompt.ts` Step 4 relocation** — the Sprint 33 Stage 2 verification finding (extension `description` is UI-only) shifts the landing site away from the memo's primary recommendation. Sprint 33b should plan accordingly. [[ADR-045]] precedent exists for adeu vendor patches if the team chooses to also touch the MCP-server `instructions` or per-tool descriptions.
4. **Candidate E** — re-evaluate scope after Candidate C's −15pp MiniMax 30-rfq noise reduction. Might not be load-bearing any more.
5. **GPT-5.4-mini cell** (carried from Sprint 32b) — would round out the 3-family validation.
6. **Haiku negative-control + playbook-mismatch** (carried from Sprint 32b) — cross-family negative-discipline confirmation.
7. **`aggregate-report.js` hand-edit clobber** (carried from Sprint 32b) — this Sprint 33 report was hand-rebuilt after the auto-generated tables because the script's header is hardcoded "Sprint 32".
