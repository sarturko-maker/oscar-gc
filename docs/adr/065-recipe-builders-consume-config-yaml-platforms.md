# ADR-065 — Recipe builders consume config.yaml platform-extension state

Status: accepted
Date: 2026-05-20
Sprint: 18

## Context

ADR-063 raises Oscar GC's permissive-default loadout. The brief's exit criterion — *"the agent's first turn already feels briefed and capable — no 'let me go enable some things first' gap"* — requires that, when the user opens a matter, the agent actually has Memory, Top of Mind, Apps, Auto Visualiser, etc. as live capabilities.

`resolve_extensions_for_new_session` (`crates/goose/src/config/extensions.rs:169`) shows the obstacle: when a recipe specifies extensions, **only** those extensions load; config.yaml's enabled platform-extension toggles are bypassed entirely. So today, even with Memory/Top of Mind toggled on in config.yaml, a matter session loads only what `buildPracticeAreaRecipe` declares — `oscar-fs`, `tavily`, and (for Commercial) `redline`.

Two paths to bridge:

- **(a) Rust core**: change `resolve_extensions_for_new_session` to merge platform extensions with recipe extensions. Cleanest semantically; arguably the right upstream default. Cost: Rust-core change with cross-distribution implications, longer review, blocks Oscar GC behind an upstream PR cycle.
- **(b) TS-side merge**: recipe builders query the current enabled-platform-extension set and include those entries in the recipe they emit. No Rust touch. Cost: ~30 lines of glue (new IPC + thread-through to three recipe builders); recipe builders become aware of platform-extension state.

## Decision

**Option (b): TS-side merge in the recipe builders.** Sprint 16's deferred "platform-extension trim" carry called out this same shape ("Goose's Settings struct has no per-recipe disable mechanism") — but the right vehicle for Oscar GC is the recipe builder, not a Rust-core merge:

- **Renderer-side derivation** (no new IPC needed). `ConfigContext.extensionsList` already exposes the joined view of config.yaml extensions with their `enabled` flag. A small helper `deriveEnabledPlatformExtensions(extensionsList)` filters to `enabled === true && (type === 'platform' || type === 'builtin')` and strips the `enabled` field — yielding the `ExtensionConfig[]` shape the recipe accepts. Both `platform` and `builtin` types are included because `extension_manager.add_extension` (`extension_manager.rs:851`) treats them as the same in-process class.
- **Recipe builders take `enabledPlatformExtensions: ExtensionConfig[]`** (added to `BuildPracticeAreaRecipeOptions`, `BuildCommercialRecipeOptions`, `buildForgeRecipe` signature). The list is spliced into the recipe's `extensions` array *before* `extraExtensions` so per-recipe MCP extensions (oscar-fs, redline, tavily) keep their existing ordering.
- **Call sites derive and thread**: `MattersLanding.openMatter` (already inside `ConfigProvider`) computes the array from its `useConfig()` snapshot and passes it through; `ForgeView`'s recipe-build path does the same. No new IPC; the existing `apiGetExtensions` refresh keeps the snapshot current.
- **Forge force-includes** `code_execution` and `extensionmanager` even if disabled in config.yaml (per ADR-063 Forge clause). Implementation: a small `ensureForgePlatforms()` helper unions the user's enabled set with the two Forge-mandated ids before recipe emission.

The Rust-core `resolve_extensions_for_new_session` is **not** touched. Recipe-declared platform extensions flow through the existing recipe-wins path; this ADR just makes the recipe carry the platform set explicitly.

## Rationale

- **Fork hygiene**: ADR-063 already touches Rust core for two `default_enabled` flips (independent lines, near-zero merge surface). Adding a merge-semantics change on top would double the Rust footprint and entangle the inversion with a behaviour change that's arguably upstream-PR-worthy on its own. Defer that conversation; ship the in-house experience now.
- **User toggle takes effect** — flipping Tutorial on in Extensions UI causes the next matter to load Tutorial as a Platform-typed extension. The Extensions Settings page is no longer theatre.
- **No double-spawn** — `resolve_extensions_for_new_session` still returns recipe extensions only; the recipe carries what we want; the result matches intent.
- **Forge mandate is explicit** — Forge's two force-on platforms live in the Forge builder, not in some hidden global override. Future readers see the override at the source.

## Consequences

- `MattersLanding.openMatter` and `ForgeView`'s recipe path each read from `ConfigContext.extensionsList` (already on screen). No new IPC; no extra round-trip; the snapshot refreshes on the existing `getExtensions(true)` cadence.
- Both `platform` and `builtin` ExtensionConfig types are included by the filter — `extension_manager.add_extension` resolves both via `PLATFORM_EXTENSIONS` lookup or `get_builtin_extension` fallback. Memory/Auto Visualiser ship as `builtin` (via `bundled-extensions.json`); Top of Mind/Apps/Todo/Summon/Chat Recall ship as `platform` (via Rust migration).
- A future upstream PR could replace the TS-side merge with a per-recipe `force_platform_extensions: string[]` declaration on the Recipe schema, picked up by `resolve_extensions_for_new_session`. Sprint 18+ candidate; tracked in [TODO.md](../../TODO.md) carry-forward.
- If a user disables `tom` (Top of Mind) in Extensions UI, matter context injection via `GOOSE_MOIM_MESSAGE_FILE` (ADR-044) stops working until they re-enable it. Trade-off accepted — the toggle should mean what it says.

## Supersedes

None. Coupled with [[ADR-063]] (permissive defaults) and [[ADR-064]] (Tavily visibility). Builds on ADR-041 (recipe-loadout convention).
