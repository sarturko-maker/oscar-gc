# oscar-document-reader-mcp

Document-navigation MCP for Oscar GC's Lavern partners. Complementary to the existing `redline` (adeu) MCP: adeu does PDF/DOCX ingest and redline output, this MCP gives partners structured navigation tools over already-parsed documents.

Five read-only stdio tools:

- `list_documents` — table of contents per document.
- `read_document_section` — read a specific section by heading or index.
- `search_document` — substring search with surrounding context.
- `get_defined_terms` — defined terms extracted from documents.
- `get_document_tables` — tables extracted from a document, as markdown.

## Origin

Structural lift from [github.com/AnttiHero/lavern](https://github.com/AnttiHero/lavern) (Apache-2.0; commit `7c2efe61524b14c632bee8f14d9bbcbdd85d0cfd`), `src/mcp/tools/document-reader.ts`. Adapted to Oscar GC's shape:

- Built on `@modelcontextprotocol/sdk` rather than `@anthropic-ai/claude-agent-sdk`.
- In-memory hardcoded sample `ParsedDocument[]` (Sprint 22 placeholder). A future sprint will wire to a real parser pipeline (likely adeu's outputs).
- No `session.documents` coupling — Oscar GC is single-user.

Raw Lavern source preserved at `src/_lavern-original/document-reader.ts` (excluded from build).

## Sprint provenance

Sprint 22 of Oscar GC. See [ADR-075](../oscar-gc-lavern/docs/adr/075-sprint22-lavern-mcp-lift-policy.md). Document-reader and adeu's redline tool are complementary, not duplicative — see ADR-075 Rationale.

## Development

```
pnpm install
pnpm build
pnpm smoke
pnpm test
```
