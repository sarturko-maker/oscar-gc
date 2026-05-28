# ADR-115 — Sprint 35 Tabular Review: bare-route mount + manifest-as-coupling

Status: accepted
Date: 2026-05-28
Sprint: 35

## Context

[[ADR-113]] settled "native React full-window split, not an MCP App," and named the Forge route as
the mount pattern. Building it surfaced two specifics the ADR left open: (1) *where* the route mounts
relative to AppLayout, and (2) *how* the grid stays coupled to the live agent without a second store
(the brief's open question). Forge turned out not to be a canvas at all — it creates a session and
redirects to `/pair` inside AppLayout. The real bare-window pattern is `standalone-app` / `launcher`
(`App.tsx`), which sit OUTSIDE AppLayout under the `w-screen h-screen` container.

## Decision

- **Mount `TabularReviewView` as a bare route OUTSIDE AppLayout** (sibling of `standalone-app`), so the
  three panes (grid / citation drawer / agent rail) own the whole window with no competing
  practice-area sidebar or right-pane chrome. The view wraps its **own** `ChatProvider`
  (`contextKey="tabular"`) and mounts a **single** `BaseChat` on the matter's bound session —
  resolved via `matters.setActive` + `matters.get`. It does **not** dispatch `ADD_ACTIVE_SESSION`
  (that would let `ChatSessionsContainer` mount a second `BaseChat` on the same session later →
  duplicate SSE streams).
- **The on-disk manifest is the sole coupling between grid and rail — no shared React state.** The
  rail's agent mutates `manifest.json` through the oscar-tabular MCP tools; the grid re-reads it on a
  2 s poll (`useManifestPoll`, gated on `updated_at`). "Add a column" typed to the rail flows: agent →
  MCP write → next poll → grid update. This is the answer to "how does the grid stay coupled to the
  live session": through the matter folder, not a renderer store ([[ADR-111]]).

## Consequences

- BaseChat works standalone because it reads navigation via `useNavigationContextSafe` (null-safe) and
  `useChatStream` has no `activeSessions` dependency — only React-Router + ChatProvider context are
  required, both supplied by the bare route. (Fallback if a descendant ever needs NavigationProvider:
  mount inside AppLayout with the sidebar hidden.)
- Opening the route takes over the app's active matter (global `OSCAR_MATTER_DIR` + Top of Mind) —
  acceptable for a full-window surface; matches `MattersLanding` semantics.
- The renderer mirrors the MCP manifest schema in `tabular/types.ts` (cross-package type seam); the
  IPC layer guards the top-level shape so drift fails visibly.

Cites: [[ADR-111]], [[ADR-113]].
