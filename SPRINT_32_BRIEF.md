# Sprint 32 — Brief

Sprint 30 ([[ADR-101]]) measured wiring uptake by hand. Sprint 31
(separate brief) patched the matter system prompt with doctrine for
the under-used affordances and re-dogfooded by hand. The manual
check is good enough to know whether a doctrine variant works at
all; it is not good enough to know whether it works **reliably**
across N runs, or whether it transfers across fixture variations.

Sprint 32 builds the measurement loop.

The shape: matter-runtime eval substrate with **Claude Code as
judge**, mirroring the Sprint 25 / [[ADR-082]] pattern for Oscar
LLP firm-mode evals. Same N=20 discipline, same judge-via-Max
approach, new domain (matter runtime instead of LLP firm-mode).

## What Arturs said (verbatim, 2026-05-25)

> 32 is model based eval where you are the evaluator.

> [Earlier, on noise handling] How do you handle noise?

The judging-as-CC shape is load-bearing. [[ADR-082]]'s codified
rule holds: **Claude Code via Max is the judge, not
`@anthropic-ai/sdk`.** Sprint 24-C tried a programmatic
@anthropic-ai/sdk judge layer and Sprint 25 pivoted away because
me-in-conversation produced sharper verdicts at zero Anthropic
spend. Do not rebuild that layer for matter-runtime evals.

The noise-handling concern from Sprint 31's doctrine work is what
this substrate exists to measure rigorously. Signal-to-noise is the
metric; raw uptake is misleading without the noise denominator.

## The meta-goal (load-bearing)

Every future doctrine change in the matter system prompt runs against
this substrate **before merging**. Sprint 31's doctrine is the first
thing measured. If it holds at N=20 across the relevance matrix, it
stays merged. If it doesn't, Sprint 33 picks up the next iteration
with the substrate already in place.

The signal-to-noise framing from Sprint 31 carries over verbatim: the
metric that matters is

```
relevant_affordance_uptake / (relevant_affordance_uptake + noise_uptake)
```

where `noise_uptake` is the count of times the agent reached for an
affordance it shouldn't have. A doctrine variant that scores 8/10 on
relevant turns but 6/10 on irrelevant turns is worse than one that
scores 5/10 on relevant turns and 0/10 on irrelevant turns.

## Cold-start reading order

1. `PROJECT.md` — Sprint Index (Sprint 31 should be the most recent on-disk when 32 opens)
2. `CLAUDE.md` — operating rules
3. `SPRINT_LOG.md` — Sprint 31 entry first (the doctrine being measured); Sprint 30 second (the baseline findings); Sprints 25 + 26 + 23 (the eval substrate precedent in chronological order)
4. `docs/adr/082-interactive-iteration-shape.md` — judging-as-CC methodology, the load-bearing pattern decision
5. `docs/adr/077-lavern-baselined-eval-methodology.md` — substrate template
6. `docs/adr/101-sprint30-dogfood-findings.md` — what the eval measures against
7. `evals/oscar-llp/` — Sprint 25 substrate; **structural template** for the new `evals/matter-runtime/`. Read `scripts/run-partner-cycle.js`, `scripts/lib-recipe24.js`, the rubric markdown, and one of the per-cycle output directories to understand the shape.
8. `docs/sprint-30/` — fixture seed (Pemberton RFQ + 10 NDAs) and the manual measurement that this substrate scales to N=20
9. `RUNBOOK.md` §Sprint 25 — operational notes on `SKIP_SANITY_GATE`, MiniMax dev-key spend logging, the per-cycle output convention

Before writing any code: re-read `evals/oscar-llp/scripts/run-partner-cycle.js` end-to-end. It is the closest analogue to what Sprint 32 builds and the discipline carries over (atomic per-cycle writes, transcript capture as flat files, scores as structured JSON, manifest per run).

## Five pieces

### Piece 1 — Substrate at `evals/matter-runtime/`

Mirrors `evals/oscar-llp/` shape; new directory because matter
runtime is structurally different from LLP firm-mode (matter
sessions are multi-turn, tool-rich, stateful, with matter-folder
content; LLP partners are single-turn, stateless, research-only,
with no per-partner state). The data shape and rubric don't
transfer directly even if the harness shape does.

Per-cycle output: matter recipe + transcript (extracted from
`sessions.db`) + tool-call timeline (the Sprint 30 extraction
helper at `docs/sprint-30/extract-transcript.py` is the starting
template) + judge verdict JSON + manifest with Sprint SHA + model
config + relevance-matrix scenario tag.

Don't over-engineer the harness. The Sprint 25 substrate is the
**ceiling** for complexity, not the floor. If a piece of Sprint
25's machinery (Phase A spawning, sanity-gate, cost log) maps
cleanly, port it. If something doesn't map (LLP-specific partner
metadata, Lavern reference docs), leave it out.

### Piece 2 — Fixture relevance matrix

Sprint 30's fixtures cover two scenarios: RFQ review (RFQ playbook
relevant; NDA playbook irrelevant) and 10-NDA triage (NDA playbook
relevant; RFQ playbook irrelevant). Sprint 32 expands to a
matrix where playbook-relevance, skill-relevance, and
delegation-relevance vary **independently**.

Suggested matrix (~6-8 scenarios is the right size; adjust to
taste):

- High playbook relevance + low skill relevance + low delegation relevance — single-doc review where one playbook matches by topic
- Low playbook relevance + high skill relevance + low delegation relevance — task that fits a bundled skill cleanly (e.g., a single NDA review hits `nda-review` skill)
- Low playbook relevance + low skill relevance + high delegation relevance — batch task with independent items (the 10-NDA shape from Sprint 30)
- High everything — batch task that matches a playbook AND a skill (e.g., 10 SaaS MSA reviews with `saas-msa-review` skill + an MSA playbook in scope)
- Low everything — generic Q&A turn ("draft me a confidentiality clause for a Series B term sheet") — the negative control
- **Mixed: playbook present but topic doesn't match the task** — the load-bearing noise control. At least one scenario must include playbooks the agent should NOT read.
- Optional: a turn where two playbooks both partially match (which does the agent pick? does it read both?)

**Think deeply about the noise controls.** Sprint 31's whole point was
to avoid reads on irrelevant turns. The eval has to be able to catch
that — and the catch can only happen if the fixture matrix includes
clear negative-control scenarios.

The fixtures themselves can reuse Sprint 30's RFQ pack + 10 NDAs as
the seed; the matrix expands by varying which playbooks are present
in `~/.config/oscar/playbooks/commercial/` and which matters are
opened. New DOCX content isn't strictly needed for most scenarios —
the relevance matrix is about playbook×task pairing, not document
diversity.

### Piece 3 — Judge rubric

**Observable-only.** Tool-call signals, not answer-quality judgments.
The judge reads the transcript + tool-timeline + scenario metadata
and produces structured JSON per cycle:

- `playbook_read_on_relevant_turn`: bool + which playbook
- `playbook_read_on_irrelevant_turn`: bool + which playbook (**the noise signal**)
- `skill_invoked_when_applicable`: bool + which skill
- `skill_invoked_when_not_applicable`: bool + which skill (noise)
- `delegate_used_when_applicable`: bool + how many subagents + scope of each
- `delegate_used_when_not_applicable`: bool + how many (noise)
- `redline_invoked_when_asked`: bool
- `extra_observations`: free-text field for the judge to flag anything the structured fields miss (caps at 300 chars per cycle so this doesn't become a dumping ground)

The rubric markdown is committed to the substrate; the judge
prompt references it by section. Same versioning discipline as
`evals/oscar-llp/RUBRIC.adapted.md`.

The rubric prompt should include the explicit reminder: **score
tool-call appropriateness, not answer quality**. The judge does not
need to be a Commercial-law expert to score whether
`oscar-fs__read_file` fired against the expected playbook path.

### Piece 4 — N=20 baseline + at least one A/B

**Baseline**: Sprint 31's doctrine variant, run N=20 against the
relevance matrix. **A/B**: at least one alternative doctrine phrasing
(e.g., Sprint 31's runner-up phrasing if there is one, or a
deliberately looser phrasing as a noise control), same fixtures,
same N. The point of the A/B is to validate that the substrate
distinguishes good doctrine from bad doctrine — not to test every
possible phrasing.

Cost envelope: N=20 × ~6-8 scenarios × ~$0.15-0.30 per matter
session (Sprint 30's per-session cost) ≈ $20-50 per variant. Two
variants ≈ $40-100. Comfortably within the $10/PCM monthly cap if
spread across the sprint, especially after Sprint 31's spend rolls
off.

**Pre-flight check before committing to N=20**: spot-run N=5 first,
look at variance across the 5 runs. If verdicts swing wildly across
N=5 on the same scenario, the model's non-determinism is too high
for N=20 to distinguish doctrine variants — escalate N to 50 or
narrow the matrix. If verdicts are stable at N=5, N=20 is sufficient.

The output: `evals/matter-runtime/reports/sprint-32-baseline.md`
with per-scenario tables, signal-to-noise computations
per affordance, and a verdict on whether Sprint 31's doctrine held
at scale.

### Piece 5 — ADR codifying matter-runtime eval methodology

Mirrors [[ADR-077]] for Lavern. Covers:

- **Scope** — matter runtime, not legal-substance accuracy. The
  substrate measures wiring uptake, not whether the agent's NDA
  analysis is correct.
- **Judging methodology** — CC via Max per [[ADR-082]]. No
  programmatic judge layer.
- **Rubric principle** — observable-only. The rubric markdown is
  the source of truth; the judge prompt references it; both are
  committed.
- **N=20 standard** — with the pre-flight N=5 variance check.
- **Cost discipline** — per-variant cost envelope; spread across the
  sprint; SKIP_SANITY_GATE pattern from Sprint 25 if a sanity gate
  is included.
- **Where future doctrine changes plug in** — every matter system
  prompt change runs through this substrate before merging.

≤ 50 lines per CLAUDE.md.

## Deliverables

- `evals/matter-runtime/` substrate (harness scripts, fixture
  loaders, judge prompts, rubric markdown). Reuse `evals/oscar-llp/`
  patterns; don't rebuild from scratch.
- N=20 baseline report at `evals/matter-runtime/reports/sprint-32-baseline.md`
  with per-scenario tables and a sign-off on whether Sprint 31's
  doctrine held.
- At least one A/B comparison report.
- ADR at decision time codifying the methodology (next free
  ADR number from `docs/adr/`).
- SPRINT_LOG entry + PROJECT.md Sprint Index row.
- Per-run cost data persisted at
  `evals/matter-runtime/iterations/_costs/costs-<date>.json` per
  Sprint 25 convention.

## Out of scope

- **Re-tuning Sprint 31's doctrine.** If the substrate reveals
  doctrine weakness, that's input to Sprint 33's scoping. Sprint 32
  **measures**; it doesn't re-tune. This is the same discipline as
  Sprint 30's "fixing what surfaces is Sprint 31's job".
- **Legal-substance accuracy scoring.** Different problem, different
  judge (probably needs a human SME or a domain-specific eval like
  CUAD/MAUD). The substrate is designed for tool-call observation.
- **Cross-area extension.** Sprint 32 is Commercial-only because
  Sprint 30's measurement lives there. Other areas come later when
  there's matter-shaped traffic in them.
- **Programmatic judge layer.** [[ADR-082]] codified CC-as-judge as
  the load-bearing pattern. Don't rebuild what 24-C tried and 25
  rejected.
- **Building Layer 3 semantic playbook retrieval.** If Sprint 32
  reveals doctrine fundamentally can't take, Layer 3 becomes
  Sprint 33's input — not Sprint 32's scope.

## Open questions to think deeply about (do not pre-resolve)

- **Judge neutrality.** The CC running Sprint 32 is the same model
  family that wrote Sprint 31's doctrine. The judge has priors on
  what "good" looks like. Mitigation: keep the rubric strictly
  observable; the rubric prompt should include "score
  tool-call appropriateness only, not answer quality". Open
  question: should the judge prompt explicitly mask the doctrine
  text from the judge's view (so the judge scores only what the
  agent did, not whether the agent followed the doctrine the judge
  knows about)? Default position: yes, mask the doctrine.

- **N=20 sufficiency.** Sprint 25 used N=20 per partner per cycle
  and it was sufficient there. Matter-runtime variance may be
  higher (multi-turn + multi-tool + tool-spawn timing). The N=5
  pre-flight check guards against this; the open question is
  whether the matrix should narrow (fewer scenarios at higher N)
  or stay broad (more scenarios at N=20).

- **Cross-scenario interference.** If the same fixture set is
  reused in every cycle, the recipe's behavior on those fixtures
  becomes the substrate's house style — the judge starts
  recognising the pattern. Periodically refreshing the fixture set
  (Sprint 33+) is good hygiene; Sprint 32 doesn't need to solve
  this but should flag the carry-forward in the close-out.

- **Variant naming convention.** Sprint 25 used `iter-{0..3}` per
  cycle. Sprint 32 has variants (doctrine phrasings) × cycles
  (sample size). Sort out the directory naming early — `variant-{A,B}/iter-{0..N}/`
  vs `iter-{0..N}-variant-{A,B}/` vs flat structure. The Sprint 25
  shape is the default; deviate only with reason.

- **Cost ceiling at scale.** Sprint 32's per-variant cost (~$30) is
  fine for one variant. If the sprint runs 4-5 variants the cost
  scales linearly toward $150. Decide up front how many variants
  the budget allows; cap accordingly. Two variants is the floor (so
  the A/B is meaningful); four is comfortable; six is the ceiling
  before crossing $200 spend.

- **Schedule risk on judging.** CC-as-judge means the sprint can't
  parallelise the N=20 partner runs from the judging — judging is
  done in-conversation by the same CC that orchestrates. The
  Sprint 25 lesson: spawn-batch the partner runs, then judge in
  bulk afterward. Don't try to judge-as-you-go; it fragments the
  context.
