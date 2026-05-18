# ADR-005 — Landing replacement seam: `Hub.tsx` only, upstream chrome retained

Status: accepted
Date: 2026-05-18
Sprint: 3

## Context

Goose's landing flow on app startup involves several layered components in `ui/desktop/src/`:

```
renderer.tsx
  └ App.tsx (HashRouter, route "/")
      └ OnboardingGuard               # checks provider config; renders provider-picker on first run
          └ ChatProvider              # chat state context
              └ AppLayout             # sidebar + topbar chrome around <Outlet/>
                  └ HubRouteWrapper   # passes navigation context to Hub
                      └ Hub           # the actual landing content (SessionInsights + ChatInput)
```

Sprint 3 needs to "prove the React source-change → rebuild → bundle-output loop" by introducing the first-ever change to `ui/desktop/src/`. Each layer above is a candidate replacement point with different blast radii. We need to fix the seam between "upstream Goose code we leave alone" and "Oscar GC product code we own" before later sprints accrete decisions implicitly.

## Decision

**`Hub.tsx` is the Sprint 3 replacement seam.** Sprint 3 replaces only the render body of `ui/desktop/src/components/Hub.tsx`. Everything above it — `App.tsx` routing, `OnboardingGuard`, `ChatProvider`, `AppLayout`, `HubRouteWrapper`, `renderer.tsx` — stays as upstream Goose.

Concretely:
- `Hub.tsx` keeps its component name and default export so `HubRouteWrapper` continues to import it unchanged.
- The `setView` prop and other navigation-context plumbing passed from `HubRouteWrapper` are received but unused by the placeholder (no buttons, no nav, no state per Sprint 3 brief).
- Sidebar and topbar (rendered by `AppLayout`) continue to show upstream Goose chrome. Those will move under product control in a later sprint.
- First-run users still see Goose's `OnboardingGuard` ("Welcome to goose" + provider picker) before reaching the Oscar GC placeholder. That string is a Sprint 2 carry-forward (`src/` branded literal), not a Sprint 3 deliverable.

## Consequences

- The single seam (`Hub.tsx`) makes the "is this our code or upstream's" question trivially answerable for Sprint 3+: anything reachable only via Hub is ours; anything else is upstream.
- Future sprints expanding the product UI (e.g., Sprint 4's practice-area navigation skeleton) will need to revisit this. Practice areas will almost certainly require changes to `AppLayout` (the chrome) and possibly to `App.tsx` (new routes). When that happens, the new ADR supersedes this one — at that point the seam moves up.
- Sprint 3's placeholder is technically reachable only by users past `OnboardingGuard`. On a fresh install with no provider configured, the user lands on the provider-picker, not the placeholder. Verification of the Oscar GC strings in Sprint 3 is via grepping the asar bundle, not via UI smoke test — see Sprint 3 plan for the verification recipe.

## Supersedes

None. Likely **superseded by** the Sprint 4+ practice-area-navigation ADR once `AppLayout` comes under product control.
