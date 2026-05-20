# ADR-075 — Sprint 22 Lavern MCP lift policy

Status: accepted
Date: 2026-05-20
Sprint: 22

## Context

Sprint 22 lifts Tier-A MCPs from `/srv/projects/lavern/src/mcp/tools/` (commit `7c2efe61524b14c632bee8f14d9bbcbdd85d0cfd`) into Oscar GC per [[ADR-073]]'s commitment table. Source inspection at lift time uncovered three empirical facts that modify ADR-073's `Decision` section (ADRs are immutable; this ADR is the correction of record):

1. **legal-md-compiler imports from `memory-system.ts`** (Tier B/C per ADR-073:39) — `import type { InstitutionalMemoryEntry, PrecedentEntry } from './memory-system.js'` at `lavern/src/mcp/tools/legal-md-compiler.ts:18-21`. Cannot lift without re-targeting onto Goose Memory.
2. **document-checks, grounding-verifier, baselines couple to Lavern session state.** document-checks writes `session.debate.findings.push({...})` at line 311 of `document-checks.ts`; grounding-verifier reads from `session.debate.findings`; baselines consumes the `SessionReportCard` type produced by report-card infrastructure (Tier C per ADR-073:44).
3. **`evals/jv/` is not empty.** ADR-073:71 claims it is. Actual contents: `RUBRIC.md` (12-item scoring rubric), three CUAD JV contracts (borrowmoney, sibannac, veoneer), human-scored EVAL_REPORT files. Sprint 23 should lift these as reference baseline rather than build the rubric from scratch.

## Decision

**Six sibling MCP repos**, one per MCP, at `/srv/projects/oscar-<name>-mcp/`, mirroring the existing `oscar-onboarding-mcp` / `oscar-memory-mcp` shape (pnpm + TypeScript + `@modelcontextprotocol/sdk` 1.29.0 + zod 4.4.3). Lifted MCPs:

- `oscar-knowledge-base-mcp` — clean lift.
- `oscar-document-reader-mcp` — clean lift. Per Agent 2 source analysis, document-reader provides navigation tools (`list_documents`, `read_document_section`, `get_defined_terms`, `get_document_tables`) over already-parsed structures, while adeu provides ingest+redline of `.docx` files. They are **complementary, not duplicative**. ADR-073:28's "Reuse existing `redline` (adeu) MCP" instruction is correct for redline but cannot replace document-reader's navigation surface; both ship.
- `oscar-risk-pricing-mcp` — clean lift.
- `oscar-baselines-mcp` — lift + adapt. Decouple from `SessionReportCard` consumer pattern; baselines stand alone.
- `oscar-grounding-verifier-mcp` — lift + adapt. Findings as explicit tool parameter, not `session.debate.findings` lookup.
- `oscar-document-checks-mcp` — lift + adapt. Expose `check_document_structure` and `check_document_formatting` returning structured findings; drop `record_pass_result` and `compile_verification_report` (debate-board writes).

**`legal-md-compiler` is dropped from Sprint 22.** Re-evaluate if Lavern's memory-system is ever lifted (currently out of scope; ADR-073 maps memory-system to Goose Memory, which doesn't expose the institutional-knowledge schema legal-md-compiler depends on).

**Adversarial-pass sub-recipe is dropped from Sprint 22** per brief's honest-scope cut; only verification-pass ships.

**Per-repo shape:** `package.json` (pinned deps, Apache 2.0, `bin` entry), `tsconfig.json` (strict, ESNext, target node20+), `src/index.ts` (MCP server entry), `src/tools/*.ts` (adapted code; raw Lavern source preserved as `src/tools/*.original.ts` per Sprint 21's [[ADR-072]] precedent), `smoke.mjs` (boot + ready-line check), `tests/integration.test.ts` (real MCP client harness per CLAUDE.md), `README.md` (Apache 2.0 attribution to Lavern, commit SHA pinned), `data/` (placeholder corpus where applicable).

**Placeholder corpora**: knowledge-base ships a small FTS5 SQLite seeded with open-source legal docs; baselines ships a few JSON templates from the CUAD set already in `/srv/projects/lavern/evals/jv/`. Real corpus curation is its own future sprint.

**Sub-recipe YAML** at `ui/desktop/src/resources/sub-recipes/verification-pass.yaml`, bundled into the .deb by an extended `prepareSubRecipes()` step in `prepare-oscar-bundle.js`. Path-referenced from each partner recipe's `sub_recipes` field per [[ADR-074]] (Path A).

## Rationale

- **One sibling repo per MCP** matches the existing pattern (oscar-onboarding-mcp, oscar-memory-mcp), keeps MCPs independently versionable, and matches ADR-073's framing. Umbrella repo considered and rejected — couples MCPs the architecture says are independent and would require an ADR change to ADR-073.
- **Adapter pattern preserves source provenance.** Adapted tool files stay alongside `*.original.ts` raws so reviewers can diff lift→adapt; same Apache 2.0 attribution discipline as Sprint 21 prompts.
- **Drop > stub.** legal-md-compiler stubbed to "no-op until memory-system lifted" would mislead partners that institutional-knowledge compilation exists; deletion is honest.
- **Placeholder corpora are demo-grade.** Real corpus selection is a content-curation problem (licensing, jurisdiction, freshness) that needs its own sprint.

## Alternatives rejected

- **Umbrella `oscar-lavern-mcps` repo**: simpler maintenance, but deviates from established per-MCP pattern; couples independent MCPs.
- **Lift legal-md-compiler with a Goose-Memory adapter**: ~day of work to retarget memory types; out of scope for Sprint 22; re-evaluable when memory-system lift is on the table.
- **Skip document-reader (literal reading of ADR-073:28 "reuse adeu")**: loses navigation tools adeu doesn't provide; sub-optimal for the demo.

## Consequences

- 6 new sibling repos under `/srv/projects/`. RUNBOOK gets the addition list.
- `prepare-oscar-bundle.js` `SIBLING_MCPS` map grows by 6; smoke test grows by 6 ready-line entries.
- `buildLavernPartnerRecipe.ts` extensions array grows by 6 stdio configs; `sub_recipes: [{name: 'verification-pass', path: ...}]` added (auto-injects summon per Goose substrate).
- Sprint 23 eval harness can lift `evals/jv/` RUBRIC.md + CUAD docs as reference rather than starting from zero — `PROJECT.md` Sprint Index notes this; Sprint 23 brief inherits.
- Document-reader and adeu both ship for Commercial workflows. Redline (adeu) and structured navigation (document-reader) are distinct verbs in the partner toolbox.

## Supersedes

None. Companion to [[ADR-073]] (Tier A/B/C commitments — corrected here) and [[ADR-074]] (Path A architectural call). Mirrors [[ADR-072]]'s raw-source-preservation pattern.
