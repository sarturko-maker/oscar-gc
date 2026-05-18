# ADR-009 — Onboarding agent tool surface: one tool, dedicated sibling MCP server

Status: accepted
Date: 2026-05-18
Sprint: 6

## Context

The onboarding agent needs to persist the user's profile to disk. Two options:

1. **Add `finalize_profile` to `oscar-memory-mcp`** (the Sprint 5 sibling). Saves one repo.
2. **New sibling MCP server `oscar-onboarding-mcp`** with `finalize_profile` as its only tool.

The Goose recipe extension whitelist (ADR-008) is at extension granularity — when the onboarding recipe whitelists an extension, the agent sees *all* of that extension's tools. There is no per-tool whitelist.

## Decision

New sibling repo: [`sarturko-maker/oscar-onboarding-mcp`](https://github.com/sarturko-maker/oscar-onboarding-mcp) at `/srv/projects/oscar-onboarding-mcp/`. Exposes exactly one tool: `finalize_profile(profile)`. Validates input with Zod against `src/schema.ts`, writes `~/.config/oscar/profile.json` atomically (write-to-temp → fsync → rename).

The onboarding recipe whitelists this extension only. The onboarding agent's tool surface is then `oscar-onboarding__finalize_profile` — a hard one-tool ceiling.

`finalize_profile` argument classification per CLAUDE.md's MCP tool-schema rule: **all arguments are A-class** (LLM extracts from the conversation). The onboarding flow is, by definition, the moment when the runtime knows nothing about the user; everything is elicited from the conversation. There is no B-class field to push out of the LLM's view. The sibling repo's [ADR-002](https://github.com/sarturko-maker/oscar-onboarding-mcp/blob/main/docs/adr/002-tool-args-a-class.md) documents this in detail.

## Rationale

- If `finalize_profile` lived in `oscar-memory-mcp` alongside `store_note` and `list_notes`, the onboarding agent would also see those notes tools. The agent might call `store_note` during onboarding ("remember the user's name as a note") — wrong store, wrong purpose. Tool-surface isolation matters here.
- The sibling-repo cost is low: same skeleton as `oscar-memory-mcp` (`@modelcontextprotocol/sdk@=1.29.0`, `zod@=4.4.3`, `typescript@=6.0.3`), 4 source files (~120 LoC), atomic-write store pattern reused.
- A second sibling repo is consistent with how we're modeling the product: each domain concern (memory, onboarding, future practice-area capture) is its own MCP server. Composition, not coupling.

## Consequences

- One more repo to track in `RUNBOOK.md`, one more `extensions:` stanza in `~/.config/goose/config.yaml`. Mirroring Sprint 5's bootstrap exactly.
- If later sprints add additional onboarding tools (e.g. `set_provider` once we design the secrets seam, per ADR-012), they live in this same server — the extension whitelist still locks the surface to one server.
- The `oscar-onboarding` extension stays `enabled: true` globally in `config.yaml`. The product agent (post-onboarding) would also see `finalize_profile` if the recipe didn't restrict it. Recipes do restrict it; the rest of Oscar GC's chat sessions never whitelist `oscar-onboarding`, so the tool is invisible outside the onboarding flow.

## Supersedes

None.
