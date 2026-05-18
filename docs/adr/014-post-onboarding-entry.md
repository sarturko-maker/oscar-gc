# ADR-014 — Post-onboarding entry point: Hub

Status: accepted
Date: 2026-05-18
Sprint: 6

## Context

The brief: "The agent's last message hands off to a concrete starting state — probably at one of the selected practice areas with an explicit 'ready to add your first customer / first entity / first stream' prompt — not a blank Hub."

That's a sensible product instinct but presumes the practice-area surface is ready to host such a starting state. Sprint 4 / 4.5 / 4.6 left the practice-area routes (`/practice/:areaId`) as Editorial placeholder pages — `{Area name} — placeholder.` with one line of body copy. They have no "add your first customer" affordance because customers, entities, and streams haven't been built yet (that's Sprint 7+ work).

Three candidates considered:

1. **Land at Hub** (`/`). Existing Editorial surface, requires no changes.
2. **Land at the first selected practice area** (e.g. `/practice/commercial` if Commercial was first in the list).
3. **Land at a one-shot "welcome" view** (new component, new route, only renders post-onboarding).

## Decision

Land at Hub (`/`). The agent's final message points the user at the sidebar ("Take a look at the sidebar — your practice areas are listed there"). The sidebar reflects the onboarded practice-area list (via `usePracticeAreas` from the profile). Clicking any sidebar entry routes to that placeholder page — same as before, just with a different list.

The Hub itself does not gain a "Welcome, {name}" banner in Sprint 6. Hub stays as the existing Editorial cover ("Oscar GC." hero) for simplicity.

## Rationale

- Landing at `/practice/{first-area}` would mean either:
  - Showing the same placeholder ("— placeholder.") that exists today, in which case we're lying about being more set up than we are.
  - Adding a "ready to add your first {primary-unit}" CTA — premature, because we haven't decided what the primary-unit interaction is. That's Sprint 7 territory.
- A one-shot "welcome" component is gratuitous UI for a moment that lasts five seconds. The agent's final spoken message is the welcome.
- The sidebar **does** reflect onboarding (it now shows the user's chosen areas, not a hardcoded 13). That's a visible win in the post-onboarding state — the lawyer sees their own scope, not the default seed. Landing on Hub showcases the sidebar.
- If a future sprint decides Hub deserves a personalized banner ("Office of {Name}'s General Counsel"), it's an additive change to `Hub.tsx`. Sprint 6 doesn't pre-emptively design for it.

## Consequences

- Sprint 6's post-onboarding screenshot is "Hub with the user's selected practice areas in the sidebar." That's the visible deliverable.
- The agent's final message wording matters more than usual — it's the only direct cue the lawyer gets that onboarding succeeded. The system prompt (ADR-010) calls it out: short, professional, points at the sidebar.
- A later sprint that builds real per-area surfaces (Customer / Entity / Stream views) will revisit whether to land directly in the first area. That ADR will reference this one.
- The schema's reserved field `entry_route` (ADR-011) is the future hook — when we land in an area, the agent can set it; future sessions will route accordingly.

## Supersedes

None.
