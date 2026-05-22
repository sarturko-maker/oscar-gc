# ADR-002 — `finalize_profile` arguments are all A-class

Status: accepted
Date: 2026-05-18
Sprint: 6 (`sarturko-maker/goose` SPRINT_LOG)

## Context

The CLAUDE.md MCP tool-schema rule (see [`sarturko-maker/goose` CLAUDE.md](https://github.com/sarturko-maker/goose/blob/main/CLAUDE.md), "MCP tool-schema design") classifies every LLM-visible tool parameter as:

- **A** — LLM extracts from natural language.
- **B** — runtime-derivable from env, session context, or per-element store. **Must not** appear in LLM-visible schema; the runtime resolves it at handler entry.
- **C** — small finite set (tight enum).

Every field on `finalize_profile`'s input is something the LLM elicits from the onboarding conversation: name, role, company name, industry, size band, practice-area list, custom practice areas, provider model. There is no per-user or per-session context the runtime knows that the LLM doesn't. The recipe pre-loads no user state; this server has no awareness of who's talking to it.

By contrast, `oscar-memory-mcp`'s `scope_id` is on a migration path to B-class (see that repo's ADR-002): the desktop UI will eventually inject the current practice-area / primary-unit identifier, so the LLM doesn't need to name it. Onboarding is different — the whole point of the conversation is to elicit identity from the user, so identity *can't* be B-class. The LLM must extract it.

## Decision

All `finalize_profile` arguments are **A-class** for the foreseeable future. The schema (see `src/schema.ts`) makes this explicit: each field has a `.describe()` annotation guiding extraction.

The `schema_version` field is a literal `1` — the LLM must emit it, but the schema rejects anything else. This is A-with-constraint (a degenerate enum), not C-class proper, since the LLM has no choice to make. It's there so the wire format is self-describing.

## Rationale

- The whole tool is "capture the user's answers and persist them." There is no context the runtime could inject that the LLM didn't just hear from the user.
- Future admin-push or multi-tenant additions (where, say, `tenant_id` is injected by the runtime) introduce **new** B-class fields without changing the classification of the existing A-class ones. Additive, not breaking.
- The persistence layer trusts Zod to enforce shape at the boundary; the LLM is treated as untrusted input.

## Consequences

- The tool's `inputSchema` is large — six top-level fields, nested objects, enums. The LLM sees all of it. This is the cost of agent-driven capture; the upside is no UI form.
- If the agent mis-extracts (e.g. records "Privacy" when the user said "Patents"), the wrong profile is written. Mitigation lives in the agent's system prompt (recap before calling the tool; require user confirmation), not in this server.
- Validation failures (Zod parse errors) propagate as MCP tool errors; the agent sees them as tool-call failures and can correct and retry within the same conversation.

## Supersedes

None.
