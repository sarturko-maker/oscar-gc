# ADR-022 — Python runtime bundling

Status: accepted
Date: 2026-05-18
Sprint: 10

## Context

ADR-016 placed adeu's Python venv at `/srv/projects/oscar-runtime/python/adeu-venv/` on the dev host and explicitly deferred bundling to Sprint 12-15. Sprint 10 brings that work forward: the venv must live inside the packaged `.deb` and start correctly on a clean Crostini install with no network and no system Python assumed.

Three options evaluated:

1. **Ship the dev venv as-is + shebang fixup at install** — smallest `.deb` addition (~70 MB), but venv shebangs reference build-host paths; install-time `sed` rewriting is fragile, and re-creating the venv on user error means re-running a sed loop.
2. **Bundle a relocatable Python + adeu wheels; create the venv at install time** — larger `.deb` addition (~70 MB compressed; ~170 MB after install), but venv shebangs are correct because the venv is created at the install location. Offline and self-contained.
3. **PyInstaller single-binary `adeu-server`** — ~150 MB single file; no venv; risk of dynamic-import collection failures in fastmcp/pydantic that surface at runtime, not build time.

## Decision

Option (2). The build pipeline bundles two things at `extraResource`:

- `resources/python/cpython/` — `python-build-standalone` CPython 3.12.x linux-x86_64-install_only tarball (`astral-sh/python-build-standalone`).
- `resources/python/wheels/` — `pip download adeu==1.6.9 --platform manylinux2014_x86_64 --python-version 3.12 --only-binary=:all:` output.

The `.deb` postinst hook creates the venv at install location from the bundled artefacts:

```sh
PY=/opt/oscar-gc/resources/python/cpython/bin/python3
$PY -m venv /opt/oscar-gc/resources/python/adeu-venv
/opt/oscar-gc/resources/python/adeu-venv/bin/pip install \
  --no-index --find-links=/opt/oscar-gc/resources/python/wheels adeu==1.6.9
```

## Rationale

- `python-build-standalone` is the project's purpose-built relocatable CPython distribution; widely used (uv, mise, rye). Stable, signed, predictable. Sprint 10 needs a relocatable interpreter; this is the standard answer.
- Recreating the venv at install location guarantees correct shebangs without `sed` gymnastics. If a user reports a broken venv, re-running postinst (`dpkg --configure oscar-gc`) is the recovery path — clean and supported.
- `--no-index --find-links` constrains pip to the local wheel cache. Honors CLAUDE.md "no system-level dependencies"; the install does no network I/O.
- PyInstaller's bytecode-import gymnastics break adeu's fastmcp dynamic registration patterns about a third of the time on first attempt; risk not worth Sprint 10's deliverable bar.

## Consequences

- `.deb` adds ~70 MB compressed for Python + wheels; ~170 MB installed footprint under `/opt/oscar-gc/resources/python/`.
- postinst hook becomes load-bearing. Surface failure with `|| exit 1` so a broken venv marks the package not-configured, not silently broken.
- Future macOS / Windows ports use the same pattern with platform-specific `python-build-standalone` tarballs.
- adeu's transitive wheel pin chain (lxml, fastmcp, pydantic, mcp, python-docx, diff-match-patch, etc.) gets baked into `resources/python/wheels/`. Re-running `prepare-oscar-bundle.js` re-resolves; commit the wheel directory or regenerate on each build — Sprint 10 commits a small lockfile (the wheels are gitignored; the lockfile records SHAs).

## Supersedes

ADR-016 "bundling deferred to Sprint 12-15" carry-forward — pulled forward to Sprint 10.
