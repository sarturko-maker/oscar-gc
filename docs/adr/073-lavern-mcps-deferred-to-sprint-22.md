# ADR-073 — Lavern MCPs deferred to Sprint 22; Goose-shape architecture commitment

Status: accepted
Date: 2026-05-20
Sprint: 21

## Context

The Sprint 21 brief carry-forward 7 reads: "Lavern's MCPs ship bundled. Whatever Lavern uses (debate, scoring, grounding verification, knowledge base access — the 21 they ship), install them as bundled MCPs available to partner recipes." The brief's out-of-scope contradicts this: "Lavern's debate protocol / 10-pass verification / precedent board — those are Lavern's load-bearing differentiators but require custom orchestration. The demo doesn't need them; partners are just specialist agents."

The contradiction resolves once Lavern's repo is read directly. The 21 MCPs at `src/mcp/tools/` are the **substrate of Lavern's multi-agent orchestration** (debate-board for posting findings, evaluator-gate for pre-delivery validation, scoring-engine for severity calibration, verification-engine for the 10-pass loop, etc.). Bundling them without orchestrators means partners post findings to a debate-board nobody reads. Lavern's own `docs/architecture-spec.md` describes the design as **hybrid sequential-with-branching** (Router → specialist → optional adversarial → mandatory Evaluator Gate), **not** the parallel-debate firm the marketing implies. The brief was working from marketing framing.

Arturs's redirect on first plan submission: "We need to have a two sprint system. Without Lavern's MCP, these partners are just a bunch of system prompts. We create these personas, run deb dogfood on Crostini. Next sprint is to actually implement Lavern's MCPs and connectors BUT in a way that fits Goose's structure (you will need to think deeply about that now, otherwise we may be wasting our time creating these personas)."

This ADR records the architectural commitment for Sprint 22 — the **Goose-shape translation** of Lavern's MCP set — so Sprint 21's persona prompts can be written to align with it.

## Decision

**Sprint 21 ships personas only. Lavern's MCPs are NOT bundled in Sprint 21.** Partners run on Oscar GC's existing permissive default loadout (Memory, Top of Mind, Apps, Todo, Summon, Chat Recall, Auto Visualiser, Extension Manager from Sprint 18; oscar-fs scoped to partner working_dir; Tavily for web search).

**Sprint 22 implements Lavern's MCPs and concepts adapted to Goose's primitives**, per this translation table:

| Lavern primitive | Tier | Sprint 22 Oscar GC implementation |
|---|---|---|
| Specialist personas | A | Single-agent recipes (DONE Sprint 21) |
| `knowledge-base` (FTS5) | A | `oscar-knowledge-base` stdio MCP; bundled legal corpus |
| `baselines` | A | `oscar-baselines` stdio MCP (knowledge-base variant) |
| `document-reader` | A | Reuse existing `redline` (adeu) MCP |
| `grounding-verifier` | A | `oscar-grounding-verifier` stdio MCP (deterministic) |
| `document-checks` | A | `oscar-document-checks` stdio MCP (OOXML checks) |
| `risk-pricing` | A | `oscar-risk-pricing` stdio MCP (benchmark scoring) |
| `legal-md-compiler` | A | `oscar-legal-md` stdio MCP (md → DOCX/PDF) |
| `evaluator-gate` | B | Pre-delivery `SubRecipe` (verification-pass) |
| `debate-board` (multi-agent post/resolve) | B | NOT implemented — single-agent doesn't fit |
| Adversarial Testing | B | Optional `SubRecipe` (adversarial-pass) |
| `handoff` | B | Goose `SubRecipe` invocation |
| `approval-gate` | B | Oscar GC UI affordance (Accept/Reject) |
| `workflow-engine` / `generic-workflow-engine` | B | Goose recipe templates (already supported) |
| `memory-system` | C | Goose Memory extension (Sprint 18 default-ON) |
| `pre-engagement` | C | Oscar GC intake (Sprint 15) |
| `feedback-loop` | C | Deferred (Sprint 24+; precedent board scope) |
| `quality-check` | C | Subsumed by verification-pass |
| `report-card` / `scoring-engine` | C | Deferred (eval-derived; surfaces in Sprint 23) |
| `session-replay-testing` | C | Use Goose's session DB directly |
| `verification-engine` ("10-pass") | C | Doesn't exist coherently in Lavern docs; subsumed by sub-recipes |

Tier-A: 7 new stdio MCPs to lift (or reuse one). Tier-B: 5 concepts implemented as Goose primitives (sub-recipes + UI affordances + recipe templates). Tier-C: 8 Lavern-internal mechanisms either already covered by Goose or deferred.

Sprint 22 augments each adapted partner prompt with a final paragraph: "Before delivering substantive analysis, invoke the `verification-pass` sub-recipe to ground your citations and check for structural issues. For high-stakes outputs, additionally invoke `adversarial-pass`." This is the **only** persona-touching change Sprint 22 makes; Sprint 21's persona files survive intact.

## Rationale

- **The brief's MCP-bundle ask was based on marketing framing**, not Lavern's actual architecture. Reading `docs/architecture-spec.md` reveals a sequential pipeline, not a parallel debate. Goose's `SubRecipe` primitive (`crates/goose/src/recipe/mod.rs:120-129`) is exactly the path-based sequential delegation Lavern's design actually needs.
- **Tier-A MCPs are deterministic, single-agent, useful** — they fit Goose's stdio-MCP shape cleanly. Lifting them in Sprint 22 gives partners real grounding/baseline/risk machinery.
- **Tier-B concepts need rethinking, not lifting.** `debate-board` doesn't fit single-agent Goose; sub-recipes substitute the use cases that matter (verification, adversarial challenge). `handoff` IS sub-recipe invocation. `approval-gate` is a UI affordance, not an MCP. Lifting these MCPs verbatim would yield write-only tools nobody consumes.
- **Tier-C MCPs are already covered or out of scope.** `memory-system` is Goose Memory; `pre-engagement` is Oscar GC intake; the rest are Lavern-internal infra (replay testing, scoring, agent report cards) without product analogue in this demo.
- **Persona alignment commitment.** Sprint 21 prompts are adapted to NOT assume orchestrator invocation (see [[ADR-072]]). That same adaptation lets Sprint 22's sub-recipe augmentation slot in additively, with no re-adaptation. The "wasted personas" risk Arturs flagged is mitigated by this commitment table.

## Alternatives rejected

- **Bundle all 21 MCPs in Sprint 21.** Larger sprint; many MCPs would expose tools with no consumers (debate-board posts to nothing); demo-breaking.
- **Bundle only Tier-A MCPs in Sprint 21.** Stretches Sprint 21 from "demo shell" to "MCP-lift sprint" — Arturs's three-sprint framing pulls toward keeping Sprint 21 lean.
- **Run Lavern as a parallel substrate, embedded inside Oscar GC.** Massive architectural commitment; deep coupling to upstream-Lavern; the brief explicitly out-of-scopes Lavern's debate protocol. Goose-shape adaptation is the right long-term direction.
- **Skip Tier-A and run partners on Tavily only forever.** Would leave the demo at "well-spoken partners with no grounding" permanently. Tier-A in Sprint 22 is the substantive upgrade.

## Consequences

- Sprint 21 ships honestly framed: "Partners chat in character, identity-aware. Substantive depth (grounded citations, baselines, risk scoring, verification) is Sprint 22."
- Sprint 22 has a fully-sketched scope: 6 new stdio MCPs to lift + 1-2 sub-recipe primitives to wire + each partner prompt augmented with one paragraph. Estimated as one sprint by Sprint 5/6/10 sibling-MCP bundling precedent.
- Sprint 23 (per-partner eval harness) is independent of Sprint 22 — can run on Sprint 21's bare personas first to baseline, then re-run after Sprint 22 to measure uplift.
- Lavern's `evals/` directory being empty (only `evals/jv/` empty subdir) confirms Sprint 23 is needed — Lavern themselves ran no per-prompt evals.

## Supersedes

None. Companion to [[ADR-071]] (Lavern firm-mode structural) and [[ADR-072]] (prompt adaptation). Cites [[ADR-053]] (companyContextBlock) and [[ADR-054]] (eval harness precedent).
