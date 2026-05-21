# ADR-079 — Sprint 24-B Lavern Pipeline: declarative orchestration via parent recipe + 3 sub-recipes

Status: accepted
Date: 2026-05-21
Sprint: 24-B

## Context

[[ADR-078]] reserved "Lavern" for the pipeline port — Lavern's three-stage contract analysis: Watchman classifies + routes (`/srv/projects/lavern/src/claw/watchman.ts`), Reader per-clause analyses + synthesises (`local-analysis.ts` + `reader-templates.ts`), Curator portfolio-level surfaces patterns (`curator.ts`). Lavern's evals validated the substance; Sprint 24-B ports it onto Goose's sub-recipe substrate per [[ADR-074]]. The architectural call is whether the pipeline is one monolithic prompt (P2) or a parent recipe with three sub-recipes (P1).

## Decision

**Shape P1 — declarative orchestration.** Parent `lavern-pipeline.yaml` declares 3 sub-recipes (`lavern-watchman.yaml`, `lavern-reader.yaml`, `lavern-curator.yaml`) and orchestrates via prose: parent's `instructions` block drives the LLM to `delegate(source: "watchman", ...)` → parse JSON → `delegate(source: "reader", ...)` → capture markdown → conditionally `delegate(source: "curator", ...)` when doc_count ≥ 2. Sub-recipes inherit parent extensions per [[ADR-074]]; `delegate()` returns plain text `Result<String, anyhow::Error>` (`subagent_handler.rs:48`). Doc-head ingress via a new `read_document_head(path, max_chars)` tool added to `oscar-document-reader-mcp` (~30 LOC). Curator-fires-when-doc-count-≥2; single-doc skips. Curator ships as a 20-line STUB in 24-B (one-shot surface-decision pass); substantive Curator (consolidation + re-read queue) deferred to Sprint 25. `settings.max_turns: 40` on parent; `32` on Reader for per-clause loop; `4` on Curator stub.

## Rationale

Lavern's per-clause map-reduce (`local-analysis.ts:126-262` clause chunking + `:266-336` per-clause analysis + `:547-563` grounding pass + `:893-927` synthesis) and the 7 doc-type Reader templates (`reader-templates.ts:65-191`) are load-bearing — Lavern's v2 result ("small models excel at narrow tasks") rests on keeping each stage's prompt tight to its job. P2's monolithic prompt collapses this. P1 preserves the per-stage prompt boundaries. `Recipe.sub_recipes` auto-injects the summon platform extension (`recipe/mod.rs:255-271`), so partner-style `delegate()` works without Rust-core change. `prepareSubRecipes()` at `prepare-oscar-bundle.js:489-510` already globs `*.yaml` from `ui/desktop/sub-recipes/` — 4 new YAMLs ship with zero bundler edit. Curator-stub-in-24-B keeps the substrate (3-stage shape, parent's conditional invocation logic) intact so Sprint 25 substantiates by editing one YAML — no orchestration rewrite. Heartbeat semantics from `curator.ts:640-693` don't translate to one-shot recipes; one-per-invocation portfolio sweep is the right adaptation. The doc-head ingress problem (Lavern Watchman reads raw text directly; Goose recipes prefer tool-mediated reads) is solved by one new MCP tool — smaller than threading file content through `Recipe.parameters`.

## Alternatives rejected

- **P2 monolithic prompt** — collapses per-stage prompt boundaries; loses Lavern's discipline; one mega-prompt has to encode 7 doc-type templates + clause loop + synthesis + portfolio sweep + grounding pass simultaneously. Fights MiniMax's tool-call cadence.
- **`File` parameter for doc ingress** — `RecipeParameter.input_type: File` exists (`crates/goose/src/recipe/mod.rs:181-185`) but doesn't accept lists. Single-doc-per-pipeline-invocation contradicts portfolio framing. New `read_document_head` MCP tool is smaller.
- **Curator substantive in 24-B** — Lavern's Curator is heartbeat-driven across a running portfolio; one-shot adaptation needs design work Sprint 24-B doesn't have budget for. Stub-now / substantive-Sprint-25 preserves shape integrity.
- **Watchman classifier as MCP tool** (not a sub-recipe) — would force Watchman's prompt into the parent's instructions; same monolithic collapse P2 has.

## Consequences

- 4 new YAMLs at `ui/desktop/sub-recipes/`; bundler picks them up; `BUNDLE.json sub_recipes.count` ticks 1 → 5 mechanically.
- New `read_document_head` tool on `oscar-document-reader-mcp` (~30 LOC); bundler smoke-tests on spawn per [[ADR-049]] pattern.
- New `buildLavernPipelineRecipe.ts` (sibling to `buildOscarLLPPartnerRecipe.ts`); new `LavernPipelineView.tsx`; new `oscar:llp:pipeline:*` IPC handlers + preload bridge; new card on `OscarLLPRoster.tsx`; new route in `App.tsx`.
- Title prefix `Oscar LLP — Lavern Pipeline` auto-trusts via [[ADR-078]]'s three-way OR (no `preload.ts` edit).
- Sprint 25 substantiates Curator; if no per-partner curation evidence by then, also revisits [[ADR-074]] Path A.
- New `test-lavern-pipeline.js` with `--parse-only` (Phase 1) and end-to-end (Phase 2) modes; no LLM mocking per CLAUDE.md.

## Supersedes

None. Companion to [[ADR-073]] (Lavern MCPs commitment), [[ADR-074]] (Path A sub-recipe inheritance), [[ADR-078]] (Oscar LLP firm/Lavern pipeline naming). Paired with [[ADR-080]] (precedent-board persistence).
