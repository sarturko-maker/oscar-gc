# ADR-098: Edit splits into in-pane manual form + Forge entry

Sprint 29 M5 (2026-05-25). Status: Accepted. Extends ADR-088.

## Context

ADR-088 (Sprint 20-M7) wired the right-pane header's `Edit` link as a
deep-link into Forge via `#/forge?modifyArea=<areaId>`. Crostini
dogfood (2026-05-25): "The edit button now goes right to Forge. Users
need to have a choice (it does not come naturally that you can just
ask an agent to amend things), and users should be able to amend key
facts in the matter and matter name manually and have an option to go
to Forge."

The Edit affordance currently presents one path — open a conversation
— for what lawyers expect to be a structured-form update. The pane
reads as a *gateway to magic* instead of a *tool*.

## Decision

`Edit` becomes the entry point to a two-mode editing surface, fully
in-pane:

1. **Manual form (default).** The MatterFactsSection renders as a
   form — `subject_label`, `counterparty` role/name, `kind`,
   `stakeholder`, `privileged`, `key_facts`, and the matter `name` —
   driven by the same `PracticeAreaShape` the new-matter dialog
   already uses (subject family, counterparty roles, kind options,
   extras-by-kind). Save writes the updated registry entry + rewrites
   matter.md. Cancel discards.
2. **Forge entry (footer of the form).** A clearly-labelled "Ask
   Forge to change this area's loadout" button with a one-sentence
   pitch ("Forge is the meta-agent for conversational edits to the
   area's agent — description, skills, tools — when the form above
   isn't enough."). Click follows the existing
   `#/forge?modifyArea=<areaId>` route.

Implementation seam:

- `editingFacts` state lifts into `RightPaneContext` so the header's
  Edit/Cancel toggle and the MatterFactsSection's form mode stay
  coordinated.
- A new `MatterFactsEditor` component owns the form and its save
  path; the existing display-mode rendering stays in
  `MatterFactsSection` and renders when `editingFacts === false`.
- A new `oscar:matters:update` IPC (extends existing matters write
  surface) writes the partial-fields update through `MatterEntry`
  Zod validation and rewrites matter.md via `renderMatterMd`. The
  bound session's recipe is unchanged — it was baked at spawn; matter
  facts updates land in Top of Mind on the next set-active.

## Alternatives rejected

- **Modal dialog over the pane.** Adds a fourth nesting layer (matter
  → pane → modal → form) and would be the only modal in the right
  pane today. Inline expansion follows the directional preference
  already established for Skills/Tools.
- **New `/matter/:slug/edit` route.** Takes the lawyer off the matter
  surface for six structured fields. Overkill against the brief's
  "default Edit matter details surface".
- **Reuse `NewMatterDialog` as-is.** That dialog is creation-shaped:
  it slugifies the name, computes default privileged from kind, has
  a Cancel/Create button pair. Editing needs a different shape
  (name is mutable but slug isn't; defaults don't override user-set
  values) and a different button pair. Sharing a renderer would be
  a leaky abstraction; the practiceAreaShape data IS shared.

## Caveats

- Slug is immutable. The form lets the lawyer change `name` but not
  `slug` — slug is the working-dir reference and the registry key.
  Renaming the working dir is a larger operation than this sprint's
  scope.
- Bound session keeps its baked recipe; description-override edits
  through Forge already required next-session-open semantics. The
  same caveat carries — the matter-facts edits flow into Top of Mind
  immediately, the rest on next spawn.
- Editing is per-matter local state; navigating away discards. The
  Edit button is a momentary UX, not a persistent mode.

Cites: ADR-038, ADR-047, ADR-067, ADR-083, ADR-088.
