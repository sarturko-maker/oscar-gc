# [Goose] Operating Rules

These rules govern HOW to write code in this project. `PROJECT.md` governs WHAT to build (the one goal, the fork strategy, the sprint index).

## Cold-start reading order

1. `PROJECT.md` — what this project is, fork strategy, Sprint Index
2. `CLAUDE.md` — this file
3. `SPRINT_LOG.md` — most recent entry, then prior entries by Sprint Index relevance
4. `RUNBOOK.md` — host-state and gotchas
5. Relevant ADRs in `docs/adr/`
6. `DEV_SETUP.md` — *if* you need to bootstrap or reproduce the dev environment. Reference material, not mandatory cold-start reading.
7. `AGENTS.md` — upstream Goose's contributor guidance. Read once for context on upstream's conventions; our CLAUDE.md takes precedence for project-specific rules.
8. `/srv/projects/LQdesign/` — design reference. Visual system (colour, type, spacing, components), HTML mockups, two CSS files. Read once per fresh session. Note: contains "LQ" branding from a sibling project; for Oscar GC we use the design language but not the LQ wordmark.

## The one goal (short-term, load-bearing)

Fork Block's Goose, replace the UI layer with an in-house-legal-shaped UI (practice areas → primary unit → memory + artifacts + agent), replace the memory layer with a scoped MCP server we own, wire adeu as an MCP server for the Commercial practice area.

**That is the entire short-term scope.** No broader product roadmap, no other practice areas, no operator marketplace until those four are working.

If a task isn't in service of one of the four, raise the question before doing it.

## Communication

Plain English. Define jargon on first use (MCP, SKILL.md, Tauri, scrypt, SSE — anything stack-specific). Don't oversimplify the reasoning, only the vocabulary. Applies to user-facing artefacts: prose docs, PR descriptions, error messages, sprint plans, reports to Arturs.

## Sprint discipline

### Plan-mode-then-execute
Every fresh sprint starts with a clean session that reads PROJECT.md, this CLAUDE.md, the most recent SPRINT_LOG.md entry, RUNBOOK.md, and relevant ADRs before producing a plan. The plan goes to Arturs for review. Execution follows approval. Bias toward smaller sprints — accumulation beats heroics.

### Sprint log
Append-only at SPRINT_LOG.md. Every sprint closes with an entry covering goal, what was built, what was deferred, and carry-forwards. PROJECT.md carries a Sprint Index — one-line summary per sprint, chronological — that points into SPRINT_LOG.md.

### ADRs at decision time
Architecture Decision Records at `docs/adr/NNN-short-title.md`, ≤50 lines each, append-only. Write the ADR **at the moment the decision is made**, not retrospectively. ADRs committed alongside or immediately before the change they document. Numbered sequentially; superseding ADRs reference the old one. **Never delete or edit a past ADR.**

If you find yourself making an architectural choice mid-task without writing an ADR, stop and write the ADR first.

### RUNBOOK currency
Every host-state change captured in RUNBOOK.md as it happens — every install, every config command, every key-file creation, every env-var lock, every daemon registration. **No retroactive writes** — capture as it happens or it didn't happen.

### Visual verification (UI sprints)
UI sprints commit screenshots to `docs/screenshots/sprint-N/` and reference them in the `SPRINT_LOG.md` entry. The capture command is in `RUNBOOK.md` under "Headless screenshot capture". Grep over `app.asar` proves a string is present in the bundle; only a PNG proves the screen renders the way Arturs expects.

## Fork hygiene (the load-bearing fork rule)

We are a custom distribution of Goose per upstream's `CUSTOM_DISTROS.md`, not a hard fork. Discipline:

- **Do not modify the Rust core** under `crates/` unless absolutely necessary. Every Rust-core change is a maintenance debt against future upstream merges.
- **All product work lives in `ui/desktop/src/`** (React/TS UI rewrite) and in sibling crates we add for the memory MCP server, the practice-area config, and adeu integration.
- **Track upstream weekly.** Read the release notes, decide whether to merge, document the decision (skip / merge / wait) in a one-line ADR addition or SPRINT_LOG note.
- **Branding metadata** lives in `ui/desktop/package.json` (productName, description). Don't sprinkle product names through source — keep them resolvable from one place.

## Reuse over rebuild — Goose

Default: reuse what Goose provides — agents, MCP, chat surfaces, providers, sessions, memory, skills, hooks, recipes. Theme or extend; don't rebuild stripped-down variants. Parallel implementations double maintenance and fragment the product.

Rebuild only with ADR-justified necessity. "We don't need feature X here" is not sufficient — those features earn their keep elsewhere.

## Inverting upstream UX defaults

Upstream Goose's UX defaults assume a developer audience and untrusted skill ecosystem. Oscar GC's audience is in-house lawyers with a bundled trusted skill library. Where defaults conflict with this, Oscar GC inverts them — no telemetry prompts, no recipe-trust dialogs, no upstream branding surfaces — and the inversion is the default for every future Goose-derived UX element.

## Distribution shape

Oscar GC ships as a single installable binary. Sibling MCP servers (memory, onboarding, future) are bundled into the Electron package at build time, spawned as subprocesses at runtime, invisible to the user. Dev-time separation across repos is a development pattern, not the distribution shape.

Implication: MCP servers stay small, self-contained, free of system-level dependencies. See PROJECT.md "Distribution shape" for the rules.

## Multi-repo discipline

Working directory determines push target — `git remote -v` to verify before any push. Cross-repo sprints record every repo touched + its pushed SHA in SPRINT_LOG. PROJECT.md is the canonical register of sibling repos and their roles.

## Rust discipline (the inherited Goose core)

- We mostly don't touch the core. When we do:
  - Pin exact versions in `Cargo.toml` (`= "x.y.z"`) for any crate that's pre-1.0 or moving fast.
  - Caret ranges only for stable 1.x crates with semver discipline (`serde`, `tokio`).
  - `cargo update --precise` for controlled bumps, after reading the changelog.
- `cargo audit` and `cargo deny` already configured upstream — don't disable.
- License policy: **no AGPL, no GPL** in our additions (we want to keep the distribution redistributable). Goose is Apache 2.0; keep our adds Apache 2.0 or MIT.

## TypeScript / Node discipline (UI + memory MCP)

- Strict mode TypeScript. `tsc --noEmit` clean on every PR.
- Pin exact versions for any pre-1.0 or fast-moving npm package. Caret only for mature 1.x.
- ESLint + Prettier configured at the package root. No drift between subpackages.
- Use Zod (or equivalent) for runtime schema validation at API/MCP boundaries; trust types internally.
- Imports: absolute paths via `tsconfig` `paths` aliases, not deep relative chains.

## Code style (both languages)

- **Default to writing no comments.** Only add a comment when the WHY is non-obvious — a hidden constraint, a subtle invariant, a workaround for a specific bug.
- Don't explain WHAT the code does — well-named identifiers do that.
- Don't reference the current task, fix, or callers ("used by X", "added for the Y flow"). Those rot.
- Don't add error handling, fallbacks, or validation for scenarios that can't happen. Trust internal code and framework guarantees. Validate at system boundaries (user input, external APIs, MCP messages, file contents) only.
- Don't add features, refactors, or abstractions beyond what the task requires. Three similar lines is better than a premature abstraction.
- Maximum file size: 300 lines. Split at responsibility boundaries.
- Don't introduce backwards-compatibility shims. We are pre-pilot.

## Type safety

- Strict types throughout, both Rust and TypeScript.
- Use Enums (Rust) / discriminated unions (TS) for fixed values (practice area, memory scope kind, MCP message kind). No raw strings for values with defined meanings.
- Serde derives at boundaries; plain structs internally.

## MCP tool-schema design

Every LLM-visible tool parameter is **A** (LLM extracts from natural language), **B** (runtime-derivable from env, session context, or per-element store — **MUST NOT** appear in LLM-visible schema; runtime resolves at handler entry), or **C** (small finite set; keep with tightest enum). B-class never appears in LLM-visible schemas (e.g., the current customer's ID; the user's practice area; the active matter scope — all B). The LLM should not be asked to repeat what the UI already knows. New tool authors classify A/B/C before adding to a schema; reviewers reject PRs that put B-class fields in LLM-visible schemas.

## Memory model

- Memory scope is per-element by default (per Customer / per Entity / per Stream — depending on practice area).
- Memory scope is per-user by default; tenant-configurable to team-shared per element.
- The memory MCP server owns the schema and the policy — Goose does not implement scoping logic itself.
- Goose's built-in tag-based memory is **not used** for product memory. It may remain enabled for agent-internal scratch only.

## Error handling

- **No silent failures.** Every `Result` (Rust) / promise (TS) is either:
  - Handled with explicit recovery logic
  - Logged with full context and propagated
  - Annotated with `// intentional: [reason]` for the rare safe-swallow case
- Log errors with context, not types. What failed, what the input was, why it matters.

## Logging

- Rust: all logging through `tracing`, output to stderr.
- TypeScript: structured logger (pino or equivalent), output to stderr.
- **Never `println!` / `console.log`** — corrupts MCP stdio if a server uses stdio transport, and makes the binary's stdout untrustworthy for piping.
- Log structure: error + diagnostic. Routine info noise removed. Every log line must be actionable or analytically useful.

## Testing

- Unit tests use mocks — that's normal.
- **Pipeline tests must NOT mock LLM calls.** Tests of agent flow invoke real configured providers (MiniMax in dev). If a pipeline test substitutes its own intelligence for a real invocation, the test is worthless.
- MCP server tests use a real MCP client harness, not a mock transport.
- Per-element test isolation: each test that exercises the memory store creates its own scope ID.

## Git discipline

- Commit at logical checkpoints. Every sprint closes with a commit that includes its SPRINT_LOG entry.
- ADRs committed alongside or immediately before the change they document. An uncommitted ADR is not a decision of record.
- Push after every commit. The remote is the only audit trail that survives a sandbox reset.
- Commit messages state the why, reference the sprint number and ADR ID when relevant.
- **Never skip hooks** (`--no-verify`).
- **Never use destructive operations** (`git reset --hard`, `git push --force`, `git checkout .`) without explicit user approval.

### Commit trailer rule
Commits do not include `Co-Authored-By: Claude ... <noreply@anthropic.com>` trailers. Write commit messages via HEREDOC, omitting the trailer. After every commit, verify with `git log -1 --pretty=full` and confirm no `Co-Authored-By` line referencing `anthropic.com` is present. If a trailer slips in, surface the violation and propose a cleanup commit before any rewrite.

## Objectivity

### Flag what doesn't add up
If something in the spec is wrong, contradictory, unclear, or will cause problems downstream — say so before building it. If a planned approach won't work with what's actually in Goose's source — say so. If a sprint exit criterion is impossible to meet with the current architecture — say so. **Do not silently work around bad instructions.** Raise the issue, explain why, propose an alternative, and wait for Arturs to decide.

### Trust internal, validate at boundaries
Internal types are checked at compile time. Don't add runtime checks for things the type system already guarantees. Validate user input, external API responses, MCP messages, and file contents at the system boundary; trust everything internal.

## Verify before acting (never assume)

**Never assume how Goose works. Read the source first, every time.** Before guiding Arturs through any install, configuration, command sequence, or operational step, verify against Goose's actual source code or canonical documentation — not against pattern-matched generic knowledge. Goose moves fast; docs lag code. When source and docs disagree, **code prevails over documentation.** Note the disagreement explicitly so Arturs can audit the call.

If a question requires reading source not yet read, read it before answering. Do not paper over the gap with educated guesses dressed up as fact.

## CLAUDE.md hygiene (meta-rules)

- This file should contain ONLY things the AI would get wrong without being told. Implementation details that live in the code (crate versions, file paths, function names) create context rot.
- Target under 200 lines. Every line competes for context window space.
- Update in real-time. When a decision is made during a session, add it immediately or write it as an ADR — not at end of session. Delete decisions that are now baked into code.
