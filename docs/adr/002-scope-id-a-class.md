# ADR-002 — `scope_id` is A-class for Sprint 5; migrates to B-class when the UI lands

Status: accepted
Date: 2026-05-18
Sprint: 5 (`sarturko-maker/goose` SPRINT_LOG)

## Context

The CLAUDE.md MCP tool-schema rule (see [`sarturko-maker/goose` CLAUDE.md](https://github.com/sarturko-maker/goose/blob/main/CLAUDE.md), "MCP tool-schema design") classifies every LLM-visible tool parameter as:

- **A** — LLM extracts from natural language.
- **B** — runtime-derivable from env, session context, or per-element store. **Must not** appear in LLM-visible schema; the runtime resolves it at handler entry.
- **C** — small finite set (tight enum).

Long-term intent for the memory layer: `scope_id` resolves from the desktop UI's currently-active primary unit (Customer / Entity / Stream — depending on practice area). That makes `scope_id` **B-class**: the UI knows it, the runtime injects it, the LLM never sees or names it.

Sprint 5's only consumer is the Goose CLI (`goose run -t "…"`). There is no UI session yet, no per-element context the runtime can read from. The LLM has no other way to know which scope a note belongs to than to extract one from the user's prompt.

## Decision

For Sprint 5, `scope_id` is **A-class** on both `store_note` and `list_notes`: declared in each tool's `inputSchema`, supplied by the LLM from the prompt.

When the desktop UI starts injecting per-element context (Sprint 6+ work, depending on which carry-forward is picked), `scope_id` migrates to B-class:

- The MCP server reads `scope_id` from an environment variable (e.g. `OSCAR_MEMORY_SCOPE_ID`) or from a session-scoped header on the MCP request, injected by Goose's UI shell.
- `scope_id` is removed from the LLM-visible `inputSchema` for both tools.
- The tools' signatures become `store_note({ body })` and `list_notes()` from the LLM's perspective.

This is a breaking change to the wire schema. It is acceptable because there are no external consumers; the Goose fork is the only client and the change ships atomically alongside the UI's per-element injection work.

## Rationale

- The brief requires verification via two CLI invocations. CLI-side, there is no other source for `scope_id` than the prompt. A-class is forced by the environment.
- An attempted B-class implementation in Sprint 5 would have to read `scope_id` from an env var set by the YAML extension config — but the YAML is static per registration, so changing scope means re-editing the YAML. Clumsy enough to make the two-shot verification harder than necessary, with no offsetting benefit for the actual product use case.
- The migration to B-class is mechanical and small; no architectural pivot needed.

## Consequences

- Sprint 5's verification script and any subsequent CLI-only test must include `scope_id` literals in the prompt.
- If the LLM mis-extracts the scope (typo, hallucination, omission), the notes go to the wrong bucket. This is acceptable for Sprint 5; the UI's B-class injection eliminates the failure mode entirely.
- Sprint 6+ work that ships the UI injection must also ship the schema change (drop `scope_id` from `inputSchema`). A new ADR records that change and supersedes this one.

## Supersedes

None.
