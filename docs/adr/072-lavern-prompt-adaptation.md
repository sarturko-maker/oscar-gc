# ADR-072 — Lavern prompt adaptation policy

Status: accepted
Date: 2026-05-20
Sprint: 21

## Context

Sprint 21 lifts 10 specialist-agent prompts from `github.com/AnttiHero/lavern` (Apache 2.0, HEAD `7c2efe61524b` at lift time) at `src/agents/prompts/*.ts`. Each is a `export const xPrompt = \`...\`;` template-literal string of ~6-9KB. The prompts assume Lavern's broader orchestration substrate — they post findings to debate-board channels (`contract-risk`, `contract-deviation`, `adversarial-edge-case`), invoke memory-system queries, output JSON for downstream consumers (evaluator-gate, scoring-engine), and self-identify as agents of "The Shem" (Lavern's fictional firm name inside the system).

Three drift problems against Oscar GC's Sprint 21 demo cut:

1. **Firm name**: prompts say "The Shem"; the demo's framing per brief is "we will actually use the name Lavern — no hiding". Mismatch needs resolving.
2. **Orchestration substrate**: prompts assume orchestrators, debate channels, scoring gates, and JSON output consumers. None of that ships in Sprint 21 — partners run as standalone specialists. References would either confuse the LLM ("I'll post this to contract-risk" — there is no such channel) or produce demo-breaking output (JSON when the user expects prose).
3. **Lavern's `evals/` is empty.** No upstream eval signal on prompt quality; lift discipline matters because we can't trust prompts blindly. Sprint 23 will run our own per-prompt evals.

## Decision

Vendor-time mechanical adaptation, applied once at lift, captured in commit history. Raw originals stay at `ui/desktop/src/components/oscar/lavern/prompts/raw/<slug>.ts` (checked in with Apache 2.0 per-file header comment + Lavern commit-SHA reference; aggregate NOTICE update per [[ADR-035]] precedent). Adapted versions land at `ui/desktop/src/components/oscar/lavern/prompts/<slug>.ts`.

Mechanical transformations applied to every prompt:

1. **Firm rename**: `s/The Shem/Lavern/g` (and `the Shem`, `THE SHEM` capitalisation variants).
2. **Debate-board strip**: delete the `## Debate Board Protocol` section in full; delete inline references to `contract-risk` / `contract-deviation` / `adversarial-edge-case` channels and to `post_finding` / `decline_to_find` / `post_challenge` tool calls. Severity colour-coding (GREEN/YELLOW/RED) survives in prose where it's tied to the persona's framework; it's removed where it's tied to debate-board posting.
3. **Memory Protocol adaptation**: re-frame from Lavern's `memory-system` MCP calls ("Query precedents", "Load anti-patterns") to Oscar GC's Goose Memory extension. Partners may use `remember_memory` / `retrieve_memories` from the per-partner working_dir to keep notes across sessions. The "Memory Protocol" section is rewritten to one paragraph rather than removed — Sprint 22 will extend with sub-recipe invocations.
4. **Output Format strip**: delete the "Your output MUST be structured JSON" sections. Partners answer in prose; the demo is a chat, not a debate-board feeder.
5. **Personality numerics strip**: delete the `**Personality Axes**` bullet lists with their X/10 numerics. They read as inert metadata in a chat context; the qualitative voice descriptors ("fast, decisive, commercially minded") survive intact.
6. **First-line rename**: `You are the M&A Specialist at Lavern` → `You are <Partner Name>, an M&A Specialist at Lavern`. The 10 invented names from [[ADR-071]] (Sarah Chen, Marcus Webb, Daniel Reeves, Priya Patel, James Okafor, Helena Voss, Diana Park, Robert Sinclair, Aisha Khan, Thomas Schmidt) thread into the lead identity sentence.
7. **Header docblock**: rewrite to reflect Sprint 21 framing — keep the persona archetype ("The Dealmaker"), describe upstream provenance (Lavern Apache 2.0 + commit SHA + adaptation summary), drop debate-board posting references.

What's **preserved** verbatim:

- Persona archetype + qualitative voice descriptors
- Multi-phase analysis framework (M&A's five-phase Deal Assessment → Structure → Risk → Negotiation → Deliverables, and each partner's equivalent)
- Domain-specific guidance ("draft in deal language, not law review prose"; "deals die from delay"; equivalent for other specialists)
- Key Principles lists (including the "this system does not provide legal advice — flag for qualified legal counsel" hedge)

## Rationale

- **Mechanical at lift, not at runtime.** A one-shot vendor-time transform keeps the production prompt files inspectable in a code review; a runtime transform would obscure what the LLM actually receives.
- **Raws checked in, not gitignored.** Apache 2.0 attribution is cleaner with the source visible. Reviewers can diff raw → adapted in PRs. Sprint 22 prompt-augmentation works against the adapted files, not the raws.
- **Numerics strip is opinionated but auto-mode-defaulted.** The open question to Arturs in the plan ("strip personality numerics?") defaulted to "strip". Flips by editing the prompts (small mechanical task) if Arturs prefers them preserved.
- **Memory Protocol re-frame, not strip.** Sprint 21's Memory MCP loadout (Sprint 18 default-ON) makes the Memory paragraph load-bearing for "partners remember across sessions". Stripping removes a useful instruction; re-framing makes it Goose-native.

## Alternatives rejected

- **Lift verbatim, strip nothing.** Partners would describe posting to non-existent channels and demand JSON output the chat UI doesn't expect. Demo-breaking.
- **Strip everything beyond the first-paragraph persona statement.** Loses the analysis frameworks that make each specialist distinct. The framework is what makes "Sarah Chen feels like a deal-maker" vs. "Daniel Reeves feels like a litigator" — too much to lose.
- **Gitignore raw originals.** Plan defaulted to this; rejected during ADR write because Apache 2.0 attribution is cleaner with source visible and Sprint 22 reviews benefit from raw→adapted diff.
- **Runtime adaptation** (read raw at session-spawn, transform on the fly). Adds complexity; obscures the actual LLM input; harder to review.

## Consequences

- 20 new files under `ui/desktop/src/components/oscar/lavern/prompts/`: 10 raw + 10 adapted. ~140KB committed prompt source.
- `NOTICE` gets a Lavern attribution paragraph (Apache 2.0; commit-SHA `7c2efe61524b`; HEAD as of lift).
- Sprint 23 evals validate each adapted prompt against per-specialism test questions. Below-threshold prompts route back to Sprint 24 prompt revision.
- Sprint 22 augments each adapted prompt with a sub-recipe invocation paragraph (no re-adaptation; additive).

## Supersedes

None. Companion to [[ADR-071]] (Lavern firm-mode structural decision) and [[ADR-073]] (Lavern MCPs deferred to Sprint 22). Mirrors [[ADR-035]]'s Apache 2.0 NOTICE pattern from claude-for-legal.
