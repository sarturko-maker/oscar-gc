# ADR-057 — Tavily key via Goose-native env_keys + keyring (amends ADR-052)

Status: accepted
Date: 2026-05-19
Sprint: 16

## Context

Sprint 15 P8 dogfood (commit `c2aa7c532`) exposed that the ADR-052 key resolution chain (`TAVILY_API_KEY` env var → `~/.config/oscar/secrets/tavily.json` → absent) required users to drop to the terminal on first launch. In-house lawyers don't.

Arturs's verbatim direction:
- *"Why [a custom modal] is needed if this is already part of Goose? Goose already manages keys as a platform?"*
- *"No one is going to use terminal. I should be asked for my provider key and Tavily key. Then I should go to interview."*

Phase 1 verification (Sprint 16 plan-mode) showed the **technical wire** for Goose-native env_keys is already in place:

- `crates/goose/src/agents/extension_manager.rs:832` runs `substitute_env_vars(uri, &all_envs)` for `streamable_http` extensions at session-spawn. With `env_keys: ['TAVILY_API_KEY']` declared and `${TAVILY_API_KEY}` templated into the URI, the keyring → env-map → URI flow resolves end-to-end.
- `Config::get_secret` (`crates/goose/src/config/base.rs:779`) reads env var (uppercase) first, then keyring — so the dev/CI env-var path is preserved automatically.

The **UX gap** was that Goose's docs claim a missing-`env_keys` prompt fires at recipe-load time, but `merge_environments` (`extension_manager.rs:446`) silently skips with a `warn!()`. ADR-058 closes that gap at the platform layer; this ADR records how Tavily is wired on top of it.

## Decision

Tavily is declared in the onboarding recipe with `env_keys: ['TAVILY_API_KEY']` and the API key templated into the URI as `${TAVILY_API_KEY}`. No more Electron-side key resolution; no more file-based fallback; the recipe-builder takes no `tavily` parameter.

**Extension declaration shape** (`onboardingRecipe.ts`):
```ts
{
  type: 'streamable_http',
  name: 'tavily',
  uri: 'https://mcp.tavily.com/mcp/?tavilyApiKey=${TAVILY_API_KEY}',
  env_keys: ['TAVILY_API_KEY'],
}
```

**Key entry on first launch.** `OscarOnboardingGuard` renders `RecipeSecretsModal` (ADR-058) between the `!profile` branch and `<OscarOnboardingView />` if any required `env_keys` are unset. User enters the Tavily key; modal calls `useConfig().upsert('TAVILY_API_KEY', value, true)`; Goose's keyring stores it. Next session spawn resolves it via the standard chain.

**Resolution chain** (entirely Goose-native; supersedes ADR-052's 3-tier shape):
1. `TAVILY_API_KEY` env var (dev / CI / launcher-wrapper / eval harness)
2. Goose secret config (keyring) — populated by first-launch gate or any future Settings affordance
3. Absent → URI placeholder unresolved → extension load fails → intake's rule-4 LLM-only fallback narrates the absence (provenance suffix becomes `(from my knowledge)` per ADR-055)

**Mitigation when user skips entry on first launch.** If `OSCAR_TAVILY_SKIPPED=true` (non-secret config flag set by the gate's Skip button) AND no `TAVILY_API_KEY` is in env or keyring, the recipe-builder omits the Tavily extension entirely — avoids loading an extension that's guaranteed to fail at first tool call. One extra config-read per recipe-build; clean fallback.

**Deletions** (all part of this commit's scope):
- `ui/desktop/src/components/oscar/onboarding/resolveTavilyKey.ts` (Electron-side resolver)
- `oscar:resolve-tavily-key` IPC handler in `main.ts`
- `oscarResolveTavilyKey` preload bridge
- `~/.config/oscar/secrets/tavily.json` reader (documented in INSTALL_CROSTINI.md removal)

`redactRecipeForLog` is preserved as defence-in-depth (the URI now contains a literal template token, not a credential — but the utility's discipline carries forward for any future log-the-recipe path).

## Rationale

- **Reuse over rebuild** (CLAUDE.md). Goose has secret storage (`Config::set_secret`/`get_secret`), env-var resolution, and URI substitution all in place. Wiring Tavily through this stack is the smallest possible product-side change.
- **No new Oscar modal at first launch.** The gate (ADR-058) is *generic* — any recipe-bundled extension declaring `env_keys` triggers it. Tavily is one declaration; future bundled extensions get the same prompt path for free.
- **Recipe-builder is now credential-free.** Recipes can be logged or serialised without redaction risk (the URI carries `${TAVILY_API_KEY}`, not a key). Simplifies any future export / debug path.
- **Env-var fallback preserved.** The eval harness, CI, and dev workflows that `export TAVILY_API_KEY=...` keep working unchanged — `Config::get_secret` reads env-uppercase first.
- **"Goose already manages keys as a platform"** — under ADR-057 + ADR-058, that becomes literally true for both LLM provider keys (Sprint 10 dialog) and bundled-recipe extension `env_keys` (this work).

## Consequences

- `buildTavilyExtension()` becomes parameter-less; `buildOnboardingRecipe`, `buildPracticeAreaRecipe`, `buildCommercialRecipe` drop the `tavily: TavilyKey | null` parameter from their signatures. `MattersLanding.tsx` and other callers drop `tavily` plumbing.
- `render-recipe.ts` in the eval harness will need a one-line touch (drop `tavily-key` flag / no longer passes `tavily` into the recipe-builders). Tracked as a Phase 2 follow-up edit.
- INSTALL_CROSTINI.md replaces the "set `TAVILY_API_KEY` via terminal" section with "you'll be asked on first launch"; advanced env-var fallback documented in a small section.
- ADR-052's "Settings UI for end-user key entry" follow-up commitment is partially satisfied (entry covered by the gate). **Post-onboarding key rotation is deferred** — `RecipeSecretsModal` only fires on first launch; users wanting to change the key today must use the env-var override or wait for the Settings affordance (Sprint 17+ candidate).
- Egress to `mcp.tavily.com` is gated on key presence (recipe-builder omission when skipped). BUNDLE.json's `runtime_egress_optional[]` declaration unchanged.

## Supersedes

Amends ADR-052 (Tavily SSE extension + key handling). ADR-052 text unchanged per ADR rules; this ADR is the new decision-of-record for the key resolution chain and the first-launch UX. ADR-058 records the platform mechanism this depends on.
