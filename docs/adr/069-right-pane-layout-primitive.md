# ADR-069 — Right pane layout primitive: flex sibling, sidebar-mirrored drag/persist

Status: accepted
Date: 2026-05-20
Sprint: 20 / M1 (right-panel master brief, sub-sprint 1)

## Context

The master brief ([[ADR-067]]) routes Forge-driven agent edits into `area_overrides`, but lawyers also need to *see* the active agent's loadout. The vehicle is a docked right pane adjacent to the chat. Today no such pane exists — the sidebar drag/persist primitive in `AppLayout.tsx:66-115` is the only resizable surface, and its `navigation_position === 'right'` branch *relocates* the same nav rather than adding a second pane.

## Decision

The right pane is a second flex sibling of the chat content area in `AppLayout`, parallel to (not a relocation of) the existing left sidebar. Drag/persist plumbing mirrors the sidebar verbatim with `direction: -1` (LEFT-drag widens). Width clamps to `[240, 520]` (default 320) and persists as an *absolute* px value via `window.electron.setSetting('rightPaneWidth', n)` — the sidebar's CONDENSED_WIDTH-delta shape doesn't apply (the pane has no condensed state, only collapsed). Visibility is route-derived and matter-aware: render the pane only on `/pair` when `window.electron.matters.lookupSession(sessionId)` returns non-null (matter-bound session). A single sticky boolean `isRightPaneExpanded: boolean | null` overlays the route default — `null` = honor default (true on matter-bound `/pair`, false on quick-chat); explicit `true`/`false` sticks across routes and restarts. M1 ships the shell only; M2 mounts content; M2-M8 do not edit `AppLayout`'s drag/persist.

## Rationale

- **Reuse beats reinvention.** The sidebar's `dragStateRef` + mousemove-clamp + electron-settings persist is battle-tested since Sprint 4; mirroring it costs ~30 lines vs ~150 for a parallel design.
- **`matters.lookupSession` is already the canonical "is this a matter-bound session" probe** ([[ADR-038]] binding, `MatterBackButton.tsx:29` consumer). Routing-only detection breaks because matter chats and quick-chats both live at `/pair?resumeSessionId=…`.
- **Single sticky boolean** keeps state minimal and matches the sidebar's `isNavExpanded` precedent. `null` as "honor default" preserves the brief's route-aware UX.
- **Two `Settings` keys, not one.** `rightPaneWidth` (number|null) and `isRightPaneExpanded` (boolean|null) — independent persistence so width changes don't reset the toggle and vice versa.

## Alternatives rejected

- **Reuse nav-position 'right' branch.** Conceptually different — relocates the same nav rather than adding a second pane.
- **localStorage-only persistence.** Width is electron-settings precedent (`navExpandedWidth`); keep the boolean there too for symmetry.
- **Per-route-class booleans** (matter vs quick-chat). More state for marginal UX gain; sticky-with-default model passes all seven M1 verification steps.

## Consequences

- `Settings` interface gains two fields; `validSettingKeys` set in `main.ts` extends to match. Defence-in-depth prototype-pollution gate unchanged.
- `NavigationContext` extends with `isRightPaneExpanded` + setter (mirrors `isNavExpanded` shape). `AppLayout` owns the width drag state directly (mirrors how it owns `navWidth`).
- M2 ([[ADR-070]]) introduces the section registry that mounts into `RightPaneShell`. M3+ wire real bodies. None re-touch the drag/persist primitive.

## Supersedes

None. Companion to [[ADR-067]] (`area_overrides` persistence surface — pane reads this from M2 onward), [[ADR-038]] (matter↔session binding — `matters.lookupSession` consumer).
