# ADR-071 — Lavern firm-mode (multi-partner consult inside Oscar GC)

Status: accepted
Date: 2026-05-20
Sprint: 21

## Context

Sprint 21 introduces **Lavern firm-mode**: a parallel sidebar entry that opens a roster of 10 specialist-partner agents an in-house lawyer can consult, sitting alongside their existing in-house practice areas. Each partner is a Goose recipe with a persona/system prompt lifted from `github.com/AnttiHero/lavern` (Apache 2.0). The partner knows who the lawyer is and which company they advise (identity cascades from `profile.json`); each partner has its own local memory; partners are independent (no cross-partner memory). The brief frames this as a **demo, not product** — light, ships fast, proves Oscar GC can host a "firm shape" alongside the in-house practice.

This is the first sidebar entry that is neither a practice area nor a system affordance (Forge, Integrations, Settings). The right placement question, the recipe-build wiring, the per-partner working_dir and session-binding state file, and the trust-bypass interaction were all left to plan-mode by the brief.

## Decision

- **Sidebar placement**: new `oscar__sidebar-group` inside `ChatHistoryTree.tsx`, between the Quick chats group and the Practice areas group. Eyebrow label `Lavern`; single child row linking to `/lavern`. Visual rhythm matches the other two tree groups. Header-zone alternative rejected (Forge/Integrations are system affordances; Lavern is an agent-mode peer to practice areas — the brief said "alongside or near practice areas"). Inlined-10-children alternative rejected (heavy permanent sidebar real estate).
- **Route `/lavern`** mounts `LavernRoster.tsx` — 10 partner cards `[Name] ([Specialism])` with blurb + status badge. Click handler mirrors `MattersLanding.openMatter:104-138` resume-on-existing pattern: `matters.detachActive()` → `lavern.ensureDir(slug)` → `lavern.lookupState(slug)` resume-or-fresh-spawn.
- **Recipe shape**: `buildLavernPartnerRecipe(partner, workingDir, resourcesRoot, userContext, companyContext, enabledPlatformExtensions)` returns `{ title: 'Lavern — <name>', instructions: [userIdentityBlock, companyContextBlock, partner.systemPrompt].join('\n\n'), extensions: [oscar-fs(workingDir) + ...enabledPlatformExtensions + Tavily], settings: minimax/M2.5 }`.
- **Per-partner working_dir**: `~/Documents/Oscar GC/Lavern/<slug>/` (user-visible Finder-discoverable; mirrors Sprint 14's matters convention but without the split state folder — partners are simpler than matters). Goose Memory's `agent-working-dir` meta-header scoping (`crates/goose-mcp/src/memory/mod.rs:21-29,165-184`) makes per-partner memory isolation automatic; no code needed.
- **Partner→session binding**: `~/.config/oscar/state/lavern/partners.json` keyed by slug, value `{ session_id: string | null }`. Minimal — no archive, no stakeholders, no groups (vs. Sprint 14 matters.json).
- **Identity cascade**: new `userIdentityBlock.ts` (Lavern-only this sprint) renders `## About the in-house lawyer you're advising` from `profile.user.{name,role_label}` + `profile.corporate.{name,industry,size_band}`. Reuses `companyContextBlock.ts` (Sprint 15) verbatim.
- **Top of Mind on partner open**: `detachActive()` called first (same as Forge, Quick chats) — ToM is matter-scoped; partners are not matters; the file must be empty during partner session.
- **Trust-bypass widening**: extend `preload.ts:422-433` `startsWith('Oscar GC')` to also accept `startsWith('Lavern —')`. Avoids the bureaucratic `Oscar GC — Lavern — Sarah Chen` triple-prefix. Captured in [[ADR-029]]'s "Sprint 15+ migration" note as the kind of in-band extension that's acceptable until the schema migrates to `recipe.metadata.bundled`.

## Rationale

- **Sidebar position derives from the conceptual model.** Quick chats = ephemeral; Lavern = consult external firm; Practice areas = manage in-house work. Top-to-bottom reads as a natural progression of scope and stickiness.
- **Recipe-driven over quick-chat-like (no-recipe) sessions.** A no-recipe path loses the explicit instructions slot (where identity + company context get baked in before turn 1), the `settings.goose_provider/model` pin, and the extension scope-down. The brief's "the partner knows who the client is" requirement is best served by recipe-instructions injection.
- **No-touch memory isolation via working_dir.** Goose Memory's meta-header scoping is the cleanest mechanism. Per-partner directories under `~/Documents/Oscar GC/Lavern/` keep the data Finder-discoverable, matching Sprint 14's matter-path doctrine.
- **Lavern-only identity block this sprint.** The same gap exists in practice-area recipes (`profile.user`/`profile.corporate` are not currently injected) but widening to retrofit in-house mode here would balloon scope. Carried forward as a Sprint 22+ candidate.

## Alternatives rejected

- **Header-zone entry** (alongside Forge/Integrations) — those are system affordances; Lavern is an agent-mode parallel to practice areas. Brief's "alongside or near practice areas" pulls toward the tree zone.
- **Inline 10-partner list** (each as a sidebar row) — 10 permanent rows compete with the practice-areas tree visual budget. Roster page is cleaner for a demo.
- **No-recipe quick-chat-style partner sessions** — loses identity/company-context first-turn briefing and settings pin (see Rationale).
- **Triple-prefix title** `Oscar GC — Lavern — <name>` — accepted as fallback but rejected for the lead path; preload widening is two lines.

## Consequences

- `ChatHistoryTree.tsx` grows a new group; the bare-row alternative is ruled out by visual-rhythm.
- New IPC namespace `window.electron.lavern.*` (ensure-dir, bind-session, lookup-state, list-partner-states) — pattern mirrors `quickChats` + a subset of `matters`.
- New `~/.config/oscar/state/lavern/partners.json` (next to `tom-active-matter.md`, `state/<area-id>/matters.json`).
- New `~/Documents/Oscar GC/Lavern/<slug>/` directories created lazily.
- Trust-bypass widened to recognise `Lavern —` prefix; bundled-recipe trust gate still applies to user-installed-from-untrusted-source recipes.
- Sprint 22 ([[ADR-073]]) extends each partner's `systemPrompt` with a sub-recipe invocation paragraph; Sprint 21's persona files are written to accept this addition without rewrite.

## Supersedes

None. Companions: [[ADR-029]] (trust-bypass; this ADR widens its title-prefix policy), [[ADR-039]] (Forge sidebar precedent), [[ADR-053]] (companyContextBlock reuse), [[ADR-066]] (Sprint 19 sidebar tree shape), [[ADR-072]] (prompt adaptation), [[ADR-073]] (MCPs deferred to Sprint 22).
