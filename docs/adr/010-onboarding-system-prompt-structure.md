# ADR-010 — Onboarding agent system-prompt structure

Status: accepted
Date: 2026-05-18
Sprint: 6

## Context

The onboarding agent's behavior is fully determined by its system prompt. The full prose lives in the implementation (`ui/desktop/src/components/oscar/onboarding/systemPrompt.ts`), but the structural decisions deserve their own ADR — both because they're load-bearing for the user experience and because they're the template later context-capture agents will follow (per-practice-area cold-start, per-element profile capture, etc.).

## Decision

Four explicit phases, hard exit condition, conversational pushback handling.

**Persona**: a peer of an in-house lawyer. Professional, direct. No chatbot tics — no emojis, no exclamation marks, no "Hey!", no "Great question!". Short turns. Voice carries Oscar GC's brand.

**Phases** (agent self-tracks where it is; the prompt names them):

- **P1 — Identity.** Name, role, company name. One or two messages. Role is captured as both a short slug (`general-counsel`, `senior-counsel`, …) and a free-text label (the user's exact wording).
- **P2 — Corporate context.** What the company does, rough size band (`1-50`, `51-200`, `201-1000`, `1001-5000`, `5000+`). One message.
- **P3 — Practice scope.** Present the 13 defaults from the in-tree seed (`components/oscar/practiceAreas.ts`) grouped readably; accept subtractions and additions in natural language. Generate `id` for user-added entries as a kebab-case slug of the name; mark them `source: "user-added"`. One or two messages.
- **P4 — Provider confirmation + wrap.** Confirm env-var-set `MINIMAX_API_KEY` (per ADR-012); recap captured profile; await user "go"; call `finalize_profile`; deliver the handoff message.

**Exit condition**: the agent calls `oscar-onboarding__finalize_profile(profile)`. After the tool returns success, the agent's final user-facing message hands off ("Take a look at the sidebar — your practice areas are listed there"). The front-end's file watcher fires on the profile write; `OscarOnboardingGuard` re-evaluates and routes to Hub. The agent does not navigate the UI directly.

**Pushback handling**: if the user objects to a default, the agent accepts and adjusts — never argues, never re-asks the same question. If the user resists a whole phase ("skip the company stuff"), the agent records `null` for any field it couldn't capture, moves on. The schema permits nulls on `corporate.*` and `user.name` precisely for this case.

**Transparency**: each capture line in the agent's voice carries a one-clause "why" — "so the sidebar reflects what you actually do", "so the agents know who they're working for". Confidentiality is in the persona, not in a footer.

**Forbidden behaviours**: inventing answers, asking for the API key as a paste (deferred per ADR-012), proposing features Oscar GC doesn't have yet (per-customer profiles, per-matter agents, etc.), narrating internal Goose plumbing.

## Rationale

- Explicit phases give the LLM a structure to track within a long conversation, but each phase is single-purpose enough that the agent can compress two phases into one message when the user is fast ("I'm Arturs Sliede, GC at Acme, manufacturing, about 500 people").
- The hard exit condition (tool call) is the only way the front-end knows the conversation is done. Anything weaker (e.g. "agent says some keyword") would race the file watcher.
- Pushback handling without re-asking is the difference between "conversational" and "chatbot-pretending-to-be-a-form". Lawyers will be the second kind's hardest critics.
- Forbidden behaviours are listed so the LLM has a refusal pattern to fall back on under prompt-engineering pressure later — if a user asks the onboarding agent to do something out-of-scope, it has language to redirect.

## Consequences

- The system prompt is the load-bearing artifact. Changing it changes the conversation contour without code review. We treat it like code: PR-reviewed, ADR-pinned for structural changes.
- A later sprint that adds per-practice-area cold-start interviews inherits this structure (one phase per dimension, hard exit, transparency / pushback rules) but with different fields. The brief calls this the "long arc".
- The recipe's `instructions` field carries the full prompt text. The recipe constant in `onboardingRecipe.ts` imports `SYSTEM_PROMPT` from `systemPrompt.ts` so the prose is editable in one place.

## Supersedes

None.
