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

## Distribution shape

Oscar GC ships as a single installable binary — `.dmg`, `.exe`, `.AppImage`. The user downloads one file, double-clicks, it runs. No "also run this service," no "install this dependency."

The sibling MCP server repos (`oscar-memory-mcp`, `oscar-onboarding-mcp`, future MCP servers) exist as separate repos for development convenience — fork hygiene against upstream Goose, per-stack build cleanliness, independent lifecycle. **They are not separate at distribution.** Each MCP server's built output gets bundled into the Electron package at packaging time, copied into the resources directory alongside `goosed`. At runtime, the desktop agent spawns them as embedded subprocesses, transparent to the user.

Pattern mirrors how Goose already handles `goosed` — separation in development, bundling at build, single binary at distribution.

Three rules to preserve this option as MCP servers grow:

1. **No system-level dependencies.** No "this requires Postgres" or "this needs a Python interpreter." Embed SQLite if you need persistence; use Node built-ins for HTTP. Anything that survives bundling (esbuild single-file output, `pkg`/Bun-compiled native binaries) is fine; anything that needs OS-level install isn't.

2. **Small, self-contained.** Each MCP server is a few hundred lines, minimal dependencies, no heavy native modules. Bundle-shaped from the start.

3. **No cross-MCP runtime coupling.** Servers don't assume other servers' versions, schemas, or presence at runtime. Each is independent. Cross-MCP coordination happens through the agent that calls them, not through direct server-to-server channels.

Bundling itself becomes a sprint when there are enough MCP servers and a clear "we're ready to ship" trigger — likely Sprint 12-15 range, after the four-item short-term goal completes. Until then, dev separation is right; the rules above keep the door open.

## Sprint Index

| Sprint | Goal | Status |
|---|---|---|
| 1 | Unmodified Goose builds + MiniMax round-trip on `lq-vps`. No product code. | Closed 2026-05-17 |
| 2 | Oscar GC rebrand (branding metadata only). First custom-distribution cycle. | Closed 2026-05-18 |
| 3 | First `ui/desktop/src/` source change — Oscar GC landing placeholder. LQdesign Terminal default. | Closed 2026-05-18 |
| 4 | Practice-area sidebar (13 entries) + placeholder routes. Seam moves to AppLayout. | Closed 2026-05-18 |
| 4.5 | Visual fidelity audit + gap closure against LQdesign Terminal: JetBrains Mono + Cormorant Garamond loaded; eyebrow / orb / `01`–`13` mono numerics / indigo-tinted sidebar active state applied. | Closed 2026-05-18 |
| 4.6 | Editorial as Oscar GC's default surface; supersedes ADR-004. Cream paper, Cormorant Garamond hero with italic copper accent, IBM Plex Mono eyebrows with hairline rule, Outfit body, copper-glow active sidebar. Outfit + IBM Plex Mono loaded; class scope renamed `.oscar-terminal` → `.oscar`. | Closed 2026-05-18 |
| 5 | Minimal in-house memory MCP server. New sibling repo `sarturko-maker/oscar-memory-mcp`. Two-tool stdio extension registered with Goose CLI; verified end-to-end. | Closed 2026-05-18 |
| 6 | First-launch onboarding as an agent-driven interview. New sibling repo `sarturko-maker/oscar-onboarding-mcp` with `finalize_profile` tool; recipe-scoped onboarding agent in a dedicated Editorial chat surface; `~/.config/oscar/profile.json` schema (v1); sidebar runtime-reads the profile. | Closed 2026-05-18 |
| 7 | Onboarding dogfood — CC operates Oscar GC as a real in-house lawyer (two personas, primary + edge) against real MiniMax. Surfaces one P0 (closing-message race), four P1s, six P2s. Establishes the "CC as the user" dogfood pattern; harness committed under `scripts/dogfood/`. Report at `docs/dogfood/sprint-7/`. | Closed 2026-05-18 |
| 8 | Hub welcome banner closes Sprint 7's P0 closing-message race. ADR-015 (extends ADR-014). `OscarHubBanner` reads `profile.json` directly; dismissable; localStorage persisted. Closes P0-A, P1-D; deprecates P1-A / P1-C as load-bearing failures. P1-B deferred to Sprint 9. Re-dogfood confirms all four. Dogfood harness gains env-configurable screenshot base + `click <selector>` subcommand. Report at `docs/dogfood/sprint-8/`. | Closed 2026-05-18 |
| 9 | adeu==1.6.9 wired as a stdio MCP under capability name `redline`. Python venv at `/srv/projects/oscar-runtime/python/adeu-venv/` (first Python component). Five ADRs at decision time: 016 Python runtime, 017 capability binding (config-level DI), 018 path-as-text ingress, 019 disk-write egress, 020 five-step lawyer-reasoning system prompt. Commercial recipe scaffolds the chat under `ui/desktop/src/components/oscar/commercial/`. Round-trip verified: substantive unilateral NDA made mutual via 8 coordinated `process_document_batch` edits; OOXML walk + lawyer-quality comparison committed. **Closes the fourth (and final) item of the four-item short-term goal.** Report at `docs/dogfood/sprint-9/`. | Closed 2026-05-18 |
| 10 | Oscar GC as one-step Crostini install. Single `oscar-gc_1.34.0_amd64.deb` published to GitHub Release. Bundled: relocatable CPython 3.12 + adeu wheels (postinst venv), Node 24, esbuild MCP bundles, launcher wrapper. Debian 12 Docker build host (ABI compatibility). Renderer blocker root-caused in 5 dogfood iterations (preload sandbox cannot import `node:fs` — fixed by moving probe to main.ts + additionalArguments config channel). Ten ADRs (021–030). CLAUDE.md inverted-defaults doctrine applied: telemetry suppressed, recipe-trust dialog bypassed for bundled recipes, GooseLogo replaced with LQ mark, Settings affordance restored. | Closed 2026-05-18 |
| 11 | claude-for-legal repackaged as bundled in-house skill library. Anthropic's 9 in-house plugins vendored at upstream commit `4d55f539` (Apache 2.0); 111 SKILL.md files. 27 drops (per-plugin `cold-start-interview`, `customize`, `CLAUDE.md` × 9) + 9 `matter-workspace` stubs kept (Sprint 12 supersedes) + 6 collision renames (`<plugin>__<skill>` per ADR-031 detect-and-prefix). Onboarding schema v2 with `area_profile` per area; new `list_area_questions` MCP tool sourced from `OSCAR_RESOURCES_ROOT`; P3.5 per-area mini-interview phase with 2-question hard cap. Five ADRs (031–035): practice-area→plugin mapping, onboarding schema v2, gating-strip policy, output-path convention (supersedes ADR-019), Apache 2.0 NOTICE + attribution. Two Sprint 10 carry-forwards closed: onboarding markdown rendering, P3→P3.5 pacing. Dogfood deferred to Arturs's Chromebook. | Closed 2026-05-19 |

See `SPRINT_LOG.md` for entries. See `CLAUDE.md` for operating rules.

## Branding follow-ups

Rebrand surface area Sprint 2 deferred and Sprint 3 chose not to expand. Each is a future sprint's anchor.

1. **`goose://` URL scheme** — 14+ literals across `ui/desktop/src/` (sessions, recipes, extensions, scheduling). Per ADR-003 the scheme rewrite must be atomic: `forge.config.ts` `schemes:` + both `.desktop` `MimeType=` + every `src/` consumer in one commit. Also bundles the `OnboardingGuard` "Welcome to goose" string (a `src/` branded literal).
2. **`document.title` runtime overwrite** — `index.html` already sets `<title>Oscar GC</title>`, but React resets the title to "Goose" after first render. Multiple call sites in `src/` (find with `grep -r "document.title" ui/desktop/src/`).
3. **System prompt** at `crates/goose/src/prompts/system.md` — the agent introduces itself as Goose at runtime. First Rust-touch sprint; merits an ADR (the only legitimate `crates/` edit so far).
4. **Icons** under `ui/desktop/src/images/` — `icon.png/.ico/.icns/.svg/-512.png` are all Goose's. Needs Oscar GC visual identity work before replacing.
5. **`ui/desktop/scripts/goosey`** — invokes `goose-app` on PATH (no longer exists under the new brand); plus `ui/desktop/package.json` macOS bundle scripts default `${GOOSE_BUNDLE_NAME:-Goose}`. Defer until the first Linux PATH installer (.deb/.rpm) ships.
