# ADR-092: Right-pane Tools section + deny-shape toggle

Sprint 28 M2 (2026-05-24). Status: Accepted. Extends ADR-070.

## Context

Dogfood feedback: "There is no clear distinction between 'tools' and
'skills'. Tools are effectively MCPs and skills are MD files." Today the
SkillsSection (M5) is the only loadout surface, but conflates the two —
lawyers cannot see at a glance which MCPs are wired into the matter.

The recipe filter half of this work already shipped in M7 (ADR-088):
`area_overrides.enabled_mcps` constrains which installed integrations
get into the recipe at matter open. There has been no UI to read or
flip that filter inside the pane.

## Decision

1. **Extend the closed `PanelSectionId` union** (ADR-070) with `Tools`.
   `practiceAreaShapes.ts` inserts `Tools` between MatterFacts/
   ProgrammeFacts and Skills in every area's `defaultPanelSections`,
   so default lawyers see Tools above Skills, infrastructure above
   recipes.

2. **Two-class data model.**
   - **Bundled-for-area MCPs** — `oscar-fs` + `computercontroller` +
     `Tavily` everywhere; `redline` (Adeu) for Commercial. These are
     hardcoded server-side; the recipe builder loads them
     unconditionally. UI renders an "Always on" chip and refuses
     toggling.
   - **Installed integrations** — read from
     `~/.config/oscar/state/<area>/installed_integrations.json`,
     joined with `INTEGRATIONS_OVERLAY` for display title /
     description. UI renders an On / Off chip; clicking persists to
     `area_overrides.enabled_mcps` and applies on next matter open
     (mirrors ADR-085 / ADR-086 resume semantics).

3. **Deny-shape on write.** Every toggle writes
   `{ mode: 'deny', ids: [...disabled] }` regardless of prior mode.
   Existing `'all'` is read as "every id enabled"; `'allow'` is
   preserved on read (recipe filter at `MattersLanding.tsx:174-180`
   already handles all three) but converted to `'deny'` on first
   toggle — older Forge Mode D writes survive the next matter open,
   then collapse into the simpler shape. The single `'deny'` writer
   matches the analogous M3 simplification of `enabled_skills`.

## Alternatives rejected

- **Surface platform extensions (Memory, Apps, Todo, Summon …) in
  Tools too.** Those are global (Settings-managed); showing them
  per-matter implies a per-matter toggle that doesn't exist. Out of
  scope for the polish sprint.
- **Refactor `enabled_mcps` to `disabled_ids: string[]`.** Cleaner
  shape but breaks ADR-088's recipe filter without a coordinated
  migration. Reusing the existing M7 shape costs nothing.
- **Read-only Tools section (visibility only, no toggle).** User
  asked for toggle UX explicitly.

## Caveats

- Bundled list lives in `main.ts` next to the bundled-tier overlay.
  Adding a bundled-for-area MCP requires touching both
  `bundledToolsForArea` and the recipe builder. Acceptable cost; the
  set rarely changes.
- The toggle is "on next matter open" semantics (ADR-085 / ADR-086).
  Lawyers may need to close and re-open the matter to see the effect.
  Same caveat the Skills section already carries.

Cites: ADR-067, ADR-070, ADR-085, ADR-086, ADR-088.
