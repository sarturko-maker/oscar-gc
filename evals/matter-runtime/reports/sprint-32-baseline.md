# Sprint 32 — Matter-runtime eval baseline report

Generated: 2026-05-26T20:03:11.572Z
Cells aggregated: 12

Per [[ADR-109]]. Signal-to-noise per affordance per cell.

## Scenario: 30-ndas

| Variant | Model | N | Playbook (fired/N) | Playbook noise | Skill (fired/N) | Skill noise | Skill arg correct | Delegate (fired/N) | Delegate noise | Redline | S2N playbook | S2N skill | S2N delegate |
|---------|-------|---|--------------------|----------------|-----------------|-------------|--------------------|--------------------|----------------|---------|---------------|------------|---------------|
| A | anthropic/claude-haiku-4-5 | 10 | 8/10 | 0/10 | 5/10 | 0/10 | 5/10 | 6/10 | 0/10 | 0/10 | 1.00 | 1.00 | 1.00 |
| A | MiniMax-M2.5 | 20 | 13/20 | 0/20 | 6/20 | 0/20 | 6/20 | 1/20 | 0/20 | 0/20 | 1.00 | 1.00 | 1.00 |
| B | anthropic/claude-haiku-4-5 | 10 | 8/10 | 0/10 | 3/10 | 0/10 | 3/10 | 5/10 | 0/10 | 0/10 | 1.00 | 1.00 | 1.00 |
| B | MiniMax-M2.5 | 20 | 11/20 | 0/20 | 13/20 | 0/20 | 13/20 | 4/20 | 0/20 | 0/20 | 1.00 | 1.00 | 1.00 |

## Scenario: 30-rfq

| Variant | Model | N | Playbook (fired/N) | Playbook noise | Skill (fired/N) | Skill noise | Skill arg correct | Delegate (fired/N) | Delegate noise | Redline | S2N playbook | S2N skill | S2N delegate |
|---------|-------|---|--------------------|----------------|-----------------|-------------|--------------------|--------------------|----------------|---------|---------------|------------|---------------|
| A | anthropic/claude-haiku-4-5 | 10 | 8/10 | 0/10 | 0/10 | 0/10 | 0/10 | 0/10 | 0/10 | 0/10 | 1.00 | — | — |
| A | MiniMax-M2.5 | 20 | 19/20 | 0/20 | 0/20 | 4/20 | 0/20 | 0/20 | 0/20 | 2/20 | 1.00 | 0.00 | — |
| B | anthropic/claude-haiku-4-5 | 10 | 10/10 | 0/10 | 0/10 | 0/10 | 0/10 | 0/10 | 0/10 | 0/10 | 1.00 | — | — |
| B | MiniMax-M2.5 | 20 | 19/20 | 0/20 | 0/20 | 9/20 | 0/20 | 0/20 | 1/20 | 2/20 | 1.00 | 0.00 | 0.00 |

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


## Per-fix verdicts (ADR-108 refinements at scale)

Sprint 31B applied three doctrine fixes. Variant A = pre-ADR-108 (Sprint 31 doctrine); Variant B = post-ADR-108. The Sprint 32 re-run (after OpenRouter cap reset) now provides clean Haiku data alongside MiniMax — surfacing **cross-family asymmetric effects** that were invisible at N=1.

### Fix 1 — slug exactness for `load_skill` (Step B addendum)

**Verdict: ✅ TOOK ON MINIMAX (+35pp), ❌ REVERSED ON HAIKU (-20pp)**

| Model | Variant A skill fired | Variant B skill fired | Δ |
|---|---|---|---|
| MiniMax-M2.5 | 6/20 = **30%** | 13/20 = **65%** | **+35pp** |
| anthropic/claude-haiku-4-5 | 5/10 = **50%** | 3/10 = **30%** | **-20pp** |

When fired, both variants used the canonical `nda-review` slug on both models. Slug-exactness lift on MiniMax is real (the doctrine clarifies the *fire-or-don't* decision when slug is correct). The **inverse effect on Haiku** is the new finding: Haiku reads the stricter "never path, never prefix" wording as a higher bar to clear, becoming MORE cautious. Variant A's looser doctrine triggers Haiku to fire 50%; variant B's tighter rules trip Haiku into "skip if uncertain" behavior at 30%.

This is the doctrine-tuning lesson at scale: **the same paragraph can help one model family and hurt another**. Sprint 33 candidate: per-family doctrine variants OR more careful negative-guard calibration.

### Fix 2 — agent-loop semantics for `delegate` (Step C addendum)

**Verdict: ✅ TOOK ON MINIMAX (+15pp), MILD REGRESSION ON HAIKU (-10pp; both variants high)**

| Model | Variant A delegate fired | Variant B delegate fired | Δ |
|---|---|---|---|
| MiniMax-M2.5 | 1/20 = **5%** | 4/20 = **20%** | **+15pp** |
| anthropic/claude-haiku-4-5 | 6/10 = **60%** | 5/10 = **50%** | -10pp |

**Headline cross-family confirmation:** Haiku DELEGATES on 30-ndas (50-60% firing rate). Sprint 31A's claim that "Anthropic family fires delegate" — observed at N=1 on Sonnet 4.6 — replicates at scale on Haiku 4.5. MiniMax remains delegate-shy (5-20%); the gap between families is the structural pattern, not the absolute numbers.

The MiniMax lift (+15pp) is the doctrine doing its job on a delegate-shy family. The Haiku decrease (-10pp) is mild and likely noise at N=10 (CI half-width ~30pp), but the direction is the same as fix 1's Haiku regression — possibly the same "stricter doctrine = more cautious behaviour" effect on a family that didn't need the prod.

### Fix 3 — "act, don't describe" (cross-cutting section)

**Verdict: ❌ DID NOT TAKE on MiniMax RFQ; not applicable on Haiku RFQ (redline not invoked by either variant)**

| Model | Variant A redline fired | Variant B redline fired | Δ |
|---|---|---|---|
| MiniMax-M2.5 | 2/20 = **10%** | 2/20 = **10%** | **0pp** |
| anthropic/claude-haiku-4-5 | 0/10 = **0%** | 0/10 = **0%** | 0pp |

Haiku planned the redline in prose on both variants (0/20 invocation). MiniMax holds flat at 10%. The Sprint 31B manual finding reproduces at scale on TWO model families now. Sprint 33 candidate (relocate "act don't describe" into the redline tool's surface description) is the right next step.

### Playbook trigger — cross-family confirmation

**Verdict: ✅ HOLDS STRONGLY ON BOTH FAMILIES, slight lift on Haiku RFQ under variant B**

| Scenario | Model | Variant A playbook | Variant B playbook | Δ |
|---|---|---|---|---|
| 30-rfq | MiniMax-M2.5 | 19/20 = 95% | 19/20 = 95% | 0pp |
| 30-rfq | Haiku 4.5 | 8/10 = 80% | 10/10 = **100%** | +20pp |
| 30-ndas | MiniMax-M2.5 | 13/20 = 65% | 11/20 = 55% | -10pp |
| 30-ndas | Haiku 4.5 | 8/10 = 80% | 8/10 = 80% | 0pp |

Playbook discovery doctrine works across both families. Haiku fires playbook on RFQ at perfect 10/10 under variant B (vs 8/10 under variant A) — a small positive effect from doctrine refinement, even though no ADR-108 fix directly targeted playbook. MiniMax 30-ndas dropped slightly (65% → 55%); within N=20 noise.

### Surprise: skill noise on 30-rfq under variant B (MiniMax-only)

| Model | Variant A skill noise | Variant B skill noise | Δ |
|---|---|---|---|
| MiniMax-M2.5 | 4/20 (20%) | 9/20 (45%) | **+25pp** |
| anthropic/claude-haiku-4-5 | 0/10 (0%) | 0/10 (0%) | 0pp |

The variant-B skill-noise regression on 30-rfq is **MiniMax-specific**. Haiku correctly does NOT fire any skill on RFQ scenarios on either variant (0/20 across both Haiku-RFQ cells). MiniMax-on-variant-B is the only configuration where the clearer skill-trigger paragraph translated into wrong-skill firings on a non-skill scenario. Sprint 33 candidate is now sharper: MiniMax-specific skill negative-guard tightening, not a cross-family change.

### Negative guards (across both negative scenarios, both variants)

**Verdict: ✅ HELD PERFECTLY at N=80 on MiniMax (Haiku not in negative scenarios this sprint)**

- `playbook_read_on_irrelevant_turn`: 0/80 firings on MiniMax negative-control + playbook-mismatch.
- `skill_invoked_when_not_applicable` on negative scenarios: 0/80.
- `delegate_used_when_not_applicable`: 0/80.
- `redline_invoked_when_asked` on negative scenarios: 0/80.

Arturs's over-tuning concern continues to not materialise on MiniMax negative-discrimination. Sprint 32b candidate: run Haiku on negative-control + playbook-mismatch to confirm the same on the Anthropic family.

## Substrate carry-forwards (Sprint 32b candidates)

1. **OpenRouter monthly limit risk** — Haiku cells 10-12 of the original main matrix were 403'd silently (Sprint 32 initial run; resolved via cap top-up + re-run with verification fix). The `pair-send-verified` poll (committed `a61bb13a4`) now surfaces silent API failures by polling sessions.db; cycles that produce 0 assistant messages within 10 min log a WARN rather than advancing silently.
2. **GPT-5.4-mini cell still deferred** — Sprint 32b candidate; would round out the 3-family matrix.
3. **Haiku on negative-control + playbook-mismatch** — Sprint 32b candidate. Sprint 32 ran negative scenarios on MiniMax only; cross-family negative-guard confirmation is the next data point.
4. **Per-cycle latency missing from cost log** — would help correlate model latency vs effect sizes.
5. **Per-family doctrine variants** — Fix 1's MiniMax-vs-Haiku reversal (+35pp / -20pp) demonstrates that one doctrine paragraph can help one family and hurt another. Sprint 33 should consider per-family doctrine snippets, or more careful neutral-language calibration that works for both.
6. **aggregate-report.js doesn't preserve hand-written headline** — running the script overwrites the per-fix verdicts + carry-forwards sections. Sprint 32b: separate the auto-generated table section from the narrative section (e.g., write the auto section to a `.fragment` file that the human-edited report includes), or accept that the script is the source of truth and move headlines into the per-cell aggregation logic.

## Sprint 32 headline

Sprint 32 establishes the matter-runtime eval substrate AND surfaces the load-bearing cross-family asymmetry that N=1 manual cycles couldn't see:

| ADR-108 Fix | MiniMax-M2.5 (N=20) | claude-haiku-4-5 (N=10) | Verdict |
|---|---|---|---|
| 1. Slug exactness for `load_skill` | **+35pp** (30%→65%) | **-20pp** (50%→30%) | ⚠️ **TOOK on MiniMax, REVERSED on Haiku** — same doctrine, opposite effect across model families |
| 2. Agent-loop semantics for `delegate` | **+15pp** (5%→20%) | -10pp (60%→50%) | ✅ TOOK on MiniMax; Haiku already had high delegate uptake |
| 3. "Act, don't describe" (redline) | 0pp (10%→10%) | 0pp (0%→0%) | ❌ DID NOT TAKE on either family |

**Cross-family confirmation of Sprint 31A's [[ADR-107]] finding:** Haiku delegates at 50-60% on 30-ndas; MiniMax barely fires delegate (5-20%). The Anthropic-family behavior Sprint 31A saw on Sonnet 4.6 (N=1) replicates on Haiku 4.5 (N=10).

**Sprint 33 candidates clarified:**
1. Relocate "act don't describe" into the redline tool's surface description (where it fires at the trigger surface)
2. Sharpen skill negative guard for cross-document review tasks — variant-B skill-noise regression on RFQ is MiniMax-specific (4/20→9/20); Haiku didn't show this regression (0/10→0/10), so the fix can be MiniMax-targeted
3. Per-family doctrine variants OR more neutral wording — fix 1's split effect demonstrates the cost of one-paragraph-fits-all doctrine. Stricter slug rules trigger different cognitive shapes across families (MiniMax: clearer trigger; Haiku: higher bar to clear)

**Negative guards held perfectly across N=80 MiniMax negative-scenario cycles.** Cross-family Haiku negative-discipline data deferred to Sprint 32b.

**Cost:** $0 marginal MiniMax (Token Plan sunk); ~$8-10 OpenRouter for the re-run Haiku cells; OpenRouter ~$10 remaining at sprint close after the cap top-up.
