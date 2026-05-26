# ADR-108: Three doctrine refinements — slug exactness, agent-loop semantics, act-don't-describe

Sprint 31B (2026-05-26). Status: Accepted. Cites [[ADR-104]], [[ADR-107]]. Extends Sprint 31's discovery doctrine in response to Sprint 31A's cross-model findings.

## Context

Sprint 31A ([[ADR-107]]) ran the Sprint 31 doctrine against three models
(MiniMax-M2.5, openai/gpt-5.4-mini, anthropic/claude-sonnet-4.6) and
surfaced three specific failure modes:

1. **Skill-slug mis-naming on GPT-5.4-mini** — called
   `load_skill(name="commercial/rfq-review-playbook.md")` (the playbook
   path as the skill name). The tool returned "not found, did you mean:
   review?" — the agent had the right intent, the wrong argument shape.

2. **Delegate vs many-tool-calls conflation on MiniMax + GPT-5.4-mini** —
   both said "I'll read these in parallel" in their thinking, then issued
   10 `redline__read_docx` calls in a single assistant message. The agent
   loop processes those serially. Neither model invoked `delegate`. Claude
   Sonnet 4.6 invoked `delegate` 7 times on the same task — confirming the
   semantic exists, the doctrine just doesn't name it for the models that
   need it spelled out.

3. **Plan-in-prose-then-stop on GPT-5.4-mini + Claude (Test 1 Turn 5)** —
   both announced redline batches ("Batch 1 covers cls. 1.3, 2.2, 4.3, ...
   Running both now simultaneously since no edit depends on another") and
   never issued the actual `redline__process_document_batch` call. The
   plan lived only in chat prose; the agent loop saw no action.

Sprint 31B is the first act on those findings.

## Decision

Three additions to `discoveryDoctrine.ts`, each at the natural attachment
point in the existing Step A/B/C structure:

### 1. Slug shape (Step B addendum)

After the existing negative guard, add a "Slug shape (load-bearing)"
paragraph naming the exact argument shape:

> The `load_skill` `name` argument is the **exact slug as listed** in
> the skills block. If the inventory lists `nda-review`, the call is
> `load_skill(name="nda-review")`. Never a file path (`nda-review.md`),
> never a category prefix (`commercial/nda-review`), never a description,
> never the playbook filename.

### 2. Agent-loop semantics (Step C addendum)

After the quantity-word trigger pattern, add a paragraph that names the
runtime semantic explicitly:

> Issuing N tool calls in a single assistant message is **not** parallel
> — the agent loop processes them one at a time. To **actually**
> parallelise N independent items, call `delegate` once per item. Each
> `delegate` spawns a subagent that runs in its own loop concurrently.
> Many-tool-calls-per-message is the anti-pattern this rule names.

### 3. "Act, don't describe" (new section)

A cross-cutting section after Step C, applying to all three steps and
the bespoke Commercial redline doctrine:

> When you've identified the right tool for a step, the next assistant
> message must be the tool call — not a prose plan. "Running both
> batches simultaneously" with the actual tool calls absent is the
> failure mode. Plan in the tool arguments, not in the chat surface.

## Why these three, and not others

Sprint 31A surfaced ~5 candidate refinements. These three are the ones
where:

- The failure mode is **observable in transcripts** (no judgement call
  required to identify it).
- The fix is **doctrine-level** (no Goose-core touch, no tool description
  change — fits under [[ADR-106]]'s env-overridable provider boundary,
  not the fork-hygiene boundary).
- The expected effect crosses **at least two of the three models** —
  fix 1 helps GPT-5.4-mini; fix 2 helps MiniMax + GPT-5.4-mini; fix 3
  helps GPT-5.4-mini + Claude.

Out of scope for Sprint 31B (deferred to Sprint 33+ candidate list):

- **Tool-side "did you mean" suggestions** on `load_skill`'s
  not-found error. Doctrine reframing should reduce the need; the tool
  fix is upstream Goose territory.
- **Per-model doctrine variants** (e.g. extra-blunt phrasing for
  MiniMax). Sprint 32's N=20 substrate is the right place to test
  per-model effect sizes before committing to variants.

## Risk: over-tuning recurrence

Sprint 31 brief flagged over-tuning as the central risk. Sprint 31A's
negative guards held perfectly across all three models on both tests —
no model crossed the playbook negative guard. Sprint 31B's additions are
**positive shapes** (here is the right slug; here is what parallel means;
here is when to act vs describe) rather than fresh negative guards.
Positive shapes are less prone to over-firing on noise. Sprint 31B's
re-dogfood validates this — if the negative guards now fire on
irrelevant turns, the fix backfired and gets reverted.

## How Sprint 31B validates this ADR

Re-run Sprint 31A's exact matrix (3 models × 2 tests = 6 cycles) with
the doctrine refinements landed. The signal:

- Fix 1 takes if GPT-5.4-mini's `load_skill` arg becomes the canonical
  slug across Test 1 + Test 2.
- Fix 2 takes if MiniMax + GPT-5.4-mini invoke `delegate` on Test 2
  Turn 1 (the 10-NDA batch).
- Fix 3 takes if GPT-5.4-mini + Claude invoke
  `redline__process_document_batch` on Test 1 Turn 5 (instead of
  planning in prose and stopping).

A miss on any of these is informative — it bounds what doctrine alone
can do and points at where Sprint 32's N=20 substrate or a Sprint 33+
tool-side change is required.

Cites: [[ADR-082]], [[ADR-099]], [[ADR-086]], [[ADR-063]], [[ADR-104]], [[ADR-106]], [[ADR-107]].
