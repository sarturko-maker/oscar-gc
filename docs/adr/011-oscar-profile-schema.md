# ADR-011 — Oscar user profile: schema v1 and file location

Status: accepted
Date: 2026-05-18
Sprint: 6

## Context

The onboarding agent finalizes a JSON document that represents "who this person is, who they work for, what they do, and which provider they're using." Every other Oscar GC surface (sidebar list, future per-area defaults, future admin push) reads from it. The schema needs to:

- Be versioned, so future shape changes are detectable.
- Be forward-compatible — additive fields should not require migrations.
- Live somewhere standard (XDG-style on Linux, hand-editable).
- Be writable atomically by the MCP server (no torn writes).
- Be cleanly separable from Goose's own config (so resetting Oscar's state doesn't disturb Goose).

## Decision

**Location**: `~/.config/oscar/profile.json`. Override via `OSCAR_PROFILE_PATH=` for tests.

**Schema** (v1, full Zod definition in `oscar-onboarding-mcp/src/schema.ts`):

```jsonc
{
  "schema_version": 1,                            // literal, drives migration
  "completed_at": "2026-05-18T14:23:00Z",         // ISO 8601 UTC
  "user": {
    "name": "Arturs Sliede" | null,               // null if declined
    "role": "general-counsel",                    // short slug
    "role_label": "General Counsel"               // human display, free-text
  },
  "corporate": {
    "name": "Acme Industries" | null,             // null if declined
    "industry": "Manufacturing" | null,           // null if declined
    "size_band": "201-1000" | null                // enum + null
  },
  "practice_areas": [                              // min 1 entry
    {
      "id": "commercial",                         // kebab-case slug
      "name": "Commercial",                       // display
      "body": "Customers, vendors, …",            // per-area body copy
      "source": "default" | "user-added"          // provenance
    }
  ],
  "provider": {
    "kind": "minimax",                            // discriminator
    "model": "MiniMax-M2.5"                       // specific model
  }
}
```

**Forward-compatibility**:

- `schema_version: 1` is a literal. Future schemas use a discriminated union; readers gracefully reject unknown versions.
- `practice_areas[].source` enum is extensible; future values `admin-pushed`, `marketplace` will require an ADR.
- `practice_areas[]` entries are additive: future fields (`skills`, `agents`, `mcp_extensions`, per-area `body_html`) are optional, schema parses unknown keys by ignoring them (Zod default) so older readers don't break.
- `provider.kind` is the discriminator for future multi-provider switching (anthropic, openai, local). Sprint 6 only emits `minimax`.

**Reserved top-level fields** (not written in v1; documented here so future sprints don't accidentally repurpose them):

- `tenant_id` — admin-push / multi-tenant identifier.
- `admin_pushed` — boolean flag indicating the profile was set centrally rather than self-onboarded.
- `entry_route` — last-visited or preferred starting route post-onboarding.

## Rationale

- **XDG config, not data**: `~/.config/oscar/` (small, hand-editable user config) is conventionally distinct from `~/.local/share/oscar-memory/` (notes data). The profile is config — it's what the user told us about themselves, not data they accumulated.
- **Separate from Goose's `config.yaml`**: keeps Goose's read/write API ownership clean (Goose owns `config.yaml`; we own `profile.json`). Resetting Oscar's state means `rm ~/.config/oscar/profile.json`, no risk to Goose's extensions / provider config. The MCP server (Node.js) writes JSON directly without touching Goose's YAML.
- **Slug + label for role**: the LLM extracts both. The slug is canonical (used for any future enum-driven UI affordance); the label preserves the user's exact wording (used for display, never re-derived). This avoids the "Senior Counsel" / "Sr. Counsel" / "Senior Legal Counsel" deduplication problem.
- **Nullable corporate fields**: lawyers may decline to share. Capturing `null` is honest; capturing fake placeholders ("Unknown Industry") would be worse.
- **Min-1 practice areas**: a user who removes every default and adds nothing has nothing to land on. The agent's prompt requires at least one area before calling `finalize_profile`.

## Consequences

- The desktop reads the file directly via Electron IPC (`oscar:read-profile`); it does not call back to the MCP server for reads. Reads are cheap, writes are atomic — single-writer pattern.
- A profile from a future schema version will fail Zod parse on the v1 reader. The reader treats parse failure as "not onboarded" (same as missing file), routing back to the onboarding agent. Lossy fallback, but Sprint 6 has only one writer (the v1 server) so the failure mode is theoretical.
- The default seed in `components/oscar/practiceAreas.ts` adopts the same shape (`source: "default"` added in this sprint) so the agent's "no changes" path can copy entries verbatim into `practice_areas`.

## Supersedes

None.
