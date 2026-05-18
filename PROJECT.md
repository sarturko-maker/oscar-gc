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

See `SPRINT_LOG.md` for entries. See `CLAUDE.md` for operating rules.

## Branding follow-ups

Rebrand surface area Sprint 2 deferred and Sprint 3 chose not to expand. Each is a future sprint's anchor.

1. **`goose://` URL scheme** — 14+ literals across `ui/desktop/src/` (sessions, recipes, extensions, scheduling). Per ADR-003 the scheme rewrite must be atomic: `forge.config.ts` `schemes:` + both `.desktop` `MimeType=` + every `src/` consumer in one commit. Also bundles the `OnboardingGuard` "Welcome to goose" string (a `src/` branded literal).
2. **`document.title` runtime overwrite** — `index.html` already sets `<title>Oscar GC</title>`, but React resets the title to "Goose" after first render. Multiple call sites in `src/` (find with `grep -r "document.title" ui/desktop/src/`).
3. **System prompt** at `crates/goose/src/prompts/system.md` — the agent introduces itself as Goose at runtime. First Rust-touch sprint; merits an ADR (the only legitimate `crates/` edit so far).
4. **Icons** under `ui/desktop/src/images/` — `icon.png/.ico/.icns/.svg/-512.png` are all Goose's. Needs Oscar GC visual identity work before replacing.
5. **`ui/desktop/scripts/goosey`** — invokes `goose-app` on PATH (no longer exists under the new brand); plus `ui/desktop/package.json` macOS bundle scripts default `${GOOSE_BUNDLE_NAME:-Goose}`. Defer until the first Linux PATH installer (.deb/.rpm) ships.
