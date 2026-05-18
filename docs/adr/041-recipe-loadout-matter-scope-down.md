# ADR-041 — Per-recipe MCP loadout convention + matter scope-down

Status: accepted
Date: 2026-05-19
Sprint: 12

## Context

Sprint 12 Workstream 3 formalises the access model: every practice-area agent runs under a recipe loadout that lists exactly which extensions and tools it gets — no Developer extension, no kitchen-sink MCPs, scoped filesystem MCP. ADR-008 (confirmed in `crates/goose/src/config/extensions.rs:169`) is the load-bearing primitive: when a recipe specifies `extensions`, only those are loaded. The brief also requires **matter scope-down** — when a matter is open, the filesystem MCP's allowed-directories narrows to that matter's folder.

Today's recipes: Onboarding (one extension: `oscar-onboarding`), Commercial (one extension: `redline`/adeu). No generic builder; the 12 non-Commercial practice areas currently render placeholder UI with no recipe at all.

## Decision

**Uniform recipe shape for every practice-area agent**:

```ts
extensions: [
  { name: 'oscar-fs', args: [<matter folder> | <practice-area folder>], … },
  { name: 'oscar-memory', … only when the area uses memory (Commercial today; others Sprint 12+) … },
  { name: '<capability>', … e.g., 'redline' for Commercial … },
]
// NO 'developer' platform extension.
// available_tools[] narrows the tool surface where useful.
```

**Generic builder factory** at `ui/desktop/src/components/oscar/recipe/buildPracticeAreaRecipe.ts`:

```ts
buildPracticeAreaRecipe(area: PracticeArea, matterFolder: string | null): Recipe
```

- Constructed per-session at session-creation time.
- `matterFolder` non-null when MattersLanding's "open matter" handler is the caller — produces `args: [matterFolder]` for `oscar-fs`; sibling matters in the same practice area are invisible to the agent.
- `matterFolder` null when the agent is launched at the practice-area level (no matter chosen yet — e.g., a future "ad-hoc chat" affordance) — `args: [<practice-area folder>]` so the matter list itself is readable.

**Sprint 12 fan-out**: Commercial keeps its bespoke recipe (with adeu redline) but consumes the builder for the `oscar-fs` line. The other 12 practice areas — including Commercial Disputes, which had no bespoke recipe coming into Sprint 12 — use the generic builder with `oscar-fs` only. Adeu/redline stays exclusive to **Commercial**; a bespoke Disputes recipe is Sprint 13+ if substantive scope justifies.

## Rationale

- **Recipe loadout is a security decision** (brief's load-bearing principle 2). The whitelist mechanism (ADR-008) already gives us hard scope; the discipline is to be deliberate.
- **No Developer extension on practice-area agents** because Developer ships bash + filesystem write tools (`crates/goose/src/agents/platform_extensions/developer/mod.rs`); any agent with it has effective full-system access regardless of other scoping. Inverts upstream defaults (CLAUDE.md doctrine).
- **Matter scope-down at recipe construction** rather than runtime-mutable scope because recipes are per-session immutables in Goose's model; mutating mid-session would require core changes (fork-hygiene violation).
- **Generic builder lands all 13 areas uniformly** so MattersLanding works everywhere on day one. Bespoke per-area recipes accrete incrementally.

## Consequences

- The Onboarding recipe is reviewed in Phase 4 to confirm the no-Developer baseline (already true — see `onboardingRecipe.ts`).
- Commercial's recipe shape changes to import from the builder for the `oscar-fs` line, retaining its system prompt and the `redline` extension.
- The MCP Roots advertisement (per goose-docs.ai) points at `working_dir`, which is the matter folder — so `oscar-fs` allowed-directories and roots align.
- Future practice areas authored via Forge (ADR-039) inherit the generic builder automatically.

## Supersedes

None. Companion to ADR-008 (recipe vehicle) and ADR-040 (`oscar-fs`).
