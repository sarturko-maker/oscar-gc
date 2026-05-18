# ADR-016 — Python runtime location for adeu

Status: accepted
Date: 2026-05-18
Sprint: 9

## Context

Sprint 9 wires `adeu==1.6.9` (Python stdio MCP, fastmcp 3.3.1) into the Oscar GC desktop binary as the redline backend. This is the project's first Python component — every prior component runs on the bundled Hermit Node + Rust toolchain. The four-item short-term goal closes with Sprint 9, so this decision sets the host-state shape for the redline capability without locking in the eventual bundling story (Sprint 12-15 distribution work).

Three options were evaluated:

1. **System Python** (`apt install python3-adeu` or system `pip install`) — couples the install to Ubuntu's apt-managed Python; pollutes a system the host uses for other things; we'd have to undo it before bundling.
2. **User-scope venv** (`~/.local/share/oscar/python/adeu-venv/`) — XDG-aligned, but couples to `$HOME` in a way that breaks under root + Xvfb dogfood and creates surprise when we move to a packaged user.
3. **Sibling-style absolute venv** at `/srv/projects/oscar-runtime/python/adeu-venv/` — mirrors `oscar-memory-mcp/`, `oscar-onboarding-mcp/` directory shape; a single absolute path goes into `~/.config/goose/config.yaml`'s `cmd:`; no PATH dependence.

## Decision

Option (3). adeu runs from a managed venv at `/srv/projects/oscar-runtime/python/adeu-venv/`. The Goose extension `cmd:` is the absolute path `/srv/projects/oscar-runtime/python/adeu-venv/bin/adeu-server` — no PATH lookup. apt installs needed at sprint start: `python3-venv`, `python3-dev`, `libxslt1-dev` (one-shot, captured in RUNBOOK §Sprint 9).

## Rationale

- **Absolute path matches ADR-008's lesson.** Electron's child-process PATH does not match the parent shell's PATH; Hermit's `node` shim shadows `/usr/bin/node` and crashes subprocess MCPs. Sibling MCPs adopted `cmd: /usr/bin/node` in the recipe. adeu adopts the same absolute-path discipline.
- **`/srv/projects/oscar-runtime/` is not a git-managed repo**; it is a runtime location. Distinct from `/srv/projects/oscar-memory-mcp/` (a sibling repo we author). adeu is upstream; we host the venv, not the source.
- **Cleanly relocatable for Sprint 12-15.** When we bundle, the entire `adeu-venv/` directory ports into Electron's `resources/python/adeu-venv/` (or equivalent), and the recipe's absolute path becomes the bundle-relative path. No app-code changes needed at swap time.
- Declined option (1): contaminates a multi-purpose Python on the dev host; harder to delete cleanly when bundling lands.
- Declined option (2): `~/.local/` semantics are confusing under root + Xvfb; the venv is host-state, not user-state.

## Consequences

- **First Python-component dependency.** apt-installed `python3-venv`, `python3-dev`, `libxslt1-dev` are captured in RUNBOOK §Sprint 9 with the install incantation.
- **Bundling debt.** Sprint 12-15 must address: (a) bundling a Python interpreter (or reusing the user's), (b) relocating the venv into the app bundle, (c) handling Windows/macOS path differences. This is anticipated, not new debt.
- adeu's transitive dep tree (~90 MB on disk including `lxml`, `fastmcp`, `pydantic`, `mcp`) is significant but acceptable; production bundling will need to evaluate stripping unused features (e.g. adeu's cloud/email tools we whitelist out).

## Supersedes

None. First ADR establishing Python runtime discipline.
