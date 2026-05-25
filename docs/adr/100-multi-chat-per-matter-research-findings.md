# ADR-100: Multi-chat per matter — research findings + Sprint 30 direction

Sprint 29 M7 (2026-05-25). Status: Accepted (research). Implementation
deferred to Sprint 30+.

## Context

Crostini dogfood (2026-05-25): Arturs asked for multiple chats per
matter (mirrors a lawyer's real workflow — same matter, different
sub-questions). Today each `MatterEntry.session_id` binds the matter
to one ever-growing session. He flagged the load-bearing question:
"what does this do to model context — does Goose compact
automatically?"

Per CLAUDE.md "Upstream Goose authoritative reference", this required
reading the upstream source rather than relying on docs (and
`goose-docs.ai` URLs in fact return 404 for the relevant pages, so
source was the only path).

## Decision

**Sprint 30+ will implement multi-chat per matter using the Sprint 27
per-partner pattern. No summary-on-spawn wiring required.**

The full research is at
`docs/sprint-29/multi-chat-research-memo.md`. Three load-bearing
findings:

1. **Goose auto-compacts each session at 80% of context limit**
   (`context_mgmt/mod.rs:185`, `agents/agent.rs:1496`). Server-side,
   transparent to the renderer (`AgentEvent::HistoryReplaced`).
2. **Sessions are independent** (`session/session_manager.rs:303`).
   No automatic cross-session memory injection.
3. **`chatrecall` platform extension** (enabled by default per Sprint
   18 ADR-063) gives the agent on-demand keyword search across past
   sessions. Agent-mediated, agent-invoked — the right default for
   "clean working memory for the new question."

Sprint 30 shape (per the memo):

- Schema: `MatterEntry.session_id: string | null` →
  `sessions: Array<{id, label?}>`. Lazy v2→v3 read-time migration
  mirroring [[ADR-092]] Sprint 27 and [[ADR-078]] Lavern rebrand.
- UI: inline session list per matter row (cap 5 + overflow) mirroring
  Sprint 27's Oscar LLP card. Sidebar `ChatHistoryTree` gains a
  third level (PA → Matter → Session) with the same Sprint 19b cap
  discipline.
- IPC: PREPEND-on-bind with dedupe-by-id; new reserved
  `oscar:matters:unbind-session` for future delete UI.
- Top of Mind: unchanged — matter is the TOM unit, chat is per-
  question. Opening any chat under a matter writes the same TOM.

**No summary injection between chats.** The auto-compact + ChatRecall
combo answers Arturs's context concern. If Sprint 30 dogfood reveals
a gap (e.g., "agent forgets what we did in chat 1 when opening chat
2"), a Sprint 31+ ADR can add user-curated decisions injection (likely
via Key Facts in matter.md, which already flows through Top of Mind).

## Alternatives rejected

- **Auto-summary of prior chats injected into new chat's system
  prompt.** Defeats Arturs's stated goal ("clean working memory"); adds
  context bloat for the cases where the lawyer wants to start fresh.
  Better as opt-in via user-curated Key Facts in matter.md.
- **Single long session with manual `/compact`.** Status quo + manual
  burden. Doesn't match Arturs's mental model.
- **Build matter-level summary file (matter-summary.md).** New
  mechanism; duplicates ChatRecall + Key Facts.

## Caveats

- The `goose-docs.ai` domain returned 404 for the specific
  session/compaction guide URL probed. Source code at
  `/srv/projects/goose/crates/goose/src/context_mgmt/mod.rs` and
  `/srv/projects/goose/crates/goose/src/agents/agent.rs:1496` is the
  authoritative reference. Documentation-discrepancy flagged per
  CLAUDE.md "code prevails over documentation".
- Multi-binding lookups (`oscar:matters:lookup-session`,
  `useRightPaneVisibility`, `MatterBackButton`) need their search
  predicate widened from `m.session_id === sid` to
  `m.sessions.some(s => s.id === sid)`. Sprint 27 handled the
  analogous change for partners; matter surface has more call sites
  but the change shape is identical.

Cites: ADR-038, ADR-044, ADR-063, ADR-078, ADR-092 (Sprint 27).
