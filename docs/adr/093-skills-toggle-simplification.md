# ADR-093: Skills section — drop tri-mode pill, per-skill toggle

Sprint 28 M3 (2026-05-24). Status: Accepted. Extends ADR-086.

## Context

Dogfood feedback on the M5 Skills section: "When I currently click on
the skills, it is unclear what 'allow' means. It is not on by default
and yet at the top it says 'all' skills." The All/Allow/Deny pill
combined with chip labels of "Allow" vs "All allowed" presented two
nested mental models — one for the section mode, one for the per-skill
state — and the inversion (`mode === 'allow' ? !skill.enabled : skill.enabled`)
made the chip's actual effect difficult to predict.

The M5 prompt-enumeration recipe-builder logic (ADR-086) is independent
of the UI shape: it consumes the resolved enabled-set, however the
profile expressed it. Simplifying the UI does not touch what the agent
sees.

## Decision

The tri-mode pill is removed. Each skill row carries a single on/off
toggle chip. Visual semantics match Tools (ADR-092):

- **On** (`aria-pressed='true'`) — skill is enabled for this area.
- **Off** (`aria-pressed='false'`) — skill is disabled for this area.

Clicking the chip writes
`area_overrides.enabled_skills = { mode: 'deny', slugs: [...disabled] }`.
Every write normalises to the deny shape. Existing profiles with
`mode: 'all'` or `mode: 'allow'` continue to render correctly because
`joinSkills` (`skillStore.ts:111`) honours all three modes when
computing per-row `enabled`; the first toggle migrates the area to
deny-shape, and subsequent reads stay self-consistent.

The IPC surface collapses from two handlers (`oscar:skills:set-mode`,
`oscar:skills:toggle-slug`) to one (`oscar:skills:toggle`). Preload
exposes `window.electron.skills.toggle(areaId, slug, enabled)`. The
recipe-render path (`oscar:skills:render-block`) is unchanged.

## Alternatives rejected

- **Keep tri-mode pill, rewrite copy ("Use all" / "Pick which" / "Block
  specific").** Cleaner labels but preserves the nested mental model.
- **`disabled_slugs: string[]` flat shape.** Would require coordinated
  migration of every existing M7 Forge Mode D write. The deny-shape
  reuse is a single-writer convergence that costs no migration.
- **Auto-flip mode based on per-skill flips.** Hides the underlying
  data model from anyone debugging profile.json; harder to reason
  about than always-deny.

## Caveats

- Lawyers who relied on the explicit "All" mode badge for confidence
  ("everything is on") now see the same default with chips labelled
  On — visually equivalent but a different reading. Acceptable given
  the dogfood complaint was the opposite direction (mode confusion).
- Old capture-m5 / capture-m6 harnesses reference the removed IPC
  names; they're vestigial visual-history scripts and won't be re-run.

Cites: ADR-067, ADR-085, ADR-086, ADR-087, ADR-092.
