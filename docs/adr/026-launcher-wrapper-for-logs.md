# ADR-026 — Launcher wrapper script for renderer log capture

Status: accepted
Date: 2026-05-18
Sprint: 10

## Context

ADR-025 shipped Crostini-aware launch flags inline in the `.desktop` Exec= line. First Crostini install confirmed the .deb installs cleanly, the main process and goosed/MCP backend start healthy — but the renderer fails with a Gtk widget assertion, and the packaged build has **no surface for capturing the renderer's stderr**. Each diagnostic round-trip is blind: we can't see what Chromium actually emits when it fails to paint.

Electron's renderer process inherits stdout/stderr from the main process. By default `electron-installer-debian` discards both (no shell pipe in the launcher). Chromium's diagnostic logging is gated behind `--enable-logging` — without it, even capturing stderr yields nothing useful. The two need to be combined for the user to read what the renderer is complaining about.

ADR-025 anticipated this evolution: "Option (2) [wrapper script] was rejected because replacing electron-installer-debian's default `/usr/bin/oscar-gc` symlink via postinst creates a dpkg-state inconsistency on uninstall. Doable, but heavier than (3) for Sprint 10's bar." The bar shifted: now the bar is "Arturs can read why the renderer is failing." That requires logging + capture, which requires a wrapper.

## Decision

A wrapper script at `/usr/lib/oscar-gc/oscar-gc-launcher.sh`, written by `postinst` (heredoc) on `configure`. The `.desktop` Exec= line points at the wrapper. The wrapper:

1. Ensures `$HOME/.cache/oscar-gc/` exists, opens `launch.log` for append.
2. Sets `LIBGL_ALWAYS_SOFTWARE=1` (per ADR-025).
3. `exec`'s the real binary with ADR-025's flags plus `--enable-logging=stderr --v=1`.
4. Redirects both stdout and stderr (`>>"$LOG_FILE" 2>&1`) so Chromium's renderer diagnostics land in the log.

`/usr/bin/oscar-gc` (the symlink from electron-installer-debian's `bin:` field) is unchanged — terminal users still hit the bare binary unflagged. For terminal debugging, INSTALL_CROSTINI.md surfaces the equivalent manual incantation.

## Rationale

- **Log path** `$HOME/.cache/oscar-gc/launch.log` honours the XDG cache convention. User-readable from Files app via "Linux files" → ".cache" (hidden — toggle "Show hidden files" in the Files app's Settings).
- **`--enable-logging=stderr`** is Chromium's standard flag for unmuting the renderer/GPU/main-process diagnostic stream. Without it, the redirect captures only what Node directly emits (very little).
- **`--v=1`** lifts logging to INFO. Higher verbosity (`--v=2`+) floods the log with vlog spam; INFO catches the Gtk/ozone/sandbox decisions that matter for a Crostini diagnostic.
- **postinst heredoc** keeps the wrapper as a defined-in-source artefact (auditable in the .deb's postinst script) without needing extraResource shoehorning or a separate file path. Uninstall leaves the wrapper as an orphan file in `/usr/lib/oscar-gc/` (dpkg doesn't track it). Sprint 11 cleanup adds prerm/postrm if it becomes a real concern; for now the orphan is harmless (a 1 KB shell script).
- **Why not modify `main.ts`** — runtime detection of Crostini in `main.ts` is the cleaner long-term shape (per ADR-025 option 1) but logging is a packaging concern, not a Goose-product concern. Keeping it in the wrapper preserves upstream-merge cleanliness on `ui/desktop/src/main.ts`.

## Consequences

- **Diagnostic loop closed.** Arturs can read `~/.cache/oscar-gc/launch.log` after a failed launch and paste the relevant assertion. Next iteration of launch flags becomes data-driven, not guesswork-driven.
- **Log rotation is on the user.** `launch.log` grows append-only with each launch (header line per launch for grep-ability). If it becomes large, the user manually trims. For Sprint 10 dogfood, single-digit launches is the expected volume.
- **Terminal-launched bare binary** still bypasses the wrapper. INSTALL_CROSTINI.md publishes the equivalent terminal incantation; ad-hoc terminal launches that don't use the wrapper get the original Gtk crash with no log. That's accepted.
- **`OSCAR_GC_LOG_DIR` env override** is supported by the wrapper for moving logs to a different location (e.g., when sharing logs out of `~/.cache/`).
- **Uninstall orphan.** Sprint 11 candidate fix: add `prerm` that removes `/usr/lib/oscar-gc/oscar-gc-launcher.sh`.

## Supersedes

Extends ADR-025 along the "wrapper-script approach" path ADR-025 explicitly anticipated. Does not supersede ADR-025; both stay in force.
