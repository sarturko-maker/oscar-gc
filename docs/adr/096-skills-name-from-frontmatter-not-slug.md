# ADR-096: Skills row shows a humanised title, not the kebab-slug

Sprint 29 M3 (2026-05-25). Status: Accepted. Extends ADR-092, ADR-093.

## Context

Sprint 28 ADR-092 lifted Tools into its own section with human display
names ("Filesystem (matter scope)", "Document extraction", "Web search
(Tavily)", "Redlining (Adeu)") drawn from an in-process overlay. Skills
under it kept the raw kebab-slug (`nda-review`, `amendment-history`,
`escalation-flagger`) as the row's primary identifier. Crostini dogfood
(2026-05-25): "Tools are good — clear titles and explanations, while
the skills are not — hard to understand what they are."

Two failure modes:

1. **Title is the slug.** `joinSkills` (`skillStore.ts:135`) sets
   `name: slug`. The bundled `claude-for-legal` SKILL.md frontmatter
   also carries `name: nda-review` — author-set but identical to slug.
2. **Visual weight reads as code.** `.oscar__skills-name` uses
   `var(--mono-editorial)` at 12px / ink-light — the same family used
   for file paths and IDs elsewhere. The eye reads it as a code token,
   not a feature.

## Decision

The Skills row presentation lifts to match Tools:

1. **Humanised title.** A `humanizeSlug` helper at
   `skills/humanizeSlug.ts` title-cases the slug on hyphen boundaries
   and expands a small fixed map of legal-domain acronyms (NDA, MSA,
   SaaS, IP, AI, EU, UK, US, GDPR, M&A, IPO, KYC, AML, RFP, SOW, LOI,
   POC, T&Cs). Defensive fallback: any unmapped slug renders as
   title-case. `joinSkills` writes the humanised string into
   `SkillEntry.name`; the raw slug stays on `SkillEntry.slug`.
2. **Sans body, not mono.** `.oscar__skills-name` switches to
   `var(--sans-editorial)` 12px / 500 / ink-light — mirrors
   `.oscar__tools-name`. The `overflow-wrap: anywhere` from Sprint 28
   M4 stays as the safety net for long mapped titles.
3. **Slug stays addressable.** Already on `data-testid` and
   `data-source`; new `title` attribute on the row shows the slug for
   power users and DOM debugging.

## Alternatives rejected

- **Read the SKILL.md frontmatter `name` directly.** Bundled skills
  set `name: nda-review` — same as the slug. We'd be plumbing a
  no-op. Authors of future custom skills via Forge would have to know
  to set a different humanised name; a deterministic transform is the
  better contract.
- **Extract a heading from the SKILL.md body.** Bigger I/O surface
  (read every SKILL.md per area) for marginal gain over a closed
  acronym map.
- **Configure the abbreviation map per-area or per-plugin.** Premature
  abstraction. The 18 entries are project-wide legal-English; adding
  the next one is a one-line PR.

## Caveats

- An unrecognised acronym (e.g., "RWAI" / "ASCO") gets title-cased
  charitably rather than expanded. Adding to the map is trivial. The
  caveat to flag, not engineer around.
- Future skills under user-authored plugins via Forge depend on this
  transform. The transform is pure; behaviour is deterministic per
  input slug.

Cites: ADR-092, ADR-093.
