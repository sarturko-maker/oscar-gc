# ADR-035 — Apache 2.0 NOTICE and attribution for bundled skill content

Status: accepted
Date: 2026-05-18
Sprint: 11

## Context

Sprint 11 vendors Anthropic's `claude-for-legal` (Apache 2.0) into Oscar GC under `skills/in-house-legal/` (per ADR-031). The project's existing `LICENSE` at repo root is Apache 2.0 covering Block's Goose ("2024 Block, Inc.") — the upstream we forked. Adding Anthropic's content alongside requires honouring Apache 2.0 §4(d) (preserve NOTICE) and §6 (trademark restriction).

Upstream `claude-for-legal` ships no NOTICE file. Upstream Goose's LICENSE is the standard Apache template with Block's copyright. Oscar GC needs its own NOTICE to record both attributions.

## Decision

**Two NOTICE files; LICENSE untouched.**

1. **`/srv/projects/goose/NOTICE`** (repo root). Lists:
   - Block Goose — Apache 2.0, copyright "2024 Block, Inc."; canonical upstream `aaif-goose/goose` (formerly `block/goose`).
   - Anthropic `claude-for-legal` — Apache 2.0; source of `skills/in-house-legal/`; pull date and vendored commit SHA recorded inline.

2. **`/srv/projects/goose/skills/in-house-legal/NOTICE`** (bundled-skills directory). Per-plugin attribution: for each of the 9 vendored plugins, the upstream source path (`anthropics/claude-for-legal/<plugin>/`), the vendored SHA, a one-line Apache 2.0 note.

**Per-file attribution comments.** Every vendored `SKILL.md` (and other vendored files where comment syntax exists) gets a top-of-file marker:
```
<!-- Sourced from anthropics/claude-for-legal/<plugin> @ <sha>; Apache 2.0 -->
```

**LICENSE at repo root is not modified.** Block retains Goose copyright; we keep their declaration verbatim. Our additions are licensed Apache 2.0 implicitly (same license as the project); NOTICE captures the attribution side.

**Trademark handling per Apache 2.0 §6.** "Anthropic", "Claude", "claude-for-legal" appear only in:
- The two NOTICE files.
- Per-file attribution comments (machine-readable provenance, not user-facing copy).
- Source comments at the vendoring site in `ui/desktop/scripts/prepare-oscar-bundle.js`.

In code identifiers, log lines, error messages, and user-facing strings, the neutral term `in-house-legal` is used. The mapping field on `PracticeArea` is `bundled_skill_sources` (not `anthropic_plugins`). The on-disk path is `skills/in-house-legal/` (not `skills/claude-for-legal/`). The runtime symlink target is `~/.agents/skills/in-house-legal/`.

## Rationale

- **Two NOTICE granularities.** Repo-root NOTICE covers what every Apache 2.0 consumer of Oscar GC needs to see (both upstreams). The bundled-directory NOTICE gives the operational detail (per-plugin SHA, per-plugin source path) that lives best next to the content it describes.
- **Per-file comments give cheap provenance.** A future contributor opening any vendored SKILL.md sees where it came from and at which version without consulting NOTICE.
- **Why not append Anthropic's copyright to LICENSE.** LICENSE is Block's copyright declaration of Goose; appending Anthropic mixes scopes confusingly. Apache 2.0 §4(d)'s "retain copyright notices in source files" is satisfied by per-file comments; "include a copy of the License" is satisfied by the existing LICENSE; "include all attribution notices" lands in NOTICE.
- **Trademark-§6 discipline.** "Anthropic"/"Claude" mark restriction means we cannot brand our redistribution with their name beyond attribution. Code identifiers and user-facing strings stay neutral; provenance surfaces stay specific. The distinction is the actionable boundary.
- **`in-house-legal` is the canonical neutral term** throughout code paths, env vars, and on-disk layout. One word, kebab-case, clearly describes what it is.

## Consequences

- `NOTICE` at repo root is now a tracked file. Future Apache 2.0 dependencies added to Oscar GC append to it.
- `skills/in-house-legal/NOTICE` is part of the bundled .deb (inside `extraResource`). Users who care about attribution have access to it.
- Re-vendoring (future upstream pulls of `claude-for-legal`) updates the recorded SHA in both NOTICE files and in every per-file comment. The orchestrator agent that runs at re-vendoring time owns this.
- Identifier discipline (`bundled_skill_sources`, `in-house-legal`, etc.) propagates through this sprint's code; future contributors inherit the pattern via this ADR.
- Public statements about Oscar GC (release notes, docs) describe the bundled content as "Anthropic-authored in-house legal skill library" in narrative copy with appropriate attribution, never as "Claude-for-legal in Oscar GC".

## Supersedes

None. First ADR on Apache 2.0 attribution shape for additions to the fork. Future ADRs on community-contributed skills (Sprint 15+) will add their own NOTICE entries under this framework.
