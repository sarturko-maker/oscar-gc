# ADR-111 — Sprint 34 Tabular Review: oscar-tabular MCP + Summon structured-recipe engine + native split surface

Status: accepted
Date: 2026-05-28
Sprint: 34

## Context

Tabular Review is batch document review — rows are documents, columns are extraction queries, each
cell holds an answer + reasoning + source citation (Legora Tabular Review / Harvey Vault shape). The
brief mandates the **agentic-parallel** build (one clean-context sub-agent reads each *whole*
document) over embeddings/RAG: in-house RFP/matter work is tens-to-low-hundreds of documents where a
missed clause is malpractice, and chunk-retrieval mismatch is the dominant legal-LLM hallucination
mode. It must persist in the matter folder, re-open losslessly, and beat Harvey/Legora. Motivating
dogfood: a 50-contract portfolio review. Plan: `/root/.claude/plans/here-is-the-brief-prancy-allen.md`.

## Decision

Four pillars, no Rust-core change:

1. **New `oscar-tabular` MCP** (`oscar/mcps/tabular/`, TS, AGPL-3.0, scaffolded from
   [[ADR-040]]'s oscar-fs / oscar-memory skeleton). Owns ONLY: grid schema + Zod validation,
   deterministic non-LLM merge-by-(document,column), a zero-LLM grounding gate ([[ADR-112]]), and
   atomic persistence. It makes no LLM calls and spawns no sub-agents.
2. **Engine = Summon `delegate`/`load`, untouched.** The matter agent fans out one
   `delegate(async, source=tabular-cell-extractor)` per document in waves of
   `GOOSE_MAX_BACKGROUND_TASKS` (default 5). Verified in source
   (`crates/goose/src/agents/subagent_handler.rs:58-60,158-160,222,259-269`; `summon.rs:1004-1024`):
   a recipe with a `response` schema makes the sub-agent return **validated structured JSON** to the
   parent — so grid assembly is deterministic with no core edit and no fragile text parsing. The
   **parent is the single writer** (calls `ingest_results` per wave); no sub-agent touches the file,
   so there is no write-contention.
3. **Native React full-window split surface** — see [[ADR-113]].
4. **Matter-folder persistence** — one `manifest.json` per review at
   `<matter>/outputs/tabular-review/<review-id>/` (+ `index.json`), atomic tmp→fsync→rename
   ([[ADR-047]] layout, [[ADR-083]] pane-reads-matter-folder). The file IS the full state.

## Rationale

Reuse over rebuild: Summon (already on matter recipes, `buildPracticeAreaRecipe.ts:167-170`),
grounding-verifier functions (lifted, not called — PROJECT.md forbids cross-MCP runtime coupling),
document-reader (full-doc read for the extractor), oscar-memory atomic store, and LQ-Grid's React
grid/citation code. No new fan-out engine, no embeddings, no vector DB, no upstream-merge debt.

## Consequences

- 50 docs ≈ 10 sequential waves; mitigate with progressive per-wave persistence; tune the cap via
  env only (never core).
- `tabular-cell-extractor.yaml` ships to `~/.config/goose/recipes/` (Summon's verified discovery
  path; it does NOT scan `~/.config/oscar/recipes`). Mind Summon's 60s source cache.
- B-class discipline: matter dir resolves server-side from `OSCAR_MATTER_DIR`; `review_id` is
  server-minted; only A (column queries) and C (finite enums) appear in LLM-visible schemas.

Cites: [[ADR-040]], [[ADR-041]], [[ADR-047]], [[ADR-080]], [[ADR-083]]. Companion: [[ADR-112]], [[ADR-113]].
