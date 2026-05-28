# ADR-114 — Sprint 35 Tabular Review: grounding-gate hardening (require quote, reject boilerplate-only)

Status: accepted
Date: 2026-05-28
Sprint: 35

## Context

[[ADR-112]] made grounding a display precondition. Stage-35 plan-mode review of the live engine
surfaced two soft spots before the first real run:

1. The extractor recipe's `response.json_schema` did **not** require `quote` — only
   `column_id`/`answer`/`confidence` (`tabular-cell-extractor.yaml`). So a non-null answer could
   arrive with no citation; grounding was enforced only by the gate, not the contract the LLM sees.
2. `isBoilerplate()` existed in `verify.ts` (lifted from grounding-verifier) but was **never called**
   in `groundCell`. `charOverlap` returns `1.0` on any substring match, so a quote of just a generic
   header ("governing law", "without limitation") green-ticks against any contract while verifying
   nothing.

## Decision

- **Require `quote` on every extractor cell** (added to the recipe schema `required` list, kept
  `type: ["string","null"]`). The field is always present; it is null **only** when the answer is
  null. The recipe instructions are tightened to say "quote the operative clause, not a generic
  header." A cross-provider-safe always-present-nullable field is preferred over a JSON-Schema
  `if/then` conditional (which MiniMax's tool-calling under-supports).
- **Wire `isBoilerplate` into `groundCell`.** A boilerplate-only quote is treated like an absent
  quote: it cannot ground via `charOverlap`; a corroborating locator (`sectionExists`) may still
  ground it, otherwise the cell flags. `method` is `charOverlap` (grounded=false) when a quote was
  present-but-unusable, `no-quote` when genuinely absent.

## Consequences

- A confident answer whose only citation is a generic phrase now reads "needs review," not green —
  tightening [[ADR-112]]'s precondition rather than changing its shape.
- Marginally more flagging on lazy quotes; acceptable (the lawyer is prompted for a specific quote).
- The COMMON_LEGAL_PHRASES set is small and generic; revisit if dogfood shows false flags on
  legitimate short clauses.

Cites: [[ADR-111]], [[ADR-112]].
