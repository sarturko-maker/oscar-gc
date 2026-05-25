# ADR-097: Skills section splits into surface zone + collapsed directory

Sprint 29 M4 (2026-05-25). Status: Accepted. Extends ADR-086, ADR-096.

## Context

Sprint 28 ADR-093 left the Skills section as one flat list of every
in-scope skill — bundled and user-added, On and Off — with a per-row
toggle. On Commercial (9 bundled skills) this is already visually
heavy; areas with richer libraries (Privacy, Regulatory) make the
pane a settings view masquerading as a status view. Crostini dogfood
(2026-05-25): "Skills should be a directory in the side panel. You
click on it and there are default skills that ship with Oscar GC and
the custom ones that a user creates. The ones that are switched on
are visible in the main panel not behind a directory."

Lawyers reading the pane want to answer "what does my agent have right
now", not "everything that exists and which slice is enabled". One
list collapses both questions onto each other and serves neither well.

## Decision

The Skills section renders two zones, separated by a horizontal rule:

1. **Surface zone — "In this matter".** Compact list of skills whose
   row resolves to `enabled === true`. Each row carries the humanised
   title (ADR-096) and an inline "Off" chip that disables the skill;
   no bundled tag, no delete (those live below). Empty-state copy:
   "No skills enabled for this matter."
2. **Directory zone — "All skills".** A collapsed `<details>`
   disclosure. Click expands inline. Contains the drop affordance plus
   the full skill list with the existing per-row On/Off chip + delete
   (for user-added). Auto-opens by default when the surface zone is
   empty so lawyers see what's available without an extra click.

Both zones read the same skill list from `oscar:skills:list` — the
zone split is a purely renderer-side partition. No new IPC; no schema
change. The drawer collapse state is React state, not persisted.

## Alternatives rejected

- **Apply the same shape to Tools.** Confirmed with Arturs ahead of
  landing: Tools today is 4 bundled + 0–2 installed integrations per
  area. The directory affordance would be near-empty and the two
  zones nearly identical — symmetric for its own sake. Tools stays
  flat.
- **Route-change directory (`/matter/.../skills` page).** Brief is
  explicit: "drawer not modal — keep it lightweight, in the pane, no
  navigation."
- **Two-list dedupe with hide-when-disabled toggle.** Doesn't change
  the cognitive model — lawyers still see the long list, just
  collapsed differently.

## Caveats

- Disabling the last enabled skill flips the surface zone empty + the
  directory auto-opens on next render. That's the intended hand-off
  ("you have nothing on; here's the menu"), not a bug.
- When the lawyer expands the directory, scroll position inside the
  pane may shift. Acceptable — the click is explicit and the drawer
  is contained.
- The `skills-list` test-id moves into the directory; harnesses that
  predicate on its presence at the top of the section need to expand
  the drawer first (new `data-testid="skills-directory-toggle"`).

Cites: ADR-086, ADR-093, ADR-096.
