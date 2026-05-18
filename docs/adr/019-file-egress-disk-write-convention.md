# ADR-019 — File egress: adeu writes to disk under a known convention; agent surfaces the path

Status: accepted
Date: 2026-05-18
Sprint: 9

## Context

The original Sprint 9 plan (`/root/.claude/plans/sprint-9-first-fizzy-raven.md` §D4) assumed adeu would return the redlined `.docx` as a base64 `resource` content block in the MCP tool response, and proposed adding a Download button to `ui/desktop/src/components/ToolCallWithResponse.tsx`'s `ToolResultView` to save it.

Phase 0 schema verification (`docs/dogfood/sprint-9/adeu-schema.md`) invalidated that assumption:

- `process_document_batch` returns `{result: string}` — a text status only.
- The modified `.docx` is **written to disk** at the `output_path` parameter the agent supplies; no bytes flow back through the MCP response.
- adeu does not emit any `resource` content block.

With no `resource` block in the tool response, a Download button on resource blocks has nothing to attach to. The egress problem reframes: how does the user retrieve a file that adeu has already written to disk?

Three options:

1. **Bridge MCP wraps adeu** — reads the file adeu wrote, returns its bytes as a `resource` content block in a new tool's response. Restores the original D4 design, at the cost of a new sibling MCP.
2. **adeu writes to a known directory; agent surfaces the path; user opens via OS file manager.** No new UI, no bridge.
3. **Path-detection UI affordance** — parse paths out of tool result text in `ToolResultView`, add a "Save copy" / "Open folder" button per detected path.

## Decision

Option (2). The Commercial recipe's system prompt (ADR-020) instructs the agent: when calling `redline__process_document_batch`, set `output_path` to `~/Documents/Oscar Redlines/{stem}_redlined_{YYYYMMDD-HHmmss}.docx`. The agent's text reply to the user names the output path. The user opens via their OS file manager.

No UI changes ship in Sprint 9 for binary tool-output rendering. Phase 5 of the original plan is dropped.

## Rationale

- **Goose's existing chat rendering handles it for free.** The agent's reply is text; text contains the path; Goose renders text. "Reuse what Goose offers" (Sprint 9 brief) is satisfied trivially.
- **The file is real and on real disk.** The lawyer doesn't need a "save" step — adeu has already saved. They need to know the location, which the agent tells them.
- **`~/Documents/Oscar Redlines/` is a familiar shape.** OS file managers treat it as just another folder; no Oscar-specific UX needed.
- Declined (1): a wrapper MCP that re-reads adeu's output and serialises it as base64 doubles I/O and adds a maintenance liability for marginal UX gain. Defer until friction is observed.
- Declined (3): path detection in chat text is fragile (path patterns vary by OS, false positives common); the affordance carries risk for marginal benefit.

## What is moving / not moving

**Moving (vs. original plan):** Phase 5 (`ToolResultView` Download button) is dropped. ~4h of UI work is freed.

**Not moving:** the verification standard. Phase 7's OOXML walk + lawyer-quality comparison artifacts (per Sprint 9 addendum) are unchanged. The dogfood pass still demonstrates a real round-trip; the lawyer-persona experience now reaches for `~/Documents/Oscar Redlines/`.

## Consequences

- **Recipe ownership of `output_path`.** The system prompt is load-bearing for the directory convention; if the agent forgets to set `output_path`, adeu writes next to the input (its default behavior), which may be `/tmp/`. The system prompt example is explicit about this.
- **Per-redline filename uniqueness.** Timestamp suffix prevents overwrites within the same minute. Sub-second collisions are vanishingly unlikely for human-paced workflows.
- **`~/Documents/Oscar Redlines/` is created on first use.** adeu writes via `python-docx` which doesn't auto-create parent directories; the system prompt instructs the agent to call `mkdir -p` via the `developer` MCP if needed, or treats the first redline as the directory-creation moment via an explicit pre-step. Sprint 9 dogfood will reveal whether this needs tightening.
- **No download path for tools that DO return `resource` blobs.** Future MCPs that return binary blobs will still hit the JSON-dump in `ToolResultView`. That gap is real but not Sprint 9's to close — it's a candidate for a UI polish sprint when a tool that genuinely needs it lands.

## Supersedes

None. First ADR on tool-output egress; revises Sprint 9 plan §D4 in light of Phase 0 schema verification.
