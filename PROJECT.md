# [Goose] — In-House Legal Agent Platform

Custom distribution of Block's Goose (now AAIF / Linux Foundation) — `aaif-goose/goose`. We replace the UI layer and the memory layer; we leave the Rust agent core alone.

## The one goal (short-term)

1. Fork Goose (done — `sarturko-maker/goose`, mirroring `aaif-goose/goose`).
2. Replace the UI layer (`ui/desktop/src/`) with an in-house-legal UI: practice areas → primary unit → memory + artifacts + agent.
3. Replace the memory layer with a scoped MCP server we own.
4. Wire adeu as an MCP server for the Commercial practice area.

Nothing further is in scope until those four are working.

## Fork strategy

We are a custom distribution of Block's Goose (now AAIF / Linux Foundation) per upstream's [`CUSTOM_DISTROS.md`](./CUSTOM_DISTROS.md) — not a hard fork. `CLAUDE.md` "Fork hygiene" covers per-PR discipline (Rust core untouched, product work in `ui/desktop/src/` + sibling crates). This section covers the upstream relationship.

**Canonical upstream**: `aaif-goose/goose` (formerly `block/goose` — the project moved to the AI Alliance Foundation under the Linux Foundation in late 2025). Remotes on `lq-vps`:

| Remote | URL | Purpose |
|---|---|---|
| `origin` | `git@github.com:sarturko-maker/goose.git` | Our distribution; product code lives here. |
| `upstream` | `git@github.com:aaif-goose/goose.git` | Canonical upstream; tracked for releases and breaking changes. |

**Customization route**: upstream's `CUSTOM_DISTROS.md` documents the supported surfaces for a custom distribution — desktop branding metadata (`ui/desktop/package.json`, `forge.config.ts`, `forge.{deb,rpm}.desktop`, `index.html`), UI rewrite under `ui/desktop/src/`, sibling crates for our additions (memory MCP server, practice-area config, adeu integration), and the system prompt at `crates/goose/src/prompts/system.md`. We follow that path; we do not patch the Rust core.

**Upstream-tracking cadence**: weekly read of upstream release notes. For each release we decide one of:

- **Skip** — release contains no security-, fork-, or product-relevant changes for us.
- **Merge** — pull `upstream/main` into a feature branch, resolve conflicts, merge into our `main`.
- **Wait** — defer to the next weekly cycle (e.g., release looks risky; want to see hotfixes land first).

Capture the per-release decision as a one-line note in `SPRINT_LOG.md` under the active sprint, or as an ADR if the decision is structural (e.g., declining a breaking change because we have a competing customization).

## Sprint Index

| Sprint | Goal | Status |
|---|---|---|
| 1 | Unmodified Goose builds + MiniMax round-trip on `lq-vps`. No product code. | Closed 2026-05-17 |
| 2 | Oscar GC rebrand (branding metadata only). First custom-distribution cycle. | Closed 2026-05-18 |

See `SPRINT_LOG.md` for entries. See `CLAUDE.md` for operating rules.
