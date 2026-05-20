# Sprint 23 baseline — Lavern-baselined partner consultation eval

Closing eval for Sprint 23. The full per-tuple data is in
`evals/lavern-jv/runs/2026-05-20T20-57-04-208Z/{transcripts,scores}/`
(gitignored; reconstructable by checking out the closing SHA and re-running
`node evals/lavern-jv/scripts/run-eval.js`).

## Headline

| Metric | Value |
|---|---|
| Δ_grounded (with-Ralph − without-Ralph), grounding-touched items | **-3.8pp** |
| Mean recall, grounding-touched items, with-Ralph | 33.3% (n=9, CI [13.8%, 57.3%]) |
| Mean recall, grounding-touched items, without-Ralph | 37.1% (n=8, CI [20.1%, 66.8%]) |
| Mean `grounded_citations`, with-Ralph | 0.71 |
| Mean `grounded_citations`, without-Ralph | 0.96 |
| Mean `hallucination_count`, both configs | 0.00 |
| Partner runs succeeded | 14 / 18 |
| Judge calls succeeded | 17 / 18 |
| Wall-clock | 2679.8 s (~44.7 min) |
| Cost | ~$1.40 against $10/PCM dev-key envelope |

## Provenance

- Run timestamp: `2026-05-20T20-57-04-208Z`
- Oscar GC SHA at run: `b3fca0ef1685671776a5ac9b053b23cda6736d35` (Piece 2 scaffolding commit; Piece 1 already on branch at `70d82658d`)
- Sprint 22 baseline SHA (frozen for the without-Ralph leg): `08a5381a7`
- Lavern source SHA: `7c2efe61524b14c632bee8f14d9bbcbdd85d0cfd` (Apache 2.0)
- Model: `MiniMax-M2.5`

## Verdict: Δ_grounded is negative — Shape A wasn't enough

Per ADR-076's exit-criterion framing: if with-Ralph does not measurably
score higher than without-Ralph on grounding-touched rubric items, "that's
the signal that Shape A wasn't enough and the next sprint reconsiders
shape." That signal has fired:

- **-3.8pp** on the headline grounding-touched recall comparison.
- **-0.25** on the mean `grounded_citations` global axis.
- **No improvement on hallucination_count** (both configs at 0 — both
  configurations are equally good at not making up text; the Ralph Loop
  isn't necessary to prevent hallucination in this corpus).

The most striking finding is that **with-Ralph's `grounded_citations`
score is actually LOWER than without-Ralph** (0.71 vs 0.96). The Ralph
Loop's verbatim-quote requirement and revision protocol are not
producing better-grounded citations on average; they're producing worse
ones — likely because the revision protocol burns turns that would
otherwise be spent on substantive analysis, and the truncated outputs
on timed-out runs leave citations partially-formed.

## Per-tuple results

| Doc | Partner | Config | Recall (all) | Recall (gt) | Grounded citations | VP cited | Tone fit | Halluc | Overprod | Note |
|---|---|---|---|---|---|---|---|---|---|---|
| doc1-borrowmoney | sarah-chen | with-ralph    | 0.0%  | 0.0%  | 1.00 | Y | 1 | 0 | — |  |
| doc1-borrowmoney | sarah-chen | without-ralph | 0.0%  | 0.0%  | 1.00 | Y | 1 | 0 | — |  |
| doc1-borrowmoney | helena-voss | with-ralph    | 58.3% | 63.6% | 0.70 | Y | 1 | 0 | — | timeout truncation; still wins +33pp on this tuple |
| doc1-borrowmoney | helena-voss | without-ralph | 25.0% | 27.3% | 1.00 | Y | 1 | 0 | — |  |
| doc1-borrowmoney | aisha-khan | with-ralph    | 16.7% | 18.2% | 0.92 | N | 0 | 0 | — | VP not cited |
| doc1-borrowmoney | aisha-khan | without-ralph | 16.7% | 18.2% | 1.00 | Y | 1 | 0 | — | tied recall |
| doc2-sibannac    | sarah-chen | with-ralph    | 60.0% | 71.4% | 1.00 | Y | 1 | 0 | — |  |
| doc2-sibannac    | sarah-chen | without-ralph | 70.0% | 71.4% | 1.00 | Y | 1 | 0 | — | -10pp on all-recall, tied on grounding-touched |
| doc2-sibannac    | helena-voss | with-ralph    | 0.0%  | 0.0%  | 0.00 | N | 0 | 0 | — | timeout truncation |
| doc2-sibannac    | helena-voss | without-ralph | —     | —     | —    | — | — | — | — | **JUDGE_PARSE_FAILED** — judge wrote "MISSING" instead of "MISSED" |
| doc2-sibannac    | aisha-khan | with-ralph    | 40.0% | 42.9% | 1.00 | Y | 1 | 0 | — |  |
| doc2-sibannac    | aisha-khan | without-ralph | 60.0% | 71.4% | 1.00 | N | 1 | 0 | — | -20pp on all-recall, -29pp on gt |
| doc3-veoneer     | sarah-chen | with-ralph    | 0.0%  | 0.0%  | 0.00 | Y | 0 | 0 | N | timeout truncation |
| doc3-veoneer     | sarah-chen | without-ralph | 14.3% | 0.0%  | 0.90 | Y | 1 | 0 | Y | flagged overproduction (>6 risks) |
| doc3-veoneer     | helena-voss | with-ralph    | 14.3% | 20.0% | 0.80 | Y | 1 | 0 | N | timeout truncation |
| doc3-veoneer     | helena-voss | without-ralph | 71.4% | 80.0% | 0.80 | Y | 2 | 0 | N | -57pp on gt due to with-Ralph timeout |
| doc3-veoneer     | aisha-khan | with-ralph    | 71.4% | 100%  | 1.00 | Y | 2 | 0 | N | full grounding-touched coverage |
| doc3-veoneer     | aisha-khan | without-ralph | 71.4% | 80.0% | 1.00 | Y | 2 | 0 | N | with-Ralph wins +20pp on gt here |

## The timeout pattern is confounding the comparison

**4 of 9 with-Ralph runs hit the 300s partner-call timeout** (Sarah×Doc 3,
Helena×Doc 1, Helena×Doc 2, Helena×Doc 3). On all four, the partner
process was killed mid-revision-loop and the truncated stdout was
scored. Three of these (Sarah×Doc 3, Helena×Doc 2, Helena×Doc 3)
contributed near-zero recall against without-Ralph completed runs of 14%,
?, and 71% respectively — substantially dragging the with-Ralph mean.

Excluding the four timed-out with-Ralph tuples (and their without-Ralph
counterparts, plus the parse-failed Helena×Doc 2 without-Ralph row), the
"both-configs-completed-clean" comparison set is:

- Sarah × Doc 1 (with 0%, without 0%) → tie
- Helena × Doc 1 (with 58.3%, without 25%) → **with-Ralph +33pp**
- Aisha × Doc 1 (with 16.7%, without 16.7%) → tie
- Sarah × Doc 2 (with 60%, without 70%) → with-Ralph -10pp
- Aisha × Doc 2 (with 40%, without 60%) → with-Ralph -20pp
- Aisha × Doc 3 (with 71.4%, without 71.4%) → tie on all-recall, +20pp on grounding-touched

**Clean-comparison pattern:** 1 strong win (Helena × Doc 1), 1 narrow win
on the grounding-touched subset only (Aisha × Doc 3), 2 ties, 2 losses.
Mixed. Even removing the timeout artifact, there is no strong signal that
Shape A's Ralph Loop measurably improves grounding behaviour.

## What the data tells us about Shape A

1. **Ralph Loop's revision discipline overflows the 300s partner-call
   budget on complex documents.** All 4 timeouts are with-Ralph. Sprint 24
   has two options to address: (a) increase partner-call budget (cheap,
   doesn't fix root cause); (b) tighten the revision conditions so the
   LLM only revises on substantive ISSUES, not on every minor verification
   feedback.

2. **The verbatim-quote requirement may be counterproductive.** The
   `grounded_citations` axis dropped 0.25 with Ralph. One hypothesis: the
   LLM tries to construct a "verbatim verification-pass quote" earlier in
   the response and then loses thread, leading to less rigorous citation
   in the substantive analysis itself. Worth diagnosing in a focused
   sub-sprint.

3. **No hallucination improvement.** Both configs scored 0 mean. The
   Ralph Loop isn't necessary for hallucination prevention in this corpus
   — MiniMax-M2.5 + Sprint 22's verification invocation are already
   sufficient on these three CUAD docs.

4. **Partner-tone-fit is unchanged.** With-Ralph and without-Ralph have
   roughly the same `partner_tone_fit` distribution. The Ralph Loop is
   not changing how partner-fluent the analyses are.

5. **Sarah × Doc 1 (0/12 both configs)** is striking. Both Sarah's
   configurations missed the rubric's clauses 32-33 indemnification + cl
   19 unanimous consent + cl 20-22 asymmetric capital and all the other
   load-bearing risks. Spot-check confirms Sarah quoted adjacent clauses
   (cl 38-39 non-pooling; cl 40 intangibles valuation; cl 17 capital lock)
   instead of the rubric's items. This is a partner-quality finding
   independent of Ralph Loop — Sarah on Doc 1 is missing what the rubric
   considers material. Sprint 24+ should look at this.

## Recommendation (informs Sprint 24 plan-mode)

Per ADR-076 and the brief's exit-criteria framing, the negative Δ_grounded
result triggers a Sprint 24 reconsideration. Options:

- **Shape B (substrate-borne)**: thread a structured REVISE signal through
  `delegate()` return into the parent's session loop, gated by a
  Recipe-level revision-count field. Touches `crates/goose/src/agents/`
  Rust core. Per CLAUDE.md "Do not modify the Rust core unless absolutely
  necessary" — this eval is the "absolutely necessary" evidence. ~100-150
  LOC, upstream-merge cost.
- **Shape A-tightened**: keep prompt-borne discipline but redesign the
  paragraph to (a) NOT require verbatim quoting in the response body (move
  the audit signal somewhere else), (b) NOT enumerate the revision count
  if it's burning turns, (c) only trigger revision on a smaller subset of
  ISSUES (RED severity only?). Cheaper but doesn't fix the budget overflow.
- **Hybrid**: keep prompt-borne discipline + extend partner-call timeout
  to 600s + tune verification-pass to return more selective ISSUES. May be
  the cheapest path to better signal in Sprint 24's eval rerun.

The brief's drop-order from Sprint 23 is consumed; Sprint 24 reopens the
Shape A vs Shape B architectural call with this data.

## Known coverage gaps in this eval

1. **`oscar-document-reader` not exercised.** Document-reader ships with
   a placeholder corpus (3 sample SaaS+NDA docs); the partner reads the
   CUAD doc from the user-message paste, not via document-reader.
   Document-reader is in the loadout but not load-bearing here.
2. **`verification-pass` receives doc text via `delegate()` args** — a
   double-paste with the partner's user message. Per ADR-074, sub-recipes
   don't inherit parent extensions. Token waste; doesn't affect rubric
   coverage but worth noting.
3. **Lavern human-baseline comparison: not surfaced in this report.**
   Lavern's `EVAL_REPORT_V*.md` files are on gemma2:2b through a different
   pipeline shape (Watchman → Reader → precedent-board → Curator). Score
   level is not directly comparable; the rubric-item match patterns
   *could* be compared for divergence flagging but adding that as a
   separate analysis pass would be its own work.
4. **n=17 / n=18 due to one judge PARSE_FAILED** (judge wrote "MISSING"
   instead of "MISSED" on Helena × Doc 2 × without-Ralph; my schema
   validator correctly rejected, retry also returned a malformed shape).
   The validator could accept "MISSING" as a synonym in a future eval
   revision; not load-bearing for this run.

## Reproducibility

To regenerate this report at a future SHA:

```bash
git checkout <sprint-23-close-sha>
# Bundled resources are required (Tier-A MCPs + verification-pass.yaml):
cd ui/desktop && pnpm bundle:oscar-linux
# Run the eval (~45 min, ~$1.40):
node evals/lavern-jv/scripts/run-eval.js
diff -u evals/lavern-jv/reports/sprint-23-baseline.md evals/lavern-jv/runs/<new-ts>/REPORT.md
```

Run-to-run drift is expected (LLM variance, especially on which clauses
the partner cites). The headline Δ_grounded should remain negative
within reasonable variance until either Shape A is tightened or a
Shape B alternative is introduced.

## Carry-forwards

1. **Δ_grounded < 0 → Sprint 24 reconsiders shape.** ADR-076 expected this
   path; the brief explicitly anticipates it. Sprint 24 plan-mode reopens
   the architectural call with this data.
2. **Partner-call timeout** is too tight at 300s for Ralph Loop runs on
   complex docs. Sprint 24 implementation note.
3. **Judge schema can accept "MISSING" as synonym for "MISSED"** — minor
   validator robustness tweak. Trivial; not blocking anything.
4. **Sarah × Doc 1 quality problem** (both configs 0/12) is independent of
   Sprint 23 scope. May indicate Sarah's prompt has a gap around
   first-pass indemnification reading; carry-forward.
5. **Document-reader not exercised in this eval** — Sprint 24+ could
   extend the eval to use document-reader against the CUAD docs (would
   require teaching document-reader to parse CUAD plain-text format).
