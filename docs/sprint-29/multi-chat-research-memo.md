# Sprint 29 — Multi-chat per matter: research memo

**Status**: research only. Implementation deferred to Sprint 30+ per the
Sprint 29 brief's Issue 7 scope.

## What Arturs asked

> Can we have multiple chats stored under one matter not one long chat
> conversation? What would this do to the model context? You cannot
> load the entire convo — does Goose compact it automatically? For
> next CC session to review.

Today's behaviour: each matter has `MatterEntry.session_id: string | null`.
First `openMatter` creates a session and binds it; every subsequent
`openMatter` resumes that one bound session. The matter accumulates
one ever-growing conversation.

## What Goose actually does about context — verified from source

CLAUDE.md "Upstream Goose authoritative reference" required reading the
upstream source rather than docs. (Side note: `goose-docs.ai/docs/guides`
URLs return 404; the source is authoritative.) Source verified at the
following paths under `/srv/projects/goose/crates/goose/src/`:

### 1. Sessions are independent

`session/session_manager.rs:303` — `create_session(working_dir, name,
session_type, goose_mode) → Session`. Each session has its own
`Conversation`; the storage layer
(`SessionStorage`) keeps them as separate rows. There is no shared
`thread`, `project`, or `container` concept above the session.

### 2. Auto-compaction within a session

`context_mgmt/mod.rs:185` —
`check_if_compaction_needed(provider, conversation, threshold_override,
session)` returns true when `current_tokens / context_limit > 0.8`
(`DEFAULT_COMPACTION_THRESHOLD`; configurable via
`GOOSE_AUTO_COMPACT_THRESHOLD`).

`context_mgmt/mod.rs:65` — `compact_messages(provider, session_id,
conversation, manual_compact)` summarises the conversation and replaces
it. The new first message is a summary; a continuation text
(`CONVERSATION_CONTINUATION_TEXT` /
`TOOL_LOOP_CONTINUATION_TEXT` / `MANUAL_COMPACT_CONTINUATION_TEXT`)
instructs the model to not mention compaction occurred.

`agents/agent.rs:1496` — the resume-stream path checks compaction every
time a session is resumed. If needed, compaction runs server-side
inline before the next turn; the renderer receives an
`AgentEvent::HistoryReplaced` event with the new conversation.

### 3. `/compact` slash command

`goose-cli/src/session/input.rs:205` — `/compact` (alias `/summarize`,
deprecation warned). Triggers `compact_messages(..., manual_compact:
true)`. Available via the CLI; the desktop renderer can call the same
underlying agent path.

### 4. No automatic cross-session memory

A new session starts with an empty conversation. There is no automatic
injection of prior sessions' summaries. The only **automatic**
cross-session continuity is what we put in the system prompt at
recipe-build time — which for matters today is Top of Mind (matter
facts + key facts via `~/.config/oscar/tom-active-matter.md`).

### 5. Agent-mediated cross-session search via Chat Recall

`agents/platform_extensions/chatrecall.rs:16` — the `chatrecall`
platform extension is enabled by default in Oscar GC (Sprint 18
ADR-063). Two tools available to the agent:
- **Search mode**: keyword search across past sessions (`query:
  "database postgres sql"`). Returns matching messages, up to 50.
- **Load mode**: `session_id: "<id>"` → returns first + last 3
  messages of that session.

So if a lawyer opens a new chat under a matter and says "remember the
indemnity carve-out we did last week", the agent CAN find it via
Chat Recall — but only by calling the tool, not automatically. This is
the right shape for Arturs's goal: "clean working memory for the new
question".

## What this means for the multi-chat UI

The compaction question's answer is **"yes, Goose auto-compacts each
session at 80% of context limit"**. So each chat under a matter
manages its own context independently; Oscar GC doesn't need to do
anything to keep an individual chat from blowing up. The
matter-level concern is *cross-chat* continuity:

- **Matter facts**: covered by Top of Mind on every spawn. Fresh chat
  under the same matter still gets the matter facts.
- **Cross-chat history**: covered by ChatRecall, agent-invoked when
  the lawyer asks ("remind me what we agreed in the side-letter
  thread"). Not automatic — and that's the right default for the
  clean-working-memory goal.
- **Optional**: a user-curated decisions log written to `matter.md` is
  already supported (the Key Facts section). Lawyers can append
  "indemnity carve-out: 12-month, capped at fees" themselves; future
  chats see it via Top of Mind. No new mechanism needed.

So the answer to the brief's load-bearing question — "fresh chat,
Goose handles continuity, OR fresh chat + Oscar GC injects summary
context" — is the first. **Goose handles continuity at the
single-session level; the matter is a container, not a thread.** No
summary-on-spawn wiring needed in Sprint 30.

## Suggested schema migration

Mirrors Sprint 27's per-partner pattern ([[ADR-092]] in this repo's
duplicate-numbering set, the one at
`docs/adr/092-sprint27-multi-session-per-partner.md`). Lazy
read-time migration; no v3 bump on disk unless writes occur.

```diff
 // matters.json[slug] entry
-  session_id: string | null
+  sessions: Array<{ id: string; label?: string }>
```

`readMattersRegistry` synthesises v2 → v3 at read time:
- `{session_id: "X"}` → `{sessions: [{id: "X", label: "(legacy)"}]}`
- `{session_id: null}` → `{sessions: []}`

`writeMattersRegistry` emits v3 shape only. v2 callers reading post-
migration data still resolve correctly: a follow-up `legacy.session_id`
shim accessor (or just drop the field — readers only used it via the
new bound-session lookup which goes through `lookupSession`).

## Suggested UI shape

Surface lives on the matter row in `MattersLanding`, mirroring Sprint
27's inline session list on the Oscar LLP partner card:

- Card click → resume `sessions[0]` (most recent). Preserves muscle
  memory.
- "+ New chat" affordance → fresh `createSession` + prepend to
  `matters.json[slug].sessions[]` via a new `bindSession` shape that
  PREPENDs with dedupe-by-id (mirrors Sprint 27).
- Session row click → resume that specific session.
- Cap visible at 5 with "…N more" overflow link to a per-matter
  detail view (or in-place expand; design call at Sprint 30 time).

Sidebar (`ChatHistoryTree`) needs to render the same nested shape:
PA → Matter → Session list. Sprint 19b already caps matters per area
at 10 with "+ N more" overflow; a session sub-tree per matter follows
the same discipline (cap N visible per matter, expand on demand).

## Affected surfaces (Sprint 30+ implementation map)

| Surface | Today | Sprint 30 change |
|---|---|---|
| `matters/types.ts` `MatterEntry.session_id` | `string \| null` | replaced by `sessions: SessionRef[]` |
| `main.ts` `readMattersRegistry` | reads v2 | lazy v2→v3 synthesis on read; tmp+rename atomic write floor |
| `main.ts` `oscar:matters:bind-session` | replaces `session_id` | PREPEND to `sessions[]` with dedupe (mirror `oscar:llp:bind-session`) |
| `main.ts` new `oscar:matters:unbind-session` | n/a | future "delete a chat from matter" UI; reserve in this sprint |
| `main.ts` `oscar:matters:lookup-session` | searches by `session_id` | searches by `sessions[].id`; per-matter back-button keeps working |
| `MattersLanding.tsx` `openMatter` | resumes `entry.session_id` or creates fresh | resumes `sessions[0]`, or creates fresh + prepends |
| `MattersLanding.tsx` row | shows matter only | adds inline session list per Sprint 27 pattern |
| `ChatHistoryTree.tsx` | PA → Matter (Sprint 19b 10-cap) | PA → Matter → Session (N-cap per matter) |
| `useRightPaneVisibility.ts` | derives matter from bound session | unchanged (still per-session lookup, works across multiple bindings) |
| `MatterBackButton.tsx` | clears Top of Mind, navigates to area | unchanged |
| Top of Mind `set-active` | once per matter | unchanged — matter is the unit of TOM, chat is per-question; opening any chat under a matter writes the same TOM |
| `useChatHistory.ts` | joins listSessions + matters × N | extends join: per matter, walk sessions[]; subscribe to SESSION_CREATED|DELETED|RENAMED|FORKED for live refresh |

Out of scope for the implementation sprint:
- Editable session labels (UI-side). v3 schema supports the field; the
  edit affordance is a follow-up.
- Cross-chat summary injection. Goose auto-compaction + ChatRecall
  cover the question; deferring to a future sprint if dogfood
  surfaces a gap.
- Session deletion UI. The reserved unbind-session IPC handles the
  back-end; renderer affordance is a follow-up.

## What Sprint 27 already proved

Sprint 27 implemented exactly this pattern for the Oscar LLP partner
roster: `partners.json` schema v1 → v2 (`session_id` → `sessions[]`),
lazy read-time migration, inline session list with cap-5-and-overflow.
The implementation shape was ~5 files, no Rust touch, no schema bump
on disk except via mutation. Sprint 30 multi-chat-per-matter can
follow the same shape and budget.

## Cost estimate for Sprint 30

Comparable to Sprint 27: one ADR, ~5 files touched
(`matters/types.ts`, `main.ts`, `preload.ts`, `MattersLanding.tsx`,
`ChatHistoryTree.tsx`), one visual harness. No Rust core touch. No
new MCP. Same atomic-write upgrade Sprint 27 made (tmp + rename) if
not already in place for `writeMattersRegistry`.

Risk: matter-bound-session lookups (`oscar:matters:lookup-session`,
`useRightPaneVisibility`, `MatterBackButton`) need their search
predicate widened from `m.session_id === sid` to `m.sessions.some(s
=> s.id === sid)`. Sprint 27 handled the analogous changes for
partners; the matter surface has more call sites but the change shape
is the same.
