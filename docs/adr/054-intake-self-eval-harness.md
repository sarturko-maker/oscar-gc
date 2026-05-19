# ADR-054 — Intake self-eval harness (persona corpus + 3-axis model-judge)

Status: accepted
Date: 2026-05-19
Sprint: 15

## Context

ADR-050's rule-set requires self-evaluation before user dogfood — Arturs's verbatim direction was *"It needs to be proper eval. CC cannot slack."* The brief's exit gate is two-stage: Stage 1 self-eval (≥5 personas; mean ≥4.0 on three axes; no cell <3.0; written self-assessment); Stage 2 user dogfood. Sprint 15 P5 ships the harness; P6 runs the eval; P7 writes the self-assessment.

## Decision

**CLI-based, goose-native, persona-driven.** Every LLM call goes through `goose run` against a recipe — the intake agent, the persona-driver, and the three judges. The harness orchestrates them as child processes; no UI driver, no Electron spinup. Faster iteration than Sprint 7–8's UI-driver pattern, and the intake rule-set (the load-bearing artefact) lives entirely in the system prompt, so CLI vs UI is irrelevant for the eval.

Components at `/srv/projects/goose/scripts/dogfood/sprint-15/`:

- **`personas/<id>.json`** × 6 — Sarah Chen (UK fintech), Daniel Okafor (Sprint 7 baseline), Priya Iyer (US healthcare), Marco Bianchi (EU AI, solo GC), Jin-soo Park (Korean marketplace), Quiet Lawyer (edge).
- **`recipes/render-recipe.ts`** — tsx-invoked; imports the production recipe builders so the eval exercises the exact code path the UI uses. Modes: `onboarding | practice-area | persona | judge`. Recipes carrying the Tavily key are written under `/tmp/` only.
- **`judge-prompts/{coverage,efficiency,downstream-briefing}.md`** — three rubrics with 0–5 scoring criteria + `specific_gaps[]`. Each judge is a Goose recipe (no extensions).
- **`run-intake-eval.mjs`** — orchestrator. Loops `goose run` intake ↔ `goose run` persona via session-id until `finalize_profile` writes the file or the 22-turn hard cap hits; then runs 2 practice-area first-turn captures and 3 judges. Writes transcript / profile / responses / scores under `docs/sprint-15/eval/iter-<N>/<persona>/`.
- **`aggregate-scores.mjs`** — markdown summary + pass/fail vs criteria.

**Pass criteria** (encoded in `aggregate-scores.mjs`):
- Mean coverage ≥ 4.0
- Mean efficiency ≥ 4.0
- Mean downstream-briefing ≥ 4.0
- No individual cell < 3.0

**Iteration loop** (manual, bounded at 5): if aggregate fails, identify the weakest axis from per-persona rationales, edit `systemPrompt.ts`, commit, re-run, repeat.

## Rationale

- **CLI over UI for speed.** Six personas × N iterations × ~14 turns each + 12 practice-area runs + 18 judge runs is many child processes. CLI avoids Xvfb spinup, DOM scraping, and screenshot capture. The intake's behaviour is determined by the system prompt — identical in both contexts.
- **Goose-native LLM calls** — all calls go through one `goose run` interface; no separate provider SDK; provider auth flows through goose's config. Eval reproducibility ties to the same goose config the user runs.
- **Real Tavily, real MiniMax** — the rule-set's hypothesis-confirm primitive is exercised end-to-end. Free-tier Tavily quota (1000 req/mo) comfortably accommodates ~10 calls/iteration × 5 iterations = ~50 Tavily calls.
- **Persona-driver as another recipe** — same LLM idiom, same observability surface, same auth path. Avoids a parallel MiniMax-SDK code path.
- **Recipes never committed.** The orchestrator writes recipe JSON to `/tmp` only. Defense-in-depth `.gitignore` rule for `docs/sprint-15/eval/**/recipe-*.json`. ADR-052 redaction discipline preserved.

## Consequences

- Goose CLI must be on PATH (or `GOOSE_BIN`) for the harness to run. Goose's config.yaml must have the provider key configured.
- Eval outputs (transcripts, profiles, scores) are committed under `docs/sprint-15/eval/iter-<N>/` for audit and follow-on diff.
- Iteration is manual: each cycle requires reading aggregate output, identifying the weakest rule, editing `systemPrompt.ts`, recompiling, re-running. Acceptable for this sprint; could be made automatic in Sprint 16+ if iteration becomes routine.
- Sprint 7's dogfood-driver (`scripts/dogfood/dogfood.sh` + UI driver) remains the canonical pattern for UI-level dogfood. Stage 2 (Arturs's user dogfood) uses the actual UI; Stage 1 (CC self-eval) uses this CLI harness.

## Supersedes

None. Extends Sprint 7's dogfood pattern with a CLI-only, multi-persona, model-judged variant.
