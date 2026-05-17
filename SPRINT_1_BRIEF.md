# Sprint 1 — Foundation Research

**Goal**: understand what we just forked. No product code yet.

**Tasks**:

1. Verify remotes: `origin` is `sarturko-maker/goose`, `upstream` is `aaif-goose/goose`.
2. Read the repo top-down: `README.md`, `CONTRIBUTING.md`, `CUSTOM_DISTROS.md`, `documentation/`, the `crates/` workspace structure, `ui/desktop/` (the React/TS UI we'll be rewriting), `crates/goose/src/agents/` (the agent core we are NOT rewriting), `crates/goose-mcp/` (where MCP integration lives).
3. Capture host build dependencies as you discover them — write each one into `RUNBOOK.md` as you install it. No retroactive writes.
4. Attempt to build Goose unmodified on `lq-vps`. Build both the CLI and the desktop app if reachable. Report build time, disk usage, failures.
5. Identify the seam for the UI rewrite (which dir, which build target).
6. Identify the seam for the memory MCP server (where Goose looks for MCP servers, what config we'd add).

**Out of scope**: any product code, any UI changes, any MCP server work, any adeu wiring.

**Exit criteria**: a written report back to Arturs covering: (a) what the repo's structure actually is, (b) what built and what didn't, (c) what the UI-rewrite seam looks like, (d) what the memory-MCP seam looks like, (e) any architectural surprises that should reshape the next sprint.

**Discipline**: ADRs at decision time if you make any. SPRINT_LOG entry on close. Commit + push frequently.
