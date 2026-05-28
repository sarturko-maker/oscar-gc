# ADR-116 — Sprint 35 Tabular Review: human verify/flag/override via an MCP tool, not a UI write

Status: accepted
Date: 2026-05-28
Sprint: 35

## Context

[[ADR-112]] folds the lawyer's verdict (verified / flagged / overridden) into the cell, and
[[ADR-111]] makes the oscar-tabular MCP the **single writer** of `manifest.json`. The native grid
(Stage B) needs to let a lawyer act on a cell. The tempting shortcut — a UI button that writes the
manifest directly via an IPC — would re-introduce a second writer and break the single-writer
invariant (concurrent writes from the renderer and the agent's MCP, with no merge authority).

## Decision

- **Human review is written through a new `set_human_review` oscar-tabular tool**
  (`set_human_review(review_id, document_id, column_id, state, note?, override?)`), which folds the
  verdict into the cell's `human` block, recomputes `summary.verified`, and persists atomically — the
  same single-writer path as extraction. The grid's 2 s poll then reflects it.
- **The renderer never writes the manifest.** A lawyer records a verdict by asking the docked rail
  agent in natural language ("mark the governing-law cell on Atlas as verified"); the tool's
  description routes the agent to `set_human_review`. The cell-state mapping renders the human verdict
  as an overlay that **wins over** the machine grounding state.

## Consequences

- One writer, one merge authority, no renderer↔agent write races; the manifest stays portable and
  auditable.
- v1 has no one-click verify/flag button in the grid — the verdict is rail-mediated. A future
  affordance can programmatically submit a templated instruction to the rail (still through the MCP,
  preserving the invariant); a direct renderer→MCP one-shot call is the alternative if rail-mediation
  proves clunky in dogfood. Either way the UI does not write the file.

Cites: [[ADR-111]], [[ADR-112]].
