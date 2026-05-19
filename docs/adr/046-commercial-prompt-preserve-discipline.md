# ADR-046 — Commercial recipe prompt discipline (preserve list + anchor-preservation + consequence framing)

Status: accepted
Date: 2026-05-19
Sprint: 13

## Context

ADR-020 (Sprint 9) committed the Commercial recipe to a five-step lawyer-reasoning system prompt at `ui/desktop/src/components/oscar/commercial/systemPrompt.ts`, with a stated escape hatch: "If Sprint 9 dogfood reveals MiniMax can't execute the doctrine, the finding is recorded explicitly rather than the doctrine being silently dropped." Sprint 9 dogfood landed at "competent, lawyer-recognisable" but Sprint 10/12 carry-forwards record open failure modes:

- **Wide target_text / new_text pairs** produce wide `<w:ins>`/`<w:del>` even after adeu's word-diff vendor-patch (ADR-045) for wholesale rewrites.
- **Qualifier-drop**: phrases like "to those of its officers and employees on a need-to-know basis" silently dropped when the LLM rewrites a confidentiality clause.
- **Mandatory-law catch-out drop**: phrases like "or as required by applicable law" omitted from tightened exception lists.
- **No explicit hand-off** when the LLM cannot preserve a flagged phrase — failure is silent, not surfaced.

ADR-045 closes the OOXML-granularity gap on the adeu side. ADR-046 closes the **input-quality** gap on the prompt side. Both are needed: prompt discipline keeps the LLM's spans narrow and preserves load-bearing phrases verbatim; adeu's word-diff narrows what remains. Either alone has a ceiling.

The brief proposed living markdown files at `redline-mcp/prompt_templates/*.md`. That path doesn't exist (adeu IS the MCP; the Commercial system prompt is a TS string literal). Sprint 13 inlines the new content directly into `systemPrompt.ts`.

## Decision

Insert four new sections into the existing `SYSTEM_PROMPT` string literal in `ui/desktop/src/components/oscar/commercial/systemPrompt.ts`, after "Things you never do" and before "Working without an attachment":

1. **`# Preserve discipline`** — for each modify edit, name the preserved phrases (qualifiers, mandatory-law catch-outs, cross-references) that must remain verbatim in `new_text`. If preserving makes the rewrite ungrammatical, write a coherent `new_text` AND emit a `comment` naming which phrase couldn't be preserved and why.

2. **`# Anchor-preservation idiom`** — concrete WRONG/RIGHT block teaching the LLM to begin `new_text` with a verbatim prefix of `target_text`. Primary mechanism that lets adeu's word-diff narrow the change.

3. **`# Failure-mode examples`** — two WRONG/RIGHT blocks for the qualifier-drop and mandatory-law-catch-out drop patterns.

4. **`# Consequence framing`** — closing paragraph: the senior solicitor will check the output against named preserved phrases; un-explained drops are rejected and reworked.

Recipe wiring unchanged — `commercialRecipe.ts` already imports `SYSTEM_PROMPT` and passes it through `buildPracticeAreaRecipe`.

## Rationale

- **Two-layer defence**. ADR-045's word-diff narrows whatever the LLM emits. This ADR reduces the floor of what the LLM emits and makes preservation an explicit contract instead of an implicit hope.
- **Doctrine, not persona** (per ADR-020). MiniMax follows explicit protocols more reliably than persona prompts. Preserve discipline is a protocol with a named consequence (comment-or-rejected).
- **Comment-as-handoff** instead of silent failure. The lawyer can address what the agent couldn't; the alternative (silent drop) is the failure mode Sprint 9 surfaced.
- **TS string literal, not external markdown**. No markdown loader exists in the desktop app; adding one for one section is yak-shaving. The current shape is the right shape; we extend it.
- **Anchor-preservation idiom is the cooperator with word-diff** — when the LLM starts `new_text` with a verbatim prefix of `target_text`, diff-match-patch's shared-prefix detection produces the narrowest possible diff. The idiom is taught with one example; MiniMax internalises it from a single concrete WRONG/RIGHT.

## Consequences

- **Token budget**: prompt grows from ~1,600 to ~2,400–2,800 tokens. Within MiniMax's context budget; per-turn reasoning unaffected.
- **Verification dependency**: Sprint 13's Phase 5 verification (`scripts/dogfood/verify-redline-shape.py`) spot-checks that named preserve phrases appear verbatim in output. ADR-046's claims are tested, not just stated.
- **Comment proliferation risk**: agent may emit comments on every edit where preservation is borderline. Acceptable — comments are lawyer-readable; over-disclosure beats under-disclosure for redline review.
- **Future practice areas**: the preserve / anchor / consequence shape ports to Litigation, Employment, etc. Future practice-area system prompts can adopt the same pattern.

## Supersedes

None. Refines ADR-020 (Commercial system-prompt doctrine) by adding the discipline ADR-020's escape hatch anticipated.
