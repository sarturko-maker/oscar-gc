# oscar/

All Oscar GC fork-specific code lives under this directory. The rest of the
repo tracks upstream goose (`aaif-goose/goose`); `oscar/` is upstream-disjoint,
so `git pull upstream main` never touches anything here.

## Layout

```
oscar/
  mcps/                       # 8 in-tree MCP servers (TypeScript, Apache-2.0)
    baselines/                # Lavern-lifted Sprint 22
    document-checks/          # Lavern-lifted Sprint 22
    document-reader/          # Lavern-lifted Sprint 22 + Sprint 24-b additions
    grounding-verifier/       # Lavern-lifted Sprint 22
    knowledge-base/           # Lavern-lifted Sprint 22 (placeholder corpus)
    memory/                   # Net-new Sprint 5
    onboarding/               # Net-new Sprint 6 (schema v4)
    risk-pricing/             # Net-new Sprint 22 (Lavern reference only)
```

## History

Before Sprint-26 consolidation, each of these 8 directories was its own
standalone repo at `/srv/projects/oscar-<name>-mcp`. They were folded in with
`git subtree add` so original commits and SHAs are preserved as ancestors of
the consolidation merges. To browse a single MCP's history:

```
git log --all --oneline -- oscar/mcps/<name>/
```

(The path-filter only shows post-consolidation commits because pre-consolidation
commits touched `src/...` rather than `oscar/mcps/<name>/src/...`. To see the
original commits use `git log <original-sha>` — original SHAs are listed in
`git log --graph` walking through the second parent of each consolidation
merge.)

The pre-consolidation state of every repo is preserved on GitHub via the
`pre-consolidation-2026-05-23` tag, pushed to each archived standalone repo
as the recovery anchor.

## Bundled vs in-tree

`prepare-oscar-bundle.js` currently bundles only `oscar-onboarding` and
`oscar-memory` into the `.deb`. The 6 Sprint-22 MCPs (baselines,
document-checks, document-reader, grounding-verifier, knowledge-base,
risk-pricing) are in-tree but not yet wired into the bundle. Wiring them is a
separate change — add to `SIBLING_MCPS` and `smokeTestBundledMcps` in
`ui/desktop/scripts/prepare-oscar-bundle.js`.

## External references (not in this repo)

Three things sit alongside Oscar GC but are intentionally NOT consolidated:

- **`/srv/projects/oscar-runtime`** — Python venv (adeu / redline server).
  Referenced as `DEV_REDLINE_VENV_BIN` in
  `ui/desktop/src/components/oscar/commercial/commercialRecipe.ts`. Not a git
  repo; lives outside this monorepo.
- **`/srv/projects/lq-ai-agentic`** — Sibling project. Used as the default
  source for `${ENV_FILE}` in `scripts/dogfood/dogfood.sh` and the
  `scripts/capture-*.sh` family. Always overrideable via the `ENV_FILE` env
  variable.
- **`/srv/projects/lavern` and `/srv/projects/LQdesign`** — Reference material
  (upstream Apache-2.0 source and design-system mockups respectively). Cloned
  for reference only; not consumed by build or runtime.

## License

Code under `oscar/` (except the per-MCP `oscar/mcps/<name>/LICENSE` files and
the `_lavern-original/` snapshots) is licensed under **AGPL-3.0-or-later** per
the root [`LICENSE`](../LICENSE). The 8 per-MCP `LICENSE` files remain
**Apache-2.0** (Copyright 2026 s-arturko) to keep MCP-level licensing uniform
across the Lavern-derived and net-new MCPs alike; AGPL-3.0 still applies at
the host-app integration level. See [`../LICENSES/README.md`](../LICENSES/README.md)
for the full per-path map and [`../NOTICE`](../NOTICE) for upstream attribution.

<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->

