# ADR-006 — Practice-area navigation; seam moves to AppLayout's sidebar invocation

Status: accepted
Date: 2026-05-18
Sprint: 4

## Context

Sprint 4 replaces Goose's upstream sidebar (`Layout/NavigationPanel.tsx`, driven by `useNavigationItems`, sessions, expansion/condensed modes) with an Oscar GC practice-area sidebar that routes to per-area placeholder pages. ADR-005 anticipated this: "Practice areas will almost certainly require changes to `AppLayout` (the chrome) and possibly to `App.tsx` (new routes). When that happens, the new ADR supersedes this one — at that point the seam moves up."

This is that ADR.

## Decision

- **Seam moves up to AppLayout's sidebar invocation.** AppLayout's chrome (push/overlay animation, resize handle, Menu trigger, NavigationProvider chain) remains upstream-tracked. The two `<Navigation />` call sites at `AppLayout.tsx:284` (push) and `:305` (overlay) are now `<OscarSidebar />`. Everything reachable through `<OscarSidebar />` is ours. New routes added to `App.tsx` for product pages (`/practice/:areaId`) are ours; the surrounding route table stays upstream.
- **OscarSidebar renders one vertical list regardless of mode.** Goose's `effectiveNavigationStyle`, `isCondensedIconOnly`, and `isHorizontalNav` are not consulted. The push/overlay container still animates open/closed via AppLayout, so users keep the Menu toggle. Horizontal-nav (top/bottom) will render an awkward strip until a later sprint addresses it.
- **NavigationProvider stays mounted.** `BaseChat`, four settings `Navigation*Selector` components, and `AppSettingsSection` consume `useNavigationContext()`. Removing the provider would crash settings. Keeping it costs nothing in OscarSidebar (which does not consume the context).
- **Practice-area list is 13 entries, not 10.** The Sprint 4 brief listed 10 (claude-for-legal's 9 + CoSec). At plan-time we replaced the generic "Litigation" entry with four dispute sub-areas (Commercial / Employment / IP / Regulatory Disputes), reflecting in-house reality where disputes are scoped to their substantive practice area. Deliberate, Arturs-approved deviation; one source of truth in `components/oscar/practiceAreas.ts`.

## Consequences

- `components/Layout/NavigationPanel.tsx`, `hooks/useNavigationItems.ts`, `hooks/useNavigationSessions.ts`, and `components/Layout/navigation/` are now orphaned (no consumers). They remain in-tree; deletion is a separately-tracked decision so the option to revive upstream chrome stays open.
- The seam is now: "anything reachable via `<OscarSidebar />`, routes under `/practice/`, the `oscar/` component namespace, or the `.oscar-terminal` style scope is ours; everything else in `ui/desktop/src/` is upstream-tracked." Future merges from `aaif-goose/goose` may conflict at `AppLayout.tsx:10` (import) and `:284,305` (invocations), and at `App.tsx` around the route table. Conflicts are deterministic and small.
- `JetBrains Mono` and `Cormorant Garamond` `@font-face` binaries remain deferred — Sprint 4's sidebar uses Inter only.
- Hub.tsx remains at `components/Hub.tsx` (Sprint 3 placement). Relocation into `components/oscar/` is deferred to whenever Hub is next touched substantively.

## Supersedes

ADR-005 (landing replacement seam at `Hub.tsx`).
