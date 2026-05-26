# Sprint 32 — Matter-runtime eval baseline report

Generated: 2026-05-26T16:49:49.379Z
Cells aggregated: 12

Per [[ADR-109]]. Signal-to-noise per affordance per cell.

## Scenario: 30-ndas

| Variant | Model | N | Playbook (fired/N) | Playbook noise | Skill (fired/N) | Skill noise | Skill arg correct | Delegate (fired/N) | Delegate noise | Redline | S2N playbook | S2N skill | S2N delegate |
|---------|-------|---|--------------------|----------------|-----------------|-------------|--------------------|--------------------|----------------|---------|---------------|------------|---------------|
| A | anthropic/claude-haiku-4-5 | 10 | 0/10 | 0/10 | 0/10 | 0/10 | 0/10 | 0/10 | 0/10 | 0/10 | — | — | — |
| A | MiniMax-M2.5 | 20 | 13/20 | 0/20 | 6/20 | 0/20 | 6/20 | 1/20 | 0/20 | 0/20 | 1.00 | 1.00 | 1.00 |
| B | anthropic/claude-haiku-4-5 | 10 | 0/10 | 0/10 | 0/10 | 0/10 | 0/10 | 0/10 | 0/10 | 0/10 | — | — | — |
| B | MiniMax-M2.5 | 20 | 11/20 | 0/20 | 13/20 | 0/20 | 13/20 | 4/20 | 0/20 | 0/20 | 1.00 | 1.00 | 1.00 |

## Scenario: 30-rfq

| Variant | Model | N | Playbook (fired/N) | Playbook noise | Skill (fired/N) | Skill noise | Skill arg correct | Delegate (fired/N) | Delegate noise | Redline | S2N playbook | S2N skill | S2N delegate |
|---------|-------|---|--------------------|----------------|-----------------|-------------|--------------------|--------------------|----------------|---------|---------------|------------|---------------|
| A | anthropic/claude-haiku-4-5 | 10 | 8/10 | 0/10 | 0/10 | 0/10 | 0/10 | 0/10 | 0/10 | 0/10 | 1.00 | — | — |
| A | MiniMax-M2.5 | 20 | 19/20 | 0/20 | 0/20 | 4/20 | 0/20 | 0/20 | 0/20 | 2/20 | 1.00 | 0.00 | — |
| B | anthropic/claude-haiku-4-5 | 10 | 0/10 | 0/10 | 0/10 | 0/10 | 0/10 | 0/10 | 0/10 | 0/10 | — | — | — |
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

Sprint 31B applied three doctrine fixes. Variant A = pre-ADR-108 (Sprint 31 doctrine); Variant B = post-ADR-108. All deltas below are on MiniMax-M2.5 at N=20 each. Haiku data on the A/B contrast is incomplete (3 of 4 Haiku cells broken — see substrate carry-forward below).

### Fix 1 — slug exactness for `load_skill` (Step B addendum)

**Verdict: ✅ HELD AT SCALE on MiniMax NDA**

- `skill_invoked_when_applicable` on `30-ndas`: **A = 6/20 (30%), B = 13/20 (65%)** — **+35pp** lift in skill firing.
- `skill_arg_correct` rate: when fired, both A and B used the canonical `nda-review` slug (6/6 and 13/13). The doctrine's slug-exactness paragraph appears to make the *whether-to-fire* decision easier; it does not alter the *what-slug* decision (MiniMax already chose canonical when firing on variant A).
- Headline Sprint 32 result: fix 1 lifted MiniMax skill uptake on the load-bearing scenario by ~2× at N=20.

### Fix 2 — agent-loop semantics for `delegate` (Step C addendum)

**Verdict: ✅ HELD AT SCALE on MiniMax NDA (small absolute effect, large relative lift)**

- `delegate_used_when_applicable` on `30-ndas`: **A = 1/20 (5%), B = 4/20 (20%)** — **+15pp** lift, 4× relative.
- Absolute fire rate is still low (4/20). Sprint 31A's claim that the MiniMax delegate gap is "model-capability-bound" largely confirmed at scale — but the refined doctrine *does* surface delegate on MiniMax a non-trivial fraction of the time (vs effectively-never pre-fix). Sprint 33 candidate: pair doctrine refinement with tool-side description refinement.

### Fix 3 — "act, don't describe" (cross-cutting section)

**Verdict: ❌ DID NOT HOLD AT SCALE on MiniMax RFQ**

- `redline_invoked_when_asked` on `30-rfq` Turn 5: **A = 2/20 (10%), B = 2/20 (10%)** — **0pp** delta.
- Sprint 31B's manual finding (1/3 cycles missed redline on both variants) reproduces at scale: ~90% of cycles plan the redline in prose and never invoke the batch tool. ADR-108's act-don't-describe paragraph does not reach end-of-flow behavior from its mid-prompt position.
- Sprint 33 candidate confirmed: move "act don't describe" out of doctrine and into the redline tool's surface description (where it fires at the actual decision point).

### Surprise: skill noise on 30-rfq under variant B

**Variant B introduces skill noise on RFQ scenarios.**

- `skill_invoked_when_not_applicable` on `30-rfq`: **A = 4/20 (20%), B = 9/20 (45%)** — variant B fires wrong-skill on 30-rfq 2.25× more often.
- Hypothesis: ADR-108's clearer skill-trigger paragraph makes MiniMax MORE eager to reach for a skill; on RFQ (no canonical skill applies) that translates to wrong-skill noise.
- Sprint 33 candidate: tighten the skill negative guard for non-skill-shaped tasks (a 7-doc RFQ pack is broader than any single skill).

### Negative guards (across both negative scenarios, both variants)

**Verdict: ✅ HELD PERFECTLY at N=80 (2 variants × 2 scenarios × N=20)**

- `playbook_read_on_irrelevant_turn`: 0/80 firings.
- `skill_invoked_when_not_applicable` on the negative scenarios: 0/80 firings.
- `delegate_used_when_not_applicable`: 0/80 firings.
- `redline_invoked_when_asked` on negative scenarios: 0/80 firings.
- Arturs's central over-tuning concern (raised at Sprint 31 brief time) **continues to not materialise**. Discovery doctrine on both variants discriminates positive vs negative scenarios reliably across N=80 negative-scenario cycles.

## Substrate carry-forwards (Sprint 32b candidates)

1. **Haiku pair-send timing bug** — 3 of 4 Haiku cells (30 cycles) produced 0 tool calls because dogfood-driver's pair-send stability detector returned before Haiku's first token. The DOM container count grew on user msg + thinking indicator, satisfying the "2 new turns + stable" break before the agent responded. Fix: stability detector should require last message role = assistant with non-empty content, or read sessions.db directly.
2. **run-matrix model path bug** — extract-cycle was passed unsanitised model name (`anthropic/claude-haiku-4-5` with slash); cycle dirs use `__`. Manual re-extract recovered all 40 Haiku cycles. Fix: sanitise in `cellDir()`.
3. **Per-cycle latency missing from cost log** — cycle wall-clock varied 60s to 5+ min. Recording per-cycle wall clock would let us correlate model latency vs effect sizes.
4. **GPT-5.4-mini cell still deferred** — Sprint 32b candidate; closes the OpenAI-family gap at the price of OpenRouter budget refresh.
5. **Anthropic A/B incomplete** — Sprint 32 has variant-A/Haiku/30-rfq (10 cycles, clean) only. Variant-B Haiku and Haiku 30-ndas need a redo after the pair-send fix.

## Sprint 32 headline

Sprint 32 establishes the matter-runtime eval substrate. Of ADR-108's three doctrine refinements:

| Fix | At N=1 (Sprint 31B) | At N=20 MiniMax (Sprint 32) | Sprint 33 disposition |
|---|---|---|---|
| 1. Slug exactness | took | **✅ took (+35pp on MiniMax NDA skill uptake; 30%→65%)** | Keep; consider extending to other tool-arg shapes |
| 2. Agent-loop semantics for `delegate` | took on GPT, not MiniMax | **✅ partial-took on MiniMax (+15pp; 5%→20%)** | Keep; pair with tool-description refinement to close further |
| 3. Act, don't describe | did not take | **❌ did not take at scale (0pp on redline; held flat at 10%)** | Move to redline tool description; doctrine-from-mid-prompt cannot reach end-of-flow behaviour |

Plus an unexpected fourth finding: variant B introduces +25pp skill noise on RFQ scenarios — the cleaner skill-trigger paragraph makes MiniMax more eager to reach for a skill, which on scenarios where no skill canonically applies translates to wrong-skill firings. Sprint 33 candidate: sharpen the skill negative guard for cross-document review tasks.

Negative guards held perfectly across N=80 negative-scenario cycles. Over-tuning has not materialised.

## Open caveats

- **Haiku 4.5 ≠ Sonnet 4.6** (Sprint 31A/B Anthropic baseline). Cross-sprint Anthropic-cell comparison is directional only — and Sprint 32's Haiku data is further limited by the pair-send bug (only variant-A/Haiku/30-rfq usable).
- **GPT-5.4-mini cell** deferred to Sprint 32b (OpenRouter cost; would close the OpenAI-family gap).
- **Negative scenarios** ran MiniMax-only; Haiku negative-discrimination data TBD in Sprint 32b.
- **MiniMax model** — Sprint 32 used MiniMax-M2.5 via the existing `/root/.minimax-dev-key`. The Token Plan only covers M2.7 per [docs](https://platform.minimax.io/docs/token-plan/intro); cost log records dollar-equivalent at PAYG rates for observability.
- **Wall-clock variance** — cycles ranged from 60s to 5+ min. Smoke-A on variant-A/Haiku/30-ndas took 5+ min for what was later confirmed to be the pair-send bug, not actual model latency. Token Plan quota of 1,500 req/5hr was not noticeably reached at our pace (~25 req/cycle × ~60 cycles/hr ≈ 1,500 req/hr — at the edge but did not throttle within Sprint 32's window).
