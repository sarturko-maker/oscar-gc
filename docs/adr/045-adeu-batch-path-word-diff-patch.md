# ADR-045 — adeu batch-path word-diff vendor-patch

Status: accepted
Date: 2026-05-19
Sprint: 13

## Context

Sprint 9 wired `adeu==1.6.9` as the redline MCP (ADR-016, ADR-020). The Sprint 9 dogfood verdict was "verification standard met" — but the verification counted `w:ins`/`w:del` occurrences, not their **width**. Sprint 10 and Sprint 12 carry-forwards both record "adeu's 'doesn't redline like a lawyer' finding — Arturs has a fix to share". Sprint 13 ships that fix.

Investigation: adeu has **two** narrowing primitives in `adeu/diff.py`:

- `trim_common_context` (diff.py:12) — trims shared prefix/suffix at word boundaries.
- `generate_edits_from_text` (diff.py:189) — full word-level diff via `diff_match_patch` with token-encoding + semantic cleanup; returns word-granular `ModifyText` sub-edits.

The `process_document_batch` MCP tool path invokes `trim_common_context` (in `engine.py:_pre_resolve_heuristic_edit` at line 1610) but **not** `generate_edits_from_text`. The latter is invoked only on `diff_docx_files` (the comparison tool path). Consequence: when the LLM emits a wide `(target_text, new_text)` pair like `("within thirty (30) days of receipt", "within fourteen (14) days of receipt")`, the engine narrows to a single proxy MODIFICATION wrapping "thirty (30)" / "fourteen (14)" and emits one `<w:ins>` + one `<w:del>` per shared-context-trimmed span. For wholesale-rewrite pairs where source and target share little text, the entire sentence is wrapped — not lawyer-shape.

Three implementation paths were considered:

1. **Build a wrapper MCP between Goose and adeu** to narrow before calling adeu's batch path. Rejected: premature abstraction; no orchestrator module in scope per Sprint 13 brief.
2. **System-prompt-only** — discipline MiniMax to emit narrow pairs in the first place. Insufficient: floor set by LLM capability; wholesale rewrites still produce wholesale OOXML.
3. **Vendor-patch adeu's batch path** to invoke its own `generate_edits_from_text` on the post-`trim_common_context` residue. Algorithm already exists; wiring is the gap.

## Decision

Option (3). Patch `/srv/projects/oscar-runtime/python/adeu-venv/lib/python3.12/site-packages/adeu/redline/engine.py:_pre_resolve_heuristic_edit` MODIFICATION branch (after line 1610): call `generate_edits_from_text(final_target, final_new)` and return a list of word-granular sub-edits, each anchored to `effective_start_idx + sub_match_start_index` with `_internal_op` derived from the diff op. `apply_edits` (engine.py:1162) already iterates over a list return from `_pre_resolve_heuristic_edit`; the consumer side is in place.

File an upstream PR concurrently against adeu's repo, recommending an opt-in parameter (`granularity: 'word' | 'span'`, default `'span'` for back-compat) so the maintainer is more likely to accept. Our recipe sets `'word'`.

## Rationale

- **The algorithm exists in adeu**; the gap is wiring on the batch path. Adding a wrapper MCP duplicates code adeu already ships.
- **adeu is `cmd:`-loaded from the absolute venv path** (ADR-016); editing files in the venv is the patch surface. No build-time injection needed.
- **Vendor-patch is reversible** — when upstream merges the PR and we repin to a newer adeu, this ADR's deletion criterion is met. Until then, the patch lives at one site.
- **adeu's design intent is span-faithful** ("the LLM knows legal intent; adeu doesn't"). That's defensible for an LLM-agnostic redline engine but mismatched with our use case where the LLM's wide spans are a known failure mode and the consumer (a senior solicitor) needs word-level OOXML.

## Consequences

- **Patch deletion criterion**: upstream adeu releases a version (≥1.7.0 expected) with this fix; we update `requirements.txt` (or whatever pins adeu) and remove the patch.
- **Patch survival across reinstalls**: the venv is at `/srv/projects/oscar-runtime/python/adeu-venv/` and not re-bootstrapped except by RUNBOOK-documented action. If a Sprint 14+ change rebuilds the venv, the patch must be reapplied — captured in RUNBOOK §Sprint 13.
- **Wholesale rewrites unchanged**: if source and target share no common text, `generate_edits_from_text` returns one DELETE + one INSERT, which the engine emits as one `<w:del>` + one `<w:ins>` of the original widths. Word-diff cannot narrow what has no common ground; prompt discipline (ADR-046) is the lever there.
- **Bundling impact**: Sprint 10's bundled `.deb` includes the venv; the patched venv ships in Sprint 13's `.deb` rebuild.

## Supersedes

None. Refines ADR-016 (Python runtime location) and ADR-020 (Commercial system-prompt doctrine) by closing the OOXML-granularity gap they implicitly assumed adeu would handle.
