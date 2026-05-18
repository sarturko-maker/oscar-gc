# ADR-021 — Sprint 10 distribution shape

Status: accepted
Date: 2026-05-18
Sprint: 10

## Context

Sprint 9 closed the four-item short-term goal (PROJECT.md §"The one goal"). Sprint 10 is the *deliverable* sprint: ship Oscar GC as a single installable file the user (Arturs) downloads from a GitHub Release and installs on his Chromebook's Crostini Linux container, then runs the four-item flow without dev intervention. PROJECT.md "Distribution shape" estimated this work for Sprint 12-15; Sprint 10 pulls it forward because the foundational scope is complete and dogfood of the packaged product is now the highest-value next step.

Three orthogonal sub-decisions:

1. **Output format**: `.deb` / `.rpm` / `.flatpak` / `.AppImage` / `.zip` / macOS `.dmg` / Windows `.exe`.
2. **Build host**: lq-vps Ubuntu 24.04 / Debian 12 Docker container / upstream GitHub Actions.
3. **Release pipeline**: upstream `release.yml` / custom CI / local `gh release create`.

## Decision

- Output format: Debian-12-compatible `.deb`, single architecture (`amd64` / `x86_64`). Other Linux formats and macOS/Windows are explicitly out of Sprint 10 scope.
- Build host: Debian 12 bookworm in Docker on lq-vps.
- Release pipeline: local `scripts/release-sprint-10.sh` wrapping `gh release create` against `sarturko-maker/goose`. Upstream CI (`release.yml`, `bundle-desktop-linux.yml`) is **not** modified.

## Rationale

- Crostini is Debian-derivative; ChromeOS Files app double-clicks `.deb` to install. AppImage on Crostini requires manual `chmod` plus dependency-hunting; researched in plan-mode and decided against.
- Ubuntu 24.04 emits `*-t64` time_t-transitioned library names in `dpkg-shlibdeps` output (e.g., `libatk1.0-0t64`). Debian 12 bookworm doesn't carry those names. A `.deb` built on Ubuntu 24.04 has a `Depends:` field that fails to resolve on Crostini. Building inside Debian 12 is the minimum-surprise host.
- Upstream `release.yml` orchestrates macOS + Windows + Linux multi-platform release work, signing, and the multi-job dependency graph. Wiring our new bundling step in cleanly is its own sprint. Sprint 10 has one user, one machine; local `gh release create` is the right scope.

## Consequences

- macOS / Windows / RPM / Flatpak release artefacts are **not** produced in Sprint 10. Future sprints add them on demand by extending the pattern.
- Docker build host is new project state — captured in RUNBOOK §"Sprint 10".
- `scripts/release-sprint-10.sh` is the canonical release procedure for this sprint; future deliverable sprints either reuse it or supersede.
- Sprint 10's `.deb` is targeted at Debian 12 specifically. Crostini users still on bullseye (Debian 11) may need to upgrade their container — surfaced in `docs/INSTALL_CROSTINI.md`.

## Supersedes

PROJECT.md "Distribution shape" timing estimate (Sprint 12-15) — pulled forward to Sprint 10.
