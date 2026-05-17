# [Goose] — In-House Legal Agent Platform

Custom distribution of Block's Goose (now AAIF / Linux Foundation) — `aaif-goose/goose`. We replace the UI layer and the memory layer; we leave the Rust agent core alone.

## The one goal (short-term)

1. Fork Goose (done — `sarturko-maker/goose`, mirroring `aaif-goose/goose`).
2. Replace the UI layer (`ui/desktop/src/`) with an in-house-legal UI: practice areas → primary unit → memory + artifacts + agent.
3. Replace the memory layer with a scoped MCP server we own.
4. Wire adeu as an MCP server for the Commercial practice area.

Nothing further is in scope until those four are working.

## Sprint Index

| Sprint | Goal | Status |
|---|---|---|
| 1 | Unmodified Goose builds + MiniMax round-trip on `lq-vps`. No product code. | Closed 2026-05-17 |
| 2 | Oscar GC rebrand (branding metadata only). First custom-distribution cycle. | Closed 2026-05-18 |

See `SPRINT_LOG.md` for entries. See `CLAUDE.md` for operating rules.
