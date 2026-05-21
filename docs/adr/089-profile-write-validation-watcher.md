# ADR-089: profile.json write validation via post-write watcher

Sprint 20-M7 (2026-05-21). Status: Accepted.

## Context

The M7 brief requires a "renderer-side validator [that] should drop
writes that fail schema validation and surface a clear error to Forge
so it can retry". Forge writes profile.json via `oscar-fs__write_file`
(ADR-039, ADR-088). oscar-fs runs as a goosed subprocess; main.ts is
NOT in the pre-write path. CLAUDE.md endorses Zod at boundaries
("Use Zod (or equivalent) for runtime schema validation at API/MCP
boundaries").

## Decision

Main-process `fs.watch` on profile.json's parent directory (watches
the dir, not the file, to survive pre-onboarding when profile.json
doesn't exist yet). On any event that names `profile.json` as the
changed filename, a 100ms debounced handler reads + JSON-parses +
Zod-parses against `ProfileForWriteValidationSchema`. Valid writes
refresh `.bak`; invalid writes revert from `.bak`. Both via atomic
temp+rename.

The Zod schema (`forge/areaOverrideSchema.ts`) mirrors
`OscarAreaOverrides` and validates only the `area_overrides` shape;
other fields `.passthrough()` so valid v3/v4/future profiles aren't
rejected on drift. Self-loop avoidance: SHA-256 of last validated
content; matching events skip validation. Forge's Mode D step 7
reads back and surfaces rejection conversationally — no IPC toast.

## Alternatives rejected

- Patch vendored oscar-fs MCP — fork-hygiene cost on upstream
  `@modelcontextprotocol/server-filesystem`.
- New MCP tool for profile writes — contradicts brief's "same write
  tool" rule.
- IPC toast — duplicates Forge's chat; jarring outside the agent.
- Cross-repo import from `oscar-onboarding-mcp` — sibling is
  private + ESM-only + no `.d.ts` + no `exports`; not packaged for
  consumption.

## Caveats

Race window microseconds (Forge's bad write briefly on disk before
revert); profile.json is user config, not security-critical. If
profile.json is present-but-invalid at app start, the watcher logs
and does NOT seed `.bak` — recovery needs a clean profile first.

Cites: ADR-039, ADR-067, ADR-068, ADR-088.
