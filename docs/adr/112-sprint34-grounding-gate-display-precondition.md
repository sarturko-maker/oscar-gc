# ADR-112 — Sprint 34 Tabular Review: the grounding gate is a display precondition, not a score

Status: accepted
Date: 2026-05-28
Sprint: 34

## Context

The single most dangerous failure for in-house counsel is a confident, well-formatted, *wrong*
cell — an answer whose cited quote isn't actually in the contract. LLM-emitted character offsets are
unreliable on long documents (LQ-Grid's known issue). Competitors (Harvey, Legora) surface citations
but leave verification to manual human spot-checks. Oscar GC already owns a zero-LLM citation checker:
`oscar/mcps/grounding-verifier/src/verifier.ts` (`charOverlap` at a 0.8 threshold, `sectionExists`,
`isBoilerplate`). The question is how strongly to wire grounding into the grid.

## Decision

Grounding is a **display precondition**, enforced at ingest in `oscar-tabular` (the single writer),
zero-LLM, on every cell:

- A cell may render `status:complete` **only if** its verbatim quote grounds in the source document
  (`charOverlap(quote, sourceText) >= 0.8`, lifted from grounding-verifier; `sectionExists` cor
  roborates a locator when present).
- Quote grounds below threshold → `status:flagged`, `confidence` forced to `low`, rendered "needs
  review".
- `status:complete` claimed with no verbatim quote → `flagged`.
- Source unreadable or binary-without-extracted-text → keep the cell, but
  `verification.method:'unverified'` (we do not punish the lawyer for a PDF we couldn't re-read; the
  UI marks it unverified rather than green-ticking it).
- LLM-emitted offsets are a **hint only**; the grounding gate plus a first-5/last-5-word quote re-find
  (LQ-Grid `highlightText.ts`) are the source of truth for the citation highlight.

The functions are **copied** into `oscar/mcps/tabular/src/verify.ts` with provenance, not called
across MCP boundaries (PROJECT.md "no cross-MCP runtime coupling").

## Rationale

Making "complete" structurally impossible without grounding is the differentiator the agentic-parallel
+ full-document architecture earns: a wrong-but-confident cell cannot reach the grid. A mere score
column would still let an ungrounded answer read as authoritative.

## Consequences

- The 0.8 threshold matches grounding-verifier; revisit if dogfood shows false-flag noise on legitimate
  paraphrase-light cells.
- A deeper, opt-in per-column LLM ensemble verification ([[ADR-081]]) stays OFF by default and runs
  async/batched, never inline per cell (a 50×8 review inline would balloon latency/cost).

Cites: [[ADR-081]], [[ADR-111]].
