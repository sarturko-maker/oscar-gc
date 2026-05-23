# ADR-078 — Sprint 24-A: rebrand "Lavern" firm-mode to "Oscar LLP"; reserve "Lavern" for Sprint 24-B+C pipeline name

Status: accepted
Date: 2026-05-21
Sprint: 24-A

## Context

[[ADR-071]] Sprint 21 introduced "Lavern firm-mode": a sidebar bench of 10 invented specialist-partner agents (Sarah Chen, …, Thomas Schmidt). The 10 names + adapted personas are Oscar GC's invention; "Lavern" was a placeholder label. Sprint 24-B+C ports Lavern's contract-analysis pipeline (Watchman → Reader → Curator — substance Lavern's own evals validated). Calling our in-house bench "Lavern" pre-empts the better reservation: pipeline = Lavern's genuine credit; firm = Oscar GC's invention.

## Decision

- **Firm name**: `Oscar LLP` (limited liability partnership — in-house-standard multi-partner shape). Replaces "Lavern" as sidebar eyebrow, route label, recipe title prefix, recipe description, and per-partner prompt body (`at Lavern` → `at Oscar LLP`).
- **Code-path rename**: `ui/desktop/src/components/oscar/lavern/` → `oscar-llp/`; symbol renames (`LAVERN_PARTNERS → OSCAR_LLP_PARTNERS`, `buildLavernPartnerRecipe → buildOscarLLPPartnerRecipe`, `LavernRoster → OscarLLPRoster`, etc.). Single atomic commit gated by `tsc --noEmit` + `lint:check`.
- **IPC namespace**: `oscar:lavern:*` → `oscar:llp:*` (renderer surface `window.electron.llp.*`).
- **State-file + working-dir migration**: `~/.config/oscar/state/lavern/partners.json` → `~/.config/oscar/state/oscar-llp/partners.json`; `~/Documents/Oscar GC/Lavern/<slug>/` → `~/Documents/Oscar GC/Oscar LLP/<slug>/`. Read-time lazy via `fs.rename()` (POSIX-atomic; carries `.goose/memory/` with the working dir). Mirrors [[ADR-047]] matters-registry backup pattern + [[ADR-032]] schema v1→v2 lazy migration.
- **Trust-bypass coexistence window**: [[ADR-029]]'s title-prefix check widens to three-way OR (`Oscar GC` || `Lavern —` || `Oscar LLP —`). Sprint 23 sessions bound to `Lavern — <name>` recipes still bypass on resume. Sprint 25 cleanup drops `Lavern —`.
- **Apache 2.0 attribution preserved verbatim**: 10 raw originals at `prompts/raw/*.ts.original` untouched; per-file `Lifted from github.com/AnttiHero/lavern` provenance untouched; `evals/lavern-jv/` directory name + `NOTICE.lavern.md` + `RUBRIC.lavern-original.md` untouched; top-level `NOTICE` body content untouched (per-section heading reframes only).

## Rationale

- **Pipeline vs firm naming tracks ownership.** Lavern's pipeline (validated by Lavern's evals) is genuinely Lavern's; the 10-partner bench is Oscar GC's invention. Sprint 24-A frees "Lavern" for Sprint 24-B+C's pipeline name (likely `Oscar LLP — Lavern Pipeline`).
- **"Oscar LLP"** — concise, professionally accurate (LLP = standard law-firm structure), fits sidebar. Beats `Oscar GC LLP` (GC + LLP doubles up oddly) and `Oscar Limited Liability Partnership` (too formal).
- **Single-atomic-commit mechanical sweep** — TypeScript reference checking catches every dangling import in one shot; splitting leaves the tree red mid-sequence.
- **Read-time lazy migration** — same precedent as [[ADR-032]] (v1→v2 profile schema): probe new path; fall back to legacy. Atomic rename survives interrupted boots; no forced re-onboarding.
- **Dual-prefix trust-bypass** — Sprint 23 partner sessions must resume cleanly through the rename window without re-triggering the trust dialog.

## Alternatives rejected

- `Oscar GC LLP` (awkward GC + LLP doubling); `Oscar Limited Liability Partnership` (too formal for sidebar).
- Generic `firm/` or `partners/` namespace — decouples from brand but obscures subsystem identity.
- Skip migration — breaks Crostini upgrade for any Sprint 21-23 user with partner→session bindings.
- Single-prefix swap (no coexistence) — breaks Sprint 23 session resume mid-upgrade.
- Edit [[ADR-071]]–[[ADR-077]] to reflect rebrand — violates CLAUDE.md "never delete or edit a past ADR".

## Consequences

- Sprint 25 cleanup drops `Lavern —` from the three-way OR trust-bypass.
- Sprint 24-B+C uses "Lavern" as *pipeline* name (recipe + sub-recipes) inside the Oscar LLP firm surface.
- ADRs 071–077 stay verbatim per CLAUDE.md immutability; ADR-078 is the rebrand pointer.

## Supersedes

None. Widens [[ADR-029]]. Companion to [[ADR-071]], [[ADR-072]], [[ADR-032]], [[ADR-047]]. To be superseded by a Sprint 25 ADR when the `Lavern —` trust-bypass prefix is dropped.
