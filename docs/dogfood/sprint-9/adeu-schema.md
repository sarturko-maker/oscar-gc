# adeu 1.6.9 — verified MCP schema (Sprint 9 Phase 0)

Captured 2026-05-18 from a live `adeu-server` (`adeu==1.6.9`, fastmcp 3.3.1, MCP protocol `2025-11-25`) running on Linux from `/srv/projects/oscar-runtime/python/adeu-venv/`. Raw `tools/list` response preserved in `adeu-tools-list.json` next to this file.

## Server identity

- name: `Adeu Redlining Service`
- version (fastmcp framework): `3.3.1`
- package version: `adeu==1.6.9` (`pip show adeu`)
- transport: `stdio`
- protocolVersion: `2025-11-25`
- capabilities: tools, resources (no subscribe), prompts (no listChanged), logging, experimental, `io.modelcontextprotocol/ui`
- stderr discipline: structlog JSON to stderr; stdout reserved for MCP framing (does not corrupt stdio transport)

## Full tool inventory (11 tools)

| Tool | Sprint 9 use | Notes |
|---|---|---|
| `read_docx` | **Whitelist** | Core read tool. Returns paginated text with optional CriticMarkup. |
| `process_document_batch` | **Whitelist** | Core redline tool. Coordinated multi-edit batch. |
| `diff_docx_files` | **Whitelist** | Compare input vs output; useful for the addendum's verification doctrine. |
| `accept_all_changes` | Deferred | Not core; finalizes tracked changes. |
| `sanitize_docx` | Deferred | Strips metadata for counterparty delivery; adjacent workflow. |
| `open_local_file` | **EXCLUDE** | Runs `xdg-open` — security/UX hazard inside the agent. |
| `login_to_adeu_cloud` | EXCLUDE | adeu cloud features not in scope. |
| `logout_of_adeu_cloud` | EXCLUDE | adeu cloud features not in scope. |
| `validate_documents` | EXCLUDE | Cloud validation; out of scope. |
| `create_email_draft` | EXCLUDE | Email cloud feature; out of scope. |
| `search_and_fetch_emails` | EXCLUDE | Email cloud feature; out of scope. |

**`available_tools` whitelist for Goose config**: `[read_docx, process_document_batch, diff_docx_files]`.

## Critical schemas

### `process_document_batch`

Required parameters: `original_docx_path: string`, `author_name: string`, `changes: array`.
Optional: `output_path: string|null` (default null → adeu chooses a path next to input).

**Return shape**: `{result: string}` per outputSchema. Text status. **No binary blob.** The modified `.docx` is written to `output_path` on disk.

**Annotation**: `destructiveHint: true`.

**Changes array** is a `oneOf` of six change types:

1. **`modify`** — search-and-replace.
   - Required: `target_text` (string, must uniquely match), `new_text` (string, supports Markdown).
   - Optional: `comment` (string|null).
   - Empty `new_text` deletes.
2. **`accept`** — accept a tracked change by `target_id` (e.g. `Chg:12`). Optional `comment`.
3. **`reject`** — revert a tracked change by `target_id`. Optional `comment`.
4. **`reply`** — reply to a comment by `target_id` (e.g. `Com:5`) with `text`.
5. **`insert_row`** — table edit; anchor `target_text` + `cells: [string]` of Markdown content + `position: above|below=below`. Disk mode only.
6. **`delete_row`** — delete the row containing `target_text`. Disk mode only.

**Native coordinated multi-edit**: a single call applies all changes in the batch. **All changes evaluate against the ORIGINAL document state** — do not chain dependent edits in one batch (rename X to Y, then modify Y → two batches).

**ID volatility caveat**: `Chg:N` and `Com:N` shift between document states. The system prompt must instruct the agent to call `read_docx` immediately before any `accept`/`reject`/`reply`. For Sprint 9's NDA→mutual scenario every change is type `modify`, so this caveat doesn't bite.

### `read_docx`

Required: `file_path: string`. Optional: `clean_view: bool=false`, `mode: full|outline=full`, `page: int=1`, `outline_max_level: int=2`, `outline_verbose: bool=false`.

**Return**: `ToolResult` (text with optional inline CriticMarkup).

Annotation: `readOnlyHint: true`.

### `diff_docx_files`

Required: `original_path: string`, `modified_path: string`. Optional: `compare_clean: bool=true`.

Returns text-based unified diff. Useful for OOXML-adjacent verification in the addendum's standard.

## Deltas from the Sprint 9 plan

| Plan assumption | Verified reality | Plan action |
|---|---|---|
| Tools: `process_document_batch`, `read_docx`, `finalize_document` | 11 tools; `finalize_document` doesn't exist (closest is `sanitize_docx` or `accept_all_changes`). | D2 unchanged; `available_tools` whitelist = `[read_docx, process_document_batch, diff_docx_files]`. |
| `process_document_batch` returns `resource` content block | Returns `{result: string}` text; output `.docx` written to disk at `output_path`. | **D4 revised**: egress is direct disk write. No UI Download button needed. |
| Phase 5 — UI download affordance in `ToolResultView` | Not applicable to adeu's output shape. | **Phase 5 dropped**. ~4h reclaimed for verification effort in Phase 7. |
| `process_document_batch({file_path, instructions})` | `process_document_batch({original_docx_path, author_name, changes, output_path})` | System prompt must instruct: provide `author_name`; build `changes` array; set `output_path` per convention. |

## D4 revised — file egress convention

The recipe / system prompt prescribes:

```
output_path = ~/Documents/Oscar Redlines/{stem}_redlined_{YYYYMMDD-HHmmss}.docx
```

The agent's reply names the output path. The user opens via their OS file manager. Goose's existing chat text rendering already handles this — no new UI affordance.

If dogfood reveals friction, a "Save copy / Open folder" UI affordance is a candidate for a later UI polish sprint. **Out of Sprint 9 scope.**

## Multi-edit verification (addendum's "verify, don't assume")

**Confirmed at source level**: `process_document_batch` natively handles coordinated multi-edits via the `changes` array. `diff-match-patch` is a transitive dependency of adeu 1.6.9 (used internally by adeu's `RedlineEngine`, not bolted on by us). No external orchestration layer needed.

**Source references**:
- `/srv/projects/oscar-runtime/python/adeu-venv/lib/python3.12/site-packages/adeu/mcp_components/tools/document.py:676-693` — Linux (non-win32) `process_document_batch` definition.
- `/srv/projects/oscar-runtime/python/adeu-venv/lib/python3.12/site-packages/adeu/redline/engine.py` — `RedlineEngine` implementation (the batch processor).
- `/srv/projects/oscar-runtime/python/adeu-venv/lib/python3.12/site-packages/adeu/models.py` — `DocumentChange`, `ModifyText` etc. (the Pydantic models behind the typed-array schema).

## Reproduce the probe

```bash
VENV=/srv/projects/oscar-runtime/python/adeu-venv
$VENV/bin/python /tmp/mcp_probe.py > adeu-tools-list.json 2>/dev/null
```

`mcp_probe.py` uses the official `mcp` Python SDK's `stdio_client` + `ClientSession`. The captured `adeu-tools-list.json` is the wire-level evidence.
