# ADR-103: Bundle adeu into bundled CPython at build time (no venv)

Sprint 31 (2026-05-26). Status: Accepted. **Supersedes [[ADR-022]]**. Closes a Sprint 30 deploy gap ([[ADR-101]] item 7). Cites [[ADR-016]], [[ADR-045]].

## Context

Sprint 30 Test 1 (`docs/sprint-30/test-1-rfq/`) hit `tool not found` on
`redline__process_document_batch` because the bundled zip release has no
postinst step, so the adeu venv at
`$RESOURCES/python/adeu-venv/bin/adeu-server` never gets created. ADR-022
created the venv at .deb-install time (via `postinst.sh`) precisely to
avoid the path-baked-into-shebangs problem of bundling a pre-built venv.
That ADR served a Sprint 10 distribution that targeted .deb only; the zip
path was an unscoped follow-on that broke at the first dogfood.

Three options were re-evaluated against Sprint 30's two-target reality
(.deb + zip):

1. **Lazy "ensure venv" at app launch.** main.ts startup hook replicates
   postinst's venv block when missing. Works but adds a startup-path
   product code change for a packaging bug, and the first launch on a
   zip install pays the venv creation cost in the foreground.
2. **Pre-build venv at bundle time with relocation rewrite.** Create the
   venv at the build host, then rewrite `pyvenv.cfg` + console-script
   shebangs to use relative or env-based paths. Fragile — depends on
   pip/setuptools internals. ADR-022 explicitly rejected the parent of
   this approach for the same reason ("install-time `sed` rewriting is
   fragile").
3. **No venv. Install adeu directly into bundled CPython's
   site-packages at bundle time.** python-build-standalone is fully
   relocatable; site-packages under `cpython/lib/python3.12/`
   travels with the python tree. Both .deb and zip ship adeu
   pre-installed and ready.

## Decision

Option (3). `prepare-oscar-bundle.js` runs `pip install adeu==1.6.9`
into the bundled CPython at bundle time (after the wheel download
step), applies the ADR-045 patch directly to bundled site-packages,
then removes the wheel staging dir (~95 MB saved in the shipped
bundle).

`postinst.sh` drops the entire venv creation block (4 lines + the patch
fallback). Only the launcher install remains.

The recipe-builder seam changes: `commercialRecipe.ts` exposes a
`resolveRedlineCmd(resourcesRoot)` returning `{cmd, args}` instead of a
single binary path. The bundled path invokes
`$RESOURCES/python/cpython/bin/python3` with `args: ['-m', 'adeu.server']`
— `adeu/server.py` already has `if __name__ == "__main__": main()` —
sidestepping the console-script's hardcoded shebang. The dev path
unchanged: `/srv/projects/oscar-runtime/python/adeu-venv/bin/adeu-server`
(its shebang is correct because the venv was created in place at that
path per ADR-016).

## Rationale

- **adeu is the only Python resident in Oscar GC today.** The venv's
  isolation has no current value — nothing else inhabits bundled CPython
  to conflict with adeu's transitive deps.
- **No-network at install time.** Property preserved: the .deb (and
  zip) ship adeu pre-installed; no `pip install` runs on the user's
  machine. ADR-022's offline-install constraint is satisfied.
- **No path-rewrite gymnastics.** python-build-standalone's relocatable
  layout means `lib/python3.12/site-packages/adeu/` works at any
  extraction prefix. `python -m adeu.server` resolves the module
  through `sys.path`, not through a shebang.
- **Bundle slims by ~95 MB.** Wheel staging dir removed after install;
  it served only the postinst step that no longer exists.
- **Easy repin.** Future bumps to adeu (e.g. 1.7.x) = update
  `ADEU_VERSION` in `prepare-oscar-bundle.js`. Each bundle re-extracts
  bundled CPython from the upstream tarball cache, so there's no
  accumulated drift in site-packages.

## Trade-offs accepted

- **Loss of venv isolation.** If a second Python tool ever lands in
  Oscar GC and its deps conflict with adeu's, we'd need to revisit —
  either rebundle with separate site-packages-per-tool or move to
  separate venvs at that point. Today nothing else in scope.
- **Console-script artefacts in `cpython/bin/`** (e.g. `adeu-server`,
  `fastmcp`) carry incorrect shebangs after extraction. We don't invoke
  them; they're inert. Future cleanup could strip them at bundle time.

## Consequences

- ADR-022's "create the venv at install location via postinst" is
  superseded. RUNBOOK §Sprint 10 / 13 / 14 references to the venv path
  remain historically accurate but should redirect to this ADR for the
  current shape.
- ADR-016's dev-host venv at `/srv/projects/oscar-runtime/python/adeu-venv/`
  is unchanged. Dev workflow keeps the in-place venv (no rebuild
  required to pick up adeu source changes locally).
- ADR-045's batch-path word-diff patch application moves from postinst
  to bundle time. Same patch, same target directory layout.
- The .deb's installed footprint drops by the wheel-staging delta
  (~95 MB) plus the venv directory delta (~95 MB) — total ~190 MB
  smaller on disk. The .deb compressed size drops by ~30 MB
  (compressed wheel-staging delta).
- `goose-server` (Rust) and other bundled MCPs unchanged.

## Supersedes

[[ADR-022]] (Python runtime bundling via venv-at-install). The
relocatable-Python + offline-install properties are preserved; the
mechanism is now bundle-time pip install instead of install-time venv.

Cites: [[ADR-016]], [[ADR-022]], [[ADR-045]], [[ADR-101]].
