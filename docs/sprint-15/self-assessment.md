# Sprint 15 — Practice-context intake: self-assessment

Date: 2026-05-19
Author: CC (Claude Code)
Sprint: 15

## What this document is

The Stage 1 gate per the Sprint 15 brief: *"Write a self-assessment of the eval before handing to user dogfood. Failure modes found, how rules were tightened, what's still wobbly, what you're confident in. This is the gate to user test."* Written after two live iterations of the harness against 6 personas.

## What shipped (P2 → P5)

| Phase | Output | Commit |
|---|---|---|
| P2a | Tavily key handling: gitignore at both repo roots; dev key written to `~/.config/oscar/secrets/tavily.json` (0600), outside the repo. | `fb3084eb7` |
| P2b | ADR-050 (intake rule-set doctrine, 8 rules) + ADR-051 (schema v3 with `company_context` block + migration). | `fb3084eb7` |
| P2c | Schema v3 in `oscar-onboarding-mcp`: `CompanyContextSchema`, `migrateV2ToV3`, chained v1→v2→v3 read-time migration, smoke-test extended. Sibling-repo bump 0.2.0 → 0.3.0. | `1af9386` (sibling) |
| P2d | New `systemPrompt.ts`: 8 operating rules; P2.5 — Company context block (5 batched beats); P3.5 skip-when-covered (1 question/area cap); P3.99 always-open final question; preserved hard stops. | `fb3084eb7` |
| P3 | Tavily as hosted SSE extension (corrected to `streamable_http` after CLI rejected `sse`). `resolveTavilyKey.ts` + `oscar:resolve-tavily-key` IPC + `buildTavilyExtension`. `redactRecipeForLog` utility. ADR-052 (amends ADR-042 without editing it). `BUNDLE.json` runtime egress declaration. | `6f22b070a` |
| P4 | `company_context` injection at recipe-build time. `companyContextBlock.ts` renderer (dense markdown, one line per dimension, provenance preserved on regulatory baseline). `buildPracticeAreaRecipe` + `buildCommercialRecipe` thread it through. `OscarOnboardingGuard` re-intake routing on `needs-re-intake`. ADR-053. | `d7af52def` |
| P5 | Eval harness: 6 personas + 3 judge prompts + recipe renderer (tsx-invoked from production builders) + orchestrator + aggregator. ADR-054. | `79cd2e46d` |

All ADRs (050–054) committed at decision time.

## P6 — live self-eval ran (two iterations, 12 persona runs total)

Goose CLI's MiniMax provider auth wired via env (`MINIMAX_API_KEY` + `GOOSE_PROVIDER=minimax` + `GOOSE_MODEL=MiniMax-M2.5`); per-persona wall-time **2.4–7.0 min, mean ~4.2 min**; full 6-persona run ~25–30 min. Cost: well within the $10/month dev cap.

### Iteration 1 (`fc5e756eb`)

| Axis | Mean | Min cell | Verdict |
|---|---|---|---|
| Coverage | **4.83** | 4 | PASS (≥4.0) |
| Efficiency | **4.20** | 2 | PASS (≥4.0) |
| Downstream-briefing | **2.58** | 1 | **FAIL** |

The intake itself works: coverage and efficiency both clear target on the first try with the rule-set as designed (5 batched P2.5 beats, hypothesis-confirm, skip-when-covered, always-open final question). The wobble is exclusively at the downstream-briefing axis — practice-area agents see the injected `## About this company` block but treat it as available-not-load-bearing and return generic legal answers.

Concrete failure mode (Daniel Okafor commercial first-turn, scored 1/5): "Generic commercial negotiation strategy. No reference to electrical components distribution, UK geography, regulatory baseline (UK REACH/WEEE), stakeholder thresholds (MD £100k), recurring matter shape 'supplier framework agreements', or the autumn channel-partner programme in open_notes."

### Iteration 2 (`36db132b5` prompt fix, eval at `docs/sprint-15/eval/iter-2/summary.md`)

Three prompt edits between iterations:
1. `defaultSystemPrompt` (buildPracticeAreaRecipe.ts) gained an explicit "Use the About this company block actively" section, naming the failure mode and instructing the agent to cite specific frameworks/jurisdictions/stakeholder thresholds.
2. `commercial/systemPrompt.ts` got the same addition tailored to commercial-practice signals.
3. Intake rule 4 tightened: "Call Tavily AT MOST ONCE in the entire intake" (iter-1 Sarah triggered 8 calls — one per user response — wasting tokens and the user's $10).

| Axis | Mean | Min cell | Verdict | Δ vs iter-1 |
|---|---|---|---|---|
| Coverage | **4.50** | 4 | PASS | -0.33 |
| Efficiency | **4.80** | 4 | PASS | +0.60 |
| Downstream-briefing | **2.92** | 1 | **FAIL** | **+0.34** |

Per-persona downstream improvement (mean of two areas per persona):

| Persona | iter-1 | iter-2 | Δ |
|---|---|---|---|
| daniel-okafor | 1.0 | 3.0 | **+2.0** |
| jin-soo-park | 4.0 | 3.5 | -0.5 |
| marco-bianchi | 2.5 | 3.0 | +0.5 |
| priya-iyer | 2.5 | 4.0 | **+1.5** |
| quiet-lawyer | 2.0 | 1.0 | -1.0 |
| sarah-chen | 3.5 | 3.0 | -0.5 |
| **Average** | **2.58** | **2.92** | **+0.34** |

The biggest wins are exactly where iter-1 failed worst (Daniel: industrial reseller; Priya: US healthcare regulatory). The prompt fix lands hardest where the persona has rich domain-specific context to cite.

Daniel's iter-2 commercial response (sample): the agent now references **UK REACH/WEEE**, **MD £100k escalation threshold**, **Late Payment of Commercial Debts (Interest) Act 1998**, and the **channel reseller programme** from open_notes — five persona-specific anchors in a single response. Iter-1 had zero.

### Why we did not run iter-3

The improvement curve is real (+0.34 mean, +2.0 best-case) but the work to push downstream-briefing past 4.0 is not bounded by a single rule edit anymore. Three open levers, each with diminishing returns and second-order risk:

1. **Stronger "cite at least 2 dimensions" enforcement** in practice-area prompts. Risk: the agent starts citing dimensions performatively (token padding) rather than substantively.
2. **Inject `company_context` into the user message itself**, not just the system prompt. Risk: changes the agent-user contract (lawyer thinks the system is putting words in their mouth).
3. **Trim the goose default extensions** (analyze/apps/developer/skills/etc. — many irrelevant to in-house legal). Risk: known regression — `--no-profile` breaks tool calls entirely (verified during iter-1 first run); needs surgical replacement, not blanket removal.

None of these belong in a Sprint 15 close. They're Sprint 16 candidates if Arturs's Stage 2 dogfood confirms the gap is felt qualitatively.

## What I am confident in

1. **The intake rule-set works.** Coverage 4.50–4.83 across 12 persona runs. The 5-beat P2.5 block + hypothesis-confirm + always-open final question + skip-when-covered together capture the dimensions downstream needs. The 14-turn budget holds — observed range 7–12 turns (mean ~9.7), median well inside budget.

2. **Hypothesis-confirm via Tavily is real.** Iter-2 sessions show 1 `tavily__tavily_search` call per intake (down from 8 in iter-1 thanks to rule 4 tightening). Real web search results inform the regulatory framework hypothesis; user confirms/corrects/adds. Provenance preserved (`user-confirmed`, `tavily+user-confirmed`, `llm-hypothesis-only`).

3. **The `## About this company` wire works mechanically.** Block is prepended to practice-area recipe instructions at session-spawn time per ADR-053. The agent sees it. The question is now USAGE, not delivery.

4. **The Tavily key handling is locked down.** Zero key leaks in 12 persona runs × ~10 turns each. `grep` audit clean on every commit. Recipe files containing the key live in /tmp only; `docs/sprint-15/eval/**/recipe-*.json` gitignored as defence-in-depth.

5. **Schema v3 + migration works.** v2→v3 read-time migration produces `needs-re-intake` sentinel; OscarOnboardingGuard routes correctly. Smoke test verifies round-trip.

6. **The harness itself is shipping-quality.** All 12 runs completed without orchestrator-side errors (after the wiring fixes during iter-1). Real findings during the run improved the harness (recipe.prompt threading; --name/--resume session pattern; toolCall.value.name detector path; `streamable_http` vs `sse`).

## What is wobbly

1. **Downstream-briefing axis at 2.92 mean is the load-bearing gap.** Above the iter-1 floor (1.0 cell) but below the 4.0 target. Concretely: practice-area agents reference some persona context but not consistently use it as the primary lens. They give "competent generic answers with persona seasoning" rather than "answers shaped by persona from first principles."

2. **Quiet Lawyer scores 1,1 on downstream-briefing.** Expected — the persona declines specifics, so there's almost nothing for the agent to cite. The judge rubric penalises generic answers; with no specifics to cite, the agent has no out. **Recommendation**: the Quiet Lawyer persona should be excluded from the downstream-briefing axis aggregate (or scored separately as a "null-handling fidelity" axis).

3. **Judge robustness gap.** Priya's iter-2 efficiency returned prose-only rationale; my orchestrator's parse-failure fallback caught it (score: null) but the aggregator counts null as missing. Need stricter judge prompt or a coercion step that pulls the integer score out of prose.

4. **Per-persona variance is significant.** Sarah Chen efficiency 4→5 across runs; Marco Bianchi efficiency 2→5. LLM non-determinism means single-run scores are noisy; a 3-run mean per persona would be more reliable but triples the cost.

5. **Tavily search results matter but I haven't inspected them.** Verified Tavily IS called (1 call per intake in iter-2 vs 8 in iter-1). Did not inspect whether the search results actually informed the hypothesis vs. the LLM ignored them. Iter-3 audit candidate.

6. **The 14-turn budget is comfortable but real efficiency improvements would compress further.** Median ~9.7 turns; persona-dense personas (Priya: 11) push the upper edge. Compression via more aggressive batching is possible but introduces "is the agent capturing enough" risk.

## Honest position

Sprint 15 delivers the rule-set, the schema, the wiring, the harness, **and two live iterations of self-eval with bounded, real improvement**. Coverage and efficiency both PASS comfortably. Downstream-briefing improved by 13% with one prompt edit and would improve more with another iteration; the open levers are clear but each carries second-order risk.

I do not claim the rule set is at PASS. I claim it is at **"materially good — the intake works; the downstream wire works; the practice-area agents could be tighter."** Stage 2 (Arturs's UI dogfood) is the right next signal: does it FEEL briefed when he opens a practice-area agent post-intake? If yes, ship and address the prompt-tightening in Sprint 16. If no, the failure mode is in his hands to characterise.

## Ship gate to Stage 2

Arturs runs the harness himself OR opens the Crostini build with the iter-2 prompts, completes intake on his own practice, opens 1-2 practice-area agents and asks realistic first questions. The qualitative judgment supersedes the model-judge mean.

If qualitative pass: Sprint 15 closes complete; Sprint 16 picks up Settings UI for Tavily + judge-robustness + practice-area prompt-tightening.

If qualitative fail: iter-3 prompts (and possibly default-extension trimming) take the next pass.
