# ADR-106: Matter recipes inherit goosed env-config provider (not pinned)

Sprint 31A (2026-05-26). Status: Accepted. Cites [[ADR-082]], [[ADR-101]], [[ADR-104]]. Drives Sprint 32's multi-model substrate.

## Context

Sprint 31's [[ADR-104]] doctrine closed two of Sprint 30's four ❌ acceptance rows but left two defensible misses on MiniMax-M2.5: no `load_skill` invocation, no `delegate` for batch tasks. The Sprint 31 redogfood README carries forward:

> Cross-model measurement (Claude, GPT-4o) will isolate whether [the delegate conflation] is MiniMax-specific.

Sprint 31A executes this carry-forward before Sprint 32 builds the N=20 eval substrate. The check requires running the same matter recipe against `openai/gpt-5.4-mini` and `anthropic/claude-sonnet-4.6` via OpenRouter, keeping fixtures/persona/binary/prompt constant.

Plan-mode exploration surfaced a load-bearing finding: `buildPracticeAreaRecipe.ts` pins `settings.goose_provider: 'minimax'` and `settings.goose_model: 'MiniMax-M2.5'` directly in the recipe. The pin wins over goosed's env-level config. Env-var exports alone are not enough to switch the provider; the recipe forces minimax even when `GOOSE_PROVIDER=openrouter` is set.

This blocks any cross-model measurement of matter behavior.

## Decision

Drop the hardcoded `settings.goose_provider` and `settings.goose_model` from `buildPracticeAreaRecipe.ts` only. Matter recipes will inherit whatever provider goosed is configured with at session-spawn time (per `GOOSE_PROVIDER` / `GOOSE_MODEL` env vars, falling back to onboarding-stored config).

Sibling recipes stay pinned for now:

- `forge/forgeRecipe.ts` — Forge UX consistency (admin surface).
- `onboarding/onboardingRecipe.ts` — first-launch UX consistency (the user has not yet picked a provider; recipe must work without one).
- `oscar-llp/buildOscarLLPPartnerRecipe.ts` — Sprint 22 partner-recipe Tier-A baseline; Sprint 25 evals depend on MiniMax pinning.
- `oscar-llp/buildLavernPipelineRecipe.ts` — same Lavern eval substrate.

The asymmetry is intentional: matter recipes are the user-facing surface where provider choice is a legitimate user/test-rig decision; admin/system recipes need predictability for their respective consumers.

## Fallback shape

Goosed reads `GOOSE_PROVIDER` / `GOOSE_MODEL` from env when the recipe doesn't pin. `scripts/dogfood/dogfood.sh` defaults these to `minimax` / `MiniMax-M2.5` if not set in env — so dev/dogfood behavior is identical to pre-Sprint-31A. Production launchers preserve the pin by setting env vars at app spawn; this ADR doesn't change that.

For Sprint 31A: dogfood.sh accepts override via env (`GOOSE_PROVIDER=openrouter GOOSE_MODEL=openai/gpt-5.4-mini`).
For Sprint 32: the eval substrate sets the same env vars per cycle to drive the multi-model matrix.
For production: the pin is preserved via env defaults; if Sprint 31A reveals a non-MiniMax model is preferable, the launcher's `GOOSE_PROVIDER` default changes — one place, one change.

## Alternatives rejected

- **Add an env-resolution IPC channel** (main.ts reads env → preload → renderer recipe builder). Extra plumbing for what is structurally a goosed-side concern. Recipes are descriptions, not provider selectors.
- **Make every recipe builder env-aware uniformly.** Forge / onboarding / Lavern recipes have load-bearing reasons to stay pinned ([[ADR-077]] Lavern, [[ADR-082]] interactive eval shape). Universal env-override risks subtle regressions in the eval substrates.
- **Pin matter recipes to a configurable default in profile.json.** Sprint 31A is measurement; production model-choice UX is a different question. Defer.

## Caveats

- After this ADR, a user who reconfigures their default provider in app settings (a UI we don't yet expose in matter flows) will see matter recipes follow the new default. Not a regression today; relevant when matter-level provider-override UX lands.
- Goosed's secret resolution for `OPENROUTER_API_KEY` goes through the config secret store. With `GOOSE_DISABLE_KEYRING=1` (dogfood default), the fallback is plain env. Sprint 31A relies on this; production launchers using keyring must store the key in keyring.

Cites: [[ADR-082]], [[ADR-101]], [[ADR-104]].
