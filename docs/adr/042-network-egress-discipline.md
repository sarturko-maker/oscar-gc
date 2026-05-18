# ADR-042 — Network-egress discipline: audit + Extension Allowlist + bubblewrap deferral

Status: accepted
Date: 2026-05-19
Sprint: 12

## Context

Sprint 12's two-tier defense (filesystem scope + network discipline, per the brief's principle 1) requires a network-egress allowlist on each agent. Survey of upstream layers:

- **Per-MCP / recipe-level network policy**: no prior art in Goose. Adding a field to `ExtensionConfig::Stdio` is a Rust-core change → fork-hygiene violation.
- **Goose Sandbox** (`docs/guides/sandbox`, goose-docs.ai): macOS-only (`sandbox-exec` + egress proxy). Linux/Crostini gets nothing built-in.
- **Goose Extension Allowlist** (`docs/guides/allowlist`): `GOOSE_ALLOWLIST` env → YAML URL listing which MCP installation commands are permitted. Exact-string matching, no wildcards. Restricts **install**, not network egress.
- **Electron-level**: `main.ts` already calls `session.setProxy()` for `HTTP_PROXY` env. Renderer-side `webRequest` / CSP available.

## Decision

**Three-layer position**:

1. **Per-MCP**: every Oscar GC bundled MCP is audited to make no outbound network calls. Today: `oscar-memory` (local SQLite), `oscar-onboarding` (filesystem-only), `oscar-fs` (filesystem-only by definition, ADR-040), `redline`/adeu (whitelisted to `read_docx`, `process_document_batch`, `diff_docx_files` — cloud-auth tools filtered out per ADR-017). Audit recorded in `BUNDLE.json` at build time (grep step in `prepare-oscar-bundle.js` scans bundled MCP source for `https?://`, `fetch(`, `axios`, `XMLHttpRequest`, `node-fetch`; zero matches required, exceptions require explicit waiver).
2. **Goosed → provider**: the only outbound traffic is goosed's HTTP call to the LLM provider. Provider URL is config-driven; locked to MiniMax for the bundled distribution per ADR-012.
3. **Electron renderer**: tighten `index.html` CSP to disallow external fetches from the renderer; `webRequest` filter blocks renderer-initiated outbound except to the LLM-provider host. Renderer makes no outbound today; this is structural prevention against future drift.

**Activate `GOOSE_ALLOWLIST`**: `main.ts` sets `GOOSE_ALLOWLIST=file://<resourcesRoot>/allowlist.yaml` before spawning goosed. Bundled `resources/allowlist.yaml` lists exactly Oscar GC's 4 MCP installation commands (`oscar-fs`, `oscar-memory`, `oscar-onboarding`, `redline`). Structurally prevents installing arbitrary MCPs via Goose's Extensions UI.

**OS-level network enforcement** (per-process firewall, network namespaces) deferred to Sprint 15+ bubblewrap-class work. Becomes load-bearing when community-tier user-installed skills land — bundled skills today are trusted at build time.

## Rationale

- **Two-tier defense from day one** (brief principle 1). Filesystem scope (ADR-041) + network discipline (this ADR) together; either alone leaves a gap.
- **Audit-as-floor over speculative-enforcement.** Linux Crostini has no upstream sandbox; the structural defense is "no MCP in our recipes does outbound" enforced at build time. Honest framing — not lagging upstream, mirroring the macOS-only reality.
- **`GOOSE_ALLOWLIST` activation is the inverted-defaults pick.** Upstream's Extensions UI invites adding MCPs; the in-house audience should never do that. Setting the env locks the structural floor.
- **No third-party data egress beyond the configured LLM provider** (brief principle 4). Network allowlist enforces this structurally, not via opt-out UX.

## Consequences

- `GOOSE_ALLOWLIST` exact-match has no wildcards — a **Sprint 15+ structural revisit** is planted: community-tier MCP installs hit a wall unless we (a) ship new allowlist with each release, (b) extend upstream allowlist with per-user additions (upstream PR), or (c) replace with Oscar-side allowlist on top. Tracked in TODO.md.
- Build-time grep audit is mechanical; if a future MCP needs HTTP, the grep flags it for explicit waiver entry in `BUNDLE.json`.
- Goosed → provider remains in-scope outbound; provider-URL discipline (ADR-012) is the load-bearing constraint there.
- Bubblewrap-class work (network namespaces) explicitly deferred. ADR at Sprint 15+ supersedes this one's deferral framing.

## Supersedes

None.
