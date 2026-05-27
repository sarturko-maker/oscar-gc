# Sprint 33 — Brief

Sprint 32 ([[ADR-109]]) built the matter-runtime eval substrate and
measured ADR-108's three doctrine fixes at scale across two model
families (MiniMax-M2.5 at N=20, Haiku 4.5 at N=10). The headline
finding the multi-family scale surfaced — invisible at the prior N=1
manual cycles — is that **the same doctrine paragraph can have
opposite effects across model families**:

| ADR-108 Fix | MiniMax-M2.5 | Haiku 4.5 | Verdict |
|---|---|---|---|
| 1. Slug exactness for `load_skill` | **+35pp** (30%→65%) | **-20pp** (50%→30%) | TOOK on MiniMax, REVERSED on Haiku |
| 2. Agent-loop semantics for `delegate` | +15pp (5%→20%) | -10pp (60%→50%) | TOOK on MiniMax; Haiku already high |
| 3. "Act, don't describe" (redline) | 0pp | 0pp | DID NOT TAKE on either |

Plus a MiniMax-specific regression: variant B introduces **+25pp
wrong-skill firings on 30-rfq** (4/20 → 9/20). Haiku correctly stays at
0/10 on both variants on the same scenario. The skill-firing trigger
needs tightening for cross-document review tasks; the change wording
must work across families even though only MiniMax is currently
mis-firing.

Sprint 33 is the cross-model-doctrine-recalibration sprint. Staged:

- **Stage 1 (research)** — what does the field already know about
  cross-model prompt portability? Memo at
  `docs/sprint-33/research-memo.md` informs Stage 2's wording
  choices. Don't iterate by guessing — others have measured this
  problem; read their findings first.
- **Stage 2 (recalibration)** — apply Stage 1's findings to three
  specific candidates (slug exactness, "act don't describe"
  location, skill negative guard for cross-document tasks).
- **Stage 3 (measurement)** — validate each candidate at N=20
  MiniMax + N=10 Haiku on the Sprint 32 substrate.

All wording changes; no per-family branching; no Rust core touch; no
sibling MCP touch.

## What Arturs said (verbatim)

(2026-05-27, on Sprint 32 close-out)

> Re-read Claude.md. Minimax is a dependency injection. All of the
> LLMs are. We cannot calibrate per model. There needs to be a way to
> achieve balance across models.

(2026-05-27, on Sprint 33 brief draft)

> Stage 1 should be research. We are not the only ones working on
> this.

These are the two load-bearing framings for Sprint 33.

The first one: per CLAUDE.md ("Reuse over rebuild — Goose", lines
56-60), providers are reused from Goose — the provider is dependency
injection. **Doctrine must work across whatever provider the user
has wired up.** Per-family doctrine variants (branching on
`GOOSE_PROVIDER`) are off the table.

The second one: **don't iterate by guessing.** Cross-model prompt
portability is an active research area. Function-calling cross-model
benchmarks exist (BFCL, NexusBench, ToolBench, Tau-Bench). The major
model labs (Anthropic, OpenAI, Google, Meta) publish prompt-engineering
guides that converge or diverge on specific patterns. Academic
literature on instruction-following robustness across models exists.
**Sprint 33's first deliverable is a research memo, not a wording
edit.** Pick wording informed by what's already known — don't burn
the OpenRouter budget A/B-testing guesses.

The over-tuning concern from Sprint 31 brief continues to hold.
Sprint 32 measured 0/80 negative-guard firings on MiniMax negative
scenarios; Sprint 33 must measure that Haiku also holds negative
guards (Sprint 32b carry-forward). Don't lose the negative-discipline
property.

## The meta-goal (load-bearing)

Find wording for each of the three candidates that hits **cross-family
balance** on the substrate's N=20 (MiniMax) + N=10 (Haiku) matrix.
Cross-family balance = no fix can show opposite-sign effect across
families. Ideal = positive on both; acceptable = positive on one and
flat on the other; **unacceptable** = positive on one and negative on
the other (that's the Sprint 32 failure mode).

**Stage the work as research → recalibration → measurement.** Research
informs which patterns to try. Recalibration writes specific wording
based on the research. Measurement validates cross-family at N=20/10.

Pre-flight every candidate at N=5 across both families before
committing to N=20. If pre-flight shows asymmetric signs, rewrite
before scaling — but the research stage should make first-try
asymmetry rare.

## Stage 1 — Research (do this before any wording edit)

**Goal**: Produce a research memo summarising what's already known
about cross-model prompt portability — especially as it bears on the
three Sprint 33 candidates. Pick wording patterns from this memo,
don't invent.

Saved at `docs/sprint-33/research-memo.md`. ~2-4 pages. Sections:

1. **Function-calling cross-model benchmarks.** What does BFCL
   (Berkeley Function Calling Leaderboard) say about how the same
   tool-use prompt performs across MiniMax / Claude / GPT? Are
   there published cross-family score gaps that match Sprint 32's
   asymmetries? Look at NexusBench, ToolBench, Tau-Bench, MetaTool
   too.
2. **Lab-published prompt-engineering guides.** Anthropic's prompt
   engineering guide. OpenAI's function-calling guide. Google's
   Gemini guide. Meta's Llama guides. MiniMax's docs. Where do
   they converge on tool-trigger wording? Where do they diverge?
   Quote specific guidance verbatim — e.g., does Anthropic
   explicitly recommend positive-imperative phrasing over negative-
   constraint lists, or vice versa?
3. **Academic literature on instruction-following robustness.**
   Search Google Scholar / Semantic Scholar / arXiv for "prompt
   portability cross-model", "instruction robustness LLM", "tool
   use prompt sensitivity". A few load-bearing papers should be
   enough — quote findings, don't paraphrase.
4. **Industry case studies.** Companies shipping multi-LLM
   products (Cursor, Continue, Sourcegraph Cody, Replit Agent,
   Devin, etc.) — what have they written about cross-provider
   prompt tuning? Blog posts, engineering memos.
5. **Specific patterns to evaluate.** Based on 1-4, distill a
   shortlist (3-7 patterns) of wording shapes worth trying on
   the three Sprint 33 candidates. For each pattern: which family
   does the literature suggest it lands on; which is the cross-
   family-robust default; any documented failure modes.
6. **Memo conclusion**: for each of the three candidates (slug
   exactness, act-don't-describe location, skill negative guard
   for cross-document tasks), pick **one** wording approach
   informed by the research above. Don't pick the answer in the
   brief — pick it in the memo, after the research.

**Tool**: WebSearch + WebFetch via the Claude Code session. CC reads,
synthesises, writes the memo. Citations as URLs in the memo.

**Acceptance**: memo committed to `docs/sprint-33/research-memo.md`
before any variant build or substrate spawn. ~2-4 pages, citations
in footnotes or end-of-section. Plain English; CLAUDE.md communication
discipline applies.

**Open question for plan-mode**: should the research stage also cover
known-good *test fixture* shapes (i.e., what do these benchmarks use
as their test inputs — RFQs, NDAs, multi-doc tasks)? Sprint 32's
fixtures are Sprint 30 verbatim; if BFCL/NexusBench use shapes that
expose the cross-family asymmetry more cleanly, Sprint 33's fixture
shape could be revisited. Default position: leave fixtures alone;
Sprint 33 measures wording changes, not fixture changes. But the
research might surface a finding that argues otherwise.

## Stage 2 — Three candidates to recalibrate (informed by Stage 1)

Three candidates, all sourced from Sprint 32's findings. Each is a
wording change to existing doctrine — no per-family branching, no
Rust core touch, no sibling MCP touch.

Stage 1's research memo informs the specific wording for each.
**Don't pick the wording in the brief — pick it in the memo's
conclusion section after surveying the literature.** The hypotheses
below are starting points for the research, not the answer.

### Candidate 1 — Recalibrate fix 1's slug-exactness wording

Sprint 32's load-bearing question. The current Sprint 31B wording in
`discoveryDoctrine.ts` (under Step B addendum) lists negative
constraints:

> The `load_skill` `name` argument is the **exact slug as listed** in
> the skills block. If the inventory lists `nda-review`, the call is
> `load_skill(name="nda-review")`. Never a file path
> (`nda-review.md`), never a category prefix
> (`commercial/nda-review`), never a description, never the playbook
> filename.

The hypothesis (not the answer — Sprint 33 finds the answer):

- MiniMax reads the negative-constraint list as a permissive
  clarification — the cognitive shape is "ah, I know which shape to
  pass," and firing rate goes up.
- Haiku reads the negative-constraint list as a higher bar to clear —
  the cognitive shape is "lots of ways to get this wrong; if I'm not
  sure, don't fire," and firing rate goes down.

Sprint 32 substrate showed this empirically: same paragraph,
+35pp / -20pp.

Candidate restructures to research in Stage 1 (the literature may
point at others):

- **Separate "when to fire" from "how to fire when firing."** The
  positive trigger (Step B's noun-matching paragraph above) drives
  the fire-or-don't decision. The slug shape applies *only* once
  the model has decided to fire. Has this framing been named in
  prompt-engineering literature?
- **Positive imperative instead of negative list.** "Pass the slug
  verbatim as listed in the skills block" vs the current "never a
  path, never a prefix, never a description." Lab guides (Anthropic
  / OpenAI / Google) — do they recommend positive imperatives over
  negative-constraint lists? Any evidence on family-specific
  responses?

Stage 1's memo picks the specific wording to try. Stage 3's substrate
runs it. If pre-flight at N=5 shows asymmetric signs, Stage 2 rewrites
based on what the research suggests as the next-best pattern.

Open question to think deeply about: is there a cross-family
phrasing that lifts BOTH families above current variant-B numbers,
or is the ceiling that variant-B already saturated MiniMax and Sprint
33's best-case is "preserve MiniMax's lift AND restore Haiku to
variant-A's 50%"? Either is acceptable; the brief doesn't pre-commit.
The research memo should look for evidence either way.

### Candidate 2 — Relocate "act don't describe" to the redline tool surface

Sprint 32 confirmed at scale on BOTH families that ADR-108's fix 3
(the "act don't describe" paragraph in the cross-cutting section of
`discoveryDoctrine.ts`) does not change behaviour:

- MiniMax 30-rfq Turn 5 redline invocation: 2/20 (10%) on both
  variants.
- Haiku 30-rfq Turn 5 redline invocation: 0/10 (0%) on both variants.

Both families plan the redline in prose and never issue the actual
tool call. The doctrine-from-mid-prompt cannot reach end-of-flow
behaviour. This was the Sprint 31B manual finding; Sprint 32
reproduced it at scale on a second family. The diagnosis is sound.

Sprint 33 candidate: **move the "act, don't describe" guidance into
the redline tool's surface description**, where it fires at the
actual decision point (the tool-use trigger surface) rather than at
the top of the system prompt where it's lost in 15K of context by
the time Turn 5 arrives.

This is a one-file change to `commercialRecipe.ts` (or wherever the
redline MCP's tool description is defined). The wording stays
model-agnostic — the candidate is *where* the guidance lives, not
*what* it says.

Open question: should this be a permanent doctrine relocation (delete
the cross-cutting section from `discoveryDoctrine.ts`, add it to the
redline tool description), or a hybrid (keep the short cross-cutting
reminder for non-redline affordances; move the redline-specific
language to the tool surface)? Default position: hybrid — generic
"act don't describe" stays for non-redline contexts, redline-specific
language moves.

### Candidate 3 — Sharpen skill negative guard for cross-document tasks

Sprint 32 surfaced the **MiniMax-specific** +25pp wrong-skill firing
rate on 30-rfq under variant B (4/20 → 9/20). Haiku correctly stays
at 0/10 on both variants on the same scenario.

The asymmetry isn't a doctrine-vs-Haiku problem — Haiku's negative
guard is already firing correctly. The asymmetry is that variant-B's
clearer skill-trigger paragraph makes MiniMax more eager, and on
cross-document scenarios (where no single skill canonically applies)
that eagerness translates to wrong-skill noise.

Sprint 33 candidate: **add or sharpen language in Step B that names
the cross-document trigger shape explicitly**. Cross-document review
tasks (RFQ pack with 7 docs; M&A diligence room; multi-document
contract bundle) are NOT skill-shaped, even when the parent topic
matches a skill noun. A skill applies to ONE document at the
canonical task level; a 7-doc cross-document analysis is broader.

Wording must work across families. Haiku currently handles this case
correctly without explicit language; the change must not regress
Haiku into over-firing. Pre-flight at N=5 on both families confirms
neutrality.

Open question: is the right framing on the positive side (sharpen
Step B's positive trigger to exclude cross-document shapes — "a slug
names the task at its actual level; a 7-doc RFQ pack is broader than
any single slug like `vendor-agreement-review`") or on the negative
side (sharpen the existing negative guard — "skip if the ask spans
multiple independent documents")? Either could work. The substrate
shows which.

## Stage 3 — Substrate measurement (per [[ADR-109]])

For each candidate that survives Stage 1's research filter (i.e., the
memo recommends a specific wording), build a variant binary, pre-flight
at N=5 cross-family, then scale to N=20 MiniMax + N=10 Haiku if
pre-flight shows cross-family neutrality. Substrate scripts at
`evals/matter-runtime/scripts/` are unchanged from Sprint 32.

Stage 3 inherits Sprint 32's substrate completely:

- Variant binaries built via `scripts/build-variant.sh` (the goosed
  fallback chain from Sprint 32 is in place).
- `pair-send-verified` polling sessions.db is in place — silent API
  failures surface as WARN events (the lesson from Sprint 32's
  OpenRouter cap exhaustion).
- `judge-cycle.js` extracts rubric fields programmatically (doctrine
  mask preserved because the script has no doctrine priors).
- `aggregate-report.js` produces the per-cell tables; CC writes the
  per-candidate verdicts.

## Cold-start reading order

1. `PROJECT.md` — Sprint Index (Sprint 32 should be the most recent on-disk)
2. `CLAUDE.md` — operating rules, especially "Reuse over rebuild — Goose" (lines 56-60: provider is DI)
3. `SPRINT_LOG.md` — Sprint 32 entry (cross-family findings), Sprint 31B (the doctrine variant B baseline), Sprint 31A (cross-model patterns), Sprint 31 (original doctrine)
4. `docs/adr/108-doctrine-refinements-sprint-31b.md` — the doctrine being recalibrated
5. `docs/adr/107-cross-model-uptake-patterns.md` — the structural finding Sprint 33 is responding to
6. `docs/adr/109-matter-runtime-eval-methodology.md` — substrate methodology
7. `evals/matter-runtime/reports/sprint-32-baseline.md` — the per-fix tables Sprint 33 is iterating against
8. `ui/desktop/src/components/oscar/recipe/discoveryDoctrine.ts` — the current wording (variant B, post-ADR-108)
9. `evals/matter-runtime/scripts/` — substrate (the variant-build, run-cell, judge-cycle, aggregate-report pipeline)
10. Memory: `feedback_doctrine_model_agnostic.md` — provider is DI; never propose per-family variants

Before writing any code: re-read the Sprint 32 baseline report's "Per-fix verdicts" section end-to-end. The cross-family asymmetry numbers are the load-bearing reference for whether a Sprint 33 candidate has actually achieved balance.

**Before writing any candidate wording**: produce the research memo at `docs/sprint-33/research-memo.md` per Stage 1 above. The memo informs the wording; the wording does not lead.

## Variant naming convention

Sprint 32 used `A` / `B`. Sprint 33's candidates start at `C`:
- `C` = recalibrated fix 1 (slug exactness; wording per Stage 1 memo)
- `D` = relocated fix 3 (act-don't-describe → redline tool surface)
- `E` = sharpened skill negative guard for cross-document tasks

Each variant is a commit SHA; build via `scripts/build-variant.sh`.
Update `lib-variants.js` per variant.

## Deliverables

- `docs/sprint-33/research-memo.md` — Stage 1's cross-model
  prompt-portability research, ~2-4 pages, with citations.
- One or more new variant commits, each with one wording change to
  `discoveryDoctrine.ts` or one new entry in
  `commercialRecipe.ts` (for candidate D's tool-surface relocation).
  Wording chosen by the research memo, not by guessing.
- Per-candidate substrate run at N=20 MiniMax + N=10 Haiku on the
  load-bearing cells (30-ndas + 30-rfq + the negative scenarios for
  candidates C and E).
- One ADR per candidate that ships (next free number from
  `docs/adr/`). Cites ADR-108 (the variant being recalibrated) and
  ADR-109 (the substrate that validated). ≤50 lines per CLAUDE.md.
- `evals/matter-runtime/reports/sprint-33-baseline.md` with
  per-candidate cross-family tables and per-candidate verdicts.
- SPRINT_LOG entry + PROJECT.md Sprint Index row.

## Cost envelope

Sprint 32 used ~$13 OpenRouter for the Haiku cells across the matrix
+ re-run (40 useful cycles total). OpenRouter sits at ~$10 remaining
at Sprint 33 open. Sprint 33's MiniMax spend is $0 marginal (Token
Plan sunk). Per-candidate Haiku cells at N=10 cost ~$4 each; three
candidates × 2 variants per candidate × N=10 = 60 Haiku cycles ≈
$24, **over the remaining OpenRouter cap**.

Realistic shape (decide in plan-mode, do not pre-resolve):

- **Sequence candidates** — do candidate 1 first (highest-value
  ADR-108 recalibration), measure, ADR + commit. Candidates 2 and
  3 follow as separate variants. Each variant's Haiku cost is
  ~$4. Stop or top up OpenRouter before exceeding the cap.
- **Pre-flight only on Haiku** — run full N=20 on MiniMax (free),
  Haiku at N=5 pre-flight only unless cross-family balance is
  confirmed at N=5 and budget allows N=10. The N=10 → N=5 reduction
  matches Sprint 32's substrate budget shape.
- **Defer to Sprint 33b if the cap binds** — Sprint 33 ships
  candidate 1 if that's all the budget allows; candidates 2 and 3
  carry to a 33b sprint.

## Out of scope

- **Per-family doctrine variants.** Off the table per provider-as-DI.
  If a candidate cannot be balanced across families through wording
  alone, that's Sprint 34's problem (Layer 3 candidate or
  tool-description refinement), not a permission to branch on
  provider.
- **New scenarios.** Sprint 30 RFQ + 10-NDA fixtures stay the load-
  bearing reference. Negative-control + playbook-mismatch stay for
  noise denominator.
- **GPT-5.4-mini cell.** Sprint 32b candidate; Sprint 33 stays on
  MiniMax + Haiku. (Adding GPT would test whether Sprint 33's
  recalibration also balances against a third family — that's the
  right Sprint 34 question, not Sprint 33's load.)
- **Sub-recipe / tool-side architecture changes for delegate.**
  MiniMax delegate gap (5-20% firing rate vs Haiku's 50-60%) is
  documented by Sprint 32 + ADR-107. The Sprint 33 work is doctrine
  wording — not closing the delegate gap structurally.
- **Substrate rebuild or refactor.** `aggregate-report.js` hand-edit
  overwrite carry-forward (Sprint 32 finding) is a Sprint 33b
  candidate, not Sprint 33's load.

## Open questions to think deeply about (do not pre-resolve)

- **What's the right candidate-1 wording?** The brief sketches a
  hypothesis (positive imperative; separate when-to-fire from
  how-to-fire) but doesn't pick the answer. Sprint 33 should try at
  least two phrasings and let the substrate pick. Worth thinking
  about whether the candidate should make the slug shape MORE
  prominent (eager prompt) or LESS prominent (let the model figure
  it out from the slug list). Sprint 32 evidence: MiniMax responds
  to prominence; Haiku responds to wording shape.

- **Is hybrid the right shape for candidate 2?** Default position in
  this brief is hybrid (cross-cutting "act don't describe" stays for
  non-redline; redline-specific language moves to the redline tool
  surface). But the alternative — full relocation, delete the
  cross-cutting paragraph entirely — would test whether the doctrine
  was contributing anything for non-redline affordances. If
  non-redline affordances stay flat under full relocation, the
  cross-cutting paragraph wasn't doing work and should be deleted.

- **Does candidate 3 belong in Step B's positive trigger or as a
  separate negative-guard paragraph?** Adding "skip on multi-document"
  to the existing negative guard reads as another rule; rewriting
  Step B's positive trigger to define "task noun at the right level"
  reads as a clarification. Either could work. Substrate decides.

- **Should Sprint 33 also run candidate-2's pre-relocation baseline
  on Haiku?** Sprint 32 has variant-A and variant-B Haiku data for
  fix 3 (0pp delta). Re-running pre-relocation isn't necessary if
  the Sprint 32 data is the baseline. Default position: skip the
  re-run; use Sprint 32 data as the pre-relocation Haiku baseline.

- **What's the exit criterion?** Sprint 33 closes when:
  (a) at least one candidate produces cross-family balance at
  N=20/10 — i.e., no opposite-sign effects — and the substrate
  confirms; OR
  (b) all three candidates have been measured and none achieves
  balance (Sprint 34 input on whether wording-only doctrine work
  has hit a ceiling).

- **Whether to revisit Sprint 32 substrate carry-forwards mid-sprint.**
  Sprint 32 has 9 carry-forwards. The pair-send-verified fix is in
  place; the rest (GPT cell, Haiku negative scenarios, per-cycle
  wall-clock logging, `aggregate-report.js` hand-edit preservation,
  goosed-from-worktree-build fallback documentation) are not Sprint
  33's load. Don't accumulate.

- **What if the research memo concludes "the literature already shows
  this asymmetry is unavoidable through wording alone"?** That would
  be the Sprint 33-as-research-only outcome: ship the memo, ship the
  ADR documenting the finding, defer wording changes to Sprint 34
  with a different shape (tool-side, sub-recipe, post-processing).
  This is acceptable — research that closes off a direction is also
  forward motion. The substrate spend doesn't happen if Stage 1
  concludes the candidates are dead-ends.
