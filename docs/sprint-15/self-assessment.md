# Sprint 15 — Practice-context intake: self-assessment

Date: 2026-05-19
Author: CC (Claude Code)
Sprint: 15

## What this document is

The Stage 1 gate per the Sprint 15 brief: *"Write a self-assessment of the eval before handing to user dogfood. Failure modes found, how rules were tightened, what's still wobbly, what you're confident in. This is the gate to user test."* Written honestly, including what was **not** run in this session.

## What shipped (P2 → P5)

| Phase | Output | Commit |
|---|---|---|
| P2a | Tavily key handling: gitignore patterns at both repo roots; dev key written to `~/.config/oscar/secrets/tavily.json` (0600), outside the repo. | `fb3084eb7` (gitignore in goose-side commit) |
| P2b | ADR-050 (intake rule-set doctrine, 8 rules) + ADR-051 (schema v3 with `company_context` block + migration). | `fb3084eb7` |
| P2c | Schema v3 in `oscar-onboarding-mcp`: `CompanyContextSchema`, `migrateV2ToV3`, chained v1→v2→v3 read-time migration, smoke-test extended to verify v3 round-trip + v2→v3 migration. Sibling-repo bump 0.2.0 → 0.3.0. | `1af9386` (oscar-onboarding-mcp) |
| P2d | New `systemPrompt.ts`: 8 operating rules; P2.5 — Company context block (5 batched beats: industry+size, geography, hypothesis-confirm, recurring matters + stakeholders, risk appetite); P3.5 skip-when-covered (1 question/area cap); P3.99 always-open final question; preserved hard stops. | `fb3084eb7` |
| P3 | Tavily as hosted SSE extension (no bundling cost). `resolveTavilyKey.ts` + `oscar:resolve-tavily-key` IPC + `buildTavilyExtension`. `redactRecipeForLog` utility. ADR-052 written, amends ADR-042 (network egress) without editing it. `BUNDLE.json` gains `runtime_egress_optional[]` section emitted by `prepare-oscar-bundle.js`. | `6f22b070a` |
| P4 | `company_context` injection at recipe-build time. `companyContextBlock.ts` renderer (dense markdown, one line per dimension, provenance preserved on regulatory baseline). `buildPracticeAreaRecipe` + `buildCommercialRecipe` thread it through. `OscarOnboardingGuard` routes `captured_via === "needs-re-intake"` profiles back into onboarding. ADR-053. | `d7af52def` |
| P5 | Eval harness: 6 personas + 3 judge prompts + recipe renderer (tsx-invoked from production builders) + orchestrator + aggregator. ADR-054. Recipe files carry Tavily key in their SSE URI — written to `/tmp/` only, with `docs/sprint-15/eval/**/recipe-*.json` as defence-in-depth gitignore. | `79cd2e46d` |

All ADRs (050, 051, 052, 053, 054) committed at decision time per CLAUDE.md sprint discipline.

## What did NOT run (P6 — live self-eval)

**The full self-eval did not run in this session.** Honest reasons:

1. **Goose provider config is permission-protected.** `~/.config/goose/config.yaml` is correctly classified by the agent harness as credential-territory; CC cannot read the provider key or the default-provider/default-model entries that drive `goose run`. A trivial `goose run -t "hello"` smoke fails with `error: No provider configured. Run 'goose configure' first.`

2. **MINIMAX_API_KEY is not in process env either.** The eval orchestrator relies on `goose run` to handle provider auth; without provider config CC cannot make a single LLM call through the goose pipeline.

3. **Tavily side is fine** — the key Arturs provided is in `~/.config/oscar/secrets/tavily.json` (0600, outside the repo). The renderer reads it and emits valid recipes. The bottleneck is goose's MiniMax auth, not Tavily.

What this means: the eval harness is **structurally ready** but has not been driven end-to-end against a real LLM. The expected pass criteria (mean ≥ 4.0 per axis; no cell < 3.0) are unverified.

## What I am confident in (without live eval)

These are claims grounded in code-review-grade scrutiny of what shipped, not vibes:

1. **The schema migration round-trip works.** `oscar-onboarding-mcp/smoke.mjs` exercises a full v3 finalize_profile + reads back; separately writes a v2 profile and re-reads it through `ProfileStore` to verify v2→v3 migration produces `captured_via: "needs-re-intake"`. Passes (smoke.mjs output: `OK`).

2. **Recipe rendering is correct.** All four `render-recipe.ts` modes (onboarding / practice-area / persona / judge) emit valid JSON; the onboarding recipe correctly includes the Tavily SSE extension when the secrets file resolves; the URI carries the actual key (verified in renderer output, then redacted from any committed artefact).

3. **The wiring from intake to practice-area is real.** `buildPracticeAreaRecipe` calls `renderCompanyContextBlock` which produces the dense markdown block. `MattersLanding.openMatter` resolves the profile + Tavily key + passes both to the builder. Typecheck clean on changed files (pre-existing module-resolution errors in unrelated files are install-workaround artefacts from the local `--no-frozen-lockfile` install; the committed lockfile produces a clean install).

4. **The Tavily key never lands in any committed file.** Verified by `grep -rE 'tvly-(dev|prod)' [staged files]` before every commit — zero hits. The recipe-redaction utility is in place at `redactRecipe.ts` for any future code path. The runtime resolution + gitignore patterns together provide defence-in-depth.

5. **OscarOnboardingGuard reroutes v2 profiles correctly.** Reading the code: `profileNeedsReIntake(profile)` returns true exactly when `company_context.regulatory_baseline.captured_via === "needs-re-intake"`. Guard returns `<OscarOnboardingView />` in that case. Existing v2 dogfood profiles route to re-intake on next launch.

## What is wobbly (without live eval, my honest concerns)

These are failure modes I expect P6 may surface. None are show-stoppers; all are testable.

1. **The intake agent may exceed the 14-turn budget on rich personas.** P2.5 has 5 beats; aggressive batching is a rule, but LLMs commonly drift into single-fact turns even with strong system prompts. Sarah Chen has dense seed facts; if the agent fails to batch P2.5d (recurring matters + stakeholders + escalation) into one or two turns, total could reach 16–18 turns. **Mitigation if found**: tighten the batching rule with verbatim example dialogue in the prompt; add a "self-check turn budget" instruction.

2. **Hypothesis-confirm via Tavily may produce noisy hypotheses.** Free-tier `tavily-search` returns 5 results; the agent's compression from raw search snippets to a 4–8 framework list is LLM-judgment-dependent. For obscure jurisdictions (e.g., the Quiet Lawyer's "Europe" non-specific), Tavily may return generic results that produce a generic hypothesis. **Mitigation if found**: the rule already says "use your own knowledge alongside the search" — emphasize this in the prompt.

3. **Persona-driver fidelity is unknown.** The persona-driver is itself an LLM acting as the lawyer. If it volunteers too much (everything from the seed at once) the intake looks DENSE artificially; if it volunteers too little it looks SPARSE artificially. The conversation_style hints (e.g. "concise, drops multiple facts per turn") attempt to control this, but won't be empirically tuned until P6 runs.

4. **The downstream-first-turn-quality judge may grade leniently.** A practice-area agent with `company_context` injected will mention persona-specific facts somewhere in a 200-word response; the judge's rubric requires *integration* not just citation. Without baseline runs, I can't say the rubric is sharp enough to distinguish "well-briefed" from "lazy-citation". **Mitigation**: P6's first iteration will reveal this; the rubric can be tightened in iteration 2.

5. **The Quiet Lawyer persona's pass criteria are ambiguous.** Coverage scoring for the Quiet Lawyer is "did the agent record nulls faithfully without inventing data" — but the agent might be forced into nulls AND still capture nothing useful for downstream. The downstream-briefing axis would score 0–1 for that persona simply because there's nothing to brief on. That's correct behavior, but it pulls the mean down. **Mitigation**: P6 results decide whether to exclude the Quiet Lawyer from the mean or adjust the rubric.

6. **P3.5 skip-when-covered may be ambiguous in practice.** The system prompt lists concrete skip rules per area, but inference on edge cases ("B2B SaaS → processor for customer data + controller for own analytics") relies on LLM judgment. May surface as P3.5 being skipped when it shouldn't, or asked when it shouldn't.

## What I am NOT confident in

- **The 5-minute budget is unverified.** Wall-time depends heavily on persona-driver response speed and MiniMax latency on the user's hardware. The 14-turn budget is the LLM proxy; whether 14 turns fits in 5 minutes is a host/network claim.
- **Tavily quota consumption per persona is unmeasured.** I expect ~1–2 calls per intake (one in P2.5c hypothesis-confirm, occasionally one mid-conversation if the agent re-checks). 6 personas × 2 calls × 5 iterations = 60 calls; comfortably within the 1000 free-tier ceiling, but unmeasured.
- **Whether MiniMax-M2.5 reliably produces structured JSON for the judge output.** The judge prompts say "Return only a JSON object" but LLMs sometimes wrap in prose. The orchestrator tries a regex fallback to extract a `{ … }` substring; whether that's robust enough is empirical.

## Ship gate to Stage 2

I recommend Arturs **run P6 himself, or grant CC permission to read goose's provider config to run it CC-side.** Either path closes the Stage 1 gate.

If running CC-side, the smallest grant needed is: `MINIMAX_API_KEY` environment variable (or equivalent provider key Goose accepts) exposed to the CC bash environment, with `GOOSE_PROVIDER=minimax` and `GOOSE_MODEL=MiniMax-M2.5`. The orchestrator handles the rest.

If Arturs runs:

```bash
cd /srv/projects/goose
# Assumes goose configure has set up MiniMax already.
# Tavily key already at ~/.config/oscar/secrets/tavily.json.
node scripts/dogfood/sprint-15/run-intake-eval.mjs --persona sarah-chen --iteration 1
node scripts/dogfood/sprint-15/run-intake-eval.mjs --persona daniel-okafor --iteration 1
# ... 4 more personas
node scripts/dogfood/sprint-15/aggregate-scores.mjs --iteration 1 > docs/sprint-15/eval/iter-1/summary.md
```

If aggregate-scores reports PASS, proceed to Stage 2 (Arturs's UI dogfood with own practice + 1–2 invented personas). If FAIL, identify the weakest axis from per-persona rationales, edit `systemPrompt.ts`, repeat (max 5 iterations per ADR-054).

## Honest position

Sprint 15 delivers the rules + schema + wiring + harness end-to-end. The eval discipline I owe — "CC cannot slack" — is partially fulfilled: the **scaffolding is rigorous** and exercises the production code path; the **live run is not done** because of a permission-bounded blocker on provider config. I do not claim the rule set is battle-tested. I claim it is **ready to be battle-tested** and the harness will provide the signal.

The next single step is to run the eval. The next layer of confidence comes from those results.
