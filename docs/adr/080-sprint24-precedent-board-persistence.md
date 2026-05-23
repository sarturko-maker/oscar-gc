# ADR-080 — Sprint 24-B Lavern Pipeline precedent-board: reuse oscar-baselines-mcp at per-user-per-area scope

Status: accepted
Date: 2026-05-21
Sprint: 24-B

## Context

Lavern's pipeline carries a precedent-board — patterns observed across documents, indexed for retrieval during Reader analysis and consolidation by Curator (`/srv/projects/lavern/src/claw/precedent-board.ts`). Lavern persists at `~/.lavern/precedents.json`, append-only with a `deprecated` flag, per-client global. Sprint 24-B's port needs a persistence layer. Two questions: (1) scope (per-matter, per-portfolio, per-user-per-area), (2) substrate (new sibling MCP vs reuse an existing one).

## Decision

**Reuse `oscar-baselines-mcp`** as the precedent-board substrate; scope **per-user-per-area** at `~/.config/oscar/state/lavern/precedents.json`. The pipeline parent recipe sets `OSCAR_BASELINES_DIR=~/.config/oscar/state/lavern/` in the `oscar-baselines` extension env. Each precedent entry becomes a baseline observation keyed by a synthetic dimension `precedent:<pattern_id>`; Reader writes new patterns; Curator (Sprint 25 substantive) marks `confirmed` after threshold uses. No new MCP server.

## Rationale

`oscar-baselines-mcp` already provides per-dimension append-only JSON persistence with atomic writes (`/srv/projects/oscar-baselines-mcp/src/store.ts:54,77`); the data shape (`record_observation` + `list_baselines` + `check_against_baseline`) maps onto precedent-board semantics. CLAUDE.md "Reuse over rebuild" forbids parallel implementations: a new `oscar-precedents-mcp` would duplicate 90%+ of baselines' persistence layer for cosmetic naming. The `OSCAR_BASELINES_DIR` env-var override exists for exactly this case — caller scopes the store. Per-user-per-area scope (vs per-matter) preserves Lavern's core value: a JV pattern observed in matter A informs Reader's analysis of matter B's JV. Per-matter blocks cross-matter pattern reuse — the precedent-board's purpose. Per-portfolio (one-shot per pipeline invocation) loses durability across days/weeks. Per-user-per-area matches Sprint 14 [[ADR-047]] split disk layout (state in `~/.config/oscar/state/<area-id>/`) and Sprint 21's `~/.config/oscar/state/lavern/partners.json` precedent (now `oscar-llp/` post-[[ADR-078]]); "lavern" as the area-id slot matches the Sprint 24-A reservation of "Lavern" for pipeline.

## Alternatives rejected

- **New `oscar-precedents-mcp` sibling repo** — duplicates baselines' persistence layer; violates CLAUDE.md reuse mandate; inflates the 6 → 7 MCP count for no functional gain. The data shape difference (precedents have `effectiveness_score` + `outcomes[]` arrays that baselines doesn't) is solvable via a richer observation payload, not a new server.
- **Per-matter scope** — `~/Documents/Oscar GC/Oscar LLP/lavern-pipeline/<run>/precedents.json` style — blocks cross-matter pattern reuse, which IS the precedent-board's purpose. Lavern's per-client global is the correct adaptation; per-matter narrows further than Lavern itself did.
- **Per-portfolio scope** (board lives in a single pipeline-invocation working dir) — ephemeral; loses pattern continuity across pipeline invocations within a single area.
- **In-memory only** — Lavern's pattern accumulates value over weeks/months of observations. In-memory loses that value at every session end.
- **Reuse `oscar-memory-mcp`** (Sprint 5's per-element scoped memory MCP) — memory MCP is shaped for per-element narrative observations, not structured pattern entries with `qualityScore` / `effectiveness_score` / `outcomes[]` numerics. Wrong shape.

## Consequences

- Pipeline parent recipe declares `oscar-baselines` extension with `envs.OSCAR_BASELINES_DIR=~/.config/oscar/state/lavern/`. No new env-var infrastructure.
- `oscar:llp:pipeline:ensure-dir` IPC creates `~/.config/oscar/state/lavern/` alongside `~/Documents/Oscar GC/Oscar LLP/lavern-pipeline/`.
- Reader sub-recipe instructions call `record_observation` with a synthetic dimension `precedent:<pattern_id>` after each significant finding (severity RED|YELLOW, confidence ≥ 0.7).
- Sprint 25 substantive Curator: `list_baselines` to enumerate; `check_against_baseline` for drift detection on confirmed patterns.
- The baselines MCP's existing schema gains no fields — Lavern's `outcomes[]` / `effectiveness_score` get encoded into the observation's `metadata` payload (free-form JSON), accepted as-is by baselines' append-only writer.
- If Sprint 25 finds the baselines schema genuinely insufficient, that's the trigger to evaluate a precedents-specific MCP. Sprint 24-B has no such evidence.

## Supersedes

None. Companion to [[ADR-079]] (pipeline shape). Mirrors [[ADR-047]] per-area state path convention and Sprint 21 [[ADR-071]]'s `~/.config/oscar/state/<area-id>/<file>.json` pattern.
