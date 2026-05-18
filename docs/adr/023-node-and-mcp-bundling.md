# ADR-023 — Node + MCP bundling

Status: accepted
Date: 2026-05-18
Sprint: 10

## Context

Sprint 5 and Sprint 6 wired `oscar-memory-mcp` and `oscar-onboarding-mcp` as stdio MCP extensions running against the dev host's `/usr/bin/node`. ADR-008's rationale section explicitly flagged this as bundling debt: "Shipping `.deb`/`.rpm` will bundle node or use a search path." Sprint 10 closes the debt.

Two options for the Node runtime:

1. **Bundle a standalone Node binary** — ~80 MB; runs MCP scripts via a separate process; recipe shape stays close to dev (`cmd: <bundled-node>`, `args: [<dist.js>]`); predictable and debuggable.
2. **Use Electron's `ELECTRON_RUN_AS_NODE`** — re-uses the existing Electron binary's bundled Node; saves ~80 MB; requires a wrapper shell script because Goose's `ExtensionConfig::Stdio` has `cmd:` + `args:` but no `env:` field.

Two options for the MCP outputs:

A. **Copy `dist/index.js` from each sibling MCP build into `resources/mcps/<name>/index.js`** — the existing esbuild outputs are single-file bundles, tiny.
B. **Compile each MCP to a standalone binary** (Node SEA, Bun compile, pkg) — each MCP becomes its own executable; redundant given option A.

## Decision

- **Node**: bundle Node 24.x linux-x64 standalone at `resources/node/bin/node`.
- **MCPs**: copy each sibling repo's `dist/index.js` to `resources/mcps/<name>/index.js`. Sprint 10 bundles both `oscar-onboarding` and `oscar-memory`, even though only `oscar-onboarding` is wired into a recipe today.

Recipe `cmd:` becomes the bundled Node path; `args:` becomes the bundled MCP dist path. Both resolved via the `resourcesPath` factory pattern (ADR-024).

## Rationale

- Standalone Node is the boring choice. The recipe-spawn mental model stays identical to dev (`cmd: <node>`, `args: [<dist.js>]`); debugging a failed MCP subprocess remains transparent.
- `ELECTRON_RUN_AS_NODE` saves 80 MB but adds a wrapper script per MCP plus the cognitive cost of "why is the same binary doing two different things." Not worth it for Sprint 10's deliverable bar; revisit when the `.deb` size pressure justifies it.
- esbuild MCP outputs are already single-file bundles (~few KB per file per Sprint 5/6 evidence). No need for compile-to-binary tooling.
- Bundling `oscar-memory` even without recipe wiring future-proofs Sprint 11's memory-wiring work — the runtime is already in place; only the recipe edit is needed when that sprint lands.

## Consequences

- `.deb` adds ~80 MB for the Node binary. Combined with Python (ADR-022, ~70 MB compressed), the runtime additions total ~150 MB on top of the existing Electron + goosed bundle.
- Node version lock: Sprint 10 ships Node 24.x. Both sibling MCPs already pin `engines.node: ^24.10.0` in their `package.json`; runtime + sibling expectations match.
- `prepare-oscar-bundle.js` is responsible for both: downloading the Node tarball and invoking each sibling repo's `pnpm build` to refresh `dist/index.js`. Sibling-repo working-dir must exist locally at the documented sibling-path (per Sprint 5/6 RUNBOOK).
- Future Node version bumps update one place (`prepare-oscar-bundle.js` constant) and re-run the build.

## Supersedes

ADR-008's "Shipping `.deb`/`.rpm` will bundle node or use a search path" deferral — addressed in Sprint 10.
