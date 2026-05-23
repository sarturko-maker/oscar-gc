# Oscar GC

_An in-house legal agent platform — local desktop app for general counsel and their teams._

Oscar GC is a single-binary Electron application for in-house legal work. Lawyers open a practice area, create a matter, and work with a scoped AI agent that knows the area, has access only to that matter's documents, and is paired with vendored in-house legal skill libraries plus a contract-redline service. The app runs locally on Linux, bundles its language-model client and document tools, and sends nothing to any cloud Oscar GC does not own.

## What it does

**Thirteen practice areas** are scaffolded out of the box: Commercial, Commercial Disputes, Corporate, CoSec, Employment, Employment Disputes, Privacy, IP, IP Disputes, Regulatory, Regulatory Disputes, Product, and AI Governance. Each area is a sidebar entry with its own onboarding-derived context, its own skill libraries (sourced from Anthropic's vendored `claude-for-legal`), and its own conversation history.

**Matters** are the primary work container — a contract negotiation, an employment case, a regulatory filing. Creating a matter spawns a session whose agent's filesystem is locked to that matter's folder (via the `oscar-fs` MCP's `allowed_directories`), so conversations never leak across matters. Commercial matters get `adeu` wired in for redline / Track-Changes generation.

**The Lavern Pipeline** (Watchman → Reader → Curator) handles substantive contract analysis: a Watchman triages the document head and routes by type (jv, nda, employment, lease, loan, saas, policy, other); a Reader runs per-clause analysis against a document-type-specific watch-list with mechanical grounding-verification; a Curator surfaces cross-document patterns when a portfolio of documents is reviewed together.

**Oscar LLP** is an in-app "firm bench" of ten specialist partner agents — Sarah Chen (M&A), Marcus Webb (Commercial), Daniel Reeves (Litigation), Priya Patel (Employment), James Okafor (IP), Helena Voss (Tax), Diana Park (Privacy), Robert Sinclair (Capital Markets), Aisha Khan (Tech Transactions), and Thomas Schmidt (Regulatory). Each partner is a scoped recipe with per-partner working directories and independent multi-session history.

**Forge** is a meta-agent for authoring new practice areas and skills inside the app.

**Quick chats** offer an unscoped surface outside the matter/area hierarchy for one-off conversations.

## Install

Oscar GC ships as a single Linux `.deb`. Pull the latest from [the releases page](https://github.com/sarturko-maker/oscar-gc/releases) and install:

```
sudo apt install ./oscar-gc_<version>_amd64.deb
```

Linux only at present (tested on Ubuntu 24.04 and Crostini). macOS and Windows packaging is on the roadmap but not built today.

## Build from source

The host setup (system packages, hermit toolchain, build sizing) is documented in [`RUNBOOK.md`](RUNBOOK.md); upstream goose's general Linux build notes live in [`BUILDING_LINUX.md`](BUILDING_LINUX.md). In short: hermit-managed toolchain (Rust 1.92, Node 24, pnpm 10), `cargo build --release` for the agent runtime, then `cd ui/desktop && pnpm install && pnpm bundle:oscar-linux` to produce the `.deb`. Full release build is ~27 minutes on a fresh checkout.

## How it's built

Oscar GC is a custom distribution of [`aaif-goose/goose`](https://github.com/aaif-goose/goose) (Apache-2.0), built using upstream's [Custom Distros](https://github.com/aaif-goose/goose/blob/main/CUSTOM_DISTROS.md) pattern. The Rust agent runtime (`goosed`) is upstream-tracked; all Oscar-specific product code lives under `oscar/` and `ui/desktop/src/components/oscar/` so upstream pulls never collide.

The `.deb` bundles nine Model Context Protocol servers:

- **Eight in-tree** under `oscar/mcps/`: `knowledge-base`, `document-reader`, `baselines`, `grounding-verifier`, `document-checks` (five lifted and adapted from [`AnttiHero/lavern`](https://github.com/AnttiHero/lavern), Apache-2.0); plus three Oscar-authored: `onboarding`, `memory`, and `risk-pricing` (Lavern's risk-pricing was scaffold-only, so Oscar's is from scratch).
- **One vendored**: `oscar-fs`, [`@modelcontextprotocol/server-filesystem`](https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem) (MIT) pinned at a specific version for per-recipe filesystem scoping.

Document redlining is handled by [`adeu`](https://github.com/dealfluence/adeu) (MIT), bundled as a Python wheel alongside CPython 3.12.5 from [`astral-sh/python-build-standalone`](https://github.com/astral-sh/python-build-standalone) (PSF + MPL-2.0); an Oscar-authored patch is applied at install per ADR-045.

The in-house legal skill library is vendored verbatim from Anthropic's [`claude-for-legal`](https://github.com/anthropics/claude-for-legal) (Apache-2.0) under `skills/in-house-legal/`. The Lavern Pipeline orchestration ships as parent + sub-recipes under `ui/desktop/sub-recipes/`.

The full per-path attribution map lives in [`NOTICE`](NOTICE).

## License

Oscar-authored code is licensed under **AGPL-3.0-or-later** (see [`LICENSE`](LICENSE)). Inherited and vendored code keeps its original license:

- Upstream goose, the Lavern lifts and prompts, the Lavern eval baseline, and Anthropic's claude-for-legal skills remain **Apache-2.0**.
- The vendored `oscar-fs` MCP and `adeu` are **MIT**.
- The bundled CPython runtime is **PSF License v2** and **MPL-2.0**.

The per-path mapping is documented in [`LICENSES/README.md`](LICENSES/README.md), with verbatim license texts in [`LICENSES/`](LICENSES/) and per-source attribution in [`NOTICE`](NOTICE).

## Status

v1.34.0, dogfood-stage on Crostini. Sprint 27 work has landed (multi-session per Oscar LLP partner). Single-platform (Linux `.deb`); not yet released externally.
