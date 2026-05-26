# ADR-107: Discovery doctrine uptake is model-family-specific, not MiniMax-specific

Sprint 31A (2026-05-26). Status: Accepted. Cites [[ADR-101]], [[ADR-104]]. Drives Sprint 32's multi-model substrate design.

## Context

Sprint 30 ([[ADR-101]]) found three discovery affordances unused on
MiniMax-M2.5: on-demand playbook reads, named-skill invocation
(`load_skill`), batch-parallelism (`delegate`). Sprint 31 ([[ADR-104]])
landed a discovery doctrine that closed the playbook gap but left
`load_skill` + `delegate` as defensible misses. The Sprint 31 carry-
forward asked: are these gaps MiniMax-specific or general?

Sprint 31A measured by running Sprint 31's exact tests against three
models in single cycles (N=1 smoke): MiniMax-M2.5, openai/gpt-5.4-mini
(OpenRouter), anthropic/claude-sonnet-4.6 (OpenRouter).

## Decision

Record the finding: **the two affordances exhibit inverse uptake patterns
across model families.**

| Affordance | MiniMax-M2.5 | gpt-5.4-mini | claude-sonnet-4.6 |
|---|---|---|---|
| `load_skill` | ✅ Test 2 (`nda-review`) | ✅ called but wrong args (used playbook path as slug) | ❌ never invoked |
| `delegate` | ❌ serial batch reads | ❌ serial + heavy file thrash | ✅ 7× `delegate(async=true)` on Test 2; per-NDA subagent with structured rubric |

Sprint 31's "MiniMax-specific" hypothesis was partially right: the
`delegate` gap is shared across MiniMax + GPT-5.4-mini (the same
"many tool calls in one assistant message ≠ parallel" conflation Sprint
31 flagged). But it is **not** structural to Goose, the doctrine, or
the agent loop — Claude reads the same doctrine and delegates cleanly.

Sprint 31's `load_skill` miss on MiniMax was **non-deterministic
single-run variance**: today's MiniMax baseline cycle invoked
`load_skill(name="nda-review")` correctly on Test 2 Turn 1. The miss
in Sprint 31 cycle 3 was N=1 noise.

## Implications

1. **Sprint 32 must run a multi-model matrix** — MiniMax alone would
   under-report `delegate` (looks broken) and over-report `load_skill`
   stability (subject to non-determinism).
2. **Rubric scoring must distinguish "tool invoked correctly" from
   "tool invoked at all"** — GPT-5.4-mini's mis-named `load_skill` is
   half-credit: doctrine fired but agent's arg-construction was off.
3. **Doctrine itself is not the bottleneck.** Sprint 31's three
   paragraphs cover the relevant trigger shapes; Claude reads and
   acts. The remaining gaps are model-capability and tool-description
   issues for non-Claude families.

## Carry-forwards (Sprint 33+ candidates, not Sprint 31A scope)

- **`delegate` doctrine refinement** — the negative guard ("items must
  be read together") may be over-broad on MiniMax + GPT. Sprint 33 can
  test sharper phrasing.
- **`load_skill` arg validation** — the tool's "not found" error could
  suggest the closest slug. GPT-5.4-mini almost found `nda-review` from
  `commercial/rfq-review-playbook.md` (got "did you mean: review?") —
  a one-step closer hint would unblock.
- **Redline tool execution gap** on GPT + Claude (planned but not
  executed). The `process_document_batch` tool description may need
  sharpening for non-MiniMax models, or the doctrine could explicitly
  require the tool call after planning.

## Caveats

- N=1 per model. Verdicts are directional, not statistical. Sprint 32's
  N=20 is the rigorous escalation.
- Sprint 31A used the rebuilt binary post-[[ADR-106]] (matter recipes
  inherit env-provider). The MiniMax baseline (session 20260526_10) is
  not literally Sprint 31 cycle 3 (session 20260526_7) — same fixtures
  and prompts, fresh recipe build, model non-determinism in play.

Cites: [[ADR-082]], [[ADR-101]], [[ADR-104]], [[ADR-106]].
