# ADR-018 — File ingress: path-as-text from chat surface + system-prompt nudge

Status: accepted
Date: 2026-05-18
Sprint: 9

## Context

Sprint 9 needs a lawyer to attach a `.docx` to a chat and have the agent invoke the redline tool against it. Phase 0 investigation of Goose's file-attachment plumbing (`ui/desktop/src/hooks/useFileDrop.ts:36-126`, `ui/desktop/src/components/ChatInput.tsx:771-816`) found:

- Image files are base64-encoded into the message as `ImageData[]`.
- Non-image files (incl. `.docx`) are captured as **file paths** via `window.electron.getPathForFile(file)`, and the path is **appended as plain text** to the message string via `appendDroppedFilePaths()`.
- The MCP spec allows binary content in tool arguments, but Goose passes message text verbatim to the LLM, which then decides what to pass to tools.

Phase 0 verification of adeu's `process_document_batch` schema (committed at `docs/dogfood/sprint-9/adeu-schema.md`) confirmed adeu takes a `original_docx_path: string` (a path on disk), not bytes. No transformation needed between the user's drop and adeu's invocation.

Two options:

1. **Bridge MCP** — a small intermediate tool (`oscar-attachments-mcp__pass_attachment_to_redline`) that intercepts the file, reads its bytes, re-encodes for adeu. Necessary if adeu wanted bytes; redundant given adeu takes paths.
2. **No bridge** — agent reads the path from the user message text and calls `redline__process_document_batch` directly with `original_docx_path: <that path>`.

## Decision

Option (2). The system prompt for the Commercial recipe (ADR-020) teaches the agent: "When the user attaches a `.docx`, their message text contains the file's absolute path. Pass that path to `redline__read_docx` and `redline__process_document_batch` as the `file_path` / `original_docx_path` argument." No bridge tool is added.

## Rationale

- adeu takes file paths natively (verified at source level and at MCP wire level).
- The path is already in the user message — the agent sees `"Please redline this NDA: /home/oscar/uploads/nda.docx"` verbatim.
- A bridge would add a hop and a process for no semantic value.
- The system prompt makes the contract explicit so the agent doesn't have to infer the convention.
- Reused-as-is: Goose's existing drag-drop in `BaseChat` requires no UI changes for Sprint 9.

## Consequences

- **Path must be filesystem-accessible to the goosed process.** In the desktop binary running as the user, the user's home directory is in scope. Under Xvfb + root for dogfood, paths under `/tmp/` and `/root/` are fine.
- **Path validation is the system prompt's job.** If the user attaches a file that has since been moved/deleted, adeu returns an error in its `result` string; the agent surfaces that to the user.
- **No path sanitisation by us.** adeu opens the file via `python-docx`'s `read_file_bytes` (sees `adeu/mcp_components/shared.py`); if a user attaches a malicious path the worst-case is adeu fails to load. Validation lives at adeu's boundary, not in Oscar.

## Supersedes

None. First ADR on file ingress.
