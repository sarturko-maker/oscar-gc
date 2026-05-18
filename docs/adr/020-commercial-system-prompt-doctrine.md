# ADR-020 — Commercial chat: recipe-scoped system prompt with five-step lawyer-reasoning doctrine

Status: accepted
Date: 2026-05-18
Sprint: 9

## Context

Sprint 9 introduces the redline capability for the Commercial practice area. Sprint 9's addendum raised the bar from "byte-level round-trip" to "lawyer-quality reasoning + OOXML-verified output." adeu is a redline executor; it performs OOXML surgery as instructed but does no legal reasoning of its own. The intellectual work — understanding the instruction's legal intent, identifying interacting clauses, planning coordinated edits, verifying coherence — is the LLM's, shaped by the agent's system prompt.

Goose's default system prompt lives in Rust core (`crates/goose/src/prompts/system.md`, do-not-modify per fork hygiene). The non-Rust seam for per-area prompts is the recipe mechanism: a recipe declares its system prompt + extension whitelist at session-creation time. Sprint 6's `ui/desktop/src/components/oscar/onboarding/onboardingRecipe.ts` is the in-tree template.

Three system-prompt shapes were considered:

1. **Mechanical** — list of tool names + their schemas, no doctrine. Treat the agent as a router. **Rejected**: produces find-replace behaviour, exactly what the addendum warned against.
2. **Persona-only** — "You are a senior commercial lawyer." No reasoning protocol. **Rejected**: leans on the LLM's prior to do all the structuring; in practice this varies wildly across models and within a model across runs.
3. **Persona + five-step reasoning protocol** — assigns a role, then a doctrinal procedure for how to approach a redline: intent → interacting clauses → coordinated plan → batch → coherence check.

## Decision

Option (3). The Commercial system prompt encodes a five-step lawyer-reasoning doctrine at `ui/desktop/src/components/oscar/commercial/systemPrompt.ts`:

1. **Read the instruction's legal intent.** Not just the surface words. ("Make this NDA mutual" → identify which obligations need to balance; understand that "mutual" implies symmetric confidentiality, may imply symmetric carve-outs, may imply renaming "Disclosing Party"/"Receiving Party" to "each Party".)
2. **Read the document.** Call `redline__read_docx` first with `mode: full` (or `mode: outline` then targeted `page:` calls for large documents). Identify every clause that interacts with the intent.
3. **Plan the coordinated set of edits before any modification.** Within the conversation turn (in reasoning text), enumerate the changes intended. Note where one change implies another.
4. **Apply via a single `redline__process_document_batch` call.** The batch evaluates against the original document state; do not chain dependent edits in one batch. `author_name`: a sensible default like "Oscar GC" or "Commercial Agent". `output_path`: `~/Documents/Oscar Redlines/{stem}_redlined_{YYYYMMDD-HHmmss}.docx` (the agent constructs this from the input path).
5. **Verify coherence.** After the redline, call `redline__read_docx` on `output_path` with `clean_view: true`. Confirm the redline reads as a coherent document, not a Frankenstein of partial substitutions. If coherence broke, surface uncertainty to the user rather than declare success.

The recipe binds: this system prompt + the `redline` extension whitelist + (later, when memory wires into the desktop) the `oscar-memory` extension. Hub Commercial-area entry routes into the recipe session.

## What is moving / not moving

**Moving:** the first product-area system prompt for non-onboarding chat in this codebase. Establishes the pattern future practice areas will follow.

**Not moving:** Goose's default system prompt remains the floor; the recipe's system prompt is prepended on top per Goose's recipe semantics. Sprint 6's onboarding system prompt is untouched.

## Rationale

- **adeu does OOXML surgery; the LLM does the lawyering.** This is the load-bearing architecture choice — adeu doesn't pretend to understand the document, and the LLM doesn't pretend to do OOXML directly. The system prompt is the interface between the two.
- **A doctrine outperforms a persona.** In Sprint 7 dogfood we saw MiniMax-M2.5 follow explicit protocols reliably. A persona alone produces variance.
- **Coordinated-batch native to adeu.** `process_document_batch` evaluates all changes against original state; the system prompt explicitly tells the agent this so it doesn't chain dependent edits within a batch.
- **The coherence check is non-optional.** It's the agent's responsibility to verify, not the user's. Addendum: "Verify document coherence after the changes — the result should still be a sensible contract, not a Frankenstein."
- **Reuse-not-rebuild: recipe + BaseChat.** ADR-013's onboarding-specific custom view does not apply here. Commercial chat uses `BaseChat`; the recipe is the only piece of new product code.

## Consequences

- **The prompt is the deliverable.** Tweaking it post-sprint is fine; the doctrine is the shape we commit to. If Sprint 9 dogfood reveals MiniMax can't execute the doctrine, the **finding is recorded explicitly** (per addendum: "sprint exits with a written finding rather than fudge") rather than the doctrine being silently dropped.
- **Up to 3 prompt iterations during Sprint 9 dogfood.** If the first run reveals a phrasing gap, iterate the prompt and re-run. If after 3 iterations the doctrine still doesn't land, the Sprint 9 close-out captures it as a Sprint 10 task ("system prompt iteration for redline doctrine") rather than declaring victory.
- **Future practice areas extend, not replace.** Litigation, Employment, etc. will each have their own recipe with their own system prompt. The five-step shape is portable to other domains where coordinated edits matter; the legal-intent vocabulary is Commercial-specific.
- **The `redline` extension whitelist** (`[read_docx, process_document_batch, diff_docx_files]`) is mirrored in both `~/.config/goose/config.yaml` and the recipe's extension override; the recipe is the source of truth at session start.

## Supersedes

None. First ADR on practice-area system-prompt doctrine. Future practice-area ADRs may borrow the five-step shape.
