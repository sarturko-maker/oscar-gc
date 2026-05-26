# Sprint 32 — Brief

Sprint 30 ([[ADR-101]]) measured wiring uptake on MiniMax-M2.5 by hand.
Sprint 31 ([[ADR-104]]) patched the matter system prompt with discovery
doctrine and re-dogfooded by hand on MiniMax. Sprint 31A ([[ADR-107]])
extended the manual measurement to GPT-5.4-mini and Claude Sonnet 4.6,
which surfaced the structural finding that uptake patterns are
**model-family-specific** (MiniMax + GPT invoke `load_skill`; Claude
invokes `delegate`). Sprint 31B ([[ADR-108]]) applied three doctrine
refinements and re-dogfooded; two of three took (slug exactness +
agent-loop semantics for `delegate`), one didn't (act-don't-describe for
end-of-flow redline batches).

The manual checks are good enough to know **whether** a doctrine variant
works at all on a single cycle — they are not good enough to know
whether it works **reliably** across N runs, or whether it transfers
across fixture variations. Sprint 31B's GPT-5.4-mini "0 → 6 `delegate`"
might be one lucky cycle or a stable shift; Sprint 31A's MiniMax
non-determinism on `load_skill` (missed in cycle 3, fired in cycle 4)
already showed N=1 lies.

Sprint 32 builds the measurement loop that resolves these questions.

The shape: matter-runtime eval substrate with **Claude Code as
judge**, mirroring the Sprint 25 / [[ADR-082]] pattern for Oscar
LLP firm-mode evals. Same N=20 discipline, same judge-via-Max
approach. **New from 31A**: multi-model matrix from day one — not
optional. **New from 31B**: explicit A/B between Sprint 31A doctrine
(pre-refinement) and Sprint 31B doctrine (post-refinement) to
quantify which fixes actually took.

## What Arturs said (verbatim, 2026-05-25)

> 32 is model based eval where you are the evaluator.

> [Earlier, on noise handling] How do you handle noise?

> [On Sprint 31A's findings] Apply the fix, re-run the test. Only then
> move to the next sprint. [Drove Sprint 31B.]

The judging-as-CC shape is load-bearing. [[ADR-082]]'s codified rule
holds: **Claude Code via Max is the judge, not `@anthropic-ai/sdk`.**
Sprint 24-C tried a programmatic judge layer and Sprint 25 pivoted
away. Do not rebuild that layer for matter-runtime evals.

The noise-handling concern from Sprint 31's doctrine work continues
to hold across 31A + 31B — negative guards stayed clean across all
three models on both tests in both sprints. Signal-to-noise is the
metric; the noise denominator has been near-zero in manual runs.
Sprint 32 validates that at N=20.

## The meta-goal (load-bearing, refined from 31B)

Every future doctrine change in the matter system prompt runs against
this substrate **before merging**. Sprint 31B's three doctrine changes
are the first batch measured at scale. If they hold at N=20 across
the relevance matrix on all three models, they stay merged. If a
variant under-performs at scale, that's input to Sprint 33's
re-scoping with the substrate already in place.

The signal-to-noise framing carries over:

```
relevant_affordance_uptake / (relevant_affordance_uptake + noise_uptake)
```

where `noise_uptake` counts the times the agent reached for an
affordance it shouldn't have. A doctrine variant that scores 8/10 on
relevant turns but 6/10 on irrelevant turns is worse than one that
scores 5/10 on relevant turns and 0/10 on irrelevant turns.

**New from Sprint 31A**: the rubric must **also** distinguish
"invoked correctly" from "invoked at all." Sprint 31A's GPT-5.4-mini
called `load_skill(name="commercial/rfq-review-playbook.md")` — the
affordance fired but the argument was wrong. Half-credit at most; the
substrate must catch this shape of failure.

## Cold-start reading order (refreshed)

1. `PROJECT.md` — Sprint Index (Sprint 31B should be the most recent on-disk when 32 opens)
2. `CLAUDE.md` — operating rules
3. `SPRINT_LOG.md` — Sprint 31B entry first (doctrine refinements being measured), Sprint 31A second (cross-model baseline), Sprint 31 third (original doctrine), Sprint 30 fourth (uptake findings); Sprints 25 + 26 + 23 (eval substrate precedent)
4. `docs/sprint-31a/README.md` + `docs/sprint-31b/README.md` — the manual measurement Sprint 32 scales
5. `docs/adr/082-interactive-iteration-shape.md` — judging-as-CC methodology
6. `docs/adr/077-lavern-baselined-eval-methodology.md` — substrate template
7. `docs/adr/101-sprint30-dogfood-findings.md` — original findings
8. `docs/adr/104-discovery-doctrine.md` + `108-doctrine-refinements-sprint-31b.md` — the doctrine being measured
9. `docs/adr/106-matter-recipe-env-overridable-provider.md` + `107-cross-model-uptake-patterns.md` — the infrastructure and the cross-model story
10. `evals/oscar-llp/` — Sprint 25 substrate; **structural template** for `evals/matter-runtime/`. Read `scripts/run-partner-cycle.js`, `scripts/lib-recipe24.js`, the rubric markdown, one per-cycle output directory
11. `evals/matter-runtime/iterations/_costs/` — proto-substrate seed; cost data from 31A + 31B per-cycle is already persisted in this shape
12. `docs/sprint-30/` — fixture seed (Pemberton RFQ + 10 NDAs); same fixtures reused by 31A + 31B
13. `RUNBOOK.md` §Sprint 25 + §Sprint 31A — operational notes on `SKIP_SANITY_GATE`, MiniMax dev-key, OpenRouter dev-key, env-var provider switch via `dogfood.sh`

Before writing any code: re-read `evals/oscar-llp/scripts/run-partner-cycle.js` end-to-end. It is the closest analogue to what Sprint 32 builds and the discipline carries (atomic per-cycle writes, transcript capture as flat files, scores as structured JSON, manifest per run).

## Five pieces

### Piece 1 — Substrate at `evals/matter-runtime/`

Mirrors `evals/oscar-llp/` shape; new directory because matter
runtime is structurally different from LLP firm-mode (matter
sessions are multi-turn, tool-rich, stateful, with matter-folder
content; LLP partners are single-turn, stateless, research-only).
Data shape and rubric don't transfer directly even if harness
shape does.

**Proto-substrate already exists**:
`evals/matter-runtime/iterations/_costs/costs-2026-05-26.json` (Sprint
31A) and `costs-2026-05-26-sprint31b.json` (Sprint 31B). Per-cycle
shape is already serialised — session_id, provider, model, tokens,
cost, key_signals. Sprint 32's substrate extends this convention; it
doesn't replace it.

**Provider switching is already wired** ([[ADR-106]]) — matter recipes
inherit `GOOSE_PROVIDER` / `GOOSE_MODEL` from env. `scripts/dogfood/dogfood.sh`
sources `/root/.openrouter-dev-key` when `GOOSE_PROVIDER=openrouter`.
The substrate's per-cycle invocation can set these env vars per
model without touching code.

Per-cycle output: matter recipe + transcript (extracted from
`sessions.db` via `docs/sprint-30/extract-transcript.py`) + tool-call
timeline + judge verdict JSON + manifest with Sprint SHA + model
config + relevance-matrix scenario tag.

Don't over-engineer. Sprint 25's substrate is the **ceiling** for
complexity, not the floor. Port the shape that maps (Phase A
spawning, cost log per-cycle), leave out what doesn't (LLP-specific
partner metadata, Lavern reference docs).

### Piece 2 — Fixture relevance matrix

Sprint 30's two fixtures (Pemberton RFQ pack, 10-NDA triage) are the
**seed**. 31A and 31B used them verbatim and they discriminate cleanly
between models (delegate fires on Claude only, redline tool fires on
MiniMax only, load_skill correctness varies). Sprint 32 expands the
matrix but the base scenarios are locked.

Suggested matrix (~6-8 scenarios; adjust to taste):

- **Sprint 30 RFQ pack** — high playbook relevance, low skill, low delegation (the existing fixture).
- **Sprint 30 10-NDA triage** — high playbook + high skill + high delegation (the existing fixture, which all three affordances target).
- **Single NDA review** — derived from one of the existing 10 NDAs in isolation. Tests skill-relevance without delegation-relevance.
- **High playbook + skill + delegation** — 10 SaaS MSA reviews with `saas-msa-review` skill + an MSA playbook in scope. New fixture.
- **Low everything (negative control)** — generic Q&A turn ("draft me a confidentiality clause for a Series B term sheet"). No matter folder content beyond `matter.md`. No playbook should fire.
- **Mixed: playbook present but topic doesn't match** — the existing RFQ matter, prompt is "draft a generic NDA template" (RFQ playbook present, irrelevant; NDA playbook absent; the agent should read neither).
- Optional: two playbooks partially match — RFQ matter with both `rfq-review-playbook.md` and `vendor-onboarding-playbook.md` in scope, RFQ prompt. Which does the agent pick?

**Sprint 31A + 31B confirmed the noise controls hold on the
existing fixtures across all three models** — no model crossed the
playbook negative guard. The Sprint 32 matrix should preserve that
discrimination, not replace it.

Fixtures can reuse Sprint 30's RFQ pack + 10 NDAs as the seed; the
matrix expands by varying which playbooks are present in
`~/.config/oscar/playbooks/commercial/` and which matters are
opened. New DOCX content isn't strictly needed for most scenarios —
the relevance matrix is about playbook×task pairing, not document
diversity.

### Piece 3 — Judge rubric (refined from 31A's "wrong args" finding)

**Observable-only.** Tool-call signals, not answer-quality judgments.
The judge reads the transcript + tool-timeline + scenario metadata
and produces structured JSON per cycle:

- `playbook_read_on_relevant_turn`: bool + which playbook
- `playbook_read_on_irrelevant_turn`: bool + which playbook (**noise signal**)
- `skill_invoked_when_applicable`: bool + which skill
- `skill_invoked_when_not_applicable`: bool + which skill (noise)
- **`skill_arg_correct`: bool** — the slug as the agent passed it
  vs the canonical inventory. GPT-5.4-mini in 31A passed
  `commercial/rfq-review-playbook.md`; in 31B it passed `review`.
  Both invoked the tool; neither used the canonical slug. The
  substrate must distinguish "fired" from "fired correctly."
- `delegate_used_when_applicable`: bool + how many subagents + scope of each
- `delegate_used_when_not_applicable`: bool + how many (noise)
- **`delegate_strategy`**: enum — `one_per_item` | `partition` | `none`.
  Claude in 31A used one-per-item (7 subagents for 10 NDAs); Claude
  in 31B used partition (4 subagents for 10 NDAs). Doctrine permits
  both; the substrate should record which.
- `redline_invoked_when_asked`: bool
- **`redline_succeeded_when_invoked`**: bool — MiniMax's batch tool
  was invoked in both 31A and 31B but rejected on content-match.
  "Invoked correctly with valid args that the tool accepted" is the
  full credit; "invoked but rejected" is partial.
- `extra_observations`: free-text field for the judge to flag
  anything the structured fields miss (caps at 300 chars per cycle
  so this doesn't become a dumping ground)

The rubric markdown is committed to the substrate; the judge
prompt references it by section. Versioning discipline mirrors
`evals/oscar-llp/RUBRIC.adapted.md`.

The rubric prompt should include the explicit reminder: **score
tool-call appropriateness, not answer quality.** The judge does not
need to be a Commercial-law expert to score whether
`oscar-fs__read_file` fired against the expected playbook path.

### Piece 4 — N=20 baseline + the load-bearing A/B (Sprint 31A vs Sprint 31B doctrine)

The natural A/B for Sprint 32 is **Sprint 31A doctrine (commit
`597a3b5bd` parent state) vs Sprint 31B doctrine (commit `d88ef8df6`)**.
Both are already in git; both have N=1 manual data for context.
Sprint 32 quantifies at N=20 which fixes took, which didn't, and
which were lucky-cycle non-determinism.

**Multi-model is required, not optional.** Sprint 31A established
that uptake patterns are model-family-specific. A single-model
substrate would under-report `delegate` (looks broken if measured on
MiniMax) and over-report `load_skill` stability (subject to
non-determinism). The matrix:

| Variant | MiniMax-M2.5 | openai/gpt-5.4-mini | anthropic/claude-sonnet-4.6 |
|---|---|---|---|
| 31A doctrine (pre-refinement) | N=20 | N=20 | N=20 |
| 31B doctrine (post-refinement) | N=20 | N=20 | N=20 |

That's 6 cells × N=20 = 120 cycles per scenario. With 6-8 scenarios,
720-960 cycles total. Per Sprint 25's spawn-batch-then-judge
discipline, this is large but tractable across a sprint.

**Pre-flight check before committing to N=20**: spot-run N=5 first,
look at variance across the 5 runs. If verdicts swing wildly across
N=5 on the same scenario, the model's non-determinism is too high
for N=20 to distinguish doctrine variants — escalate N to 50 or
narrow the matrix. If verdicts are stable at N=5, N=20 is sufficient.

Sprint 31A + 31B suggest non-determinism is real but bounded —
MiniMax's `load_skill` missed in 31 cycle 3, fired in 31A cycle and
31B cycle. That's 2/3 ≈ 67% uptake on N=3 manual cycles — N=20
sharpens this to a confidence interval.

The output: `evals/matter-runtime/reports/sprint-32-baseline.md`
with per-scenario tables, signal-to-noise computations per
affordance, per-model effect sizes for each 31B doctrine refinement,
and a verdict on whether each fix held at scale.

### Piece 5 — ADR codifying matter-runtime eval methodology

Mirrors [[ADR-077]] for Lavern. Covers:

- **Scope** — matter runtime, not legal-substance accuracy. The
  substrate measures wiring uptake, not whether the agent's NDA
  analysis is correct.
- **Multi-model standard** — every doctrine A/B runs against the
  same set of models from day one (current set: MiniMax + GPT-5.4-mini
  + Claude Sonnet 4.6). Single-model evaluation is the failure mode
  Sprint 31A documented; the substrate prevents it by construction.
- **Judging methodology** — CC via Max per [[ADR-082]]. No
  programmatic judge layer.
- **Rubric principle** — observable-only. Distinguishes "invoked"
  from "invoked correctly" (the 31A lesson). Rubric markdown is
  the source of truth; judge prompt references it; both committed.
- **N=20 standard** — with the pre-flight N=5 variance check.
- **Provider switch via env** ([[ADR-106]]) — matter recipes
  inherit `GOOSE_PROVIDER` / `GOOSE_MODEL`; substrate sets these
  per-cycle.
- **Cost discipline** — per-variant cost envelope; spread across
  the sprint; SKIP_SANITY_GATE pattern from Sprint 25.
- **Where future doctrine changes plug in** — every matter system
  prompt change runs through this substrate before merging.

≤ 50 lines per CLAUDE.md.

## Cost envelope (refreshed — OpenRouter cap is the constraint)

Sprint 31A + 31B consumed $8.79 of the $10 OpenRouter cap; **$1.21
remains**. Sprint 32 needs a refresh strategy.

Manual cost from 31A + 31B per cycle (per model):
- MiniMax-M2.5: ~$0.12 average per Test 1 + Test 2 (Test 1 ~$0.25, Test 2 ~$0.08)
- openai/gpt-5.4-mini: ~$0.55 average per scenario after 31B doctrine reduced thrash (was ~$0.90 pre-31B due to fs-search loops)
- claude-sonnet-4.6: ~$1.20 average per scenario (high per-turn input cost)

Sprint 32 cost projection at N=20 × 2 variants × 3 models × 6 scenarios:
- MiniMax: 720 cycles × $0.12 = ~$86 (on $10/PCM MiniMax cap → need 9 months or rate limit)
- GPT-5.4-mini: 720 cycles × $0.55 = ~$396 (way over $10 OpenRouter — needs refresh)
- Claude Sonnet 4.6: 720 cycles × $1.20 = ~$864 (way over)

This is the load-bearing constraint Sprint 32 must resolve before
spawning the first cycle. Options to consider:

1. **OpenRouter cap refresh** — does Arturs's OpenRouter account
   support topping up? Per the ad-hoc key Sprint 31A used, the $10
   was the project budget — not the account total.
2. **Cheaper Claude variant** — `claude-haiku-4-5` at ~$0.20-0.30/M
   input vs Sonnet's $3/M input. 10x cheaper. Sprint 32 could swap
   Sonnet → Haiku and capture most of the cross-family signal.
3. **Narrow the matrix** — fewer scenarios (4 instead of 6-8) and
   lower N (10 instead of 20). N=10 still gives confidence intervals;
   4 scenarios × 2 variants × 3 models × N=10 = 240 cycles.
4. **Stagger across multiple OpenRouter key refreshes** — run
   MiniMax fully first (cheap), then GPT, then Claude — pause if
   key exhausts.

Decide upfront before spawning; cap accordingly. The Sprint 31A +
31B exact-replay matrix is the floor — Sprint 32 must at least
validate those 6 cells (3 models × 2 tests) at N=20 to confirm the
manual findings. That's 120 cycles ≈ $50-60 OpenRouter — already
over the $1.21 remaining.

## What Sprint 31A + 31B taught about substrate design

1. **Single-cycle results lie.** Sprint 31 cycle 3 missed `load_skill`
   on MiniMax; same prompt and binary, Sprint 31A baseline cycle hit
   it. N=20 is the right horizon; N=1 is a smoke check.

2. **Model families are different surfaces.** Same doctrine produced
   different uptake patterns across MiniMax + GPT + Claude. The
   substrate must measure each in parallel; running on one and
   extrapolating is exactly the failure mode Sprint 31 brief warned
   about.

3. **Cost varies wildly across models.** GPT-5.4-mini at $1.36 per
   Test 2 cycle (pre-31B doctrine) vs $0.52 (post) vs MiniMax's
   $0.08 — same workload. Substrate cost projections must use
   per-model rates from manual data, not a single average.

4. **Where doctrine lives matters.** Sprint 31B's three positive-shape
   fixes — two took strongly (Step B + Step C trigger surfaces), one
   missed (end-of-flow act-don't-describe). The substrate should
   surface this pattern: doctrine paragraphs that name a Turn-1 or
   trigger-surface decision land; doctrine paragraphs that try to
   shape end-of-flow behaviour from the middle of the system prompt
   don't reach.

## Deliverables

- `evals/matter-runtime/` substrate (harness scripts, fixture
  loaders, judge prompts, rubric markdown). Reuse `evals/oscar-llp/`
  patterns; don't rebuild from scratch.
- N=20 baseline report at `evals/matter-runtime/reports/sprint-32-baseline.md`
  with per-scenario × per-model × per-variant tables and per-fix
  effect sizes.
- A/B comparison report: Sprint 31A doctrine vs Sprint 31B doctrine
  per model. The headline question: which fixes held at scale?
- ADR at decision time codifying the methodology (next free ADR
  number from `docs/adr/`).
- SPRINT_LOG entry + PROJECT.md Sprint Index row.
- Per-run cost data persisted at
  `evals/matter-runtime/iterations/_costs/costs-<date>-<sprint>.json`
  (extends 31A + 31B convention).

## Out of scope

- **Re-tuning doctrine.** If the substrate reveals 31B doctrine
  weakness, that's input to Sprint 33's scoping. Sprint 32
  **measures**.
- **Legal-substance accuracy scoring.** Different problem, different
  judge (probably needs a human SME or a domain-specific eval like
  CUAD/MAUD). The substrate is designed for tool-call observation.
- **Cross-area extension.** Sprint 32 is Commercial-only because
  Sprint 30 + 31 + 31A + 31B all live there. Other areas come later.
- **Programmatic judge layer.** [[ADR-082]] codified CC-as-judge.
- **Layer 3 semantic playbook retrieval.** If Sprint 32 reveals
  doctrine fundamentally can't take on a model, Layer 3 becomes
  Sprint 33's input — not Sprint 32's scope.
- **Sprint 33 candidates from 31B** (do not solve in Sprint 32):
  - Moving "act don't describe" into bespoke Commercial redline
    doctrine or tool description.
  - MiniMax delegate gap (model-capability-bound; tool-side
    adjustment or accept).
  - GPT skill-arg "did you mean: review?" trap (error hint refinement).

## Open questions to think deeply about (do not pre-resolve)

- **Cost-cap-driven scope decisions.** The $1.21 OpenRouter remaining
  forces an early decision: refresh, swap Claude for Haiku, narrow
  the matrix, or stagger. Each shapes the substrate's ceiling. Pick
  one and document why before spawning any cycle.

- **Judge neutrality.** The CC running Sprint 32 is the same model
  family that wrote Sprint 31B's doctrine. The judge has priors on
  what "good" looks like. Mitigation: keep the rubric strictly
  observable; the rubric prompt should include "score tool-call
  appropriateness only, not answer quality". Open question: should
  the judge prompt explicitly mask the doctrine text from the judge's
  view (so the judge scores only what the agent did, not whether the
  agent followed the doctrine the judge knows about)? Default
  position: yes, mask the doctrine.

- **N=20 sufficiency.** Sprint 25 used N=20 per partner per cycle and
  it was sufficient there. Matter-runtime variance may be higher
  (multi-turn + multi-tool + tool-spawn timing). 31A + 31B's N=1
  cycles suggest variance bounded but real (MiniMax 2/3 on
  load_skill across 3 manual cycles). N=5 pre-flight guards against
  this; the open question is whether the matrix should narrow
  (fewer scenarios at higher N) or stay broad (more scenarios at
  N=20).

- **Cross-scenario interference.** If the same fixture set is reused
  in every cycle, the recipe's behavior on those fixtures becomes
  the substrate's house style — the judge starts recognising the
  pattern. Sprint 33+ should periodically refresh fixtures; Sprint
  32 doesn't need to solve this but should flag the carry-forward.

- **Variant naming convention.** Sprint 25 used `iter-{0..3}` per
  cycle. Sprint 32 has variants × models × cycles ≈ 3-dim grid.
  Sort out directory naming early — `model-X/variant-Y/cycle-NN/`
  vs `variant-Y/model-X/cycle-NN/` vs flat structure with manifest.
  The 31A + 31B `<model>/test-<N>/` shape is the closest precedent;
  extending to `<model>/variant-<31A|31B>/scenario-<NN>/cycle-<NN>/`
  is the natural shape.

- **Schedule risk on judging.** CC-as-judge means the sprint can't
  parallelise spawning from judging — judging is done in-conversation
  by the same CC that orchestrates. The Sprint 25 lesson:
  spawn-batch the cycles, then judge in bulk afterward. Don't try to
  judge-as-you-go; it fragments the context.

- **Whether the Sprint 31B "act don't describe" miss is structural
  or non-deterministic.** Manual N=1 showed both GPT and Claude
  planned in prose without invoking the redline tool. Sprint 32 N=20
  resolves this. If 18/20 also miss, the failure is structural and
  the Sprint 33 candidate (moving doctrine to the tool surface) is
  the right work. If 12/20 miss, it's noisy and partial — sharpen
  the same doctrine first.
