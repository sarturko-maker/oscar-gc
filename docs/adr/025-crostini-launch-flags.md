# ADR-025 — Crostini-aware Electron launch flags in the .desktop entry

Status: accepted
Date: 2026-05-18
Sprint: 10

## Context

Sprint 10's P6 verification installed the `oscar-gc_1.34.0_amd64.deb` in a clean `debian:bookworm` Docker container. Postinst succeeded, the adeu venv populated, bundled Node started the MCPs, glibc audit passed (max GLIBC_2.34). The container has no X server, so the GUI itself was never exercised. Sprint 10's P9 (Arturs's Crostini dogfood) is the first time the Electron renderer actually attempted to paint inside Crostini.

The result: `oscar-gc` launches but its renderer can't paint. A Gtk widget assertion fails under both Wayland and X11 ozone backends, with and without GPU. ChromeOS GPU-acceleration is not available on Arturs's Chromebook (the toggle is absent), so the standard "enable GPU acceleration in ChromeOS settings" workaround is closed.

Crostini exposes a GUI through Sommelier, a Wayland/X11 proxy. Electron's Chromium-derived ozone-platform abstraction has known frictions with Sommelier: Wayland support is incomplete on Sommelier's side; Electron's automatic GPU helper subprocess collides with Crostini's seccomp/namespace setup; GTK's renderer-side widget realization fails when ozone picks a backend Sommelier can't fully service.

This is a **packaging/launch-wrapping problem, not a Goose code problem** — upstream Goose runs fine on regular Linux desktops where Wayland/X11 + GPU are stable. The fix has to live in how Oscar GC's `.deb` invokes the Electron binary, not in the Rust agent core or the renderer code.

Three options were considered:

1. **Runtime detection in `main.ts`** — `app.commandLine.appendSwitch(...)` gated on a Crostini probe (`/opt/google/cros-containers` or `/dev/.cros_milestone`). Cleanest architecturally; lives in product code we own; affects only Crostini.
2. **Wrapper shell script** at `/usr/bin/oscar-gc` (replacing electron-installer-debian's default symlink) that detects Crostini and exec's the binary with flags. Works for both launcher and terminal users.
3. **Hardcoded flags in the `.desktop` Exec=** line. Flags always apply for launcher-launched instances (the primary Crostini UX); terminal users start the bare binary unflagged.

## Decision

Option (3). `forge.deb.desktop`'s Exec= line wraps with `env LIBGL_ALWAYS_SOFTWARE=1` and appends `--ozone-platform=x11 --disable-gpu --disable-software-rasterizer` to the binary invocation.

Sprint 10's target IS Crostini, exclusively (ADR-021). Flags universally applied to `.deb` installs are correct for the target audience. Terminal-launched debugging by the user is rare for the dogfood phase; if it becomes load-bearing, option (1) or (2) supersedes this ADR.

## Rationale

- **`--ozone-platform=x11`** forces Electron's ozone abstraction to X11, bypassing the Wayland code path that Sommelier services poorly. Sommelier's X11 surface is more mature than its Wayland surface.
- **`--disable-gpu`** matches Arturs's environment (no GPU acceleration toggle available). Electron's GPU process tries to start helper subprocesses that fail to negotiate with Crostini's GPU-passthrough, surfacing as the Gtk widget assertion when the renderer falls back from the failed GPU path.
- **`--disable-software-rasterizer`** is paradoxical-looking but addresses a known Electron bug: with `--disable-gpu`, Electron sometimes still tries the software rasterizer code path, which then fails differently. Explicitly disabling both forces the simplest rendering pipeline.
- **`LIBGL_ALWAYS_SOFTWARE=1`** is belt-and-suspenders for Mesa: forces software OpenGL even when the system claims hardware GL exists. Crostini's `libGL` advertises capabilities Sommelier can't actually deliver; the env var short-circuits that.
- Option (1) is the right long-term shape. Sprint 10 chose (3) to ship the dogfood iteration in minutes, not hours. ADR-025 supersedes itself if and when Sprint 11+ generalizes the launch story for non-Crostini Linux.
- Option (2) was rejected because replacing electron-installer-debian's default `/usr/bin/oscar-gc` symlink via postinst creates a dpkg-state inconsistency on uninstall (dpkg expects a symlink, finds a regular file). Doable, but heavier than (3) for Sprint 10's bar.

## Consequences

- **Non-Crostini Linux installs** (none planned in Sprint 10) would get Crostini flags applied to their `.deb` install. `--disable-gpu` is a perf hit but not a correctness hit. Move to option (1) before announcing wider Linux availability.
- **Terminal-launched `oscar-gc`** (without flags) still hits the Gtk widget crash. Document the manual flag set in the Troubleshooting section of `INSTALL_CROSTINI.md` so the user can debug from a terminal if needed.
- **Future Wayland support on Crostini** — if Sommelier's Wayland matures or ChromeOS exposes a working GPU toggle on Arturs's hardware, the `.deb`'s flag set updates accordingly. The launch-flag shape is the seam for environmental adaptation; the binary itself stays unchanged.
- If even with these flags the renderer still fails to paint, the next iteration tries `--no-sandbox` (security regression accepted only for Crostini) or `--in-process-gpu` (moves the GPU helper code into the main process).

## Supersedes

None. First ADR on launch-wrapping for the packaged distribution.
