# ADR-053 — Recipe-time company_context injection

Status: accepted
Date: 2026-05-19
Sprint: 15

## Context

ADR-050's intake rule-set produces a `company_context` block on the profile. ADR-051 places it in schema v3. Neither ADR specifies how that captured context reaches a practice-area agent at session-spawn time so the agent's first response is *specifically briefed* — the load-bearing exit criterion of the entire sprint. Without a concrete wire from profile → agent, the new intake captures context that downstream agents never read.

Top of Mind (ADR-044) is the per-matter channel — already wired via `tom-active-matter.md` on matter-set-active. It carries matter facts (subject, counterparty, kind, key facts) and is read fresh by Goose's `tom` extension every turn. Not the right channel for company-level baseline: company_context is invariant across matters within a session.

## Decision

**Recipe-time prepend.** At session-spawn time, the renderer (`MattersLanding.openMatter` and any other practice-area entry path) reads the profile via `oscar:read-profile` IPC, extracts `company_context`, renders it as a markdown block, and prepends it to the recipe's `instructions` string before passing the Recipe to `createSession`.

Renderer: `renderCompanyContextBlock(ctx): string | null` at `ui/desktop/src/components/oscar/recipe/companyContextBlock.ts`. Produces a `## About this company` markdown block from non-null fields, one line per dimension (Industry, Geography, Regulatory baseline + provenance, Recurring matters, Stakeholders, Risk appetite, Open notes). Returns null when `captured_via === "needs-re-intake"` or all fields empty. `buildPracticeAreaRecipe` takes `companyContext` option; prepends `${block}\n\n` to instructions when non-null. `buildCommercialRecipe` threads it through.

**Static per session**, not re-read each turn. **Provenance preserved on regulatory baseline** ("user-confirmed against web search" / "user-enumerated" / "LLM hypothesis, user-reviewed") so the agent has trust signal. **No injection on `needs-re-intake` profiles** — OscarOnboardingGuard catches first; renderer null-guards as defence-in-depth.

## Rationale

- **Prepend, not append.** Company context is foundational — the LLM should read it before the area-specific instructions. Prepending puts it first in the system prompt.
- **Static at recipe-build time.** Top of Mind covers per-turn churn (matter context); company-level baseline doesn't change within a session. One disk read at spawn beats re-reading every turn.
- **Single source of truth.** The profile is the only place company_context lives; every practice-area agent reads from the same source via the same wire. No drift between intake and downstream.
- **Provenance in the prompt.** "User-confirmed against web search" carries different weight than "LLM hypothesis" — the agent surfaces uncertainty differently when the regulatory baseline came from a low-trust source.

## Consequences

- `MattersLanding.openMatter` now does two reads at spawn (matter setActive + profile read). One extra IPC, ~10ms.
- Recipes get larger (`instructions` grows by ~6–10 lines). System prompt token budget should comfortably accommodate.
- New `OscarUserProfile.company_context` typed on the renderer; `profileNeedsReIntake()` helper for the guard.
- Sprint 16 may iterate the renderer's prose shape if dogfood reveals brittle phrasings; the prompt is small and easily tunable.

## Supersedes

None. Extends ADR-044 (Top of Mind for matter context) with a parallel per-session/per-area channel.
