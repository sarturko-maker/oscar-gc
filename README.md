# oscar-document-checks-mcp

Computational document-structure + formatting checks MCP for Oscar GC's Lavern partners.

Two tools:

- `check_document_structure` — detects heading hierarchy gaps, section-numbering discontinuities, and broken cross-references. Returns score + specific findings.
- `check_document_formatting` — detects inconsistent defined-term capitalization, unused defined terms, broken cross-references, mixed numbering patterns, and typography inconsistencies.

## Origin

Adapter lift from [github.com/AnttiHero/lavern](https://github.com/AnttiHero/lavern) (Apache-2.0; commit `7c2efe61524b14c632bee8f14d9bbcbdd85d0cfd`), `src/mcp/tools/document-checks.ts`. Lavern's version exposed four tools; the two above are lifted (their analysis functions are pure and take args explicitly already). The other two — `record_pass_result` and `compile_verification_report` — write to `session.debate.findings` and `session.verification` (Tier B/C debate-board state per [ADR-073](../oscar-gc-lavern/docs/adr/073-lavern-mcps-deferred-to-sprint-22.md)) and are dropped from Sprint 22. The `verification-pass` sub-recipe handles result compilation in its response prose instead.

Raw Lavern source preserved at `src/_lavern-original/document-checks.ts`.

## Sprint provenance

Sprint 22 of Oscar GC. See [ADR-075](../oscar-gc-lavern/docs/adr/075-sprint22-lavern-mcp-lift-policy.md).

## Development

```
pnpm install
pnpm build
pnpm smoke
pnpm test
```
