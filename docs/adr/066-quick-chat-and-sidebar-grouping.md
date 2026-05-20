# ADR-066 — Unscoped quick-chat path, sidebar PA→Matter→Session tree, per-area entry noun

Status: accepted
Date: 2026-05-20
Sprint: 19

## Context

Sprint 12+ shipped matters: a lawyer opens a practice area, picks/creates a matter, and lands in a session bound to it (working_dir = matter folder, Top of Mind injected per turn, oscar-fs scoped down). Sprint 14 added the schema v2 split-disk layout (state at `~/.config/oscar/state/<area-id>/`, content at `~/Documents/Oscar GC/<Area>/<Matter>/`).

Three gaps surface in dogfood and brief framing:

1. **No unscoped chat path.** Every conversation today requires creating a matter first. The high-frequency "what's a typical liability cap for SaaS MSAs?" research question has no entry — ceremony where there should be none.
2. **No chat-history navigation.** `OscarSidebar` lists Forge / Integrations / 13 practice areas / Settings. There is no session list at all; the lawyer cannot see "what conversations did I have last week, grouped by area and matter".
3. **Per-area vocabulary drift.** `MattersLanding` hard-codes `<h1>Matters</h1>`. Privacy / Regulatory / AI Governance read more naturally as "Programmes" — GDPR, NIS2, DORA, AI Act compliance are ongoing programmes, not matter-shaped cases.

Goose's native primitives already cover most of this if we wire them right: `sessions.db` is keyed on `working_dir` (NOT NULL, queryable in memory); the Memory MCP creates `.goose/memory/` only on agent write (`crates/goose-mcp/src/memory/mod.rs:216-217`) and silently falls back to global memory when the local dir is absent (`mod.rs:189,239`); Top of Mind reads `GOOSE_MOIM_MESSAGE_FILE` every turn and emits nothing when the file is empty (`tom.rs:81-86`).

## Decision

Three coupled decisions, all UI/TS layer — no Rust core touch, no schema additions.

### D1 — Unscoped working_dir at `~/Documents/Oscar GC/.quick-chats/`

A dedicated, dot-hidden scratch directory under the Oscar root. Every unscoped session is created with this as its `working_dir`. `main.ts` ensures the directory exists at IPC time (idempotent `fs.mkdir({ recursive: true })`) and exposes the absolute path to the renderer via `oscar:quick-chats:ensure-dir` / `oscar:quick-chats:get-dir`.

Rationale:

- **Same volume as matters** — keeps working_dir resolution consistent with split-disk-layout (ADR-047). The Memory MCP's `extract_working_dir_from_meta` reads `agent-working-dir` from MCP meta on every tool call; a real path keeps the contract.
- **Memory MCP lazy-creation makes the dir safe** — reads no-op when `.goose/memory/` is absent; writes lazily create. An unscoped session that never asks the agent to `remember_memory(is_global:false)` leaves the directory empty. If the agent does write locally, it stays in `.quick-chats/.goose/memory/` and doesn't shadow matter folders.
- **Top of Mind stays empty** — quick-chat startup calls the existing `oscar:matters:detach-active` IPC, which truncates `tom-active-matter.md`. Native ToM behaviour returns `None` when the file is empty (`tom.rs:81-86`); no per-turn injection.
- **Dot-hidden** — kept out of Finder/file-manager view by convention, so the user doesn't see it next to their matter folders.

Alternatives rejected: Oscar root (`~/Documents/Oscar GC/`) would risk an agent-written `.goose/memory/` shadowing per-matter memory in sibling folders; `os.tmpdir()` would orphan working_dir paths across reboots; `~` would conflict with any CLI-side `~/.goose/memory/`.

### D2 — Sidebar replaces the flat practice-area list with a grouped tree

`OscarSidebar` becomes:

```
+ New chat                 (QuickChatButton, sidebar variant)
> Forge
> Integrations

Quick chats
  · <session-name>          ← sessions with working_dir under .quick-chats/
  ...

Practice areas
  v 01  Commercial          ← expandable; clicking title navigates to /practice/commercial
     · Acme — MSA renewal   ← matter rows; click opens the matter (existing flow)
        · <session-name>    ← bound session; click resumes
     ...
  > 02  Commercial Disputes
  ...

Settings                    (footer, unchanged)
```

All 13 practice areas always render. Each area carries a chevron only when it has matters. Matters with no bound session render the matter row alone; clicking the row goes through the existing `openMatter` flow which creates and binds. Quick chats group renders only when ≥1 quick-chat session exists.

Implementation: a `useChatHistory` hook joins `listSessions()` + parallel `window.electron.matters.list(areaId)` calls + `usePracticeAreas()`. The list is filtered into a Quick chats group (working_dir starts with the quick-chats path) and per-area groups (matter rows whose `session_id` matches a session id). `PracticeAreaPlaceholder.tsx` does **not** gain a Sessions tab — the sidebar carries that responsibility, no duplication.

### D3 — Quick chat button: sidebar header AND Hub home

Two placements:

- **Sidebar header** (above Forge): persistent, one click from any view.
- **Hub home** (`/`): two CTAs below the existing subtitle — "Start a quick chat" + "Browse practice areas". Hub today has zero action buttons; this is the first-launch entry.

Single component `QuickChatButton` with `variant: 'sidebar' | 'hub'` driving copy/styling. Onclick path: `oscar:matters:detach-active` (truncate ToM) → `oscar:quick-chats:ensure-dir` (mkdir + return absolute path) → `createSession(quickChatsDir)` with no recipe (server falls back to enabled extensions from `config.yaml` per `extensions.rs:125-143`) → dispatch `ADD_ACTIVE_SESSION` → navigate to `/pair?resumeSessionId=...`.

### D4 — Per-area entry noun (Matter vs Programme)

`PracticeAreaShape` gains an additive field:

```ts
entryNoun: { singular: string; plural: string };
```

Default `Matter / Matters`. Per the 13-area assignment:

| Area | Noun | Rationale |
|---|---|---|
| Commercial, Commercial Disputes, Corporate, Employment, Employment Disputes, IP, IP Disputes, Regulatory Disputes, Product, CoSec | Matter / Matters | Case-shaped or transactional work; Disputes especially (lawyer's own framing per Sprint 19 brief) |
| Privacy | Programme / Programmes | DSRs / DPIAs / vendor DPAs / regulator inquiries map onto ongoing programmes (GDPR, CCPA) |
| Regulatory | Programme / Programmes | Brief explicitly names — regulator-named programmes (NIS2, DORA, sectoral regimes) |
| AI Governance | Programme / Programmes | AI Act / model risk / framework alignment — ongoing governance |

Forge-created areas pick their own noun. `forge/systemPrompt.ts` instructs the agent to ask the lawyer "Are work units in this area more naturally called Matters (case-shaped) or Programmes (ongoing)?" when creating a new area, and persist the choice in the area's shape. Default Matter when the agent doesn't elicit a preference.

`MattersLanding` and `NewMatterDialog` consume `shape.entryNoun` for the title, the "New X" button, and the empty-state copy. No 13-way switch in code — the variation is data, consistent with ADR-047's "config-driven renderer" stance.

## Rationale

- **Lean on native Goose, add no storage.** Sessions stay in `sessions.db`. Memory MCP's lazy-creation gives per-matter memory for free and unscoped global-only for free. No schema additions, no new tables, no Rust touch.
- **Working_dir is the partition key.** It's already NOT NULL on every session row; it already drives Memory scope and oscar-fs scope; using it to partition the sidebar (Quick chats vs matter-bound) is the cheapest correct join.
- **Sidebar grouping over a separate "Sessions" route.** The brief asks for minimum hierarchy; a parallel `/sessions` route would be the wrong shape. The PA → Matter → Session tree is the lawyer's mental model; surfacing it in one place avoids navigation duplication.
- **`.quick-chats/` as a real working_dir, not a special-case null.** Goose's session schema treats `working_dir TEXT NOT NULL` as load-bearing; nothing special-cases empty/missing values. A real dedicated path keeps every downstream primitive consistent.
- **Two button placements over one.** Sidebar header serves the within-app flow; Hub serves first-launch. Both are cheap; preferring one would force a worse cold-start or a worse in-app flow.

## Consequences

- **`PracticeAreaShape` gains an additive field.** All 13 areas update; the field is required (no `?:`) so the type system catches any new area without a noun. Forge-created areas get the prompt to pick one.
- **OscarSidebar grows a tree** (replaces the flat list). File creep: extract `ChatHistoryTree` into its own component; if it pushes past 300 lines, split into a small `SidebarSessionRow` helper.
- **No "Sessions in this matter" view today.** `matters.json[slug].session_id` is single-valued (ADR-038); one matter ↔ one session. Future multi-session-per-matter would require schema additions; out of scope.
- **No promote-unscoped-to-matter.** Useful future workflow (an exploratory chat that becomes load-bearing); tracked in TODO.md as a follow-up.
- **The quick-chats group can grow unbounded.** Lawyers who quick-chat often will accumulate sessions; native Goose session UX (rename, delete, archive) handles this. Optional future enhancement: a "Show all" affordance / archive policy. Out of scope.
- **Local-memory writes inside quick chats are the user's choice.** The agent's `remember_memory(is_global:false)` is described as "project-specific" in the tool docs; an unscoped chat that writes locally will leave a `.goose/memory/` under `.quick-chats/`. We accept this — the agent's behaviour matches its tool description, and the user can still explicitly ask for global memory.
- **ToM truncates on quick chat.** Already supported by `oscar:matters:detach-active`. Re-using that IPC means the matter→quick-chat→matter cycle behaves correctly without new state.

## Supersedes

None. Companion to [[ADR-038]] (one matter ↔ one session), [[ADR-044]] (Top of Mind matter context — quick chat truncates the same file), [[ADR-047]] (split-disk layout — `.quick-chats/` lives on the same `~/Documents/Oscar GC/` volume).
