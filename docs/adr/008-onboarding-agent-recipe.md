# ADR-008 — Onboarding agent vehicle: Goose Recipe

Status: accepted
Date: 2026-05-18
Sprint: 6

## Context

Sprint 6 needs a special-purpose agent at first launch: custom system prompt (the onboarding persona), restricted tool surface (only the profile-writer, nothing else), a defined opening message, and a defined provider/model. Three vehicles were considered:

1. **Goose Recipe** — Goose's existing first-class concept for "a session with pre-configured instructions, prompt, extensions, and settings."
2. **Custom IPC channel** — bypass Goose's session/recipe layer; speak directly to the MiniMax provider from the desktop.
3. **New agent abstraction** — extend Goose with a "mode" concept.

## Decision

Use a Goose Recipe. Defined inline as a TypeScript constant in `ui/desktop/src/components/oscar/onboarding/onboardingRecipe.ts`, passed to `startAgent({ body: { working_dir, recipe } })`.

Concretely the recipe sets:

- `instructions:` — the onboarding agent's system prompt (Oscar's persona, four-phase contour, transparency / pushback rules).
- `prompt:` — the agent's opening line (so the agent speaks first, not the user).
- `extensions:` — whitelist of one entry: `oscar-onboarding`. No `developer`, no `oscar-memory`, no platform tools. See `crates/goose/src/config/extensions.rs:169` (`resolve_extensions_for_new_session`) — when a recipe specifies extensions, only those are loaded; everything else is hidden from the agent. The whitelist is a hard scope.
- `settings:` — `goose_provider: minimax`, `goose_model: MiniMax-M2.5`.
- No `parameters`, no `response`, no `sub_recipes` — onboarding doesn't need user-templated inputs or structured output (the tool call does the work).

## Rationale

- Recipes are upstream-tracked, stable, and already wired through Goose's session layer (`crates/goose-server/src/routes/agent.rs:266-308`). The recipe is attached to the session at creation; the agent loop reads `instructions` for prompt composition and `extensions` for tool resolution.
- Constructing the recipe inline (TypeScript constant) avoids the YAML-on-disk recipe-discovery flow (`GOOSE_RECIPE_PATH`, `~/.config/goose/recipes/`). The desktop `createSession` API accepts a decoded `recipe` object directly in the request body (`ui/desktop/src/sessions.ts:55-59`). One source of truth in code; no file-deployment seam.
- A custom IPC channel would mean reimplementing streaming, tool-call rendering, and session persistence — a sprint of its own. Recipes win on effort by an order of magnitude.
- A new agent abstraction would be a Rust-core change. Per CLAUDE.md fork hygiene, we don't touch the Rust core unless absolutely necessary; recipes are the supported surface for exactly this use case.

## Consequences

- The recipe lives in TypeScript, so the schema mirror in `ui/desktop/src/recipe.ts` must stay aligned with `crates/goose/src/recipe/mod.rs:41`. Upstream changes to the Recipe struct are a tracked merge risk.
- The agent's behavior is fully captured in the `instructions` string. Changing the conversation contour is a string edit, not a code change — easy to iterate, easy to A/B if we ever want to.
- The extension whitelist is at extension granularity, not tool granularity. Adding any tool to `oscar-onboarding-mcp` immediately exposes it to the onboarding agent. ADR-009 covers the tool-surface decision and the resulting "one server, one tool" rule.

## Supersedes

None.
