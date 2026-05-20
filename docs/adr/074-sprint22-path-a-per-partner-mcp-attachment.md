# ADR-074 — Sprint 22 Path A: per-partner MCP attachment

Status: accepted
Date: 2026-05-20
Sprint: 22

## Context

Sprint 22 lifts six Tier-A MCPs ([[ADR-073]]) and a `verification-pass` sub-recipe into the Lavern partner recipes built by `ui/desktop/src/components/oscar/lavern/buildLavernPartnerRecipe.ts`. The MCPs have to attach somewhere. Two shapes were on the table:

- **Path A** — each of the 10 partner recipes declares its own MCP loadout (Sprint 21's shape extended).
- **Path B** — a future "Project" recipe (Sprint 24's M&A-transaction scope) declares the MCPs once; partners become lightweight agent files (`~/.agents/agents/<slug>.md`) discovered by Goose's summon extension; subagents inherit Project extensions.

The brief framed Path B as the simpler Sprint 24 substrate but acknowledged it forces an agent-file migration in Sprint 22. The architectural call had to be made before touching the recipe builder.

## Decision

**Path A.** Each Lavern partner recipe declares its Tier-A MCPs in its own `extensions` array. Sub_recipes carry `verification-pass` per recipe. No migration of partners to agent files; no Rust-core changes.

## Rationale

Goose's substrate, verified at HEAD:

- `SubRecipe` carries no extensions override (`crates/goose/src/recipe/mod.rs:119-129`). A parent recipe's extensions flow to all sub-recipes; per-sub-recipe MCP curation requires a Rust-core schema change.
- Agent files cannot declare MCPs — `AgentMetadata` accepts only `name`, `description`, `model` (`crates/goose/src/agents/platform_extensions/summon.rs:90-97`). Agent files are prompt-only.
- Subagents inherit the parent session's extension list (`summon.rs:1252`). The `delegate(extensions: [...])` filter narrows but cannot extend.
- `Recipe.sub_recipes` auto-injects the summon platform extension when present (`recipe/mod.rs:255-271`), so partners gain `delegate()` / `load()` tools for free.

Path B in Sprint 22 would mean either (a) pulling Sprint 24's Project recipe forward and migrating 10 partners to agent files, or (b) modifying the Rust core to add `extensions` to SubRecipe. (a) inflates Sprint 22 with Sprint 24 scope; (b) violates CLAUDE.md's "do not modify the Rust core unless absolutely necessary" rule and creates upstream-merge debt every Goose pull.

Path A keeps Sprint 21's shape intact: a clean attachment point already exists at `buildLavernPartnerRecipe.ts:45-57`. Sprint 24 can still build the Project recipe later — partner recipes are valid `SubRecipe.path` targets (YAML files referenced by path); the Project simply wraps them. At that time, if Sprint 24 needs per-partner MCP curation, a Rust-core change can be evaluated on Sprint-24-specific evidence rather than speculatively now.

Uniform MCP loadout across all 10 partners for this sprint. Per-partner curation (e.g., risk-pricing only for transactional specialists) is revisitable after dogfood.

## Alternatives rejected

- **Path B with agent-file migration**: too large for Sprint 22 (pulls Sprint 24 scope forward); locks the choice before per-partner MCP-curation evidence exists.
- **Path B with Rust-core SubRecipe schema extension**: violates CLAUDE.md; creates persistent upstream-merge debt; no Sprint-22 customer for the schema change.
- **Attach MCPs to Oscar GC's global default loadout** (Sprint 18 permissive default): would inflict legal-corpus / contract-baseline tools on every chat session including Quick Chats and Practice Areas; pollutes non-Lavern surfaces.

## Consequences

- `buildLavernPartnerRecipe.ts` grows the extensions array by 6 entries and adds a `sub_recipes` field. Single touchpoint, no API change for callers.
- All 10 partners get the same MCP loadout. Per-partner curation deferred.
- Sprint 24's Project recipe is additive: wrap partner recipes as `sub_recipes`; if curation needed, Rust-core change evaluated then.
- Each partner session spawns 6 stdio MCP subprocesses on session open (acceptable; matches Sprint 21's existing oscar-fs + platform-extension pattern).

## Supersedes

None. Companion to [[ADR-071]] (Lavern firm-mode structural), [[ADR-072]] (prompt adaptation), [[ADR-073]] (MCP commitment table). Refines ADR-073's "Sprint 22 implements Lavern's MCPs" commitment with the recipe-attachment shape.
