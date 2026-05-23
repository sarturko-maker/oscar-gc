# oscar-knowledge-base-mcp

Legal-corpus search MCP for Oscar GC's Lavern partners.

Three read-only stdio tools:

- `search_knowledge_base` — synonym-expanded substring search across the bundled corpus.
- `list_knowledge_base_collections` — list available collections with stats.
- `get_knowledge_base_entry` — retrieve a specific chunk by ID.

## Origin

Structural lift from [github.com/AnttiHero/lavern](https://github.com/AnttiHero/lavern) (Apache-2.0; commit `7c2efe61524b14c632bee8f14d9bbcbdd85d0cfd`). Lavern's `src/mcp/tools/knowledge-base.ts` and `src/knowledge-base/retriever.ts` provided the tool surface and the legal-synonym expansion table; the substrate is adapted to Oscar GC's shape:

- Built on `@modelcontextprotocol/sdk` rather than `@anthropic-ai/claude-agent-sdk` (Goose is the MCP host).
- In-memory placeholder corpus (typed `KbChunk[]`) rather than SQLite FTS5. Sprint 22 ships demo-grade content; a future sprint will swap in a real curated corpus + SQLite back-end.
- No `userId` scoping — Oscar GC is single-user on the desktop.

Raw Lavern sources preserved at `src/_lavern-original/` (excluded from the build) for diff review per [Sprint 21 ADR-072](../oscar-gc-lavern/docs/adr/072-lavern-prompt-adaptation.md).

## Sprint provenance

Built in Sprint 22 of the Oscar GC project. See [ADR-073](../oscar-gc-lavern/docs/adr/073-lavern-mcps-deferred-to-sprint-22.md) for the Tier A/B/C commitment table and [ADR-075](../oscar-gc-lavern/docs/adr/075-sprint22-lavern-mcp-lift-policy.md) for the lift policy.

## Development

```
pnpm install
pnpm build
pnpm smoke
pnpm test
```
