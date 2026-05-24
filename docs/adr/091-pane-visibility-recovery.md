# ADR-091: Right pane visibility — matter-only mount; in-memory toggle

Sprint 28 M1 (2026-05-24). Status: Accepted. Supersedes part of ADR-069.

## Context

Dogfood feedback: "When clicking Edit the panel disappears forever and
cannot be called back. Restart does not help." Reproduced under Xvfb
with `capture-sprint28-m1.js`:

- Clicking the M7 Edit link navigates to `#/pair?resumeSessionId=<forge>`.
- `matters.lookupSession(forge-session-id)` returns null (Forge is a
  quick-chat).
- The pre-fix `useRightPaneVisibility` returned `isMounted=true` +
  `isExpanded=false` on this path — i.e. a 32px rail-only strip.
- Lawyers perceive 32px as "panel disappeared".
- Once a user has clicked the chevron, `isRightPaneExpanded=false` was
  persisted via `electron-settings` and propagated across routes: even
  back on a matter, `isExpanded = false ?? true = false` → still
  rail-only → still "disappeared", through restarts.

## Decision

Two-part fix:

1. **Matter-only mount.** `useRightPaneVisibility` returns `HIDDEN`
   whenever `matterRow === null` (non-matter `/pair`). The 32-px
   rail-only state is removed for Forge / quick-chats — pane is
   either fully present (matter) or fully absent (everything else).
   The lawyer-toggleable-in-quick-chat path from ADR-069 is
   superseded.
2. **Session-local chevron.** `NavigationContext.isRightPaneExpanded`
   drops `electron-settings` persistence; state lives only in React
   memory. Default `null` → route default `true` on matter. Chevron
   collapses to rail within the session; next app launch starts
   expanded. Pre-existing persisted values are silently ignored — no
   migration needed because the key is now write-only-by-no-one.

## Alternatives rejected

- **Reset persisted key on Forge round-trip.** Brittle; relies on
  remembering every navigation that "should" clear sticky state.
- **Per-route-shape sticky keys.** Doubled persistence surface for a
  feature lawyers have not asked for (in-quick-chat pane).
- **External "Show pane" button outside the pane.** Treats the
  symptom; rail-only stranding stays possible.

## Caveats

- Lawyers who had previously toggled the chevron expecting the
  in-matter collapsed state to persist across restarts will see the
  pane open again next launch. Acceptable: the only signal was the
  dogfood complaint, and even there the user wanted the pane back,
  not collapsed.
- The `isRightPaneExpanded` key may sit dead in existing
  `settings.json` files; harmless.

Cites: ADR-038, ADR-067, ADR-069, ADR-070, ADR-088.
