# ADR-095: Drop coming-soon panel-section stubs (Redlining, Forum, Deadlines)

Sprint 29 M2 (2026-05-25). Status: Accepted. Extends ADR-070, ADR-092.

## Context

Sprint 28 ADR-092 added Tools as a real panel section above Skills, with
`redline` (Adeu) rendered as a bundled-for-area "Always on" tool for
Commercial. Crostini dogfood (2026-05-25) surfaced the consequence: the
Commercial pane shows both a `Tools → Redlining (Adeu)` row AND a
"Redlining — coming soon" stub section. Two surfaces, same name, no
distinguishing function. Lawyers reasonably ask "what's the difference?"

Forum and Deadlines are the same shape: stubs introduced by ADR-070's
closed `PanelSectionId` union as placeholders for future surfaces that
have not been planned in. They sit in seven areas' `defaultPanelSections`
advertising functionality the product does not yet deliver.

The pane is the lawyer's window onto the matter. Stubs labelled "coming
soon" make it a roadmap surface — that is not what it is for.

## Decision

Remove `Redlining`, `Forum`, and `Deadlines` from the closed
`PanelSectionId` union, from `SECTION_META`, from `sectionRegistry`, and
from every area's `defaultPanelSections`. Delete
`PanelSectionStub.tsx` — with no remaining stub-shaped IDs it has no
consumer.

If a richer redline workflow (diff preview / accept-reject), a forum/
tribunal section (hearing-tracker UI), or a deadlines section
(calendar-shaped reminder surface) ever earns dedicated implementation,
that sprint re-adds the ID at the same time. The closed union is
load-bearing: it is what makes the pane's composition typesafe per
ADR-070.

Profile data tolerance: `area_overrides.panel_sections` is `string[]`
in profile.json. Any historical Forge Mode D write naming a dropped ID
is silently skipped by `useActiveAreaSections` (already filters via
`isPanelSectionId`) — no migration required.

## Alternatives rejected

- **Hide the stub sections by default; render only if listed in
  area_overrides.panel_sections.** Keeps the IDs alive in the union,
  costs nothing to render; but the IDs themselves are vapour, and the
  caveat "Forge Mode D can resurrect them" is more confusing than
  cleansing.
- **Keep Forum and Deadlines for areas that genuinely need a forum/
  deadline surface (Disputes, Regulatory, Privacy programmes).** The
  brief is explicit: if a feature isn't in scope, the surface should
  not advertise it. We can re-add when the implementation exists.

## Caveats

- `defaultPanelSections` shrinks meaningfully on five areas (the four
  Disputes areas lose Forum; three programme areas lose Deadlines;
  Commercial loses Redlining). Lawyers who relied on these as visual
  hooks ("I know the pane has loaded because Forum is at the bottom")
  get a shorter pane. Acceptable — Forum was a stub.
- Tooling that grepped for `'Redlining' | 'Forum' | 'Deadlines'`
  literals (none in this codebase as of the change) would need
  updating; the closed union narrows on this change.

Cites: ADR-070, ADR-092.
