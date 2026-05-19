# ADR-049 — Bundled MCP spawn-boot smoke test

Status: accepted
Date: 2026-05-19
Sprint: 14

## Context

Sprint 13 dogfood surfaced a P0 install regression (findings.md §P0-A): the vendored `oscar-fs` ESM bundle shipped with two `#!/usr/bin/env node` shebangs because `prepareVendoredMcps` left the esbuild `banner` config in place when it switched to `format: 'esm'`. ESM preserves the source shebang; the banner re-added it; Node rejected line 2 with `SyntaxError: Invalid or unexpected token`; `oscar-fs` failed to spawn at runtime. Forge claimed only `platform__manage_schedule` was available. Commercial would have lost matter-folder scope the same way.

The static `auditMcpNetworkSurface` (ADR-042) ran on the same bundle and reported clean — it only pattern-matches source text. The regression was invisible until a human (Arturs) installed the .deb on Crostini. Fix landed as `bc2e601a5` (banner dropped); but the class of failure — "bundle ships, fails to spawn at install time" — is recurrable. We want it caught at build time, not user time.

## Decision

Add `smokeTestBundledMcps` to `ui/desktop/scripts/prepare-oscar-bundle.js`. After both MCP-prep phases (`prepareMcps`, `prepareVendoredMcps`) and before `auditMcpNetworkSurface`, spawn each bundled MCP under the bundled Node binary, watch stderr for the MCP's ready-line, time out at 3 seconds, SIGTERM on match or timeout. Build fails (non-zero exit) if any MCP doesn't reach handshake. Results are recorded in `BUNDLE.json` under a new `smoke_test` key for provenance.

Per-MCP ready-line config is hard-coded inline (three MCPs; a `bundledMcpManifest` abstraction is premature). 3-second timeout chosen over 2s to absorb VPS cold-start variance observed during Sprint 13. `SKIP_SMOKE_TEST=1` env-var bypasses with a noisy warning, for local-dev iteration only; CI/VPS builds must not set it.

## Rationale

- **Catches the class, not just the instance**. Sprint 13's duplicate-shebang is one of many ways a bundle can ship-but-not-spawn (top-level-await rejected, native-module loader path missing, JSON-parse-on-startup blow-up, ESM/CJS mismatch). Any of these would surface as `process exited before ready line` with a stderr tail; the smoke test does not need per-failure-mode knowledge.
- **Reuses what already exists**. The MCPs already log a recognisable ready-line on stderr as part of normal startup — no instrumentation needed.
- **Hermetic**. The oscar-fs directory arg points at `.oscar-bundle-cache/smoke-sandbox/` (a per-build, per-host scratch dir), not `/tmp`, so smoke tests don't depend on shared host state.
- **Fail fast, fail loud**. Smoke failure throws from `main()` which already produces a non-zero exit and an error message; this slots into the existing build-pipeline failure surface without new wiring.

## Consequences

- Adds ~125ms × 3 MCPs to every bundle prep run (≈400ms total). Negligible against the multi-minute end-to-end .deb build.
- Build now requires the bundled Node binary to exist before `smokeTestBundledMcps` runs — already true (`prepareNode` runs first in `main`).
- Pinned npm vendor (`@modelcontextprotocol/server-filesystem`) may change its boot banner on version bump; the inline regex would then fail on a legitimate bundle. Acceptable: bumping vendor versions is also when we'd re-confirm the boot signal.
- Sibling MCPs (`oscar-memory`, `oscar-onboarding`) own their ready-line strings (`*-mcp ready` on stderr as a structured-log line); changing those strings becomes a coordinated change between the sibling repo and this script.
- `SKIP_SMOKE_TEST=1` is a deliberate dev-only escape hatch. The release SOP must never set it; CI/VPS configurations don't.

## Supersedes

None. Complements ADR-042 (static network audit). Where ADR-042 catches "this bundle pulled in something that talks to the network", ADR-049 catches "this bundle can't load at all".
