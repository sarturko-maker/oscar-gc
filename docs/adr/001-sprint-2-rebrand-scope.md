# ADR-001 — Sprint 2 rebrand scope: desktop build boundary

Status: accepted
Date: 2026-05-18
Sprint: 2

## Context

Sprint 2 introduces the first custom-distribution cycle: rename upstream Goose to "Oscar GC" and prove the rebuild pipeline. `CUSTOM_DISTROS.md` §D names two surfaces — desktop config + visual assets, and `crates/.../prompts/system.md` — that together form a "complete" rebrand. The goal of Sprint 2 is a one-day cycle, not a complete rebrand.

A complete rebrand would touch four areas: (1) desktop config metadata, (2) UI source under `ui/desktop/src/` (window title, branded constants, `goose://` deep-link literals at 14+ call sites), (3) icon assets under `ui/desktop/src/images/`, (4) Rust system prompt + branded literals under `crates/`. Areas 2–4 are large enough to merit dedicated sprints; bundling them into Sprint 2 destroys the one-day-cycle goal.

## Decision

Sprint 2 rebrands only the five desktop config files identified in `CUSTOM_DISTROS.md` §D step 5:

- `ui/desktop/package.json` (`name`, `productName`, `description`)
- `ui/desktop/forge.config.ts` (`packagerConfig.name`/`executableName`, protocol name, TCC strings, deb/rpm `name`/`bin`, publisher fallback owner)
- `ui/desktop/forge.deb.desktop` + `forge.rpm.desktop` (`Name`, `Exec`, `Icon`)
- `ui/desktop/index.html` (`<title>`)

Everything else stays as upstream Goose, including: `ui/desktop/src/`, all of `crates/`, icon assets, the system prompt, `ui/desktop/scripts/goosey`, the `goose://` URL scheme (see ADR-003), `${GOOSE_BUNDLE_NAME:-Goose}` env-var default in macOS bundle scripts, deb/rpm maintainer + homepage, Flatpak app ID.

## Consequences

- The rebuilt zip's filename and in-zip binary name reflect Oscar GC — sufficient for Sprint 2's exit criteria.
- At runtime the app still introduces itself as Goose (Rust system prompt), the React-controlled `document.title` reverts to "Goose" after the first render, deep links remain `goose://`, the icon stays as Goose's, and `ui/desktop/scripts/goosey` breaks for any Linux PATH user (it invokes `goose-app` which no longer exists).
- Each of those gaps is a known, named carry-forward; closing them is the work of Sprint 3 (`src/` rewrite) and a later Rust-touch sprint.
- This ADR records the intentional scope line: Sprint 2 stops at the desktop build boundary, not the user-experience boundary.

## Supersedes

None (first ADR in this project).
