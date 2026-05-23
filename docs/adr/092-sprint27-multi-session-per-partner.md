# ADR-092 — Sprint 27: multi-session per partner on the Oscar LLP roster

Status: accepted
Date: 2026-05-22
Sprint: 27

## Context

[[ADR-071]] Sprint 21 bound each Oscar LLP partner to exactly one session via `partners.json[slug].session_id`. Sprint 21's Crostini dogfood (Arturs, 2026-05-20) surfaced the gap: "I want multiple sessions per partner. Right now clicking Sarah Chen always opens the same conversation. History should be on the Oscar LLP screen." Two earlier framings — sidebar tree extension; M3 right-pane History panel bolt-on — were rejected as wrong surfaces. The roster page (`/oscar-llp`, `ui/desktop/src/components/oscar/oscar-llp/OscarLLPRoster.tsx`) is the actual surface; the actual gap is that the roster shows partners but not their conversation history.

## Decision

- **Schema bump v1 → v2** in `~/.config/oscar/state/oscar-llp/partners.json`:
  - v1 (Sprint 21): `{ [slug]: { session_id: string | null } }` — singular binding.
  - v2 (Sprint 27): `{ [slug]: { sessions: Array<{ id: string, label: string | null }> } }` — array, most-recent first by insert order. `label` is `partners.json`-owned; session metadata (`name`, `created_at`, `updated_at`) read from goosed via `listSessions()`. One source of truth per field.
- **Lazy read-time migration**. `readOscarLlpRegistry()` (`main.ts:2245-2273` region) probes each entry: `Array.isArray(v.sessions)` → already v2; else if `typeof v.session_id === 'string'` → synthesize `{ sessions: [{ id: v.session_id, label: '(legacy)' }] }`; else skip. Persisted on next mutation. Mirrors [[ADR-078]]'s `migrateLegacyLavernRegistry` pattern (read-time shape check; no eager wipe).
- **Click-on-card semantics**:
  - Click partner card (header area) → resume `state.sessions[0]` (most-recent). If `sessions[]` empty OR the session no longer exists server-side → fall through to fresh-spawn. Preserves Sprint 21 muscle memory.
  - Click "+ New chat with <Name>" → always fresh `createSession`; `bindSession` PREPENDS the new id to `sessions[]`.
  - Click a specific session row → resume that session (same dance as today's resume path, parameterized by `session.id`).
- **Atomic-write upgrade**. `writeOscarLlpRegistry()` upgrades from direct `fs.writeFile` to `.tmp + fs.rename` — interrupt-safety floor; current direct-write is acceptable for tiny v1 but the array grows over time.
- **Working-dir model unchanged**. All sessions of a partner share `~/Documents/Oscar GC/Oscar LLP/<slug>/`. Goose Memory's `agent-working-dir` auto-scoping continues to work per partner; sessions are conversations, the partner working_dir is the partner's notes/memory namespace.

## Rationale

- **Array-of-ids over array-of-snapshots**: a `created_at` denormalization in `partners.json` would drift from goosed's session DB. Single source of truth per field — id-only in `partners.json`, metadata via `listSessions()`. Cost: one extra API call per roster mount (one `listSessions()` joined across all 10 partners). Negligible.
- **Lazy migration with `(legacy)` label**: Sprint 21 was a real release. Wiping the registry would lose the binding even if the underlying session row still exists in goosed. The `(legacy)` placeholder surfaces the prior conversation as a recognizable row; user can rename via Sprint 28+ editable-label work.
- **Resume-most-recent on card click**: preserves Sprint 21's "click partner, start working" muscle memory. Only changes once a partner has >1 session; new behaviour is opt-in via clicking a non-most-recent row or "+ New chat".
- **PREPEND semantics for `bindSession`**: writer prepends rather than overwrites. The function name doesn't change because callers don't care about the internal append-vs-prepend semantics; they just say "this session belongs to this partner". Dedupe by id at write time (defensive).

## Alternatives rejected

- **Sidebar tree extension** (partners surfaced in `ChatHistoryTree`): partners aren't in the sidebar tree today; the sidebar has a single Oscar LLP link routing to `/oscar-llp`. Wrong surface.
- **M3 right-pane History panel** on partner chats: per-session history panel; orthogonal to per-partner roster history. M3 isn't on this branch; rebasing onto `main` for this is non-trivial and unrelated to the gap.
- **Partner-detail page** (Q1.b in plan-mode): cleaner card density but adds a navigation hop. Recommended fall-back if N grows large per partner; not yet load-bearing.
- **Hard cut-over migration**: tiny code, but loses any v1 binding on upgrade. Lazy migration is one branch in the reader for the same outcome with zero user-side friction.
- **Click-card → always-new**: breaks Sprint 21 muscle memory sharply; "+ New chat" is the right explicit affordance for fresh chat.

## Consequences

- `main.ts` IPC handlers + `preload.ts` bridge change semantics; renderer-side hook (`useOscarLLPPartners.ts`) and roster (`OscarLLPRoster.tsx`) reshape to handle the array.
- Smoke gate: `ui/desktop/scripts/test-oscar-llp-agents.js` 3/3 PASS (or 2/3 matching Sprint 26 baseline) post-change — composition seam unbroken (no recipe / prompt / verification-gate touch in Sprint 27).
- Out-of-scope, flagged explicitly:
  - Sidebar tree surfacing of partner sessions (Sprint 28+ candidate).
  - @-mention partners from chat — requires `ChatInput.tsx` mention popover + `summon` verification (Sprint 28).
  - Multi-agent project / "M&A team" recipe-vs-agent-files question (Sprint 29+).
  - M3 right-pane integration with partner chats (separate architectural sprint).
  - Editable session labels in the UI — schema supports user labels via `label` field; only the roster mutation surface is missing (Sprint 28+).
- No Rust core touch. No new sibling MCP. No `main` rebase.

## Supersedes

None. Companion to:
- [[ADR-071]] (Lavern firm-mode — the Sprint 21 structural decision Sprint 27 evolves).
- [[ADR-078]] (Lavern → Oscar LLP rename — the read-time lazy migration pattern Sprint 27 mirrors for the schema bump).
