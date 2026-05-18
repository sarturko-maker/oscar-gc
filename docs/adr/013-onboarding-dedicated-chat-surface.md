# ADR-013 — Onboarding chat surface: dedicated component, not BaseChat reuse

Status: accepted
Date: 2026-05-18
Sprint: 6

## Context

The onboarding chat needs to render a multi-turn conversation in Oscar GC's Editorial visual language (paper cream, Cormorant Garamond, Outfit, IBM Plex Mono, copper accents per ADR-007). Two implementation paths:

1. **Reuse Goose's `BaseChat` with style overrides.** `BaseChat` accepts `customChatInputProps`, `customMainLayoutProps`, `contentClassName` — overridable surface area. Inherits Goose's streaming, session, recipe-attachment plumbing for free.
2. **Dedicated `<OscarOnboardingView>` component.** Reuses Goose's lower-level session / streaming machinery (`startAgent`, the streaming SSE handler, the message store) but renders messages with our own Editorial classes (`.oscar__chat-message-*`).

## Decision

Dedicated `<OscarOnboardingView>` component, in `ui/desktop/src/components/oscar/onboarding/`. Reuses the session-creation API (`createSession`) and the streaming machinery, but owns every pixel of the visual surface: message list, input field, send button, status states.

The recipe-attachment, tool-call rendering, and SSE streaming work through the same Goose APIs `BaseChat` uses, but at a lower level — we subscribe to message updates and render them ourselves.

## Rationale

- **First-launch is a brand moment.** The first thing the lawyer sees should read as LegalQuants editorial — cream paper, Cormorant hero, copper accents — not as a Goose-flavored chat with cosmetics on top. Sprint 4.5 → 4.6 (ADR-004 superseded by ADR-007) was a recent reminder of what happens when visual fidelity gets paraphrased away. Owning the surface means we can deliver the brand without paragraph-by-paragraph overrides of `BaseChat`'s child components.
- **BaseChat's chrome leaks.** It carries a `RecipeWarningModal` for first-time recipe acceptance, a `RecipeHeader` banner, provider-mismatch warnings, toast notifications, attachment widgets in `ChatInput`. All overridable in principle, in practice fragile — Tailwind class overrides on third-party components break silently on upstream merges.
- **The visual scope is small.** ~250 LoC of dedicated chat shell (message list, input, send). Streaming UX (typing indicator, partial-message rendering) is a single subscribe-to-store-and-render pattern. The cost is bounded.
- **Upstream-merge safety**: our dedicated component doesn't conflict with future `BaseChat` changes. We touch only files under `components/oscar/` (per the ADR-006 seam) plus one route wiring change in `App.tsx` (also a known seam-conflict surface, deterministic and small).

## Consequences

- We don't get future `BaseChat` improvements automatically (e.g. if upstream adds voice input or attachment previews). Acceptable — onboarding doesn't need attachments, doesn't need voice. If we ever want them in product chats post-onboarding, those land via `BaseChat` consumption elsewhere.
- The dedicated component is reusable: when later sprints add per-practice-area cold-start interviews (the brief's "long arc"), they can reuse the same `<OscarOnboardingView>` shell with a different recipe — one component, many capture flows.
- We need to write the streaming-subscription code ourselves. The Goose `useChatStream`-equivalent hook (or its underlying primitives) is what we reuse; the surface is our own JSX.
- CSS lives in `ui/desktop/src/styles/main.css` under the `.oscar` Editorial scope (ADR-007), specifically a new `.oscar__chat-*` block. Reuses the same tokens (`--paper`, `--ink`, `--copper`, `--serif`, `--sans-editorial`, `--mono-editorial`).

## Supersedes

None.
