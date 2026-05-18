# ADR-029 — Bypass trust-a-recipe dialog for bundled recipes

Status: accepted
Date: 2026-05-18
Sprint: 10

## Context

Sprint 10's Crostini dogfood surfaced the second upstream-defaults frictionpoint after telemetry: Goose's `RecipeWarningModal` ("Only proceed if you trust the source of this recipe.") fired on first launch of the Onboarding recipe — a recipe Oscar GC bundled into the .deb at packaging time. The dialog asks the user to trust a recipe they did not install and could not have inspected; the recipe was assembled by us, into the binary, and shipped to them.

CLAUDE.md "inverting upstream UX defaults" applies. Upstream's threat model assumes recipes flow in from arbitrary network-shared sources (GitHub gists, deep-links, user-imports). Oscar GC's threat model in Sprint 10 has exactly two recipes, both code-defined in `ui/desktop/src/components/oscar/{onboarding,commercial}/`. Bundled = trusted.

Two surfaces in the existing code:
- `ui/desktop/src/components/BaseChat.tsx:206` calls `window.electron.hasAcceptedRecipeBefore(recipe)` — returns `true` if the user has previously accepted, otherwise the dialog opens.
- `ui/desktop/src/components/BaseChat.tsx:218` calls `window.electron.recordRecipeHash(recipe)` after acceptance.
- Backed by IPC handlers in main and the modal at `components/ui/RecipeWarningModal.tsx`.

Three options considered:

1. **Marker on the Recipe object.** Add a `metadata.bundled: true` field. BaseChat checks the marker and skips the trust call. Cleanest long-term. But `Recipe` is generated from openapi.json and adding a field needs backend coordination; Sprint 10 scope-cut.
2. **Title-prefix short-circuit.** Bundled recipes all have titles starting with "Oscar GC" (`Oscar GC Onboarding`, `Oscar GC — Commercial`). preload's `hasAcceptedRecipeBefore` returns `true` synchronously when the prefix matches; falls through to the IPC call otherwise. Tactical but invisible to BaseChat.
3. **Always bypass.** Sprint 10 only has bundled recipes; user-installed-from-untrusted-source recipes don't exist until the community-skills tier (Sprint 15+). Make `hasAcceptedRecipeBefore` always return `true` for now.

## Decision

Option (2). `ui/desktop/src/preload.ts`'s `hasAcceptedRecipeBefore` and `recordRecipeHash` short-circuit and return `Promise.resolve(true)` when `recipe.title` starts with `"Oscar GC"`. Other recipes fall through to the existing IPC path. Bypass happens in preload (single seam) so all renderer call sites — current and future — inherit the behaviour without per-call awareness.

## Rationale

- **Doctrine application.** Bundled artefacts shipped in the release the user installed are trusted by definition. The dialog is meaningful only for recipes from sources outside our control. None exist in Sprint 10.
- **Preload-level seam over BaseChat-level conditional.** Catches every renderer call to `hasAcceptedRecipeBefore` (not just BaseChat). A future component that loads recipes would inherit the bypass automatically. Future-proof for Sprint 11–14 work.
- **Title prefix over Recipe marker.** Title-prefix is a tactical workaround that costs zero schema changes; Recipe-marker is the right long-term shape but requires upstream openapi.json coordination. ADR-029 records the trade-off explicitly: when Sprint 15+ opens community recipes, the title prefix is no longer sufficient (anyone can craft a malicious recipe with "Oscar GC" in the title); migrate to a Recipe-marker mechanism at that point.
- **Why not option (3)** (always bypass): if a user pastes a recipe deeplink (the `goose://` URL scheme is retained per ADR-003), that recipe is *not* bundled and should hit the trust dialog. Option (2) preserves the dialog for that path.

## Consequences

- **No trust-a-recipe dialog** on first launch for `Oscar GC Onboarding` or `Oscar GC — Commercial` (or any future bundled recipe with the `"Oscar GC"` title prefix).
- **Deeplink-installed recipes** still hit the dialog. Acceptable: those are not Sprint 10 territory but the gate stays useful when it becomes relevant.
- **Sprint 15+ migration**: when community recipes open, replace the title-prefix short-circuit with a `recipe.metadata.bundled` check. Requires extending the Recipe schema in `ui/desktop/src/api/` (which mirrors `crates/goose/src/recipe/mod.rs`) and updating both BaseChat and preload. ADR at that time supersedes this one.
- **Title-prefix discipline.** Bundled recipes MUST use a `"Oscar GC"` prefix on `title`. Captured in CLAUDE.md? No — too implementation-specific. Captured here in ADR-029, and in the recipe factory's source comments.

## Supersedes

None. First ADR on bundled-vs-untrusted recipe distinction. Will itself be superseded by a Sprint 15+ ADR when community recipes arrive.
