# ADR-102: Matter recipes hard-exclude developer + computercontroller from platform-extension thread-through

Sprint 31 (2026-05-26). Status: Accepted. Closes a Sprint 30 leak ([[ADR-101]] item 8). Cites [[ADR-041]], [[ADR-063]], [[ADR-065]], [[ADR-085]].

## Context

Sprint 30 dogfood ([[ADR-101]] item 8) found `developer` enabled in
matter sessions despite Sprint 18's default-OFF doctrine ([[ADR-063]])
and Sprint 12's access-model exclusion ([[ADR-041]]). The agent used
`developer__write` in Test 2 Turn 3. Investigation found three things:

1. The Rust core's `developer.default_enabled` is correctly `false`
   (`crates/goose/src/agents/platform_extensions/mod.rs:160`) — the
   Sprint 18 flip is intact.
2. The user's `~/.config/goose/config.yaml` carries
   `developer.enabled: true` — a pre-Sprint-18 entry that
   `syncBundledExtensions` preserves because the entry is marked
   `bundled: true` (the function only sets initial values for fresh
   keys; it never rewrites preserved-bundled entries —
   `bundled-extensions.ts:82-84`).
3. `deriveEnabledPlatformExtensions` filters `extensionsList` by
   `enabled === true` and includes everything in `PLATFORM_LIKE_TYPES`
   — no exclusion list. Stale config.yaml → enabled flag true →
   developer enters the matter recipe.

A separate concern surfaced for `computercontroller`: matter recipes
already register a narrowed instance (`pdf_tool` + `docx_tool` only,
ADR-085 Layer 2). If a user toggles computercontroller on in
Extensions Settings, the full-tool instance would duplicate or
override the narrowed one.

## Decision

Add `deriveEnabledPlatformExtensionsForMatter` in
`enabledPlatformExtensions.ts`. It composes
`deriveEnabledPlatformExtensions` and then drops two platforms by
`nameToKey`:

- `developer` — per ADR-041, matter recipes never carry shell +
  filesystem-write, regardless of user toggle. Quick chats and Forge
  call the base function, so quick chats still get developer if the
  user enables it (power-user escape hatch).
- `computercontroller` — matter recipes carry a narrowed instance;
  block the user-toggled full instance to keep the narrow surface as
  the only registration.

`MattersLanding.openMatter` switches to the matter-specific function.
Forge's call site (`ForgeView.tsx:49`) keeps the base function —
Forge's `ensureForgePlatforms` already excludes developer by design
(forgeRecipe.ts header comment: "no Developer, no memory, no
onboarding, no redline"), and the base function suffices because the
config-derived developer entry doesn't appear in
`FORGE_MANDATED_PLATFORMS`.

## Alternatives rejected

- **One-shot config migration** that rewrites stale
  `developer.enabled: true` to false. Risks overriding a deliberate
  user choice — impossible to distinguish stale-default from
  intentional-enable post-Sprint-18. Hard exclusion at the
  recipe-build seam is observable and reversible without touching
  user state.
- **Exclude all four ADR-063 escape-hatch extensions** (developer,
  computercontroller, tutorial, code_execution). `tutorial` and
  `code_execution` are user-toggleable defaults; a lawyer who flips
  them on expects them in their sessions. Only `developer` carries
  the ADR-041 security policy; only `computercontroller` has the
  narrowed-duplicate concern. Scope kept tight.
- **Refactor `bundled-extensions.ts:syncBundledExtensions` to update
  preserved-bundled entries on default change.** Wider blast radius;
  would silently rewrite many other users' choices on future flips.
  Not Sprint 31 scope.

## Caveats

- The exclusion is by `nameToKey(name)` — case- and whitespace-
  insensitive. Future renames of the upstream extensions would break
  the set; pin the lowercase keys here as the load-bearing string.
- Quick chats are NOT matter recipes — they use Goose's
  fallback-to-config.yaml path (see Sprint 19 ADR-066). Developer
  still appears in quick chats when the user has it enabled.

Cites: [[ADR-041]], [[ADR-063]], [[ADR-065]], [[ADR-085]], [[ADR-101]].
