# oscar-grounding-verifier-mcp

Mechanical citation-grounding verifier MCP for Oscar GC's Lavern partners. Answers: "did the agent cite things that actually exist in the source document?" — with zero LLM cost.

Two tools:

- `verify_grounding` — verify a single evidence string (citations + quoted text) against a document. Returns per-citation found/not-found + a grounding score (0.0-1.0).
- `verify_findings_batch` — batch-verify multiple findings; returns per-finding scores + summary table.

## Origin

Adapter lift from [github.com/AnttiHero/lavern](https://github.com/AnttiHero/lavern) (Apache-2.0; commit `7c2efe61524b14c632bee8f14d9bbcbdd85d0cfd`), `src/mcp/tools/grounding-verifier.ts`. Lavern's version read `session.debate.findings` (debate-board state) and `session.documents` (parsed in-session). Oscar GC's Sprint 22 does not lift the debate board, so this MCP takes findings and document context as **explicit tool parameters**: the agent fetches document text via `oscar-document-reader-mcp` (or pastes it in) and passes findings inline.

The core algorithms — section-ref regex matching, quote sliding-window overlap, boilerplate suppression — are lifted verbatim from Lavern. Raw source preserved at `src/_lavern-original/grounding-verifier.ts`.

## Sprint provenance

Sprint 22 of Oscar GC. See [ADR-075](../oscar-gc-lavern/docs/adr/075-sprint22-lavern-mcp-lift-policy.md) for the adapter rationale.

## Development

```
pnpm install
pnpm build
pnpm smoke
pnpm test
```
