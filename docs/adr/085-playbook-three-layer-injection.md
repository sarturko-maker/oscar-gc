# ADR-085: Playbook three-layer injection (reuse computercontroller)

Status: accepted (2026-05-21).
Context: Sprint 20-M4 — Playbooks subsystem. Companion to ADR-084. Builds
on ADR-017 (`available_tools` narrowing), ADR-040 (oscar-fs), ADR-041
(recipe loadout). Plan-mode reached for pdf-parse + mammoth; mid-execution
Goose's bundled `computercontroller` MCP was found to ship the same
extraction (Rust `lopdf` + `docx_rs`). CLAUDE.md "Reuse over rebuild" wins.

## Decision

**Layer 1 — always-on injection.** At recipe-build time, the renderer
calls `oscar:playbooks:render-block(relPaths, charCap=8000)`. Main process
spawns `goosed mcp computercontroller` as a stdio MCP child for binary
files (.pdf, .docx); reads text formats raw (.md/.txt/.html/.json/.yaml/
.csv); redistributes the budget per-file (`floor(cap / count)`); truncates
at paragraph boundaries; returns a `## Playbooks in scope` markdown block
prepended to instructions. One subprocess per build.

**Layer 2 — on-demand.** Practice-area recipes carry `computercontroller`
narrowed via `available_tools: ['pdf_tool', 'docx_tool']` (ADR-017). With
oscar-fs widening (ADR-084), the agent reads text via `oscar-fs__read_file`
and binary via the two computercontroller tools when prompted.

**Layer 3 — semantic retrieval.** Deferred post-master-brief.

## Rationale

- Extractors already in `goosed`; spawn cost (~200-500 ms) paid once per
  build only when a binary always-on file is present.
- Narrowed availability — no `automation_script`, `web_scrape`, `cache`,
  `xlsx_tool` exposed.
- Per-file budget redistribution keeps the always-on block bounded;
  toggle-time rejection on single-file-exceeds-cap surfaces the cap.
- pdf-parse + mammoth rejected: duplicate Goose capability; bundle weight;
  pdf-parse v2 pulls native canvas.

## Consequences

- **Recipe-rebuild semantics.** Toggle applies on the **next fresh
  matter-open**; already-bound sessions keep the recipe baked at spawn
  (ADR-038 + Sprint 19b: resume-path skips the builder). Pane reflects
  the toggle immediately via the 2 s poll; injection lands on next spawn.
  Force-detaching on toggle rejected — would destroy in-flight context.
- `buildPracticeAreaRecipe` is async; cascades to `commercialRecipe.ts`
  and `MattersLanding.openMatter`.
- No new npm deps.
