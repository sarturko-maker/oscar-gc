# ADR-058 — Lift secret_discovery to goose-core + new /recipe/scan_secrets route

Status: accepted
Date: 2026-05-19
Sprint: 16

## Context

Goose's documentation (`documentation/docs/guides/recipes/recipe-reference.md`) describes a missing-`env_keys` prompt flow: *"When a recipe is loaded, goose scans all extensions for `env_keys` fields. If any required environment variables are missing, goose prompts the user to enter them."*

Phase 1 verification (Sprint 16 plan-mode) read the actual code:

- `crates/goose-cli/src/recipes/secret_discovery.rs` exists with `discover_recipe_secrets(&Recipe) -> Vec<SecretRequirement>`. The CLI calls it in `recipes/recipe.rs:34` and prompts for missing keys interactively before session-spawn.
- `goose-server` does NOT depend on the `goose-cli` crate. There's no callsite for `discover_recipe_secrets` in the daemon or the desktop. The desktop UI has no IPC or component for surfacing missing `env_keys` on recipe load.
- `crates/goose/src/agents/extension_manager.rs::merge_environments` (line 446) silently skips missing `env_keys` with a `warn!()` log — no event surfaced.

**Per CLAUDE.md "code prevails over documentation"**: the docs describe behaviour that does not exist in the desktop path. The CLI has half of it; the desktop has none.

Arturs's directive in the Sprint 16 brief: *"If [the missing-key prompt] doesn't [fire], that's a Rust-core question and needs an ADR for the choice."* — anticipated exactly this finding.

## Decision

**Lift `secret_discovery` from goose-cli into goose-core, expose via a new goose-server route, surface in the desktop via a generic `RecipeSecretsModal`.** Makes the docs-described behaviour true on every binary that loads recipes.

**Rust changes:**
- Move `crates/goose-cli/src/recipes/secret_discovery.rs` → `crates/goose/src/recipe/secret_discovery.rs`. Re-export from `goose-cli/src/recipes/mod.rs` to preserve the existing `recipes/recipe.rs:34` callsite.
- The CLI module's file-loading helpers (`load_recipe_file`, `discover_sub_recipe_secrets`) move with it; the core consumer (desktop / goose-server) calls `discover_recipe_secrets(&Recipe)` directly with the in-memory recipe object — no filesystem reads.
- New route on `goose-server`: `POST /recipe/scan_secrets` — body is a `Recipe`, response is `{ secrets: Vec<{ key: String, extension_name: String, description: String }> }`. Reuses the existing `Recipe` type that the desktop already serialises today.
- Regenerate `ui/desktop/src/api/sdk.gen.ts` via the existing codegen pipeline. No manual TS schema editing.

**Desktop UI:**
- New `ui/desktop/src/components/oscar/onboarding/RecipeSecretsModal.tsx`. Inputs: a `Recipe`. Calls `/recipe/scan_secrets`; for each returned `SecretRequirement`, calls `useConfig().read(key, true)` to check if already set in env or keyring; renders a form with a password input per missing key. Save → `useConfig().upsert(key, value, true)` per entry. Skip-all → write a non-secret `OSCAR_<KEY>_SKIPPED=true` per skipped key (so the next recipe-build can detect intentional skip vs unset).
- Renders only when at least one required key is unset; auto-skips to children otherwise.
- Wired into `OscarOnboardingGuard` between the `!profile` branch and `<OscarOnboardingView />`.

The form mirrors `ProviderConfigForm.tsx`'s visual language (input + `SecureStorageNotice` + Continue/Skip buttons). No new design surface.

## Rationale

- **Makes docs true.** The flow Goose describes for end-users now exists for every binary. Future env_keys-declaring bundled extensions get the prompt automatically.
- **Pattern is already in goose-cli.** Lifting is a small mechanical move, not a redesign. The scan logic, `SecretRequirement` struct, sub-recipe recursion — all untouched in semantics. Just relocated to a crate the desktop can reach.
- **Upstream-PR viability.** This is the kind of cross-binary parity fix that upstream Goose would plausibly accept. Sprint 17+ candidate to push the PR; Oscar GC ships the fix now.
- **Generic mechanism beats Tavily-specific.** ADR-057 is one consumer; any future env_keys extension reuses the same gate without code change.
- **Reuse over rebuild** (CLAUDE.md). `Config::get_secret` env-then-keyring resolution chain works as-is — the gate's `read` calls return a masked-but-non-null value when env is set, so CI / dev paths short-circuit automatically.

## Consequences

- Touches the inherited Rust core (against the fork hygiene default of "Do not modify the Rust core"). Justified per the ADR-justified-necessity carve-out: the desktop's bundled-recipe UX gap requires it, and the move is mechanical relocation, not new core logic. Maintenance debt against upstream merges is contained — `secret_discovery.rs` is a self-contained module and the new route is a thin handler.
- `goose-cli/src/recipes/secret_discovery.rs` becomes a re-export shim for backward compat (or deleted if no other consumer exists; verify during implementation).
- OpenAPI / SDK regeneration is part of the implementation flow; doesn't introduce drift.
- Post-onboarding key rotation remains a Sprint 17+ open item — the gate is entry-only; users with a wrong key must override via env var or wait for a Settings affordance.
- The mitigation in ADR-057 (recipe-builder omits Tavily when skipped + key absent) prevents loading an extension that's known to fail at first tool call.

## Supersedes

None. New mechanism that ADR-057 depends on. Closes the docs-vs-code gap that drove the Phase 1 verification findings.
