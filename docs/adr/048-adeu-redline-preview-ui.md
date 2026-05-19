# ADR-048 — Adeu MCP App diff preview (commit=False default + commit_document_batch tool)

Status: accepted (design); implementation deferred to Sprint 16b
Date: 2026-05-19
Sprint: 16 (carry-forward from Sprint 14)

## Context

Sprint 13 Crostini dogfood (`docs/dogfood/sprint-13/`) surfaced *"Adeu does not render MCP Apps"* — the redline pipeline writes the rewritten `.docx` to disk before the lawyer sees what changed. Apply/Reject happens at the file-system level, not at the legal-review level. Lawyers need to scan the diff *before* a file lands.

Sprint 14 plan-mode (Workstream 5 in `/root/.claude/plans/brief-sprint-14-immutable-diffie.md`) discovered the actual gap is narrow:

- Adeu **already implements MCP-Apps natively.** `read_docx` in `/srv/projects/oscar-runtime/python/adeu-venv/lib/python3.12/site-packages/adeu/mcp_components/tools/document.py` is decorated with `meta={"ui": {"resourceUri": MARKDOWN_UI_URI}}`. The Jinja resource lives at `mcp_components/resources/markdown_ui.py`.
- Goose's `McpAppRenderer.tsx` + `ToolCallWithResponse.tsx:317–325` already detect `_meta.ui.resourceUri` and render the iframe via `@mcp-ui/client`.
- `process_document_batch` (the redline-applying tool) has no UI resource decoration and writes to disk directly. **That single decoration is the missing link.**

ADR-045 already shipped the underlying word-diff narrowing (deletions/insertions narrowed to the smallest changed run). The preview UI just needs a Jinja resource that consumes those edit-groups and renders them, plus a commit/reject contract so the iframe can confirm intent before a file lands.

## Decision

Extend adeu's existing MCP-Apps Jinja-resource pattern. Don't invent a new pattern; mirror `markdown_ui`. Two-tool contract: `process_document_batch(commit=False)` prepares the preview, `commit_document_batch(preview_id, action)` lands or discards it.

### Vendor patch — `docs/redline/adeu-1.6.9-redline-preview-ui.patch`

Applied after the existing word-diff patch in `ui/desktop/scripts/postinst.sh`. Touches adeu 1.6.9:

- `process_document_batch` (both win32 and disk variants) gains `commit: bool = False`.
- **When `commit=False`** (the Commercial recipe default): adeu runs the engine to completion in memory, writes the resulting `.docx` to `/tmp/adeu-batch-<uuid>/output.docx`, returns structured `edit_groups` JSON in `structuredContent` plus the preview UUID and a 60-min TTL.
- Decorate `process_document_batch` with `meta={"ui": {"resourceUri": REDLINE_PREVIEW_UI_URI}}` — the same shape that makes Goose's renderer surface the iframe.
- **New tool `commit_document_batch(preview_id, action)`**: `action="apply"` moves the tempfile to the original `proposed_output_path`; `action="reject"` deletes the tempfile. Validates UUID is live (not expired, not already-committed). Returns explicit error in chat if expired or used.
- New resource `mcp_components/resources/redline_preview_ui.py` + template `templates/redline_preview_ui.html` — mirrors `markdown_ui` pattern. Iframe consumes `structuredContent.edit_groups`, renders each as a collapsible card with strike/underline. Apply/Reject buttons postMessage back to `commit_document_batch`.
- `REDLINE_PREVIEW_UI_URI = "ui://adeu/redline-preview-ui"` declared in `shared.py`.
- TTL reaper: `atexit` hook deletes any live tempfiles; wall-clock check per `commit_document_batch` call rejects expired UUIDs.

### Edit-group data shape (verbatim from Sprint 14 plan §5b)

```json
{
  "preview_id": "<uuid>",
  "original_path": "...",
  "proposed_output_path": "...",
  "author_name": "Oscar",
  "expires_at": "<ISO-8601>",
  "edit_groups": [
    {
      "group_id": 0,
      "summary": "Modify clause 4.2 — 30-day → 14-day notice",
      "paragraph_index": 12,
      "sub_edits": [
        {"kind": "delete", "char_offset": 142, "text": "thirty (30)"},
        {"kind": "insert", "char_offset": 142, "text": "fourteen (14)"}
      ]
    }
  ]
}
```

Each LLM `DocumentChange` → one `edit_group`. ADR-045's word-diff narrowing produces multiple word-level `sub_edits` per group. The iframe renders each group as a collapsible card with strike/underline. The summary line is the model's own short description of the change; sub_edits drive the strike/underline rendering.

### Failure modes (verbatim from Sprint 14 plan §5c)

- **Window closed mid-review:** tempfile reaped via `atexit` + 60-min TTL.
- **Reject:** explicit `commit_document_batch(action="reject")` deletes; if iframe never calls (browser-close), TTL reaps.
- **Stale UUID:** commit validates live; expired/committed returns explicit error in chat ("preview <uuid> expired or already-committed; re-run the redline").
- **Concurrent batches on same source:** newer UUID supersedes older. Older's tempfile is reaped on its own TTL.

### Files to touch (implementation phase)

- **NEW** `docs/redline/adeu-1.6.9-redline-preview-ui.patch` (unified diff against adeu 1.6.9)
- `ui/desktop/scripts/prepare-oscar-bundle.js` — copy new patch alongside the existing word-diff patch in `preparePython()`
- `ui/desktop/scripts/postinst.sh` — apply new patch after the word-diff patch (idempotent — same approach as ADR-045)
- `ui/desktop/src/components/oscar/commercial/commercialRecipe.ts` — add `commit_document_batch` to `available_tools[]` so the recipe declares the new tool
- `docs/redline/lawyer-shape-criteria.md` — add criterion: *"Apply/Reject reviewable before disk write"*
- `RUNBOOK.md` — Sprint 16 patch reapply guidance (parallel to ADR-045's existing entry)

## Rationale

- **Vendor-patch over fork.** Adeu is upstream-pinned at 1.6.9 (per ADR-018 reproducibility discipline). A patch keeps the upstream-merge story clean; a fork would create a maintenance debt against future adeu releases.
- **Extend the existing MCP-Apps pattern.** Adeu already speaks MCP-Apps for `read_docx`; the Jinja template + decorator pattern is proven. The preview UI is a mechanical second instance of the same shape.
- **commit=False default plus separate commit tool.** This is the cleanest contract for "preview → confirm → apply" without leaking concurrency or state-machine complexity into the recipe. The LLM doesn't reason about file paths or TTLs — it calls the preview tool, the lawyer reviews, the iframe calls commit.
- **TTL + atexit reaper** handle the dropped-state cases (window close, browser crash, app exit) without relying on the LLM to clean up.
- **Goose's existing `McpAppRenderer.tsx` does the heavy lifting** — no Goose UI code change beyond the recipe declaration. Reuse over rebuild (CLAUDE.md).

## Consequences

- New Python tool surface in adeu (`commit_document_batch`). The Commercial recipe declares it in `available_tools` so the LLM can call it; existing `process_document_batch` keeps working with `commit=True` if a caller explicitly opts back into one-shot mode (rare).
- `/tmp/adeu-batch-<uuid>/` tempfile lifecycle becomes a soft state-machine. TTL + atexit reap the leaks; UUID validation catches the user-driven cases.
- Adeu's bundled patch chain grows by one patch (word-diff + preview-ui). `postinst.sh` orders them deterministically: word-diff first, then preview-ui (preview-ui's `process_document_batch` decoration must apply on top of word-diff's signature changes).
- The lawyer-shape acceptance criteria gains "Apply/Reject before disk write" as a load-bearing item for Commercial dogfood.

## Implementation deferred

Per Sprint 16 plan's "Scope honesty" escape hatch: Sprint 16 carries Anchors 1+2 + Carries 1+2 + ADR-048 (design). The Adeu **implementation** lands in Sprint 16b. This ADR is the decision-of-record so future implementation work has a single source of truth.

Sprint 16b deliverable shape:
1. Generate the unified-diff patch against adeu 1.6.9 source (verify the apply target on a clean install of adeu 1.6.9 in `/srv/projects/oscar-runtime/python/adeu-venv/`).
2. Add Jinja template + Python resource per the shape in §"Vendor patch".
3. Wire into `ui/desktop/scripts/prepare-oscar-bundle.js` + `postinst.sh`.
4. Update `commercialRecipe.ts` available_tools.
5. Commercial dogfood: open a real NDA, agent runs `process_document_batch(commit=False)`, chat shows the iframe with collapsible edit-groups, Apply lands the file at `proposed_output_path`, Reject deletes the tempfile.
6. Update `lawyer-shape-criteria.md` and `RUNBOOK.md` patch-reapply guidance.

## Supersedes

None. Extends ADR-045 (word-diff narrowing). Closes the dogfood finding from Sprint 13.
