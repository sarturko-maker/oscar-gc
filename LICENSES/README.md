# Oscar GC license map

Oscar GC is a multi-license codebase. Oscar-authored work is licensed under
AGPL-3.0-or-later; inherited and bundled work keeps its original license.
This file documents which license covers which path; verbatim license texts
are alongside it; per-component attribution lives in [`../NOTICE`](../NOTICE).

## License files in this directory

| File                              | SPDX               | Covers                                                                                                                                  |
| --------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| [`../LICENSE`](../LICENSE)        | AGPL-3.0-or-later  | Oscar-authored code (see paths below). Root license of the repo.                                                                        |
| `Apache-2.0.txt`                  | Apache-2.0         | Upstream goose, Lavern lifts, Anthropic claude-for-legal vendored skills, Lavern eval baseline, per-MCP LICENSEs under `oscar/mcps/*/`. |
| `MIT.txt`                         | MIT                | Vendored `oscar-fs` (`@modelcontextprotocol/server-filesystem`), `adeu` Python wheel, and several wheels in the adeu cohort.            |
| `MPL-2.0.txt`                     | MPL-2.0            | Portions of the bundled CPython runtime redistributed via `python-build-standalone`.                                                    |
| `Python-2.0.txt`                  | Python-2.0         | CPython 3.12.5 itself (PSF License v2 + the historical BeOpen / CNRI / CWI license stack that CPython ships).                          |

## Per-path coverage

### AGPL-3.0-or-later (Oscar-authored)

- `oscar/` — except `oscar/mcps/*/LICENSE` (each Apache-2.0; see below) and `oscar/mcps/*/src/_lavern-original/` (Apache-2.0; verbatim Lavern snapshots).
- `ui/desktop/src/components/oscar/` — except `oscar-llp/prompts/raw/*.original` (Apache-2.0; verbatim Lavern prompt snapshots).
- `ui/desktop/sub-recipes/verification-pass.yaml` (Oscar-authored, per ADR-081). The four `ui/desktop/sub-recipes/lavern-*.yaml` files stay Apache-2.0.
- `ui/desktop/scripts/prepare-oscar-bundle.js` and any Oscar-authored postinst scripts under `ui/desktop/scripts/` that wrap the adeu patch.
- `evals/lavern-jv/scripts/` (Oscar-authored eval runner, per ADR-077). The verbatim Lavern fixtures in `evals/lavern-jv/RUBRIC.lavern-original.md` and `evals/lavern-jv/docs/*` stay Apache-2.0.
- `evals/oscar-llp/` (Oscar-authored Oscar LLP eval scaffolding).
- `docs/redline/adeu-1.6.9-batch-path-word-diff.patch` (Oscar-authored modification to adeu; the adeu wheel it patches stays MIT).
- New top-level docs authored by Oscar GC.

### Apache-2.0 (inherited / preserved)

- Everything outside `oscar/` and outside the explicit AGPL-3.0 paths above — i.e., the upstream goose tree (`crates/`, `documentation/`, `recipe-scanner/`, `services/`, `Justfile`, `Cargo.*`, and the bulk of `ui/desktop/` that tracks upstream).
- `oscar/mcps/<name>/LICENSE` (8 files, Copyright 2026 s-arturko) — originally chosen as Apache-2.0; preserved for license history continuity. Five of the eight MCPs are Lavern derivatives; three (`memory`, `onboarding`, `risk-pricing`) are Oscar-authored but kept Apache-2.0 to keep MCP-level licensing uniform. AGPL-3.0 still applies at the integration level via the host app.
- `oscar/mcps/<name>/src/_lavern-original/` — verbatim Lavern snapshots, Apache-2.0.
- `skills/in-house-legal/` — vendored verbatim from Anthropic's `claude-for-legal`, Apache-2.0 (Copyright Anthropic, PBC).
- `evals/lavern-jv/{NOTICE.lavern.md, RUBRIC.lavern-original.md, docs/*}` — verbatim Lavern eval baseline, Apache-2.0.
- `ui/desktop/src/components/oscar/oscar-llp/prompts/raw/*.original` — verbatim Lavern prompt snapshots, Apache-2.0.
- `ui/desktop/sub-recipes/lavern-{watchman,reader,curator,pipeline}.yaml` — derived from Lavern, Apache-2.0.

### MIT (vendored)

- `ui/desktop/src/resources/mcps/oscar-fs/` — `@modelcontextprotocol/server-filesystem` v2026.1.14 (Copyright Anthropic, PBC). Per-component LICENSE file at `ui/desktop/src/resources/mcps/oscar-fs/LICENSE`.
- `ui/desktop/src/resources/python/wheels/adeu-1.6.9-py3-none-any.whl` — `adeu` 1.6.9 (Copyright (c) 2026 Dealfluence Oy). LICENSE travels inside the wheel's `dist-info/`.
- Most of the ~47 other bundled Python wheels (mixed permissive licenses; per-wheel LICENSE travels inside each wheel's `dist-info/`).

### Python-2.0 + MPL-2.0 (bundled runtime)

- `ui/desktop/src/resources/python/cpython/` — CPython 3.12.5 from `astral-sh/python-build-standalone`, bundled at build time by `ui/desktop/scripts/prepare-oscar-bundle.js`. CPython itself is covered by `Python-2.0.txt`; portions added by python-build-standalone are covered by `MPL-2.0.txt`.

## SPDX header convention

New Oscar-authored source files SHOULD carry an SPDX header on the first non-shebang line:

```
// SPDX-License-Identifier: AGPL-3.0-or-later
```

(or the language-equivalent comment syntax). Inherited files and verbatim vendored snapshots are left untouched. Header rollout is incremental — see the seed list noted in commit `license: relicense Oscar-authored code to AGPL-3.0`.

## When in doubt

- If a file lives under `oscar/`, `ui/desktop/src/components/oscar/`, or `ui/desktop/sub-recipes/verification-pass.yaml` and was authored by Oscar GC: **AGPL-3.0-or-later**.
- If a file lives anywhere else and predates the relicense, or is a verbatim snapshot of an external upstream: **its original license** (see `../NOTICE` for the upstream and grant).
- For new code contributed under upstream-namespace paths: assume the upstream's license (Apache-2.0 for goose-tracked paths).

## Compatibility

Apache-2.0, MIT, and Python-2.0 are one-way compatible with AGPL-3.0. The Apache-2.0 NOTICE requirements still apply to inherited code — `../NOTICE` carries the full upstream attribution map. We do not retroactively re-license inherited code; the LICENSE that applied at the time of import remains the license of those files.

This scheme is described in ADR-035 (attribution scheme) and updated by the `license:` commit that introduced this directory.
